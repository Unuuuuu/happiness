---
name: audio-learn
description: Convert web content into Korean audio summaries for learning on the go. Use when user shares a URL and wants to learn from it via audio.
---

# audio-learn

영어/한국어 웹 콘텐츠를 **한국어 음성 요약**으로 변환한다.

## 사전 조건

- `edge-tts` 설치 필요: `uv tool install edge-tts`

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
완료!

~/audio-learn/YYYY-MM-DD-<slug>/
├── original.md    (원문)
├── distilled.md   (핵심 정리)
└── audio.mp3      (음성)
```
