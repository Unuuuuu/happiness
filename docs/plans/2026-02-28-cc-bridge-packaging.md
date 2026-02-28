# cc-telegram-bridge 패키징 및 배포 가이드

> 구현 완료 후 적용. git clone + 수동 실행 방식에서 pip 패키지로 전환.

## 목표

`pip install`로 설치하고 `cc-bridge` CLI 명령으로 실행할 수 있게 패키징한다.

## 변경 사항

### 1. pyproject.toml 추가

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "cc-telegram-bridge"
version = "0.1.0"
description = "Telegram bridge for Claude Code via tmux"
requires-python = ">=3.11"
dependencies = [
    "python-telegram-bot>=20.0",
    "starlette>=0.37.0",
    "uvicorn>=0.29.0",
    "libtmux>=0.37.0",
    "aiosqlite>=0.20.0",
]

[project.scripts]
cc-bridge = "cc_telegram_bridge.cli:main"
```

### 2. 디렉토리 구조 변경

```
cc-telegram-bridge/
├── pyproject.toml
├── src/
│   └── cc_telegram_bridge/
│       ├── __init__.py
│       ├── cli.py          ← 엔트리포인트
│       ├── bot.py
│       ├── db.py
│       ├── session_manager.py
│       ├── message_utils.py
│       ├── hook_handler.py
│       ├── telegram_handlers.py
│       ├── cleanup.py
│       └── installer.py
└── README.md
```

### 3. cli.py 엔트리포인트

```python
import argparse
import asyncio
import sys


def main():
    parser = argparse.ArgumentParser(description="Claude Code Telegram Bridge")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("run", help="브릿지 봇 실행")

    install_parser = sub.add_parser("install", help="프로젝트에 훅 설치")
    install_parser.add_argument("project_dir")
    install_parser.add_argument("--port", type=int, default=7777)

    uninstall_parser = sub.add_parser("uninstall", help="프로젝트에서 훅 제거")
    uninstall_parser.add_argument("project_dir")
    uninstall_parser.add_argument("--port", type=int, default=7777)

    args = parser.parse_args()

    if args.command == "run":
        from .bot import main as bot_main
        asyncio.run(bot_main())
    elif args.command == "install":
        from .installer import install_hooks
        install_hooks(args.project_dir, args.port)
    elif args.command == "uninstall":
        from .installer import uninstall_hooks
        uninstall_hooks(args.project_dir, args.port)
    else:
        parser.print_help()
        sys.exit(1)
```

## 배포 절차

### 서버에 설치

```bash
pip install git+https://github.com/yourname/cc-telegram-bridge
```

### 프로젝트에 훅 설치

```bash
cc-bridge install ~/Projects/happiness --port 7777
```

### 환경 파일 생성

```bash
sudo mkdir -p /etc/cc-bridge
sudo cat > /etc/cc-bridge/happiness.env << 'EOF'
TELEGRAM_BOT_TOKEN=...
PROJECT_DIR=/home/user/Projects/happiness
PROJECT_NAME=happiness
WEBHOOK_URL=https://cc-bridge.example.com
BOT_PORT=7777
ALLOWED_TELEGRAM_USERS=...
DATA_DIR=/var/lib/cc-bridge/happiness
EOF
```

### systemd 등록

```ini
# /etc/systemd/system/cc-bridge@.service
[Unit]
Description=Claude Code Telegram Bridge (%i)
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cc-bridge run
Restart=always
RestartSec=5
EnvironmentFile=/etc/cc-bridge/%i.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable cc-bridge@happiness
sudo systemctl start cc-bridge@happiness
```

### 업데이트

```bash
pip install --upgrade git+https://github.com/yourname/cc-telegram-bridge
sudo systemctl restart cc-bridge@happiness
```

### 프로젝트 추가

```bash
# 새 프로젝트용 봇 토큰 발급 (@BotFather)
# 환경 파일 생성
sudo cat > /etc/cc-bridge/work-tools.env << 'EOF'
TELEGRAM_BOT_TOKEN=...
PROJECT_DIR=/home/user/Projects/work-tools
PROJECT_NAME=work-tools
WEBHOOK_URL=https://cc-bridge.example.com
BOT_PORT=7778
...
EOF

# 훅 설치 + 서비스 시작
cc-bridge install ~/Projects/work-tools --port 7778
sudo systemctl enable --now cc-bridge@work-tools
```
