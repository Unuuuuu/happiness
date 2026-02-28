# Telegram-Claude Code tmux 브릿지 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Telegram에서 Claude Code 스킬을 비개발자도 사용할 수 있는 tmux 브릿지 봇을 구축한다.

**Architecture:** Python Telegram Bot + Starlette HTTP 서버를 단일 프로세스로 실행. 사용자별 tmux 세션에서 Claude Code TUI를 실행하고, Claude Code 훅(Notification, Stop)이 HTTP로 봇에 이벤트를 전달하면 봇이 Telegram으로 중계한다.

**Tech Stack:** Python 3.11+, python-telegram-bot v20+, Starlette, uvicorn, libtmux, aiosqlite, cloudflared

**설계 문서:** `docs/plans/2026-02-28-telegram-claude-code-bridge-design.md`

---

## Task 1: 프로젝트 스캐폴딩

**Files:**
- Create: `cc-telegram-bridge/bot.py` (메인 엔트리포인트)
- Create: `cc-telegram-bridge/requirements.txt`
- Create: `cc-telegram-bridge/.env.example`

**Step 1: 디렉토리 생성 및 requirements.txt 작성**

```txt
python-telegram-bot>=20.0
starlette>=0.37.0
uvicorn>=0.29.0
libtmux>=0.37.0
aiosqlite>=0.20.0
```

**Step 2: .env.example 작성**

```bash
TELEGRAM_BOT_TOKEN=your-bot-token-here
PROJECT_DIR=/path/to/your/project
PROJECT_NAME=my-project          # tmux 네임스페이스 (기본: 디렉토리명)
WEBHOOK_URL=https://cc-bridge.yourdomain.com
BOT_PORT=7777                    # 다중 인스턴스 시 포트를 다르게 설정
ALLOWED_TELEGRAM_USERS=123456789,987654321
SESSION_IDLE_MINUTES=30
DATA_DIR=./data                  # DB 등 데이터 저장 경로
```

**Step 3: bot.py 빈 엔트리포인트 작성**

```python
import asyncio
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    logger.info("CC Telegram Bridge starting...")

if __name__ == "__main__":
    asyncio.run(main())
```

**Step 4: 실행 확인**

Run: `cd cc-telegram-bridge && python bot.py`
Expected: "CC Telegram Bridge starting..." 로그 출력 후 종료

**Step 5: 커밋**

```bash
git add cc-telegram-bridge/
git commit -m "feat: Telegram-Claude Code 브릿지 프로젝트 스캐폴딩"
```

---

## Task 2: SQLite 세션 저장소

**Files:**
- Create: `cc-telegram-bridge/db.py`

**Step 1: db.py 작성**

```python
import os

import aiosqlite

DB_PATH = os.path.join(os.environ.get("DATA_DIR", "."), "bridge.db")


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                telegram_user_id INTEGER PRIMARY KEY,
                tmux_session_name TEXT NOT NULL,
                claude_session_id TEXT,
                processing_msg_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await db.commit()


async def upsert_session(telegram_user_id: int, tmux_session_name: str, claude_session_id: str | None = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO sessions (telegram_user_id, tmux_session_name, claude_session_id, last_activity)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(telegram_user_id) DO UPDATE SET
                tmux_session_name = excluded.tmux_session_name,
                claude_session_id = COALESCE(excluded.claude_session_id, sessions.claude_session_id),
                last_activity = CURRENT_TIMESTAMP
        """, (telegram_user_id, tmux_session_name, claude_session_id))
        await db.commit()


async def get_user_id_for_session(claude_session_id: str) -> int | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT telegram_user_id FROM sessions WHERE claude_session_id = ?",
            (claude_session_id,)
        ) as cursor:
            row = await cursor.fetchone()
            return row["telegram_user_id"] if row else None


async def update_claude_session_id(tmux_session_name: str, claude_session_id: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE sessions SET claude_session_id = ? WHERE tmux_session_name = ?",
            (claude_session_id, tmux_session_name)
        )
        await db.commit()


async def store_processing_msg(telegram_user_id: int, message_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "UPDATE sessions SET processing_msg_id = ? WHERE telegram_user_id = ?",
            (message_id, telegram_user_id)
        )
        await db.commit()


async def get_and_clear_processing_msg(telegram_user_id: int) -> int | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT processing_msg_id FROM sessions WHERE telegram_user_id = ?",
            (telegram_user_id,)
        ) as cursor:
            row = await cursor.fetchone()
            msg_id = row["processing_msg_id"] if row else None
        if msg_id:
            await db.execute(
                "UPDATE sessions SET processing_msg_id = NULL WHERE telegram_user_id = ?",
                (telegram_user_id,)
            )
            await db.commit()
        return msg_id


async def get_stale_sessions(idle_minutes: int = 30) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT telegram_user_id, tmux_session_name
            FROM sessions
            WHERE last_activity < datetime('now', ? || ' minutes')
        """, (f"-{idle_minutes}",)) as cursor:
            return [dict(row) async for row in cursor]


async def delete_session(telegram_user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "DELETE FROM sessions WHERE telegram_user_id = ?",
            (telegram_user_id,)
        )
        await db.commit()
```

