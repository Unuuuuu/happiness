# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 실행 환경

이 프로젝트는 **두 가지 환경**에서 사용된다:

| 환경 | 특성 |
|---|---|
| **Claude Code on Web** (claude.ai/code) | 세션마다 환경 초기화 가능, `~/.claude/` 유지 보장 안 됨 |
| **Claude Code CLI** (PC/로컬) | `~/.claude/` 영속, 로컬 파일시스템 전체 접근 가능 |

**양쪽 모두에서 동작해야 하므로:**
- 플러그인/스킬 의존성은 **SessionStart 훅으로 자동 설치**한다 (웹에서 세션 초기화 대응)
- PC 전용 기능(로컬 파일 경로, IDE 통합 등)에 의존하지 않는다
- 웹과 PC 공통으로 사용 가능한 도구(MCP 서버, 서브에이전트, git 등)를 우선한다
- 현재 `.claude/hooks/install-plugins.sh`에서 세션 시작 시 필요한 플러그인을 설치한다

## 프로젝트 개요

**gateway**는 삶의 모든 문제를 Claude Code 스킬로 정의하고 해결하는 메타 저장소다. 전통적인 소스 코드가 아닌, **스킬 정의(Markdown + YAML frontmatter)**와 **설계 문서**로 구성된다.

빌드, 린트, 테스트 명령어는 없다. 스킬이 올바르게 동작하는지는 Claude Code 세션에서 직접 호출하여 확인한다.

## 핵심 아키텍처: 5계층 해결 방식

문제를 4가지 기준(사람 개입, 반복 주기, AI 추론, 외부 서비스)으로 분석하여 가장 적합한 해결 방식을 라우팅한다:

| 계층 | 해결 방식 | 언제 쓰는가 |
|---|---|---|
| 1 | launchd + 셸 스크립트 | 단순 스케줄, AI 불필요, 무인 |
| 2 | Apple Shortcuts | 디바이스 트리거, 크로스 디바이스 |
| 3 | Raycast 확장 | 키보드 즉석 호출, 빠른 작업 |
| 4 | n8n 워크플로우 | 멀티서비스 연동, 이벤트 기반 자동화 |
| 5 | Claude Code 스킬 | 깊은 AI 추론, 대화형, 복잡한 판단 |

## 디렉토리 구조 규칙

- `docs/plans/` — 스킬 설계 문서 (`YYYY-MM-DD-<주제>.md`)
- `docs/lookups/` — `/lookup` 스킬 실행 결과 기록
- `.claude/skills/<스킬명>/SKILL.md` — 스킬 정의 (YAML frontmatter + Markdown)
- `.claude/skills/<스킬명>/references/` — 스킬이 참조하는 레퍼런스 파일

## 문서 언어

모든 문서와 커밋 메시지는 **한국어**로 작성한다. 단, YAML frontmatter의 `description` 필드는 영어로 작성한다 (Claude Code 스킬 디스커버리를 위해).

## 커밋 컨벤션

Conventional Commits를 따른다: `feat:`, `docs:`, `chore:` 등. 커밋 메시지 본문은 한국어.
