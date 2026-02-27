# /work-scan 기간 확장 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `/work-scan`에 기간 인자를 지원하고, 장기 데이터일 때 추가 패턴 분석을 제공한다.

**Architecture:** 기존 SKILL.md를 수정하여 ARGUMENTS에서 숫자를 파싱하고, 기간에 따라 패턴 분석 섹션을 분기한다. 스킬 단독 변경이므로 외부 의존성 없음.

**Tech Stack:** Claude Code 스킬 (SKILL.md Markdown)

**참조 설계:** `docs/plans/2026-02-27-work-scan-확장-design.md`

---

## Task 1: SKILL.md 수정 — 기간 인자 파싱 + 장기 패턴 추가

**목표:** `/work-scan 90` 형태로 기간을 지정할 수 있게 하고, 30일+ 데이터에 대한 추가 패턴 분석을 추가한다.

**파일:**
- 수정: `.claude/skills/work-scan/SKILL.md`

**Step 1: 1단계(데이터 수집) 수정**

현재 코드 (SKILL.md 65~75행):
```markdown
## 1단계: 데이터 수집

WebFetch로 맥락 조회 API를 호출한다:

```
GET https://unu.unuuuuu.com/webhook/get-my-context?days=14
```

- 프롬프트: "Return the full response text as-is without summarizing"
- 데이터가 "수집된 맥락이 없습니다"이면 `?days=30`으로 재시도
- 30일에도 없으면 "수집된 업무 데이터가 없습니다. Linear/GitHub 웹훅이 정상 작동하는지 확인해주세요." 안내 후 종료
```

변경할 내용:
```markdown
## 1단계: 데이터 수집

**기간 결정:**
- ARGUMENTS에 숫자가 있으면 해당 값을 `days`로 사용 (예: `/work-scan 90` → `days=90`)
- 숫자가 없으면 기본값 `days=14`
- 유효 범위: 1~365. 범위 밖이면 기본값 14 사용

WebFetch로 맥락 조회 API를 호출한다:

```
GET https://unu.unuuuuu.com/webhook/get-my-context?days={결정된 days}
```

- 프롬프트: "Return the full response text as-is without summarizing"
- 데이터가 "수집된 맥락이 없습니다"이면:
  - 기본값(14일)으로 호출한 경우 → `?days=30`으로 재시도
  - 사용자 지정 기간인 경우 → 재시도 없이 "해당 기간에 수집된 데이터가 없습니다." 안내 후 종료
- 30일에도 없으면 "수집된 업무 데이터가 없습니다. Linear/GitHub 웹훅이 정상 작동하는지 확인해주세요." 안내 후 종료
```

**Step 2: 2단계(현황 요약) 수정**

현재 코드 (SKILL.md 77~88행):
```markdown
## 2단계: 현황 요약

반환된 데이터에서 팩트만 정리한다:

```
### 현황 요약
- Linear: N건 (In Progress M건, Todo K건, Done J건)
- GitHub: PR N건, Push M건, Review K건
- 활동 프로젝트: project1, project2
```

해석이나 판단을 넣지 않는다. 숫자와 분류만.
```

변경할 내용:
```markdown
## 2단계: 현황 요약

반환된 데이터에서 팩트만 정리한다:

```
### 현황 요약 ({days}일)
- Linear: N건 (In Progress M건, Todo K건, Done J건)
- GitHub: PR N건, Push M건, Review K건
- 활동 프로젝트: project1, project2
```

30일 이상일 때는 시간 분포도 추가한다:
```
- 활동 분포: 최근 14일 N건, 그 이전 M건
```

해석이나 판단을 넣지 않는다. 숫자와 분류만.
```

**Step 3: 3단계(패턴 분석) 수정**

현재 코드 (SKILL.md 90~106행):
```markdown
## 3단계: 패턴 분석

데이터에서 다음 패턴을 탐지하여 출력한다:

- **장기 체류**: 같은 상태에 7일 이상 머문 이슈
- **우선순위 불일치**: P1-P2인데 진전 없는 이슈
- **리뷰 대기**: 오픈 상태로 방치된 PR
- **활동 공백**: 특정 프로젝트에 활동이 없는 기간
- **반복 키워드**: 여러 이슈/PR에 걸쳐 나타나는 주제
```

변경할 내용:
```markdown
## 3단계: 패턴 분석

데이터에서 다음 패턴을 탐지하여 출력한다:

**기본 패턴 (항상 탐지):**
- **장기 체류**: 같은 상태에 7일 이상 머문 이슈
- **우선순위 불일치**: P1-P2인데 진전 없는 이슈
- **리뷰 대기**: 오픈 상태로 방치된 PR
- **활동 공백**: 특정 프로젝트에 활동이 없는 기간
- **반복 키워드**: 여러 이슈/PR에 걸쳐 나타나는 주제

**장기 패턴 (30일+ 데이터일 때 추가 탐지):**
- **반복 작업**: 비슷한 유형의 이슈가 여러 번 등장 (예: 같은 종류의 고객 문의, 같은 도메인의 마이그레이션 작업)
- **완료 후 재등장**: Done 처리된 주제와 비슷한 이슈가 새로 등장
- **프로젝트 집중도 변화**: 특정 프로젝트에 활동이 몰렸다가 사라지는 패턴
- **상태 순환**: 이슈가 상태를 왔다갔다 하는 패턴 (In Progress ↔ Todo 등)
```

패턴 관찰 예시도 업데이트:
```
### 패턴 관찰
- HAP-12가 10일째 In Progress 상태 (P2)
- repo-x에 PR 2건이 리뷰 없이 3일 대기 중
- [장기] "고객 문의" 관련 이슈가 90일간 8건 반복 등장
- [장기] NestJS 마이그레이션 이슈가 6개 도메인에 걸쳐 순차 진행 중
```

**Step 4: 커밋**

```bash
git add .claude/skills/work-scan/SKILL.md
git commit -m "feat: /work-scan 기간 인자 지원 + 장기 패턴 분석 추가"
```

---

## Task 2: 스킬 테스트

**목표:** 수정된 `/work-scan`이 기간 인자를 올바르게 처리하는지 확인한다.

**Step 1: 기본 호출 테스트**

`/work-scan` (인자 없이)을 호출한다.

기대 결과:
- `days=14`로 API 호출됨
- 현황 요약에 "(14일)" 표시
- 기본 패턴만 분석 (장기 패턴 없음)

**Step 2: 기간 지정 호출 테스트**

`/work-scan 90`을 호출한다.

기대 결과:
- `days=90`으로 API 호출됨
- 현황 요약에 "(90일)" 표시
- 시간 분포 정보 포함 ("활동 분포: 최근 14일 N건, 그 이전 M건")
- 장기 패턴 분석 포함 (반복 작업, 완료 후 재등장 등)

**Step 3: 최종 커밋**

테스트 과정에서 수정이 필요했다면 추가 커밋:

```bash
git add .claude/skills/work-scan/SKILL.md
git commit -m "fix: /work-scan 기간 확장 테스트 후 수정"
```
