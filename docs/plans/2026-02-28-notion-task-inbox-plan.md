# Notion 기반 할일/일정 통합 관리 시스템 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 텔레그램 자연어 입력으로 Notion에 할일/일정을 즉시 기록하고 관리하는 시스템 구축

**Architecture:** n8n Workflow #4142를 베이스로 import → Notion DB 스키마 커스터마이징 → 시스템 프롬프트 한국어화 → delete/query Tool 확장. AI Agent + Tool Calling 패턴.

**Tech Stack:** n8n (self-hosted, Coolify), Telegram Bot API, Notion API, OpenAI (Whisper + GPT), PostgreSQL (메모리)

**참고 문서:**
- 설계: `docs/plans/2026-02-28-notion-task-inbox-design.md`
- n8n 삽질 기록: `.claude/skills/n8n-gotchas/SKILL.md`
- 리서치: `docs/lookups/2026-02-28-n8n-ai-agent-연구.md`
- 리서치: `docs/lookups/2026-02-28-텔레그램-AI-노션-기존시스템-조사.md`

**도구:** n8n MCP 도구 (`n8n_list_workflows`, `n8n_create_workflow`, `n8n_update_workflow`, `n8n_activate_workflow`, `n8n_get_workflow` 등) 또는 n8n UI. 가능하면 MCP 우선.

---

## Phase 1: #4142 즉시 적용

> 이 Phase만으로 일상 태스크 관리의 ~80% 커버. add, list, complete, update timing 사용 가능.

### Task 1: Notion 태스크 DB 생성

**작업 환경:** Notion 웹/앱

**Step 1: Notion에 새 데이터베이스 생성**

다음 속성으로 "Tasks" 데이터베이스를 만든다:

| 속성 | 타입 | 설정 |
|---|---|---|
| 제목 | Title | (기본) |
| 타입 | Select | 옵션: `할일`, `일정`, `메모` |
| 영역 | Select | 옵션: `건강`, `재정`, `업무`, `가정`, `자기개발`, `이동`, `관계` |
| 우선순위 | Select | 옵션: `P1`, `P2`, `P3` |
| 상태 | Status | 그룹: To-do=`대기`, In progress=`진행중`, Complete=`완료` |
| 마감일 | Date | (include time OFF) |
| 일정시작 | Date | (include time ON) |
| 일정종료 | Date | (include time ON) |

**Step 2: DB ID 기록**

Notion 데이터베이스 URL에서 ID 추출: `https://www.notion.so/<workspace>/<DB_ID>?v=...`
이 ID를 별도로 기록해둔다.

**Step 3: Notion Integration 생성**

- https://www.notion.so/my-integrations 에서 새 Integration 생성
- 이름: `task-inbox-bot`
- Capabilities: Read content, Update content, Insert content
- 생성된 Internal Integration Token 기록
- Tasks DB에 이 Integration을 연결 (Share → Invite)

**검증:** Notion DB에 수동으로 샘플 항목 1개 추가하여 속성이 모두 정상 작동하는지 확인

---

### Task 2: Telegram Bot 생성

**작업 환경:** Telegram

**Step 1: BotFather로 봇 생성**

1. Telegram에서 @BotFather에게 `/newbot` 전송
2. 봇 이름 설정 (예: "Task Inbox")
3. 봇 username 설정 (예: `my_task_inbox_bot`)
4. 발급된 Bot Token 기록

**Step 2: 봇 설정**

BotFather에게 추가 명령:
- `/setdescription` — "자연어로 할일/일정을 관리하는 AI 어시스턴트"
- `/setcommands` — 비워두기 (자연어만 사용)

**검증:** Telegram에서 생성한 봇을 찾아 `/start`를 보내본다 (아직 응답은 없음)

---

### Task 3: n8n에 #4142 워크플로우 import

**작업 환경:** n8n UI

**Step 1: 워크플로우 템플릿 import**

