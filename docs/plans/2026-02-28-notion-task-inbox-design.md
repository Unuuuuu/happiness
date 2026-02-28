# Notion 기반 할일/일정 통합 관리 시스템 설계

> 작성일: 2026-02-28
> 계층: Layer 4 (n8n 워크플로우)
> 상태: 설계 승인됨

---

## 1. 문제 정의

삶에서 발생하는 할일과 일정을 **텔레그램 자연어 입력**으로 Notion에 즉시 기록하고, 조회/완료/수정/삭제까지 텔레그램 안에서 처리한다. Notion 앱을 열지 않아도 되는 **제로 마찰 캡처**가 핵심 가치다.

## 2. 핵심 전략: 기존 워크플로우 활용

처음부터 만들지 않는다. **[n8n Workflow #4142](https://n8n.io/workflows/4142-ai-powered-telegram-task-assistant-with-notion-integration/)**를 베이스로 가져와 커스터마이징한다.

### #4142가 이미 제공하는 것

- Telegram Trigger + 음성/텍스트 분기
- OpenAI Whisper 음성 전사
- AI Agent + Tool Calling 아키텍처
- Notion Tool (list, add, complete/uncomplete, update timing)
- 대화 메모리 (컨텍스트 유지)

### 추가 참고 워크플로우

| 워크플로우 | 참고 포인트 |
|---|---|
| [#4186: Todoist + GPT-4o](https://n8n.io/workflows/4186-natural-language-task-management-with-todoist-and-gpt-4o/) | Orchestrator → Executor 2단계 구조, 15+ 엔드포인트 Tool 설계 |
| [#9271: Gemini + Approvals](https://n8n.io/workflows/9271-extract-tasks-from-telegram-messages-to-notion-using-gemini-ai-and-approvals/) | 삭제/완료 시 Approval 버튼 패턴 |
| [#8237: Personal Life Manager](https://n8n.io/workflows/8237-personal-life-manager-with-telegram-google-services-and-voice-enabled-ai/) | Calendar + Gmail 확장 시 참고 |
| [n8n-notion-advanced-node](https://github.com/AZ-IT-US/n8n-notion-advanced-node) | 기본 Notion 노드보다 강력한 CRUD + AI Agent Tool 지원 |

## 3. 아키텍처

```
[Telegram] ── 텍스트/음성 ──→ [n8n Workflow]
                                    │
                              ┌─────┴─────┐
                              │ 음성 분기   │
                              │ → Whisper  │
                              └─────┬─────┘
                                    ↓
                            [AI Agent (LLM)]
                             ├─ Memory: PostgreSQL (session_key = chat_id)
                             ├─ System Prompt (한국어)
                             │
                             ├─ Tool: search_tasks
                             ├─ Tool: create_task
                             ├─ Tool: update_task
                             ├─ Tool: complete_task
                             ├─ Tool: delete_task (+ Approval 확인)
                             └─ Tool: query_tasks
                                    ↓
                            [Telegram 응답]
```

### 아키텍처 결정 근거

**Intent Classifier + Switch 분기가 아니라, AI Agent가 Tool을 직접 선택하는 패턴을 사용한다.**

- n8n 생태계의 표준 패턴 (조사한 10개+ 워크플로우 모두 이 구조)
- 새 액션 추가 = Tool 추가만으로 가능 (Switch 분기 수정 불필요)
- 검색 → 확인 → 실행의 멀티스텝을 AI Agent가 자동 체이닝
- n8n의 `$fromAI()` 함수로 Tool 파라미터를 LLM이 동적으로 채움

### n8n 알려진 이슈 및 대응

| 이슈 | 대응 |
|---|---|
| Sub-node 표현식이 첫 번째 아이템만 참조 ([#18859](https://github.com/n8n-io/n8n/issues/18859)) | 복잡한 CRUD는 서브 워크플로우(Call n8n Workflow Tool)로 감싸기 |
| 같은 프롬프트에 비결정적 결과 ([#19100](https://github.com/n8n-io/n8n/issues/19100)) | 한 번에 하나의 아이템만 처리하도록 시스템 프롬프트에 명시 |
| `$fromAI()` 이중 호출 버그 | Notion Create Database Page 대신 HTTP Request 또는 서브 워크플로우 사용 |
| Simple Memory 재시작 시 소실 | Phase 3에서 PostgreSQL Memory로 교체 |

## 4. 5개 액션 (Tool 정의)

### 액션 선정 근거

- Todoist Sync API도 `complete`를 `update`와 분리 (부수효과가 다르므로)
- 모든 유사 시스템이 query/list를 별도 지원
- v1에서 5개면 충분 (리서치 결과 확인됨)

### Tool 상세

| Tool | 입력 | 동작 | 출처 |
|---|---|---|---|
| **create_task** | title, area, priority, deadline, type, event_start, event_end | Notion DB에 페이지 생성 | #4142 기본 포함 |
| **complete_task** | page_id 또는 keyword | 상태를 '완료'로 변경 | #4142 기본 포함 |
| **update_task** | page_id 또는 keyword + 변경할 필드 | 속성 수정 (시간, 우선순위 등) | #4142 일부 포함, 확장 필요 |
| **delete_task** | page_id 또는 keyword | Notion 페이지 아카이브 | 추가 구현 + Approval 패턴 |
| **query_tasks** | date_range, area, status | 필터된 목록 반환 | #4142 list 확장 |

### Entity Resolution (대상 식별) 패턴

모든 수정/삭제/완료 Tool은 내부에서 다음 흐름을 탄다:

```
keyword로 Notion DB 검색
    ↓
┌─── 0개 매칭 → "관련 항목을 찾을 수 없어요"
├─── 1개 매칭 → 바로 실행 + 확인 메시지
└─── 2개+ 매칭 → 번호 매긴 선택지 제시
         [1] 🦷 치과 정기검진 (3/5)
         [2] 🦷 치과 스케일링 예약 (3/12)
         [취소]
```

시스템 프롬프트에 명시: "여러 항목이 매칭되면 번호를 매겨 사용자에게 제시하고, 사용자가 선택할 때까지 기다려라."

메모리가 있어야 "2번" 같은 후속 응답을 이해할 수 있으므로, 대화 메모리가 전제조건이다.

### delete 안전장치

delete Tool은 Telegram Inline Keyboard 버튼으로 최종 확인을 받는다 (#9271 Approval 패턴 참고):

```
Bot: "'치과 정기검진 (3/5)' 항목을 삭제할까요?"
     [삭제] [취소]
```

## 5. Notion DB 스키마

| 속성 | 타입 | 값 | 비고 |
|---|---|---|---|
| 제목 | Title | 자유 텍스트 | 필수 |
| 타입 | Select | 할일 / 일정 / 메모 | AI가 자동 분류 |
| 영역 | Select | 건강, 재정, 업무, 가정, 자기개발, 이동, 관계 | AI가 자동 분류 |
| 우선순위 | Select | P1(긴급) / P2(중요) / P3(보통) | 기본값 P3 |
| 상태 | Status | 대기 / 진행중 / 완료 | 기본값 대기 |
| 마감일 | Date | nullable | 할일용 |
| 일정시작 | Date (with time) | nullable | 일정용 |
| 일정종료 | Date (with time) | nullable | 일정용 |

## 6. 시스템 프롬프트 방향

한국어로 작성. 핵심 규칙:

- 사용자 메시지에서 타입, 영역, 우선순위를 자동 추론
- 명시되지 않은 속성은 합리적 기본값 사용 (우선순위 → P3, 타입 → 문맥에서 추론)
- 여러 항목 매칭 시 번호 목록으로 제시, 사용자 선택 대기
- 삭제 전 반드시 확인 요청
- 응답은 간결하게 (확인 메시지 1-2줄)
- 한 번에 하나의 아이템만 처리

## 7. 단계별 출시

### Phase 1: #4142 즉시 적용

- n8n에 #4142 워크플로우 import
- Telegram Bot credential 연결
- Notion DB credential + DB ID 연결
- OpenAI API key 연결
- 바로 사용 가능: add, list, complete, update timing
- **이것만으로 일상 태스크 관리의 ~80% 커버**

### Phase 2: 커스터마이징

- Notion DB 스키마를 위 설계에 맞게 조정 (영역, 우선순위, 타입 등 속성 추가)
- 시스템 프롬프트 한국어화 + 우리 규칙 반영
- delete Tool 추가 (Approval 패턴 포함)
- query Tool 고도화 (날짜 범위, 영역 필터)
- create_task에 영역/우선순위 자동 추론 로직 추가

### Phase 3: 프로덕션 안정화 및 확장

- 메모리를 PostgreSQL로 교체 (프로덕션 안정성)
- 복잡한 Tool을 서브 워크플로우(Call n8n Workflow Tool)로 분리
- Google Calendar Tool 추가 (일정 동기화)
- MCP 브리지로 Layer 5 (Claude Code) 연결

## 8. v1 범위 밖 (의도적 제외)

| 기능 | 제외 이유 |
|---|---|
| 반복 일정 | Notion DB 속성 + 스케줄링 복잡도 급증. Google Calendar로 대체 가능 |
| 직전 입력 정정 ("아 그거 아니고...") | 대화 컨텍스트 유지 필요 → "수정"으로 명시적으로 말하도록 유도 |
| 일괄 처리 ("이번 주 할 일 전부 다음 주로") | 조회 + 루프 수정 → 복잡. 하나씩 처리 |
| snooze / 리마인더 | 별도 리마인더 시스템 필요 |
| undo ("방금 한 거 취소") | 상태 관리 복잡도. 대신 delete/update로 수동 복구 |

## 9. 리서치 기반 현실 기대치

- **Todoist Ramble**(프로덕션 음성→태스크 제품)의 end-to-end 성공률이 ~62%
- 자연어→구조화 변환은 완벽하지 않음을 전제로, **Approval 패턴**과 **간결한 확인 메시지**로 보완
- Phase 1에서 빠르게 시작하고, 실사용 피드백으로 점진적 개선

## 10. 참고 자료

- [n8n Workflow #4142: AI Telegram Task Assistant + Notion](https://n8n.io/workflows/4142-ai-powered-telegram-task-assistant-with-notion-integration/)
- [n8n Workflow #4186: Natural Language Task Management + Todoist](https://n8n.io/workflows/4186-natural-language-task-management-with-todoist-and-gpt-4o/)
- [n8n Workflow #9271: Gemini AI + Approvals](https://n8n.io/workflows/9271-extract-tasks-from-telegram-messages-to-notion-using-gemini-ai-and-approvals/)
- [n8n Workflow #11817: Notion To-Do + Voice + OpenAI](https://n8n.io/workflows/11817-manage-notion-to-do-tasks-via-telegram-with-voice-messages-and-openai/)
- [n8n Workflow #8237: Personal Life Manager](https://n8n.io/workflows/8237-personal-life-manager-with-telegram-google-services-and-voice-enabled-ai/)
- [n8n AI Agent Node Docs](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.agent/tools-agent/)
- [n8n-notion-advanced-node](https://github.com/AZ-IT-US/n8n-notion-advanced-node)
- [Todoist Sync API v9](https://developer.todoist.com/sync/v9)
- [Vellum: LLM Intent Classification](https://www.vellum.ai/blog/how-to-build-intent-detection-for-your-chatbot)
- 프로젝트 내 리서치 기록:
  - `docs/lookups/2026-02-28-n8n-ai-agent-연구.md`
  - `docs/lookups/2026-02-28-텔레그램-AI-노션-기존시스템-조사.md`
