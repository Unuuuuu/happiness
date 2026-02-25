# lookup 스킬 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 삶의 문제를 입력하면 5가지 해결 방식 중 적합한 것을 추천하는 Claude Code 스킬 생성

**Architecture:** `.claude/skills/lookup/SKILL.md`에 스킬 정의. 판단 기준 4가지로 질문 → 추천 + 근거 → `docs/lookups/`에 기록 저장 → 다음 단계 안내. 상세 해결 방식 정보는 `references/solution-approaches.md`에 분리.

**Tech Stack:** Claude Code skill (Markdown + YAML frontmatter)

---

### Task 1: 스킬 디렉토리 구조 생성

**Files:**
- Create: `.claude/skills/lookup/SKILL.md` (빈 파일로 시작)
- Create: `.claude/skills/lookup/references/solution-approaches.md` (빈 파일로 시작)
- Create: `docs/lookups/.gitkeep`

**Step 1: 디렉토리 생성**

```bash
mkdir -p .claude/skills/lookup/references
mkdir -p docs/lookups
touch docs/lookups/.gitkeep
```

**Step 2: 확인**

```bash
ls -la .claude/skills/lookup/
ls -la docs/lookups/
```

Expected: 디렉토리가 존재하고, `.gitkeep` 파일이 있음

**Step 3: Commit**

```bash
git add .claude/skills/lookup docs/lookups/.gitkeep
git commit -m "chore: lookup 스킬 디렉토리 구조 생성"
```

---

### Task 2: references/solution-approaches.md 작성

**Files:**
- Create: `.claude/skills/lookup/references/solution-approaches.md`

**Step 1: 해결 방식 레퍼런스 파일 작성**

5가지 해결 방식의 상세 정보를 담은 레퍼런스 파일. SKILL.md에서 참조하여 추천 근거를 생성할 때 사용.

```markdown
# 해결 방식 레퍼런스

## 1. launchd + 셸 스크립트

### 적합한 경우
- 단순 반복 작업 (매일/매주 스케줄)
- AI 추론 불필요
- 사람 개입 불필요
- 외부 서비스 연동 없거나 단순 (curl로 충분)

### 부적합한 경우
- 복잡한 조건 분기가 필요할 때
- 여러 외부 서비스를 연결해야 할 때
- AI 판단이 필요할 때

### 특성
- macOS 네이티브, 의존성 없음
- Mac 잠자기 상태에서 깨어날 때 밀린 작업 실행
- ~/Library/LaunchAgents/에 plist 파일로 설정
- 디버깅이 단순 (로그 파일 확인)

### 다음 단계
- ~/Library/LaunchAgents/com.user.<이름>.plist 파일 작성
- 셸 스크립트를 ~/Scripts/ 또는 프로젝트 내 scripts/에 작성
- launchctl load로 등록

---

## 2. Apple Shortcuts

### 적합한 경우
- iOS/macOS 디바이스 기능 제어 (Focus 모드, 설정 변경)
- 위치/시간/NFC 기반 트리거
- iPhone ↔ Mac 크로스 디바이스 자동화
- 비개발자도 수정 가능해야 할 때

### 부적합한 경우
- 복잡한 로직이나 데이터 처리
- 웹 서비스 연동이 많을 때
- 버전 관리가 필요할 때 (git 추적 불가)

### 특성
- Apple 생태계 전용
- GUI 기반 편집
- Siri로 음성 호출 가능
- AppleScript/JXA/셸 스크립트 내장 가능

### 다음 단계
- Shortcuts 앱에서 새 워크플로우 생성
- 필요한 트리거 설정 (시간, 위치, NFC 등)
- 테스트 후 자동화 활성화

---

## 3. Raycast 확장

### 적합한 경우
- 키보드로 빠르게 호출하는 즉석 작업
- 클립보드 변환, 빠른 검색, 텍스트 처리
- AI 기반 빠른 판단 (Raycast AI Commands)
- 개발자 도구 연동 (GitHub, Linear, Jira)

### 부적합한 경우
- 스케줄 기반 자동화
- 백그라운드 실행
- 복잡한 멀티 스텝 워크플로우

### 특성
- React + TypeScript로 개발
- 핫키 한 번으로 즉시 실행
- AI Commands로 LLM 연동 내장
- 1,500+ 오픈소스 확장 생태계

### 다음 단계
- 기존 Raycast 확장 스토어에서 검색
- 없으면 create-raycast-extension으로 새 확장 개발
- 핫키 설정

---

## 4. n8n 워크플로우

### 적합한 경우
- 여러 외부 서비스 연동 (Slack, Google, Notion 등)
- 이벤트 기반 트리거 (웹훅, 이메일, 캘린더)
- 24/7 무인 자동화
- AI 노드로 가벼운 LLM 판단 포함

### 부적합한 경우
- 깊은 AI 추론이 핵심일 때
- 대화형 상호작용이 필요할 때
- 코드베이스 이해/수정이 필요할 때

### 특성
- 500+ 서비스 연동
- 셀프 호스팅 가능 (데이터 프라이버시)
- 비주얼 워크플로우 빌더
- AI 노드 (OpenAI, Claude, Gemini 등)
- 초당 220회 실행 가능

### 다음 단계
- n8n 관련 스킬 사용: n8n-workflow-patterns, n8n-node-configuration
- 워크플로우 설계 → 노드 구성 → 테스트 → 배포

---

## 5. Claude Code 스킬

### 적합한 경우
- 깊은 AI 추론이 필요한 작업
- 대화형 상호작용 (질문-답변-판단 루프)
- 코드 작성, 리뷰, 리팩토링
- 복잡한 의사결정, 설계, 분석
- 문서 작성, 창의적 작업

### 부적합한 경우
- 24/7 무인 자동화
- 스케줄 기반 반복 실행
- 실시간 이벤트 반응
- 사람 없이 돌아가야 할 때

### 특성
- 대화형, 적응적 실행
- MCP 서버로 외부 서비스 연동
- 서브에이전트로 병렬 처리
- git 통합 (브랜치, 커밋, PR)
- 세션 내 사람 개입 필수

### 다음 단계
- brainstorming 스킬로 아이디어 구체화
- writing-plans 스킬로 구현 계획 작성
- executing-plans 또는 subagent-driven-development로 실행
```