**Step 2: bot.py에서 DB 초기화 호출**

```python
from db import init_db

async def main():
    await init_db()
    logger.info("DB initialized")
```

**Step 3: 실행 확인**

Run: `python bot.py`
Expected: "DB initialized" 로그, `bridge.db` 파일 생성

**Step 4: 커밋**

```bash
git add cc-telegram-bridge/db.py cc-telegram-bridge/bot.py
git commit -m "feat: SQLite 세션 저장소 모듈 추가"
```

---

## Task 3: tmux 세션 매니저

**Files:**
- Create: `cc-telegram-bridge/session_manager.py`

**Step 1: session_manager.py 작성**

```python
import asyncio
import logging

import libtmux

logger = logging.getLogger(__name__)


class SessionManager:
    def __init__(self, project_dir: str, project_name: str):
        self.server = libtmux.Server()
        self.project_dir = project_dir
        self.project_name = project_name

    def _session_name(self, user_id: int) -> str:
        return f"{self.project_name}-{user_id}"

    def session_exists(self, user_id: int) -> bool:
        name = self._session_name(user_id)
        return self.server.sessions.get(session_name=name) is not None

    def create_session(self, user_id: int) -> str:
        name = self._session_name(user_id)
        if self.server.sessions.get(session_name=name):
            return name

        self.server.new_session(
            session_name=name,
            start_directory=self.project_dir,
            window_command="claude --dangerously-skip-permissions",
            attach=False,
        )
        logger.info(f"Created tmux session: {name}")
        return name

    def send_keys(self, user_id: int, text: str):
        name = self._session_name(user_id)
        session = self.server.sessions.get(session_name=name)
        if not session:
            raise RuntimeError(f"Session not found: {name}")

        pane = session.active_window.active_pane
        pane.send_keys(text, literal=True, enter=False)
        pane.send_keys("", enter=True)

    def kill_session(self, user_id: int):
        name = self._session_name(user_id)
        session = self.server.sessions.get(session_name=name)
        if session:
            session.kill()
            logger.info(f"Killed tmux session: {name}")


# Async wrappers

async def async_ensure_session(mgr: SessionManager, user_id: int) -> str:
    return await asyncio.to_thread(mgr.create_session, user_id)

async def async_send_keys(mgr: SessionManager, user_id: int, text: str):
    await asyncio.to_thread(mgr.send_keys, user_id, text)

async def async_kill_session(mgr: SessionManager, user_id: int):
    await asyncio.to_thread(mgr.kill_session, user_id)

async def async_session_exists(mgr: SessionManager, user_id: int) -> bool:
    return await asyncio.to_thread(mgr.session_exists, user_id)
```

**Step 2: 수동 확인**

Run: `python -c "from session_manager import SessionManager; m = SessionManager('/tmp'); print(m.session_exists(999))"`
Expected: `False` (세션 없으므로)

