# Telegram-Claude Code tmux 브릿지 설계

## 목적

비개발자도 Telegram에서 Claude Code 스킬을 자유롭게 사용할 수 있는 환경을 구축한다. Claude Code on Web이나 Remote Control은 기술적 진입장벽이 높다. Telegram Bot을 통해 서버에 설치된 Claude Code에 접근하면, 누구나 Claude Code의 전체 능력(스킬, MCP 서버, 파일시스템, 셸)을 활용할 수 있다.

## 요구사항

- 소수 팀 (2-5명), 사용자별 독립 세션
- 공유 프로젝트 (happiness 저장소의 스킬)
- AskUserQuestion 등 인터랙티브 스킬 지원
- Max 구독 인증 사용 (추가 API 비용 없음)
- 독립 서비스 (n8n 불필요)
- 홈서버 호스트에 직접 배포

## 아키텍처

```
┌─────────────┐
│  Telegram    │
│  (사용자 A)  │──┐
└─────────────┘  │     ┌──────────────────────────────────────────────┐
                 │     │            홈서버 (Host)                      │
┌─────────────┐  │     │                                              │
│  Telegram    │──┼────▶│  Telegram Bot (Python, port 7777)           │
│  (사용자 B)  │  │     │    │                                        │
└─────────────┘  │     │    ├── Telegram 웹훅 수신 (HTTPS)            │
                 │     │    ├── 훅 HTTP 수신 (localhost:7777/hook)    │
┌─────────────┐  │     │    └── SessionManager                       │
│  Telegram    │──┘     │         ├── cc-a: tmux 세션 → Claude Code  │
│  (사용자 C)  │        │         ├── cc-b: tmux 세션 → Claude Code  │
└─────────────┘        │         └── cc-c: tmux 세션 → Claude Code  │
                       │                                              │
                       │  모든 세션: cwd = ~/Projects/happiness       │
                       └──────────────────────────────────────────────┘
```

## 핵심 흐름

### 메시지 전송 (사용자 → Claude Code)

1. 사용자가 Telegram에 메시지 전송
2. Bot이 화이트리스트 확인
3. 해당 사용자의 tmux 세션을 찾거나 생성
4. Bot이 즉시 "처리 중..." 메시지 전송
5. `tmux send-keys -l -t "cc-{user_id}" "{메시지}" Enter`로 주입

### 응답 수신 (Claude Code → 사용자)

훅 기반 이벤트 감지:

| 훅 | 트리거 | Bot 동작 |
|---|---|---|
| `Notification` (elicitation_dialog) | AskUserQuestion 호출 | 질문을 Telegram으로 전달 |
| `Notification` (permission_prompt) | 권한 승인 요청 | 권한 요청을 Telegram으로 전달 |
| `Notification` (idle_prompt) | 입력 대기 | 입력 대기 상태 알림 |
| `Stop` | Claude Code 응답 완료 | last_assistant_message를 Telegram으로 전송 |

훅 스크립트는 stdin으로 JSON을 받아 `curl`로 Bot 서버(localhost:7777/hook)에 POST한다.

### 역매핑

훅은 Claude Code의 `session_id`를 전달한다. Bot은 세션 생성 시 아래 매핑을 SQLite에 저장:

```
telegram_user_id ↔ tmux_session_name ↔ claude_session_id
```

훅에서 온 `session_id`로 어떤 Telegram 사용자에게 보낼지 결정한다.

## 세션 관리

### 생성

```bash
tmux new-session -d -s "cc-{user_id}" \
  -c ~/Projects/happiness \
  "claude --dangerously-skip-permissions"
```

- CLAUDE.md, 스킬, MCP 서버, 훅 모두 로드됨
- 대화형 TUI이므로 모든 인터랙션 가능

### 수명

- 유휴 30분 후 자동 종료
- 다음 메시지 시 새 세션 자동 생성

### 동시성

- 사용자당 1세션
- 이전 응답 완료 전 새 메시지는 큐에 대기