**Step 2: Commit**

```bash
git add .claude/skills/lookup/references/solution-approaches.md
git commit -m "docs: lookup 스킬 해결 방식 레퍼런스 작성"
```

---

### Task 3: SKILL.md 작성

**Files:**
- Create: `.claude/skills/lookup/SKILL.md`

**Step 1: SKILL.md 작성**

```markdown
---
name: lookup
description: Use when facing a life problem and need to find the right solution approach - choosing between launchd scripts, Apple Shortcuts, Raycast extensions, n8n workflows, or Claude Code skills. Use when the user invokes /lookup or asks how to solve/automate a personal problem.
---

# lookup

삶의 문제에 맞는 해결 방식을 찾아주는 스킬.

## 해결 방식 후보

| 방식 | 핵심 특성 |
|---|---|
| launchd + 셸 스크립트 | 단순 스케줄, AI 불필요, 무인 실행 |
| Apple Shortcuts | OS/디바이스 통합, 크로스 디바이스 |
| Raycast 확장 | 빠른 즉석 호출, 키보드 기반 |
| n8n 워크플로우 | 이벤트 기반, 멀티서비스 연동, 무인 자동화 |
| Claude Code 스킬 | AI 추론 필요, 대화형, 복잡한 판단 |

상세 정보: `references/solution-approaches.md` 참조.

## 실행 흐름

### 1단계: 문제 파악

사용자가 입력한 문제를 읽고, 4가지 판단 기준에 대해 질문한다. **한 번에 1개씩** 질문하고, 가능하면 객관식으로 제시한다.

**판단 기준:**

1. **사람 개입** — 이 문제를 해결할 때 매번 사람의 판단이 필요한가?
   - A) 사람 판단 필요 없음 (자동으로 돌아가면 됨)
   - B) 가끔 판단 필요
   - C) 매번 사람이 개입해야 함

2. **반복 주기** — 이 문제는 얼마나 자주 발생하는가?
   - A) 일회성 또는 비정기적
   - B) 매일/매주 등 정기적
   - C) 특정 이벤트 발생 시 (이메일 도착, 웹훅 등)

3. **AI 추론** — 해결에 AI의 판단/창의성이 필요한가?
   - A) 불필요 (단순 반복/자동화)
   - B) 가벼운 분류/요약 정도
   - C) 깊은 추론, 설계, 분석 필요

4. **외부 서비스** — 어떤 서비스와 연결되어야 하는가?
   - A) 없음 (로컬에서 완결)
   - B) 1-2개 서비스
   - C) 3개 이상 서비스 연동

### 2단계: 추천

4가지 답변을 종합하여 가장 적합한 해결 방식 **1개**를 추천한다.

**추천 판단 로직:**

```
사람 개입 불필요 + 반복적 + AI 불필요 + 로컬
  → launchd + 셸 스크립트