**Step 3: 커밋**

```bash
git add cc-telegram-bridge/session_manager.py
git commit -m "feat: tmux 세션 매니저 모듈 추가"
```

---

## Task 4: 메시지 유틸리티

**Files:**
- Create: `cc-telegram-bridge/message_utils.py`

**Step 1: message_utils.py 작성**

```python
import asyncio

MAX_TG_LENGTH = 4096


def split_message(text: str) -> list[str]:
    """4096자 기준으로 줄 경계에서 분할. 코드 블록 중간 절단 방지."""
    if len(text) <= MAX_TG_LENGTH:
        return [text]

    chunks = []
    in_code_block = False

    while text:
        if len(text) <= MAX_TG_LENGTH:
            chunks.append(text)
            break

        split_at = text.rfind("\n", 0, MAX_TG_LENGTH)
        if split_at == -1 or split_at < MAX_TG_LENGTH // 2:
            split_at = MAX_TG_LENGTH

        chunk = text[:split_at]

        backtick_count = chunk.count("```")
        if in_code_block:
            chunk = "```\n" + chunk
        if (backtick_count + (1 if in_code_block else 0)) % 2 == 1:
            chunk += "\n```"
            in_code_block = not in_code_block

        chunks.append(chunk)
        text = text[split_at:].lstrip("\n")

    return chunks


async def send_long_message(bot, chat_id: int, text: str):
    """긴 메시지를 분할하여 순차 전송."""
    chunks = split_message(text)
    for chunk in chunks:
        try:
            await bot.send_message(chat_id=chat_id, text=chunk, parse_mode="Markdown")
        except Exception:
            # Markdown 파싱 실패 시 plain text로 재시도
            await bot.send_message(chat_id=chat_id, text=chunk)
        if len(chunks) > 1:
            await asyncio.sleep(0.3)
```

**Step 2: 커밋**

```bash
git add cc-telegram-bridge/message_utils.py
git commit -m "feat: Telegram 메시지 분할 유틸리티 추가"
```

---

## Task 5: 훅 이벤트 핸들러

**Files:**
- Create: `cc-telegram-bridge/hook_handler.py`

**Step 1: hook_handler.py 작성**

이 모듈은 Claude Code 훅에서 POST로 전달받은 JSON을 처리하여 적절한 Telegram 메시지를 전송한다.

```python
import logging

from telegram import Bot

from db import get_user_id_for_session, get_and_clear_processing_msg, update_claude_session_id
from message_utils import send_long_message

logger = logging.getLogger(__name__)


async def handle_hook(payload: dict, bot: Bot):
    """Claude Code 훅 이벤트를 처리하여 Telegram으로 중계."""
    event = payload.get("hook_event_name")
    session_id = payload.get("session_id")

    if not session_id:
        logger.warning("Hook payload missing session_id")
        return

    # session_id로 Telegram 사용자 찾기
    user_id = await get_user_id_for_session(session_id)

    if not user_id:
        # 아직 매핑이 없으면, tmux 세션명에서 추론 시도
        # transcript_path에서 세션 정보를 얻을 수도 있음
        logger.warning(f"No user mapping for session: {session_id}")
        return

    if event == "Stop":
        await _handle_stop(payload, bot, user_id)
    elif event == "Notification":
        await _handle_notification(payload, bot, user_id)
    else:
        logger.info(f"Unhandled hook event: {event}")


async def _handle_stop(payload: dict, bot: Bot, user_id: int):
    # stop_hook_active 체크 (무한 루프 방지)
    if payload.get("stop_hook_active"):
        return

    text = payload.get("last_assistant_message", "")
    if not text:
        return

    # "처리 중..." 메시지 교체
    processing_msg_id = await get_and_clear_processing_msg(user_id)
    if processing_msg_id and len(text) <= 4096:
        try:
            await bot.edit_message_text(
                chat_id=user_id,
                message_id=processing_msg_id,
                text=text,
                parse_mode="Markdown",
            )
            return
        except Exception:
            pass

    # 교체 실패 시 "처리 중..." 삭제 후 새 메시지 전송
    if processing_msg_id:
        try:
            await bot.delete_message(chat_id=user_id, message_id=processing_msg_id)
        except Exception:
            pass

    await send_long_message(bot, user_id, text)


