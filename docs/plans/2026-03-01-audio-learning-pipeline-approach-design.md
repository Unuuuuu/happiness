# 오디오 학습 파이프라인 — 접근 방식 설계

## 배경

[큰 그림 설계](2026-03-01-audio-learning-pipeline-design.md)에서 5단계 파이프라인(소스 입력 → 콘텐츠 추출 → 핵심 정리 → 음성 합성 → 소비)을 정의했다. 이 문서는 **어떤 접근 방식으로 구현할 것인가**를 결정한다.

## 결정: 코어 관통 후 단계별 독립 강화

세 가지 접근 방식을 비교 검토했다:

| 접근 방식 | 설명 | 판단 |
|---|---|---|
| Top-Down | 전체 인터페이스를 먼저 확정 후 구현 | TTS 미정 상태에서 추측 필요. 분석 마비 위험 |
| Bottom-Up | 각 단계를 완전히 독립 설계/구현 후 조합 | 전체 동작까지 오래 걸림. 인터페이스 불일치 위험 |
| **코어 관통 후 강화** | 최소한으로 전체 관통 → 단계별 독립 분리/강화 | **채택**. 빠른 피드백 + 점진적 독립성 확보 |

"점진적으로 구축한다"는 큰 그림 설계 원칙과 일치한다.

## 5계층 매핑

이 파이프라인은 단일 계층이 아니라 **여러 계층의 조합**이다.

| 단계 | Phase 1 (수동 관통) | Phase 2+ (자동화) |
|---|---|---|
| 소스 입력 | 5계층 — Claude Code 스킬에 URL 전달 | 4계층 — n8n 웹훅/RSS 트리거 |
| 콘텐츠 추출 | 5계층 — Claude Code의 WebFetch | 4계층 — n8n HTTP Request |
| 핵심 정리 | 5계층 — Claude Code 스킬 (핵심 가치) | 4계층 — n8n → Max proxy API로 스킬의 프롬프트 호출 |
| 음성 합성 | 1계층 — 셸에서 TTS CLI 호출 | 4계층 — n8n HTTP Request로 TTS API |
| 저장/소비 | 1계층 — 로컬 파일 저장 | 4계층 — Telegram 전송 + 파일 저장 |

핵심: **핵심 정리 프롬프트는 항상 Claude Code 스킬에서 관리**. 실행 환경만 바뀐다.

## Phase 1: 최소 관통

### 스킬 구조

`audio-learn` Claude Code 스킬 하나가 전체 파이프라인을 실행한다.

```
사용자: "이 URL 학습해줘"
    │
    ├── 1. WebFetch로 콘텐츠 추출 → original.md
    ├── 2. Claude가 핵심 정리 → distilled.md
    └── 3. Bash로 edge-tts 호출 → audio.mp3
```

### 저장 구조

```
~/audio-learn/
└── YYYY-MM-DD-<slug>/
    ├── original.md        # 추출된 원문
    ├── distilled.md       # 핵심 정리 (한국어)
    └── audio.mp3          # TTS 음성
```

### TTS 선택

Phase 1에서는 `edge-tts`(Microsoft Edge TTS)를 사용한다.

- 무료, `pip install edge-tts`로 설치, CLI 한 줄로 호출
- 한국어 음성 품질 충분
- 나중에 OpenAI TTS, Google Cloud TTS 등으로 교체 가능

## Phase 2: 단계 분리

관통 후 각 단계를 **독립 실행 가능한 모듈**로 분리한다.

```
audio-learn 스킬 (오케스트레이터)
    ├── extract(url) → original.md
    ├── distill(original.md) → distilled.md
    └── synthesize(distilled.md) → audio.mp3
```

분리 기준: 각 모듈은 **파일 입력 → 파일 출력**. 파일 시스템이 인터페이스이므로 언어/환경에 무관하게 교체 가능.

이 단계에서 확장:
- YouTube 자막 추출 지원 추가
- TTS 엔진 비교/교체
- 프롬프트 튜닝 (실제 사용 경험 기반)

## Phase 3: n8n 자동화

```
n8n 워크플로우
    ├── 트리거: RSS / 웹훅 / 스케줄
    ├── HTTP Request → 웹 콘텐츠 추출
    ├── HTTP Request → Max proxy API (핵심 정리 프롬프트)
    ├── HTTP Request → TTS API
    └── Telegram 전송 / 파일 저장
```

핵심 정리 프롬프트는 스킬 파일에서 관리하고, n8n은 그 프롬프트를 읽어서 사용한다.

## 첫 마일스톤 정의

**URL 하나를 넣으면 `~/audio-learn/` 아래에 원문 + 정리본 + MP3가 생긴다.**

성공 기준:
- 웹 문서 URL → 본문 추출 성공
- 한국어 핵심 정리가 귀로 들었을 때 자연스러움
- MP3 파일이 재생 가능하고 음질이 학습에 충분함
