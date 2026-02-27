# /work-scan 스킬 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 업무 맥락 데이터(Linear/GitHub)를 분석하여 해결 가능한 포인트를 발견하고, `/surface`로 연결하는 `/work-scan` 스킬을 만든다.

**Architecture:** Claude Code 스킬 단독 방식. 스킬이 맥락 조회 API를 HTTP로 호출하고, Claude가 반환된 Markdown을 분석하여 현황 요약 → 패턴 관찰 → 제안을 생성한다.

**Tech Stack:** Claude Code 스킬 (SKILL.md), 기존 맥락 조회 API (`GET https://unu.unuuuuu.com/webhook/get-my-context`)

**참조 설계:** `docs/plans/2026-02-27-work-scan-design.md`

---

## Task 1: SKILL.md 작성

**목표:** `/work-scan` 스킬 정의 파일을 생성한다.

**파일:**
- 생성: `.claude/skills/work-scan/SKILL.md`

**Step 1: 스킬 파일 생성**

기존 `/surface`, `/lookup` 스킬의 구조를 따른다:
- YAML frontmatter (name, description 영어)
- 본문 한국어
- 체크리스트 (TodoWrite 추적)
- Graphviz 흐름도
- HARD-GATE 섹션
- 단계별 상세 지침

```markdown
---
name: work-scan
description: Scan work context from Linear/GitHub data to find actionable insights. Use when the user invokes /work-scan or wants to review their current work status and find problems to solve.
---

# work-scan

Linear/GitHub 업무 데이터를 스캔하여 해결할 수 있는 포인트를 발견하는 스킬. 해결 방식은 찾지 않는다 — 그건 surface → lookup의 몫.

**흐름**: work-scan (데이터 기반 문제 후보 발견) → surface (문제 정의) → lookup (해결 방식 탐색)

## 체크리스트

반드시 TodoWrite로 아래 항목을 추적한다:

1. **데이터 수집** — 맥락 조회 API 호출
2. **현황 요약** — 소스별/상태별 분류 출력
3. **패턴 분석** — 장기 체류, 리뷰 대기 등 패턴 탐지
4. **제안** — 2-3개 액션 포인트 제시
5. **사용자 선택** — 관심 포인트 확인
6. **surface 스킬 호출** — 선택된 포인트로 문제 정의 진행

## 실행 흐름

(graphviz 다이어그램 포함)

## HARD-GATE

1. 데이터 없이 추측하지 않는다. 반드시 조회 API를 호출한 후 분석한다.
2. 제안은 최대 3개로 제한한다.
3. surface 연결은 사용자가 포인트를 선택한 후에만 한다.
4. 해결 방식을 직접 제안하지 않는다 (surface → lookup의 몫).

## 각 단계 상세 지침 포함
```

전체 내용은 아래 Step 2에서 작성.

**Step 2: 스킬 내용 완성**

스킬의 각 단계별 상세 지침을 작성한다:

- **1단계 (데이터 수집)**: WebFetch로 `https://unu.unuuuuu.com/webhook/get-my-context?days=14` 호출. 데이터 없으면 기간을 30일로 확장 재시도.
- **2단계 (현황 요약)**: 반환된 Markdown에서 Linear 이슈 수/상태, GitHub PR/push/review 수를 정리하여 출력.
- **3단계 (패턴 분석)**: 다음 패턴을 탐지하여 출력:
  - 장기 체류 이슈 (같은 상태 7일 이상)
  - 높은 우선순위(P1-P2)인데 진전 없는 이슈
  - 리뷰 대기 중인 PR
  - 활동 집중/공백 영역
  - 반복적으로 나타나는 키워드/프로젝트
- **4단계 (제안)**: AskUserQuestion으로 2-3개 액션 포인트를 제시. 각 포인트는 "왜 주목하는지"와 "무엇을 할 수 있는지"를 간결하게 설명.
- **5단계 (사용자 선택)**: 사용자가 포인트를 선택하거나 "없음"을 선택.
- **6단계 (surface 호출)**: 선택된 포인트의 맥락을 요약하여 `/surface` 스킬을 호출.

**Step 3: 커밋**

```bash
git add .claude/skills/work-scan/SKILL.md
git commit -m "feat: /work-scan 스킬 생성 — 업무 맥락 스캔"
```

---

## Task 2: 스킬 테스트

**목표:** `/work-scan` 스킬이 정상 작동하는지 확인한다.

**Step 1: 스킬 호출 테스트**

Claude Code 세션에서 `/work-scan`을 호출한다.

기대 결과:
- 조회 API가 호출되어 데이터를 가져옴
- 현황 요약이 출력됨
- 패턴 분석이 출력됨
- 제안이 2-3개 제시됨

**Step 2: surface 연결 테스트**

제안된 포인트 중 하나를 선택하여 `/surface` 스킬이 호출되는지 확인한다.

기대 결과:
- 선택한 포인트의 맥락이 `/surface`에 전달됨
- `/surface`가 정상 시작됨

**Step 3: 데이터 없는 경우 테스트**

`?days=0` 등으로 데이터가 없는 경우를 테스트한다.

기대 결과:
- "수집된 맥락이 없습니다" 메시지 표시
- 기간 확장 재시도 또는 안내

**Step 4: 최종 커밋**

```bash
git add -A
git commit -m "feat: /work-scan 스킬 테스트 완료"
```