## 메시지 포매팅

### 출력 (Claude Code → Telegram)

- 4096자 이하: 그대로 전송 (parse_mode: Markdown)
- 4096자 초과: 줄 경계 기준 분할, 코드 블록 중간 절단 방지, 순차 전송

### 입력 (Telegram → Claude Code)

- 일반 텍스트: `tmux send-keys -l "{메시지}" Enter`
- 특수문자: `-l` (literal) 모드로 이스케이프 문제 회피
- 여러 줄: 줄바꿈 유지

## 보안

### 접근 제어

- `ALLOWED_TELEGRAM_USERS` 환경변수로 화이트리스트 관리
- 화이트리스트에 없는 사용자의 메시지는 무시
- Claude Code가 `--dangerously-skip-permissions`로 실행되므로 Bot 레벨 접근 제어가 유일한 보안 경계

### 파일시스템

- 소수 신뢰 팀 전제, 별도 격리 없음
- 모든 세션이 같은 프로젝트 디렉토리에서 실행

## 배포

### 시스템 요구사항

- Claude Code CLI (`npm install -g @anthropic-ai/claude-code`)
- Max 구독 인증 (`claude login`)
- tmux (시스템 패키지)
- Python 3.11+

### 기술 스택

| 컴포넌트 | 선택 | 이유 |
|---|---|---|
| 언어 | Python | python-telegram-bot 생태계, 빠른 프로토타이핑 |
| Telegram 라이브러리 | python-telegram-bot | 가장 성숙, 비동기 지원 |
| HTTP 서버 (훅 수신) | aiohttp 또는 FastAPI | Bot과 같은 프로세스에서 비동기 실행 |
| 세션 저장소 | SQLite | 파일 하나, 별도 DB 불필요 |
| 프로세스 관리 | systemd | 호스트 직접 실행 |

### 네트워크

- Telegram 웹훅: HTTPS 엔드포인트 필요 (Cloudflare Tunnel 또는 Nginx)
- 훅 HTTP: localhost:7777 (외부 노출 불필요)

### 훅 설정

```jsonc
// .claude/settings.json (프로젝트 레벨)
{
  "hooks": {
    "Notification": [{
      "hooks": [{
        "type": "command",
        "command": ".claude/hooks/bridge-notify.sh"
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": ".claude/hooks/bridge-stop.sh"
      }]
    }]
  }
}
```

### systemd 서비스

```ini
[Unit]
Description=Claude Code Telegram Bridge
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/cc-telegram-bridge/bot.py
Restart=always
Environment=TELEGRAM_BOT_TOKEN=xxx
Environment=ALLOWED_TELEGRAM_USERS=xxx
WorkingDirectory=/home/user/Projects/happiness

[Install]
WantedBy=multi-user.target
```

## 사용자 경험 예시

```
사용자: "오늘 회의실 예약해줘"
Bot:    "⏳ 처리 중..."

[Claude Code가 스킬 자동 호출]

Bot:    "📋 질문이 있습니다:
         어떤 회의실을 예약할까요?
         1. 강남 A룸
         2. 강남 B룸
         3. 직접 입력"

사용자: "1"

[Claude Code가 계속 실행]

Bot:    "✅ 강남 A룸 14:00-15:00 예약 완료했습니다."
```

## 정책 리스크

- `claude -p` (CLI) 자동 호출은 Max 구독 OAuth로 허용됨
- tmux 브릿지는 Claude Code TUI를 그대로 실행하므로 기술적으로 동일
- 그러나 "제3자 하네스" 정책 해석에 따라 회색 지대에 해당할 수 있음
- 개인/소수 팀, 비상업적 사용에서는 현실적 리스크 낮음

## 향후 확장 가능성

- 사용자별 프로젝트 디렉토리 전환 지원
- 파일 업로드/다운로드 (이미지, 문서)
- 음성 메시지 전사 (Whisper)
- 세션 히스토리 조회
- 스킬 목록 조회 명령어 (`/skills`)