async def _handle_notification(payload: dict, bot: Bot, user_id: int):
    notification_type = payload.get("notification_type", "")
    message = payload.get("message", "")
    title = payload.get("title", "")

    if notification_type == "elicitation_dialog":
        text = f"📋 *질문이 있습니다:*\n{message}"
    elif notification_type == "permission_prompt":
        text = f"🔐 *권한 요청:*\n{message}"
    elif notification_type == "idle_prompt":
        text = f"⏳ *입력을 기다리고 있습니다*"
    else:
        text = f"ℹ️ {title}\n{message}" if title else message

    if text:
        try:
            await bot.send_message(chat_id=user_id, text=text, parse_mode="Markdown")
        except Exception:
            await bot.send_message(chat_id=user_id, text=text)
```

**Step 2: 커밋**

```bash
git add cc-telegram-bridge/hook_handler.py
git commit -m "feat: Claude Code 훅 이벤트 핸들러 추가"
```

---

## Task 6: Telegram 핸들러

**Files:**
- Create: `cc-telegram-bridge/telegram_handlers.py`

**Step 1: telegram_handlers.py 작성**

```python
import logging
import os

from telegram import Update
from telegram.ext import ContextTypes

from db import upsert_session, store_processing_msg
from session_manager import SessionManager, async_ensure_session, async_send_keys, async_kill_session

logger = logging.getLogger(__name__)

ALLOWED_USERS: set[int] = set()


def load_allowed_users():
    global ALLOWED_USERS
    raw = os.environ.get("ALLOWED_TELEGRAM_USERS", "")
    if raw:
        ALLOWED_USERS = {int(uid.strip()) for uid in raw.split(",") if uid.strip()}
    logger.info(f"Allowed users: {ALLOWED_USERS}")


def is_allowed(user_id: int) -> bool:
    return not ALLOWED_USERS or user_id in ALLOWED_USERS


