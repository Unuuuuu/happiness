# /work-scan 스킬 설계

## 목적

Linear/GitHub에서 수집된 업무 맥락 데이터를 분석하여 해결 가능한 포인트를 발견하고, `/surface` 스킬로 연결하여 구체적 문제 정의까지 이어지게 한다.

## 스킬 파이프라인

```
/work-scan (데이터 기반 문제 후보 발견)
    ↓ 사용자가 포인트 선택
/surface (선택한 포인트를 구체적 문제로 정의)
    ↓
/lookup (5계층 중 해결 방식 결정)
    ↓
구현
```

`/work-scan`은 `/surface`의 데이터 기반 상위 진입점이다. 기존 `/surface`가 대화로 삶의 영역을 탐색했다면, `/work-scan`은 실제 작업 데이터에서 패턴을 읽어 문제 후보를 먼저 제시한다.

## 실행 흐름

1. **데이터 수집** — 맥락 조회 API 호출 (`GET https://unu.unuuuuu.com/webhook/get-my-context?days=14`)
2. **현황 요약** — 소스별/상태별 분류 출력
3. **패턴 분석** — Claude가 다음 패턴을 탐지:
   - 장기 체류 이슈 (7일 이상 같은 상태)
   - 리뷰 대기 PR
   - 활동 집중/공백 영역
   - 우선순위 높은데 진전 없는 항목
4. **제안** — 2-3개 액션 포인트 제시
5. **연결** — 사용자가 포인트 선택 시 `/surface` 호출

## 접근법: Claude Code 스킬 단독

- 스킬이 조회 API를 HTTP로 호출하고, Claude가 반환된 Markdown을 직접 분석
- 별도 n8n AI 노드나 API 수정 불필요
- Claude의 추론 능력으로 패턴 분석 + 제안 생성
- 대화형으로 후속 질문/탐색 가능

## 결과물 구조

```
[1] 현황 요약 — "Linear 이슈 5건 진행중, GitHub PR 3건 오픈"
[2] 패턴 관찰 — "HAP-12가 10일째 In Progress, 우선순위 높은데 진전 없음"
[3] 제안 — "이 부분을 /surface로 파보는 건 어떨까?"
```

## Hard Gate

- 반드시 조회 API를 호출한 후 분석 (데이터 없이 추측 금지)
- 제안은 최대 3개로 제한
- `/surface` 연결은 사용자 선택 후에만

## 기존 스킬과의 차이

| | `/surface` | `/work-scan` |
|---|---|---|
| 입력 | 사용자의 막연한 불편함 | Linear/GitHub 실제 데이터 |
| 탐색 방법 | 대화로 삶의 영역 탐색 | 데이터 패턴 분석 |
| 연결 | → `/lookup` | → `/surface` → `/lookup` |

## 구현 범위

**필요:**
- `.claude/skills/work-scan/SKILL.md` 생성

**불필요 (YAGNI):**
- 조회 API 수정 (현재 Markdown 반환으로 충분)
- 별도 MCP 도구 등록
- DB 스키마 변경
- 새 n8n 워크플로우

## 기술 스택

- Claude Code 스킬 (5계층)
- 기존 맥락 조회 API (4계층 n8n 워크플로우, ID: NJu5CxFmsq3VXoii)
- 조회 URL: `https://unu.unuuuuu.com/webhook/get-my-context`
