# surface 스킬 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** lookup 스킬의 전 단계로, 삶의 문제를 발견하는 브레인스토밍 스킬을 만든다.

**Architecture:** YAML frontmatter + Markdown으로 구성된 Claude Code 스킬. 대화형으로 문제를 파고들고, 정의된 문제를 `docs/surfaces/`에 기록한 뒤 lookup 스킬을 호출한다.

**Tech Stack:** Claude Code 스킬 (SKILL.md), Markdown

---

### Task 1: 스킬 디렉토리 생성

**Files:**
- Create: `.claude/skills/surface/` (디렉토리)

**Step 1: 디렉토리 생성**

```bash
mkdir -p .claude/skills/surface
```

**Step 2: 출력 디렉토리 생성**

```bash
mkdir -p docs/surfaces
```

`docs/surfaces/`는 스킬 실행 결과가 저장되는 곳. `docs/lookups/`와 대칭.

**Step 3: .gitkeep 추가**

```bash
touch docs/surfaces/.gitkeep
```

빈 디렉토리를 git에서 추적하기 위함.

**Step 4: 커밋**

```bash
git add .claude/skills/surface docs/surfaces/.gitkeep
git commit -m "chore: surface 스킬 디렉토리 및 출력 디렉토리 생성"
```

---

### Task 2: SKILL.md 작성

**Files:**
- Create: `.claude/skills/surface/SKILL.md`
- Reference: `.claude/skills/lookup/SKILL.md` (구조 참고)
- Reference: `docs/plans/2026-02-26-surface-skill-design.md` (설계 문서)

**Step 1: SKILL.md 작성**

lookup 스킬의 SKILL.md 구조를 따르되, 설계 문서의 내용을 스킬 정의로 변환한다.

필수 포함 내용:

1. **YAML frontmatter**
   - `name: surface`
   - `description:` — 영어로, Claude Code 디스커버리용. 예: `Use when you want to discover and define life problems worth automating. Precedes /lookup by identifying pain points through guided conversation.`

2. **체크리스트** — brainstorming 스킬처럼 TodoWrite로 추적할 항목:
   - 진입 상태 판별 (막연한 불편 vs 아무것도 모름)
   - 탐색 또는 파고들기 질문
   - 문제 정의 제시
   - 사용자 승인
   - 기록 저장 + 커밋
   - lookup 스킬 호출

3. **실행 흐름** — 설계 문서의 dot 그래프 포함

4. **HARD-GATE 2개**:
   - 해결 방식 제안 금지
   - 승인 전 기록/lookup 호출 금지

5. **단계별 상세** — 탐색, 파고들기, 문제 정의 제시, 기록 저장, lookup 호출

6. **기록 파일 형식** — `docs/surfaces/YYYY-MM-DD-<주제>.md` 템플릿

7. **Red Flags 표**

8. **핵심 원칙** — 질문 1개씩, 객관식 선호, 문제만 찾고 해법은 찾지 않음, 세션당 1개

**Step 2: 커밋**

```bash
git add .claude/skills/surface/SKILL.md
git commit -m "feat: surface 스킬 정의 (SKILL.md) 작성"
```

---

### Task 3: 푸시

**Step 1: 원격 브랜치에 푸시**

```bash
git push -u origin claude/implement-lookup-command-ZGGKK
```

---

### Task 4: 스킬 동작 확인

**Step 1: /surface 호출로 스킬이 로드되는지 확인**

Claude Code 세션에서 `/surface`를 입력하여 스킬이 정상 로드되는지 확인.

확인 항목:
- SKILL.md가 Claude Code에 의해 인식되는가
- 체크리스트가 TodoWrite로 생성되는가
- 질문이 한 번에 1개씩 객관식으로 나오는가
- HARD-GATE가 동작하는가 (해결 방식 제안 안 함)
