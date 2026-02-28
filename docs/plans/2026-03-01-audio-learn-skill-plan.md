# audio-learn 스킬 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** URL을 입력하면 원문 추출 + 한국어 핵심 정리 + MP3 음성 파일을 생성하는 Claude Code 스킬

**Architecture:** Claude Code 스킬(`audio-learn`)이 전체 파이프라인을 오케스트레이션. WebFetch로 콘텐츠 추출, Claude 자체가 핵심 정리, Bash로 edge-tts 호출하여 음성 합성. 산출물은 `~/audio-learn/YYYY-MM-DD-<slug>/`에 저장.

**Tech Stack:** Claude Code 스킬 (YAML frontmatter + Markdown), edge-tts (Microsoft Edge TTS, 무료), Python 3

---

## Task 1: edge-tts 설치 및 한국어 음성 검증

**Files:**
- 없음 (환경 설정만)

**Step 1: edge-tts 설치**

```bash
pip install edge-tts
```

**Step 2: 한국어 음성 목록 확인**

```bash
edge-tts --list-voices | grep ko-KR
```

Expected: `ko-KR-SunHiNeural` (여성), `ko-KR-InJoonNeural` (남성) 확인

**Step 3: 한국어 TTS 테스트**

```bash
mkdir -p ~/audio-learn/test
edge-tts --text "안녕하세요. 이것은 오디오 학습 파이프라인의 테스트입니다. 트랜스포머 아키텍처는 셀프 어텐션 메커니즘을 통해 입력 시퀀스의 모든 위치를 동시에 참조할 수 있습니다." --voice ko-KR-SunHiNeural --write-media ~/audio-learn/test/test.mp3
```

Expected: `~/audio-learn/test/test.mp3` 생성, 재생 시 자연스러운 한국어 음성

**Step 4: 테스트 파일 정리**

```bash
rm -rf ~/audio-learn/test
```

---

## Task 2: audio-learn 스킬 작성

**Files:**
- Create: `.claude/skills/audio-learn/SKILL.md`
- Create: `.claude/skills/audio-learn/references/distillation-prompt.md`

**Step 1: 디렉토리 생성**

```bash
mkdir -p .claude/skills/audio-learn/references
```

**Step 2: SKILL.md 작성**

`.claude/skills/audio-learn/SKILL.md`:

```markdown
---
name: audio-learn
description: Convert web content into Korean audio summaries for learning on the go. Use when user shares a URL and wants to learn from it via audio.
---

# audio-learn

영어/한국어 웹 콘텐츠를 **한국어 음성 요약**으로 변환한다.

## 사전 조건

- `edge-tts` 설치 필요: `pip install edge-tts`

## 실행 흐름

사용자가 URL을 제공하면 다음 순서로 실행한다:

### 1. 출력 디렉토리 생성

```bash
mkdir -p ~/audio-learn/YYYY-MM-DD-<slug>
```

- `YYYY-MM-DD`: 오늘 날짜
- `<slug>`: URL이나 페이지 제목에서 추출한 짧은 영문 식별자 (예: `understanding-transformers`)

### 2. 콘텐츠 추출

WebFetch로 URL의 콘텐츠를 가져온다.
- 프롬프트: "Extract the main article content. Remove navigation, ads, footers, and other non-content elements. Return the full article text."
- 결과를 `~/audio-learn/YYYY-MM-DD-<slug>/original.md`에 저장

### 3. 핵심 정리

`references/distillation-prompt.md`의 프롬프트를 참고하여 원문을 한국어 학습 콘텐츠로 변환한다.
- 결과를 `~/audio-learn/YYYY-MM-DD-<slug>/distilled.md`에 저장

### 4. 음성 합성

distilled.md의 내용을 edge-tts로 MP3로 변환한다:

```bash
edge-tts --file ~/audio-learn/YYYY-MM-DD-<slug>/distilled.md --voice ko-KR-SunHiNeural --write-media ~/audio-learn/YYYY-MM-DD-<slug>/audio.mp3
```

### 5. 완료 보고

생성된 파일 목록과 경로를 사용자에게 알려준다:

```
✅ 학습 자료 생성 완료

