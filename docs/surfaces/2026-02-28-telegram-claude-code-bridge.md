# Telegram → Claude Code CLI 브릿지

## 배경

현재 n8n AI Agent 구조에서 AI의 능력은 연결된 도구 수에 의존한다. Claude Code CLI는 MCP 서버, 스킬, 파일시스템, 셸 등 풍부한 도구 접근권을 가지고 있다. 이것을 텔레그램에서 호출할 수 있으면 모바일에서도 Claude Code의 전체 능력을 활용할 수 있다.

## 목표

텔레그램 메시지로 Claude Code CLI를 호출하고, 결과를 텔레그램으로 받는 최소 PoC.

## 인프라 현황

- **홈서버**: Claude Max API proxy 운영 중 (Coolify)
- **n8n**: Coolify에서 운영 중, MCP 서버(`n8n-mcp.unuuuuu.com`) 사용 가능
- **Claude Code CLI**: `claude -p "프롬프트"` 로 비대화형 실행 가능, `--output-format json` 으로 구조화된 출력 가능

## 아키텍처 구상

```
Telegram → n8n (새 워크플로우) → Execute Command / SSH → claude -p "메시지" → 응답 → Telegram
```

### 핵심 고려사항

1. **Claude Code CLI 설치 위치**: 홈서버(Coolify 컨테이너 또는 호스트)에 설치 필요
2. **실행 방식**: `claude --print "메시지"` — 비대화형, 단발 실행
3. **컨텍스트 유지**: 매 호출이 새 세션. 대화 연속성이 필요하면 `--resume` 또는 `--continue` 플래그 검토
4. **응답 시간**: Claude Code는 도구 호출 포함 수십 초~수 분 소요 가능. n8n 타임아웃 설정 필요
5. **프로젝트 컨텍스트**: `--project-dir` 로 특정 프로젝트의 CLAUDE.md, 스킬, MCP 설정을 로드 가능
6. **출력 형식**: `--output-format json` 사용 시 `{ result, cost, duration }` 등 구조화된 응답

### n8n에서 실행하는 방법 후보

| 방법 | 장점 | 단점 |
|---|---|---|
| Execute Command 노드 | 간단, n8n 컨테이너 내 직접 실행 | 컨테이너에 CLI 설치 필요, 컨테이너 재시작 시 소실 |
| SSH 노드 | 호스트 머신에서 실행 가능 | SSH 설정 필요 |
| HTTP Request → 중간 서비스 | 가장 유연, 큐잉 가능 | 별도 서비스 구축 필요 |

### 제약사항

- Claude Code CLI는 인터랙티브 프롬프트가 뜰 수 있음 → `--print` 모드 + `--allowedTools` 로 제한
- Docker 컨테이너 안에서 Claude Code 실행 시 파일시스템 접근 범위 고려
- API 키 관리: Claude Max API proxy를 CLI에서도 활용할 수 있는지 확인 필요

## 다음 단계

1. 홈서버에서 `claude -p "hello"` 실행 가능한 환경 확인
2. n8n에서 해당 명령을 호출하는 최소 워크플로우 구성 (Telegram Trigger → Execute/SSH → Telegram Send)
3. 응답 시간, 출력 형식, 에러 핸들링 테스트
4. 컨텍스트 유지 방법 실험 (`--resume`, `--continue`)
