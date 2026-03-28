"""
session_store.py — In-memory store for browser sessions + locked form contexts.

Each session holds:
  - A live Selenium WebDriver (kept open between requests)
  - The locked form config (JSON) once analysis is complete
  - Screenshot history and fill history for the AI agent
  - The original URL
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any

import undetected_chromedriver as uc
from selenium.webdriver.chrome.options import Options


# ── Session model ─────────────────────────────────────────────────────────────

@dataclass
class FormSession:
    session_id: str
    url: str
    driver: Any                          # uc.Chrome instance
    form_config: dict | None = None      # Locked after first /analyze
    context_locked: bool = False
    fill_history: list[dict] = field(default_factory=list)
    screenshot_history: list[str] = field(default_factory=list)  # base64
    current_tab_handle: str | None = None


# ── Global registry ───────────────────────────────────────────────────────────

_sessions: dict[str, FormSession] = {}
_lock = threading.Lock()


# ── Driver factory ────────────────────────────────────────────────────────────

def _make_driver() -> uc.Chrome:
    """
    Create an undetected Chrome instance.
    undetected-chromedriver patches CDP to avoid bot-detection fingerprints.
    """
    options = uc.ChromeOptions()
    # Keep the browser window visible so the user can handle CAPTCHAs / MFA.
    # Remove the next line to run headless (but many sites will block it).
    # options.add_argument("--headless=new")
    options.add_argument("--window-size=1440,900")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    driver = uc.Chrome(options=options, use_subprocess=True)
    driver.execute_script(
        "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    )
    return driver


# ── Public API ────────────────────────────────────────────────────────────────

def create_session(url: str) -> FormSession:
    sid = str(uuid.uuid4())[:8]
    driver = _make_driver()
    session = FormSession(session_id=sid, url=url, driver=driver)
    with _lock:
        _sessions[sid] = session
    return session


def get_session(session_id: str) -> FormSession | None:
    return _sessions.get(session_id)


def list_sessions() -> list[str]:
    return list(_sessions.keys())


def close_session(session_id: str) -> None:
    with _lock:
        session = _sessions.pop(session_id, None)
    if session:
        try:
            session.driver.quit()
        except Exception:
            pass


def close_all() -> None:
    with _lock:
        sids = list(_sessions.keys())
    for sid in sids:
        close_session(sid)