1. n8n UI에서 Workflows → Add workflow → Browse templates
2. "AI-Powered Telegram Task Assistant with Notion Integration" 검색 (또는 직접 URL: https://n8n.io/workflows/4142)
3. "Use this workflow" 클릭하여 import
4. 또는: 템플릿 JSON을 다운로드 → n8n UI에서 Import from file

**Step 2: import된 워크플로우 구조 확인**

- Telegram Trigger 노드 존재 확인
- AI Agent 노드 존재 확인
- Notion Tool 노드 존재 확인
- 음성 처리 노드 존재 확인

**검증:** 워크플로우가 n8n에 표시되고, 모든 노드가 보이는지 확인 (아직 비활성 상태)

---

### Task 4: Credential 연결

**작업 환경:** n8n UI

**Step 1: Telegram credential 등록**

1. n8n Settings → Credentials → Add credential
2. Telegram API 선택
3. Access Token: Task 2에서 받은 Bot Token 입력
4. 저장

**Step 2: Notion credential 등록**

1. Add credential → Notion API 선택
2. Internal Integration Token: Task 1에서 받은 토큰 입력
3. 저장

**Step 3: OpenAI credential 등록**

1. Add credential → OpenAI API 선택
2. API Key 입력
3. 저장

**Step 4: 워크플로우의 각 노드에 credential 연결**

1. Telegram Trigger 노드 → Telegram credential 선택
2. Telegram Send Message 노드(들) → 같은 Telegram credential
3. Notion 관련 노드 → Notion credential 선택 + Database ID를 Task 1의 DB ID로 설정
4. OpenAI/AI Agent 노드 → OpenAI credential 선택
5. Whisper 노드(음성 전사) → OpenAI credential 선택

**Step 5: Notion DB 연결 확인**

Notion Tool 노드에서 Database를 선택할 때, Task 1에서 만든 "Tasks" DB가 목록에 나타나는지 확인

**검증:** 모든 노드에서 credential 경고(빨간 느낌표)가 사라졌는지 확인

---

### Task 5: 워크플로우 활성화 및 기본 테스트

**작업 환경:** n8n UI + Telegram

**Step 1: 워크플로우 활성화**

n8n UI에서 워크플로우 토글을 Active로 변경

> ⚠️ n8n-gotchas 참고: 활성화 후 로그에서 `Activated workflow` 메시지 확인. 없으면 토글 OFF → ON 재시도.

**Step 2: 기본 테스트 — 태스크 추가**

Telegram에서 봇에게 메시지:
```
내일 오후 3시 치과 예약
```

기대 결과: Notion DB에 "치과 예약" 항목이 생성됨

**Step 3: 태스크 목록 조회**

```
할 일 목록 보여줘
```

기대 결과: 현재 Notion DB의 태스크 목록이 텍스트로 반환

**Step 4: 태스크 완료**

```
치과 예약 완료
```

기대 결과: "치과 예약" 항목의 상태가 완료로 변경

**Step 5: 음성 테스트**

Telegram에서 음성 메시지로 "우유 사기 추가해줘" 전송

기대 결과: Whisper로 전사 → "우유 사기" 태스크 생성

**Step 6: 커밋**

Phase 1 완료를 기록한다:

```bash
# happiness 저장소에서
git add -A && git commit -m "docs: Phase 1 완료 — #4142 import 및 기본 동작 확인"
```

**이 시점의 기능 범위:** add, list, complete/uncomplete, update timing, 음성 입력

---

## Phase 2: 커스터마이징

> Notion 스키마에 맞게 확장하고, 한국어 프롬프트 적용, delete/query 고도화

### Task 6: Notion DB 스키마와 Tool 매핑 조정

**작업 환경:** n8n UI

**Step 1: Notion Tool 노드의 속성 매핑 확인**

#4142의 Notion Tool이 어떤 속성을 사용하는지 확인한다:
- 어떤 필드를 create 시 채우는지
- complete 시 어떤 필드를 변경하는지
- list 시 어떤 필드를 반환하는지

**Step 2: 우리 스키마 속성을 Tool에 반영**

Notion Tool 노드에서:
- create 시: 타입, 영역, 우선순위, 마감일, 일정시작, 일정종료 필드 추가
- list 시: 반환 포맷에 영역, 우선순위 포함
- complete 시: 상태를 "완료"로 변경 (Status 타입의 올바른 옵션명 사용)

> ⚠️ n8n-gotchas 참고: `updateNode`는 파라미터를 덮어쓰므로, 항상 전체 parameters를 보내야 한다.

**Step 3: 테스트**

```
업무 관련으로 P1 긴급 — 내일까지 분기 보고서 작성
```

기대 결과: Notion에 제목="분기 보고서 작성", 영역=업무, 우선순위=P1, 마감일=내일 로 생성

**검증:** Notion DB에서 모든 속성이 올바르게 채워졌는지 확인

---

### Task 7: 시스템 프롬프트 한국어화

**작업 환경:** n8n UI (AI Agent 노드의 System Prompt)

**Step 1: 현재 시스템 프롬프트 백업**

AI Agent 노드의 System Message 내용을 복사하여 기록

**Step 2: 한국어 시스템 프롬프트 작성**

다음 규칙을 포함하는 시스템 프롬프트로 교체:

```
당신은 한국어로 소통하는 할일/일정 관리 어시스턴트입니다.

## 역할
사용자의 자연어 메시지를 해석하여 Notion 데이터베이스에 할일과 일정을 관리합니다.

## 자동 추론 규칙
- 타입: 시간이 명시되면 "일정", 없으면 "할일", 정보성이면 "메모"
- 영역: 메시지 내용에서 자동 추론 (건강/재정/업무/가정/자기개발/이동/관계)
- 우선순위: 명시되지 않으면 P3. "긴급/급한"→P1, "중요한"→P2
- 상태: 새 항목은 항상 "대기"

## 대상 식별 (수정/삭제/완료 시)
- 키워드로 Notion DB를 검색하여 대상을 찾는다
- 1개 매칭: 바로 실행하고 확인 메시지 반환
- 2개+ 매칭: 번호를 매겨 목록으로 제시하고, 사용자가 선택할 때까지 기다린다
- 0개 매칭: "관련 항목을 찾을 수 없어요"

## 응답 규칙
- 간결하게 1-2줄로 응답
- 한 번에 하나의 아이템만 처리
- 삭제 전에는 반드시 확인 요청

## 현재 시간 정보
현재 날짜: {{현재 날짜}}
현재 요일: {{현재 요일}}
현재 시간: {{현재 시간}}
```

> ⚠️ n8n-gotchas 참고: 상대 시간 파싱을 위해 현재 날짜+시간+요일을 모두 프롬프트에 포함해야 한다. n8n 표현식 사용:
> ```
> 현재 날짜: {{ $now.setZone('Asia/Seoul').toISODate() }}
> 현재 요일: {{ $now.setZone('Asia/Seoul').toFormat('cccc') }}
> 현재 시간: {{ $now.setZone('Asia/Seoul').toFormat('HH:mm') }}
> ```

**Step 3: 테스트**

여러 패턴으로 테스트:
- `치과 3/5 오후 2시` → 타입=일정, 영역=건강 자동 추론
- `세금 신고 이번 달까지` → 타입=할일, 영역=재정 자동 추론
- `오늘 뭐 있어?` → 오늘 일정/할일 목록 반환
- `치과 완료` → 상태를 완료로 변경

**검증:** 각 테스트에서 AI가 한국어로 응답하고, 속성이 올바르게 자동 추론되는지 확인

---

### Task 8: delete Tool 추가 (Approval 패턴)

**작업 환경:** n8n UI

**Step 1: 현재 워크플로우에 delete 기능이 있는지 확인**

#4142는 delete를 지원하지 않으므로 새 Tool을 추가해야 한다.

**Step 2: 시스템 프롬프트에 삭제 규칙 추가**

시스템 프롬프트에 추가:
```
## 삭제 처리
- 사용자가 삭제를 요청하면, 먼저 대상을 검색한다
- 대상을 찾으면 "'{제목}'을 삭제할까요?"라고 확인을 요청한다
- 사용자가 "네", "삭제", "응" 등으로 확인하면 삭제를 실행한다
- 사용자가 "아니오", "취소" 등으로 거부하면 삭제하지 않는다
```

**Step 3: Notion 삭제(아카이브) Tool 노드 추가**

AI Agent에 새 Tool을 연결한다:
- Notion 노드: Operation = "Archive a Page"
- `$fromAI()`로 page_id를 동적으로 받음
- 또는 HTTP Request Tool로 Notion API 직접 호출:
  ```
  PATCH https://api.notion.com/v1/pages/{page_id}
  Body: { "archived": true }
  ```

> ⚠️ n8n-gotchas 참고: 검색→삭제 멀티스텝이므로, AI Agent가 먼저 검색 Tool로 page_id를 얻고, 그 결과를 삭제 Tool에 전달하는 체이닝이 필요. 시스템 프롬프트에 이 흐름을 명시한다.

**Step 4: 테스트**

```
우유 사기 삭제해줘
```

기대 흐름:
1. AI가 "우유 사기" 검색 → 1개 매칭
2. "'우유 사기' 항목을 삭제할까요?" 확인 메시지
3. 사용자: "응"
4. Notion에서 아카이브 처리
5. "삭제했습니다" 확인 메시지

**검증:** Notion DB에서 해당 항목이 아카이브(휴지통)로 이동했는지 확인

---

### Task 9: query Tool 고도화

**작업 환경:** n8n UI

**Step 1: 현재 list 기능 분석**

#4142의 list가 어떤 필터를 지원하는지 확인한다 (전체 목록만? 날짜 필터? 상태 필터?)

**Step 2: query 기능 확장**

시스템 프롬프트에 쿼리 패턴 추가:
```
## 조회 처리
다음 패턴의 질문에 응답한다:
- "오늘 뭐 있어?" → 오늘 마감/일정 필터
- "이번 주 할 일" → 이번 주 범위 필터
- "업무 관련 할 일" → 영역=업무 필터
- "P1 긴급 항목" → 우선순위=P1 필터
- "완료 안 된 것들" → 상태≠완료 필터
```

Notion 검색 Tool에 필터 파라미터를 추가한다:
- date 범위 (오늘, 이번 주, 이번 달)
- 영역 필터
- 우선순위 필터
- 상태 필터 (완료 제외/포함)

**Step 3: 테스트**

- `오늘 할 일 뭐 있어?` → 오늘 마감 항목만 반환
- `업무 관련 할 일` → 영역=업무인 항목만 반환
- `이번 주 일정` → 이번 주 일정시작이 있는 항목 반환

**Step 4: 커밋**

```bash
git add -A && git commit -m "docs: Phase 2 완료 — 한국어 프롬프트, delete/query 확장"
```

**검증:** 각 쿼리 패턴에서 올바른 필터 결과가 반환되는지 확인

---

## Phase 3: 프로덕션 안정화

> 메모리 영속화, 서브 워크플로우 분리, 안정성 향상

### Task 10: PostgreSQL 메모리로 교체

**작업 환경:** n8n UI + Coolify (PostgreSQL)

**Step 1: PostgreSQL 접속 정보 확인**

Coolify에서 n8n이 사용하는 PostgreSQL (또는 별도 PostgreSQL) 접속 정보 확인:
- Host, Port, Database, User, Password

**Step 2: n8n에 PostgreSQL credential 등록**

Settings → Credentials → Add → PostgreSQL

**Step 3: AI Agent 메모리 노드 교체**

1. 현재 Simple Memory (또는 Window Buffer Memory) 노드를 제거
2. Postgres Chat Memory 노드 추가
3. Session Key = `{{ $json.message.chat.id }}` (Telegram chat ID)
4. Window Size = 10 (멀티스텝 대화를 위해)
5. PostgreSQL credential 연결

**Step 4: 테스트 — 멀티턴 대화**

```
사용자: 치과 삭제해줘
봇: 두 개 항목을 찾았어요:
    1. 치과 정기검진 (3/5)
    2. 치과 스케일링 (3/12)
    어떤 것을 삭제할까요?
사용자: 2번
봇: '치과 스케일링 (3/12)'을 삭제할까요?
사용자: 응
봇: 삭제했습니다.
```

**검증:**
1. n8n 재시작 후에도 이전 대화 컨텍스트가 유지되는지 확인
2. 번호 선택("2번")이 올바르게 해석되는지 확인

---

### Task 11: 복잡한 Tool을 서브 워크플로우로 분리

**작업 환경:** n8n UI

**Step 1: 분리할 Tool 식별**

다음 Tool은 멀티스텝 로직이므로 서브 워크플로우로 분리한다:
- `delete_task`: 검색 → 확인 → 아카이브
- `update_task`: 검색 → 대상 확인 → 업데이트

> ⚠️ n8n-gotchas 참고: Sub-node 표현식이 첫 번째 아이템만 참조하는 버그([#18859](https://github.com/n8n-io/n8n/issues/18859)) 때문에, 복잡한 CRUD는 서브 워크플로우로 감싸는 것이 안전하다.

**Step 2: 서브 워크플로우 생성**

각 서브 워크플로우 구조:
```
[Execute Workflow Trigger] → [Notion DB Query] → [결과 처리 Code] → [Notion Update/Archive] → [결과 반환]
```

**Step 3: 메인 워크플로우의 Tool 노드를 "Call n8n Workflow" Tool로 교체**

AI Agent에 연결된 직접 Notion 노드 대신, "Call n8n Workflow Tool" 노드를 사용하여 서브 워크플로우를 호출한다.

**Step 4: 테스트**

기존 테스트 시나리오를 모두 재실행하여 동일하게 동작하는지 확인:
- 추가, 조회, 완료, 수정, 삭제 각 1회씩

**Step 5: 커밋**

```bash
git add -A && git commit -m "docs: Phase 3 완료 — PostgreSQL 메모리, 서브 워크플로우 분리"
```

---

### Task 12: 종합 테스트 및 문서 정리

**작업 환경:** Telegram + n8n + happiness 저장소

**Step 1: End-to-end 테스트 시나리오 실행**

| # | 입력 | 기대 동작 | 확인 |
|---|---|---|---|
| 1 | `내일 오후 2시 치과` | 일정 생성 (영역=건강, 일정시작=내일 14:00) | |
| 2 | `이번 주까지 세금 신고 P1` | 할일 생성 (영역=재정, 우선순위=P1, 마감일=이번 주 금요일) | |
| 3 | `오늘 뭐 있어?` | 오늘 일정/할일 목록 반환 | |
| 4 | `치과 완료` | 상태→완료 | |
| 5 | `세금 신고 다음 주로 미뤄줘` | 마감일 변경 | |
| 6 | `세금 신고 삭제` | 확인 질문 → 승인 → 아카이브 | |
| 7 | (음성) "장보기 추가해줘" | 음성→텍스트→할일 생성 | |
| 8 | `이번 주 업무 할 일` | 영역=업무 + 이번 주 필터 | |

**Step 2: n8n-gotchas 업데이트**

구현 중 발견한 새로운 삽질이 있으면 `.claude/skills/n8n-gotchas/SKILL.md`에 추가한다.

**Step 3: 최종 커밋 및 푸시**

```bash
git add -A && git commit -m "feat: Notion 기반 할일/일정 통합 관리 시스템 구축 완료"
git push -u origin claude/general-session-6e1Gy
```

---

## Phase별 예상 소요

| Phase | Task | 내용 |
|---|---|---|
| **Phase 1** | Task 1-5 | Notion DB + Telegram Bot + #4142 import + 기본 동작 확인 |
| **Phase 2** | Task 6-9 | 스키마 매핑, 한국어 프롬프트, delete/query 확장 |
| **Phase 3** | Task 10-12 | PostgreSQL 메모리, 서브 워크플로우, 종합 테스트 |

## 의존성 그래프

```
Task 1 (Notion DB) ──┐
Task 2 (Telegram Bot) ├── Task 3 (Import) → Task 4 (Credentials) → Task 5 (Activate)
                      │                                                      ↓
                      │                                              Task 6 (스키마 매핑)
                      │                                                      ↓
                      │                                              Task 7 (한국어 프롬프트)
                      │                                                      ↓
                      │                                    ┌── Task 8 (delete) ──┐
                      │                                    └── Task 9 (query) ───┤
                      │                                                          ↓
                      │                                              Task 10 (PostgreSQL)
                      │                                                          ↓
                      │                                              Task 11 (서브 워크플로우)
                      │                                                          ↓
                      └──────────────────────────────────────────── Task 12 (종합 테스트)
```

Task 1과 Task 2는 병렬 실행 가능. Task 8과 Task 9도 병렬 실행 가능.
