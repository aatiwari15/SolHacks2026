"""
agent.py — Gemini AI agent with context locking.

Responsibilities:
  1. analyze_page()  — Given raw scrape data, produce a locked FormConfig
                       (field list with human-readable questions + reliable selectors).
  2. resolve_fill_error() — Given a failed fill attempt + current screenshot,
                            suggest an alternative selector/strategy.
  3. detect_login()  — Return True + login field selectors if the page has a
                       login wall.

Context locking: once analyze_page() runs for a session, the returned config
is stored on `session.form_config` and `session.context_locked = True`.
All subsequent AI calls receive that locked config as part of the system prompt,
preventing selector drift across turns.
"""

from __future__ import annotations

import json
import os
import textwrap
from typing import Any

import google.generativeai as genai
from dotenv import load_dotenv

from session_store import FormSession

load_dotenv()
genai.configure(api_key=os.environ["GEMINI_API_KEY"])

_MODEL = "gemini-2.0-flash"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _model() -> genai.GenerativeModel:
    return genai.GenerativeModel(_MODEL)


def _parse_json_block(text: str) -> Any:
    """Extract the first JSON block from a model response."""
    # Try fenced code block first
    import re
    m = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if m:
        return json.loads(m.group(1).strip())
    # Otherwise try the whole response
    return json.loads(text.strip())


# ── System prompt builder ─────────────────────────────────────────────────────

_ANALYZE_SYSTEM = textwrap.dedent("""
You are FormBot, an expert at analysing web forms and government documents.

Given:
  • A page title + URL
  • Cleaned HTML (forms + inputs only)
  • A raw field inventory extracted by Selenium
  • A screenshot (if provided)

Your job is to return a JSON object with this exact shape:

{
  "form_type": "<government_form|login|registration|search|other>",
  "form_title": "<human-readable form name>",
  "requires_login": <true|false>,
  "login_hint": "<URL or instruction if login required, else null>",
  "multi_step": <true|false>,
  "fields": [
    {
      "field_key": "<snake_case unique key>",
      "label": "<exact label text on the page>",
      "question": "<plain-English question this field is asking the user>",
      "type": "<text|email|password|tel|date|select|checkbox|radio|textarea|file>",
      "selector": "<the most reliable CSS selector — prefer #id, then [name=...], then descriptive>",
      "required": <true|false>,
      "options": [<list of string options for select/radio/checkbox, else []>],
      "hint": "<any helper text, placeholder, or tooltip visible near the field>"
    }
  ],
  "submit": {
    "selector": "<CSS selector for the primary submit button>",
    "label": "<button text>"
  },
  "notes": "<any important observations: CAPTCHAs, dynamic fields, iframe embedding, etc.>"
}

Rules:
- Use #id selectors wherever available — they are most stable.
- Do NOT include hidden fields, submit buttons, or CSRF tokens in `fields`.
- For login pages, set form_type="login" and list only username/password/remember-me fields.
- If a field's purpose is ambiguous, write the clearest possible `question`.
- Return ONLY valid JSON, no prose before or after.
""").strip()

_FILL_SYSTEM = textwrap.dedent("""
You are FormBot. You previously analysed a web form and produced a locked config.
Below is the locked config. Do not alter field_key or selector values.
Your task is to advise on a fill strategy given a failed attempt.

Return JSON:
{
  "field_key": "<which field failed>",
  "strategy": "<direct|js_click|scroll_then_fill|select_by_text|select_by_value|checkbox_toggle>",
  "alternative_selector": "<try this selector instead, or null>",
  "js_snippet": "<optional JS to run in the browser before filling, or null>",
  "reason": "<why this strategy should work>"
}
""").strip()


# ── Public API ────────────────────────────────────────────────────────────────

def analyze_page(session: FormSession, page_info: dict) -> dict:
    """
    Run full AI analysis on the scraped page.
    Locks the result onto `session.form_config`.
    Returns the form config dict.
    """
    if session.context_locked and session.form_config:
        return session.form_config  # already locked — return cached

    model = _model()

    prompt_parts: list[Any] = [
        f"Page Title: {page_info['title']}\nURL: {page_info['url']}\n\n",
        f"=== CLEANED HTML ===\n{page_info['cleaned_html']}\n\n",
        f"=== RAW FIELD INVENTORY ===\n{json.dumps(page_info['raw_fields'], indent=2)}\n\n",
        f"=== PAGE TEXT SAMPLE ===\n{page_info['page_text']}\n\n",
        "Analyse this form and return the JSON config described in your system prompt.",
    ]

    # Attach screenshot if available
    if page_info.get("screenshot_b64"):
        import base64
        screenshot_bytes = base64.b64decode(page_info["screenshot_b64"])
        prompt_parts.insert(0, {
            "mime_type": "image/png",
            "data": screenshot_bytes,
        })

    response = model.generate_content(
        [_ANALYZE_SYSTEM] + prompt_parts,
        generation_config={"temperature": 0, "max_output_tokens": 2048},
    )

    config = _parse_json_block(response.text)

    # Lock context
    session.form_config = config
    session.context_locked = True

    return config


def resolve_fill_error(session: FormSession, field_key: str, error: str, screenshot_b64: str) -> dict:
    """
    Called when a fill attempt fails. Returns a recovery strategy.
    """
    if not session.form_config:
        return {"strategy": "direct", "alternative_selector": None, "js_snippet": None, "reason": "no config"}

    model = _model()

    import base64
    screenshot_bytes = base64.b64decode(screenshot_b64)

    prompt = (
        f"=== LOCKED FORM CONFIG ===\n{json.dumps(session.form_config, indent=2)}\n\n"
        f"=== FILL HISTORY ===\n{json.dumps(session.fill_history[-5:], indent=2)}\n\n"
        f"Failed field: {field_key}\n"
        f"Error: {error}\n\n"
        "Suggest a recovery strategy."
    )

    response = model.generate_content(
        [
            _FILL_SYSTEM,
            {"mime_type": "image/png", "data": screenshot_bytes},
            prompt,
        ],
        generation_config={"temperature": 0.2, "max_output_tokens": 512},
    )

    try:
        return _parse_json_block(response.text)
    except Exception:
        return {"strategy": "direct", "alternative_selector": None, "js_snippet": None, "reason": response.text}


def detect_login(session: FormSession, page_info: dict) -> dict:
    """
    Quick check: does this page have a login wall?
    Returns {"has_login": bool, "username_selector": str|None, "password_selector": str|None}
    """
    form_config = session.form_config
    if form_config:
        has_login = form_config.get("requires_login", False) or form_config.get("form_type") == "login"
        fields = form_config.get("fields", [])
        user_sel = next((f["selector"] for f in fields if f["type"] in ("email", "text") and "user" in f["field_key"].lower()), None)
        pass_sel = next((f["selector"] for f in fields if f["type"] == "password"), None)
        return {"has_login": has_login, "username_selector": user_sel, "password_selector": pass_sel}

    # Fast heuristic check without a full AI call
    raw = page_info.get("raw_fields", [])
    has_password = any(f.get("type") == "password" for f in raw)
    return {
        "has_login": has_password,
        "username_selector": None,
        "password_selector": next((f["selector"] for f in raw if f.get("type") == "password"), None),
    }