async def handle_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_allowed(update.effective_user.id):
        return
    await update.message.reply_text(
        "Claude Code 브릿지에 연결되었습니다. 메시지를 보내면 Claude Code가 처리합니다."
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.effective_user.id
    if not is_allowed(user_id):
        return

    text = update.message.text
    if not text:
        return

    mgr: SessionManager = context.bot_data["session_manager"]

    # 세션 확보
    tmux_name = await async_ensure_session(mgr, user_id)
    await upsert_session(telegram_user_id=user_id, tmux_session_name=tmux_name)

    # "처리 중..." 전송
    processing_msg = await update.message.reply_text("⏳ 처리 중...")
    await store_processing_msg(user_id, processing_msg.message_id)

    # tmux에 메시지 주입
    await async_send_keys(mgr, user_id, text)


async def handle_reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """"/reset 명령: 현재 세션 종료 후 새 세션 시작."""
    user_id = update.effective_user.id
    if not is_allowed(user_id):
        return

    mgr: SessionManager = context.bot_data["session_manager"]
    await async_kill_session(mgr, user_id)
    await update.message.reply_text("세션이 초기화되었습니다. 다음 메시지부터 새 세션이 시작됩니다.")
```

**Step 2: 커밋**

```bash
git add cc-telegram-bridge/telegram_handlers.py
git commit -m "feat: Telegram 메시지 핸들러 추가"
```

---

## Task 7: 메인 애플리케이션 통합

**Files:**
- Modify: `cc-telegram-bridge/bot.py`

**Step 1: bot.py를 전체 통합 버전으로 재작성**

```python
import asyncio
import logging
import os

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import PlainTextResponse, Response
from starlette.routing import Route

from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters

from db import init_db
from hook_handler import handle_hook
from session_manager import SessionManager
from telegram_handlers import handle_start, handle_message, handle_reset, load_allowed_users

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger(__name__)

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
WEBHOOK_URL = os.environ["WEBHOOK_URL"]
PROJECT_DIR = os.environ["PROJECT_DIR"]
PROJECT_NAME = os.environ.get("PROJECT_NAME", os.path.basename(PROJECT_DIR))
PORT = int(os.environ.get("BOT_PORT", "7777"))


async def main():
    await init_db()
    load_allowed_users()

    session_mgr = SessionManager(project_dir=PROJECT_DIR, project_name=PROJECT_NAME)

    # PTB Application (updater=None for custom webhook handling)
    ptb = (
        Application.builder()
        .token(TOKEN)
        .updater(None)
        .build()
    )
    ptb.bot_data["session_manager"] = session_mgr

    ptb.add_handler(CommandHandler("start", handle_start))
    ptb.add_handler(CommandHandler("reset", handle_reset))
    ptb.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Starlette routes
    async def telegram_webhook(request: Request) -> Response:
        data = await request.json()
        update = Update.de_json(data=data, bot=ptb.bot)
        await ptb.update_queue.put(update)
        return Response()

    async def hook_endpoint(request: Request) -> PlainTextResponse:
        payload = await request.json()
        await handle_hook(payload, ptb.bot)
        return PlainTextResponse("OK")

    async def health(request: Request) -> PlainTextResponse:
        return PlainTextResponse("running")

    starlette_app = Starlette(routes=[
        Route("/telegram", telegram_webhook, methods=["POST"]),
        Route("/hook", hook_endpoint, methods=["POST"]),
        Route("/health", health, methods=["GET"]),
    ])

    webserver = uvicorn.Server(
        config=uvicorn.Config(
            app=starlette_app,
            port=PORT,
            host="0.0.0.0",
            use_colors=False,
        )
    )

    async with ptb:
        await ptb.bot.set_webhook(
            url=f"{WEBHOOK_URL}/telegram",
            allowed_updates=Update.ALL_TYPES,
        )
        await ptb.start()
        logger.info(f"Bot running on port {PORT}, webhook: {WEBHOOK_URL}/telegram")
        await webserver.serve()
        await ptb.stop()


if __name__ == "__main__":
    asyncio.run(main())
```

**Step 2: 로컬 실행 확인 (Telegram 연결 전)**

Run: `TELEGRAM_BOT_TOKEN=test WEBHOOK_URL=https://test.com python bot.py`
Expected: 서버 시작, Telegram webhook 설정 시도 (토큰이 잘못되어 에러) — 코드 구조가 올바른지 확인용

**Step 3: 커밋**

```bash
git add cc-telegram-bridge/bot.py
git commit -m "feat: 메인 애플리케이션 통합 — Starlette + PTB + 훅 엔드포인트"
```

---

## Task 8: 훅 설치 CLI 명령

**Files:**
- Create: `cc-telegram-bridge/installer.py`

**Step 1: installer.py 작성**

대상 프로젝트의 `.claude/settings.json`에 훅을 자동 병합하는 CLI 명령.
별도 셸 스크립트 파일 없이 인라인 명령으로 처리하므로 프로젝트에 파일을 추가하지 않는다.

```python
import json
import os
import sys


def install_hooks(project_dir: str, port: int = 7777):
    """대상 프로젝트의 .claude/settings.json에 브릿지 훅을 병합."""
    settings_path = os.path.join(project_dir, ".claude", "settings.json")

    # 기존 설정 로드
    if os.path.exists(settings_path):
        with open(settings_path) as f:
            settings = json.load(f)
    else:
        os.makedirs(os.path.dirname(settings_path), exist_ok=True)
        settings = {}

    hooks = settings.setdefault("hooks", {})

    # Notification 훅 추가
    notify_cmd = (
        f"cat | curl -s -X POST http://localhost:{port}/hook "
        f"-H 'Content-Type: application/json' -d @- > /dev/null 2>&1 &"
    )
    notify_hook = {"hooks": [{"type": "command", "command": notify_cmd}]}

    # Stop 훅 추가 (stop_hook_active 체크 포함)
    stop_cmd = (
        f'INPUT=$(cat); '
        f'STOP_ACTIVE=$(echo "$INPUT" | jq -r \'.stop_hook_active // false\'); '
        f'[ "$STOP_ACTIVE" = "true" ] && exit 0; '
        f'echo "$INPUT" | curl -s -X POST http://localhost:{port}/hook '
        f'-H \'Content-Type: application/json\' -d @- > /dev/null 2>&1 &'
    )
    stop_hook = {"hooks": [{"type": "command", "command": stop_cmd}]}

    # 기존 훅과 병합 (기존 항목을 유지하고 추가)
    hooks.setdefault("Notification", []).append(notify_hook)
    hooks.setdefault("Stop", []).append(stop_hook)

    with open(settings_path, "w") as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)

    print(f"Hooks installed to {settings_path} (port {port})")


def uninstall_hooks(project_dir: str, port: int = 7777):
    """대상 프로젝트에서 브릿지 훅을 제거."""
    settings_path = os.path.join(project_dir, ".claude", "settings.json")
    if not os.path.exists(settings_path):
        print("No settings.json found")
        return

    with open(settings_path) as f:
        settings = json.load(f)

    hooks = settings.get("hooks", {})
    port_str = f"localhost:{port}"

    for event in ["Notification", "Stop"]:
        if event in hooks:
            hooks[event] = [
                h for h in hooks[event]
                if not any(port_str in hook.get("command", "") for hook in h.get("hooks", []))
            ]
            if not hooks[event]:
                del hooks[event]

    with open(settings_path, "w") as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)

    print(f"Hooks removed from {settings_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python installer.py install|uninstall <project_dir> [port]")
        sys.exit(1)

    action = sys.argv[1]
    project_dir = os.path.expanduser(sys.argv[2])
    port = int(sys.argv[3]) if len(sys.argv) > 3 else 7777

    if action == "install":
        install_hooks(project_dir, port)
    elif action == "uninstall":
        uninstall_hooks(project_dir, port)
    else:
        print(f"Unknown action: {action}")
        sys.exit(1)
```

**Step 2: 실행 확인**

Run: `python installer.py install /tmp/test-project 7777`
Expected: `/tmp/test-project/.claude/settings.json` 생성, 훅 설정 포함

Run: `python installer.py uninstall /tmp/test-project 7777`
Expected: 훅 설정 제거

**Step 3: 커밋**

```bash
git add cc-telegram-bridge/installer.py
git commit -m "feat: 프로젝트별 훅 설치/제거 CLI 명령 추가"
```

---

## Task 9: session_id 매핑 해결

**Files:**
- Modify: `cc-telegram-bridge/hook_handler.py`
- Modify: `cc-telegram-bridge/db.py`

**문제:** Claude Code 훅은 `session_id`를 전달하지만, tmux 세션 생성 시에는 이 값을 알 수 없다. 첫 훅 콜백에서 매핑을 완성해야 한다.

**Step 1: hook_handler.py에 역매핑 로직 추가**

`handle_hook` 함수 상단에 아래 로직 추가:

```python
async def handle_hook(payload: dict, bot: Bot):
    event = payload.get("hook_event_name")
    session_id = payload.get("session_id")

    if not session_id:
        return

    user_id = await get_user_id_for_session(session_id)

    if not user_id:
        # transcript_path에서 tmux 세션 추론:
        # ~/.claude/projects/-Users-user-Projects-happiness/sessions/{session_id}.jsonl
        # 또는 cwd를 기반으로 전체 세션 테이블 스캔하여
        # claude_session_id가 NULL인 행에 매핑
        user_id = await try_map_session(session_id)
        if not user_id:
            logger.warning(f"Cannot map session: {session_id}")
            return

    # ... 나머지 이벤트 처리
```

**Step 2: db.py에 try_map_session 추가**

```python
async def try_map_session(claude_session_id: str) -> int | None:
    """claude_session_id가 NULL인 가장 최근 세션에 매핑 시도."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT telegram_user_id, tmux_session_name
            FROM sessions
            WHERE claude_session_id IS NULL
            ORDER BY last_activity DESC
            LIMIT 1
        """) as cursor:
            row = await cursor.fetchone()
            if row:
                await db.execute(
                    "UPDATE sessions SET claude_session_id = ? WHERE telegram_user_id = ?",
                    (claude_session_id, row["telegram_user_id"])
                )
                await db.commit()
                return row["telegram_user_id"]
    return None
```

**Step 3: 커밋**

```bash
git add cc-telegram-bridge/hook_handler.py cc-telegram-bridge/db.py
git commit -m "feat: 훅 session_id → Telegram user_id 역매핑 로직 추가"
```

---

## Task 10: 세션 정리 스케줄러

**Files:**
- Create: `cc-telegram-bridge/cleanup.py`
- Modify: `cc-telegram-bridge/bot.py`

**Step 1: cleanup.py 작성**

```python
import asyncio
import logging
import os

from db import get_stale_sessions, delete_session
from session_manager import SessionManager, async_kill_session

logger = logging.getLogger(__name__)

IDLE_MINUTES = int(os.environ.get("SESSION_IDLE_MINUTES", "30"))


async def cleanup_loop(session_mgr: SessionManager):
    """주기적으로 유휴 세션을 정리."""
    while True:
        try:
            stale = await get_stale_sessions(IDLE_MINUTES)
            for s in stale:
                user_id = s["telegram_user_id"]
                await async_kill_session(session_mgr, user_id)
                await delete_session(user_id)
                logger.info(f"Cleaned up stale session for user {user_id}")
        except Exception as e:
            logger.error(f"Cleanup error: {e}")

        await asyncio.sleep(300)  # 5분마다 실행
```

**Step 2: bot.py에서 cleanup 태스크 시작**

`main()` 함수에서 `await ptb.start()` 뒤에 추가:

```python
from cleanup import cleanup_loop

# ptb.start() 이후:
cleanup_task = asyncio.create_task(cleanup_loop(session_mgr))
```

`await ptb.stop()` 앞에서 정리:

```python
cleanup_task.cancel()
```

**Step 3: 커밋**

```bash
git add cc-telegram-bridge/cleanup.py cc-telegram-bridge/bot.py
git commit -m "feat: 유휴 세션 자동 정리 스케줄러 추가"
```

---

## Task 11: 배포 설정 (다중 인스턴스)

**Files:**
- Create: `cc-telegram-bridge/systemd/cc-bridge@.service`
- Create: `cc-telegram-bridge/deploy.sh`

**Step 1: systemd 템플릿 유닛 작성**

`cc-bridge@.service` — `%i`가 인스턴스 이름(프로젝트명)으로 치환됨:

```ini
[Unit]
Description=Claude Code Telegram Bridge (%i)
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/cc-telegram-bridge/bot.py
Restart=always
RestartSec=5
EnvironmentFile=/etc/cc-bridge/%i.env

[Install]
WantedBy=multi-user.target
```

**Step 2: deploy.sh 작성**

```bash
#!/bin/bash
set -e

INSTALL_DIR=/opt/cc-telegram-bridge
INSTANCE_NAME=${1:?사용법: ./deploy.sh <instance-name>}

echo "=== CC Telegram Bridge 배포: $INSTANCE_NAME ==="

# 브릿지 코드 설치 (최초 1회)
sudo mkdir -p "$INSTALL_DIR"
sudo cp bot.py db.py session_manager.py message_utils.py \
  hook_handler.py telegram_handlers.py cleanup.py installer.py \
  requirements.txt "$INSTALL_DIR/"
cd "$INSTALL_DIR"
pip install -r requirements.txt

# 인스턴스 환경 파일 확인
if [ ! -f "/etc/cc-bridge/${INSTANCE_NAME}.env" ]; then
  sudo mkdir -p /etc/cc-bridge
  echo "환경 파일을 생성하세요: /etc/cc-bridge/${INSTANCE_NAME}.env"
  echo "예시:"
  echo "  TELEGRAM_BOT_TOKEN=..."
  echo "  PROJECT_DIR=/path/to/project"
  echo "  PROJECT_NAME=$INSTANCE_NAME"
  echo "  WEBHOOK_URL=https://..."
  echo "  BOT_PORT=7777"
  echo "  ALLOWED_TELEGRAM_USERS=..."
  echo "  DATA_DIR=/var/lib/cc-bridge/$INSTANCE_NAME"
  exit 1
fi

# 데이터 디렉토리 생성
DATA_DIR=$(grep DATA_DIR "/etc/cc-bridge/${INSTANCE_NAME}.env" | cut -d= -f2)
sudo mkdir -p "${DATA_DIR:-/var/lib/cc-bridge/$INSTANCE_NAME}"

# 대상 프로젝트에 훅 설치
PROJECT_DIR=$(grep PROJECT_DIR "/etc/cc-bridge/${INSTANCE_NAME}.env" | cut -d= -f2)
BOT_PORT=$(grep BOT_PORT "/etc/cc-bridge/${INSTANCE_NAME}.env" | cut -d= -f2)
python3 installer.py install "$PROJECT_DIR" "${BOT_PORT:-7777}"

# systemd 등록
sudo cp systemd/cc-bridge@.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable "cc-bridge@${INSTANCE_NAME}"
sudo systemctl restart "cc-bridge@${INSTANCE_NAME}"

echo "=== 배포 완료: $INSTANCE_NAME ==="
echo "상태 확인: sudo systemctl status cc-bridge@${INSTANCE_NAME}"
```

**Step 3: 사용 예시**

```bash
# happiness 프로젝트 인스턴스 배포
./deploy.sh happiness

# work-tools 프로젝트 인스턴스 추가 배포
./deploy.sh work-tools

# 인스턴스 관리
sudo systemctl status cc-bridge@happiness
sudo systemctl status cc-bridge@work-tools
sudo systemctl stop cc-bridge@happiness
```

**Step 4: 커밋**

```bash
git add cc-telegram-bridge/systemd/ cc-telegram-bridge/deploy.sh
chmod +x cc-telegram-bridge/deploy.sh
git commit -m "feat: 다중 인스턴스 systemd 템플릿 및 배포 스크립트 추가"
```

---

## Task 12: 엔드투엔드 수동 검증

**사전 조건:**
- 홈서버에 Claude Code CLI 설치 및 `claude login` 완료
- tmux 설치
- Telegram Bot 토큰 발급 (@BotFather)
- Cloudflare Tunnel 설정 완료
- `.env` 파일 작성

**Step 1: 서비스 시작**

```bash
# Cloudflare Tunnel 시작 (별도 설정)
sudo systemctl start cc-bridge-tunnel

# happiness 인스턴스 시작
sudo systemctl start cc-bridge@happiness
```

**Step 2: 기본 동작 확인**

1. Telegram에서 봇에 `/start` 전송 → 환영 메시지 수신 확인
2. "안녕" 전송 → "처리 중..." 표시 후 Claude 응답 수신 확인
3. "이 프로젝트에 어떤 스킬이 있어?" → Claude가 스킬 목록 응답 확인

**Step 3: 인터랙티브 스킬 확인**

1. Claude가 AskUserQuestion을 사용하는 질문을 유도
2. Notification 훅이 발동하여 Telegram에 질문 전달 확인
3. Telegram에서 답변 → Claude가 계속 진행 확인

**Step 4: 세션 관리 확인**

1. `/reset` → 세션 초기화 메시지 확인
2. 다음 메시지 → 새 세션에서 처리 확인

**Step 5: 커밋**

```bash
git commit --allow-empty -m "docs: 엔드투엔드 수동 검증 완료"
```