사람 개입 불필요 + 디바이스 트리거 + AI 불필요 + 로컬
  → Apple Shortcuts

사람 개입 필요 + 즉석 + AI 가벼운 수준 + 로컬 또는 소수 서비스
  → Raycast 확장

사람 개입 불필요 + 반복/이벤트 + AI 가벼운 수준 + 다수 서비스
  → n8n 워크플로우

사람 개입 필요 + 깊은 AI 추론 필요
  → Claude Code 스킬
```

위 로직은 가이드라인이지, 엄격한 규칙이 아니다. 맥락을 고려하여 가장 적합한 방식을 추천한다.

**출력 형식:**

> **추천: [방식 이름]**
>
> [왜 이 방식이 적합한지 1-2문장]
>
> **다른 방식이 안 되는 이유:**
> - [방식 A]: [근거]
> - [방식 B]: [근거]
> - [방식 C]: [근거]
> - [방식 D]: [근거]

### 3단계: 기록 저장

사용자 승인 후, 분석 결과를 `docs/lookups/YYYY-MM-DD-<주제>.md`에 저장하고 git commit한다.

**파일 구조:**

```markdown
# <문제 요약>

## 문제 정의
<사용자가 설명한 문제>

## 분석
- 사람 개입: <답변>
- 반복 주기: <답변>
- AI 추론: <답변>
- 외부 서비스: <답변>

## 추천
**<추천 방식>**

<추천 근거>

### 다른 방식이 안 되는 이유
- <방식 A>: <근거>
- <방식 B>: <근거>
- <방식 C>: <근거>
- <방식 D>: <근거>

## 다음 단계
<구체적인 스킬/도구 안내>
```

### 4단계: 다음 단계 안내

추천 방식에 맞는 다음 행동을 안내한다:

| 추천 방식 | 다음 단계 |
|---|---|
| launchd + 셸 스크립트 | plist 파일 작성법, 스크립트 위치, launchctl 명령어 안내 |
| Apple Shortcuts | Shortcuts 앱에서 워크플로우 생성 방법 안내 |
| Raycast 확장 | 기존 확장 검색 또는 새 확장 개발 안내 |
| n8n 워크플로우 | `n8n-workflow-patterns`, `n8n-node-configuration` 스킬 안내 |
| Claude Code 스킬 | `brainstorming` 스킬 호출 안내 |
```

**Step 2: Commit**

```bash
git add .claude/skills/lookup/SKILL.md
git commit -m "feat: lookup 스킬 SKILL.md 작성"
```

---

### Task 4: 통합 테스트

**Step 1: 스킬 디스커버리 확인**

새 Claude Code 세션에서 `/lookup 테스트 문제`를 호출하여 스킬이 정상적으로 트리거되는지 확인.

**Step 2: 전체 흐름 테스트**

`/lookup 매일 운동 루틴 관리가 안 돼`를 실행하여:
- 4가지 질문이 1개씩 나오는지
- 추천 + 근거가 출력되는지
- `docs/lookups/` 파일이 생성되는지
- 다음 단계 안내가 나오는지

확인.

**Step 3: 최종 커밋**

문제가 있으면 수정 후 커밋. 없으면 스킵.