📂 ~/audio-learn/YYYY-MM-DD-<slug>/
├── original.md    (원문)
├── distilled.md   (핵심 정리)
└── audio.mp3      (음성)
```
```

**Step 3: 핵심 정리 프롬프트 작성**

`.claude/skills/audio-learn/references/distillation-prompt.md`:

```markdown
# 핵심 정리 프롬프트

아래 원문을 **귀로 듣기 좋은 한국어 학습 콘텐츠**로 변환하라.

## 변환 원칙

1. **핵심만 남긴다** — 원문의 지식 밀도를 유지하되, 서론/반복/사족은 제거
2. **구어체 한국어** — 글이 아니라 음성으로 들을 텍스트. "~입니다", "~인데요" 같은 자연스러운 문체
3. **구체적으로** — 추상적 설명 대신 핵심 개념과 예시 중심
4. **구조를 드러낸다** — "첫째, ... 둘째, ..." 같은 구조 표지를 사용하여 귀로 들었을 때 흐름 파악이 쉽게
5. **전문 용어 처리** — 영어 전문 용어는 처음 나올 때 "트랜스포머, 즉 Transformer는" 식으로 병기. 이후에는 한국어만 사용

## 분량

- 원문 대비 30-50% 분량을 목표로 한다
- 듣기 시간 기준 3-10분이 적절 (한국어 기준 분당 약 300자)

## 출력 형식

- 마크다운 헤더 없이 순수 텍스트만 출력 (TTS가 헤더를 읽지 않도록)
- 문단 사이에 빈 줄 하나로 구분 (TTS가 자연스럽게 쉬는 구간)
```

**Step 4: 커밋**

```bash
git add .claude/skills/audio-learn/
git commit -m "feat: audio-learn 스킬 초기 버전 작성

URL → 원문 추출 → 한국어 핵심 정리 → edge-tts MP3 생성
파이프라인의 Phase 1 최소 관통 구현."
```

---

## Task 3: 실제 URL로 스킬 통합 검증

**Files:**
- Modify: `.claude/skills/audio-learn/SKILL.md` (필요시 조정)
- Modify: `.claude/skills/audio-learn/references/distillation-prompt.md` (필요시 조정)

**Step 1: 테스트 URL 선정 및 스킬 실행**

적당한 영어 기술 블로그 URL을 골라 `audio-learn` 스킬을 호출한다.
- 추천 테스트 URL: 중간 길이(1000-3000단어)의 영어 기술 아티클

**Step 2: 원문 추출 검증**

`original.md`를 읽고 확인:
- 본문 텍스트가 제대로 추출되었는가?
- 광고/네비게이션 노이즈가 제거되었는가?

**Step 3: 핵심 정리 검증**

`distilled.md`를 읽고 확인:
- 한국어가 자연스러운가? (구어체, 듣기 좋은 문체)
- 핵심 정보가 보존되었는가?
- 분량이 적절한가? (원문의 30-50%)
- 마크다운 헤더 없이 순수 텍스트인가?

**Step 4: 음성 품질 검증**

`audio.mp3`를 재생하여 확인:
- 한국어 발음이 자연스러운가?
- 듣기 속도가 적절한가?
- 문단 사이 쉼이 자연스러운가?

**Step 5: 문제 발견 시 수정**

검증에서 발견된 문제를 수정한다. 예상 가능한 조정:
- 프롬프트 문체 조정 (distillation-prompt.md)
- edge-tts 음성/속도 파라미터 조정 (SKILL.md)
- WebFetch 프롬프트 조정 (추출 품질 문제 시)

**Step 6: 최종 커밋**

```bash
git add .claude/skills/audio-learn/
git commit -m "fix: audio-learn 스킬 검증 후 프롬프트 튜닝"
```

---

## 완료 조건

- [ ] `edge-tts`가 설치되어 한국어 MP3를 생성할 수 있다
- [ ] `audio-learn` 스킬이 `.claude/skills/`에 존재한다
- [ ] 실제 URL로 테스트하여 `~/audio-learn/`에 3개 파일이 생성된다
- [ ] 핵심 정리 텍스트가 귀로 들었을 때 자연스럽다
- [ ] MP3 음성 품질이 학습에 충분하다
