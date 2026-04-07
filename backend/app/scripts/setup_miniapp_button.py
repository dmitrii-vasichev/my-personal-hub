"""One-time script: configure Telegram bot menu button to open Mini App.

Usage:
    python -m app.scripts.setup_miniapp_button <bot_token> <webapp_url>

Example:
    python -m app.scripts.setup_miniapp_button 123:ABC https://hub.example.com/miniapp
"""

import asyncio
import sys

from telegram import Bot, MenuButtonWebApp, WebAppInfo


async def setup_menu_button(bot_token: str, webapp_url: str) -> None:
    bot = Bot(token=bot_token)
    menu_button = MenuButtonWebApp(
        text="Reminders",
        web_app=WebAppInfo(url=webapp_url),
    )
    await bot.set_chat_menu_button(menu_button=menu_button)
    print(f"Bot menu button set: 'Reminders' -> {webapp_url}")


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    asyncio.run(setup_menu_button(sys.argv[1], sys.argv[2]))


if __name__ == "__main__":
    main()
