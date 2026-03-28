"""
form_filler.py — Fill a web form using a locked FormConfig + user-supplied answers.

Features:
  - Handles text, email, tel, date, select (by text or value), checkbox, radio, textarea
  - JS fallback for stubborn fields
  - Scroll-into-view before every interaction
  - Calls agent.resolve_fill_error() on failure and retries once with the
    AI-suggested alternative strategy
  - Returns a per-field fill report
"""

from __future__ import annotations

import time
from typing import Any

from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

import agent as ai_agent
from session_store import FormSession


# ── Public entry point ────────────────────────────────────────────────────────

def fill_form(session: FormSession, answers: dict[str, str]) -> dict:
    """
    Fill the form using `answers` = {field_key: value}.
    Returns {"results": [...], "success": bool, "errors": [...]}
    """
    if not session.form_config:
        return {"results": [], "success": False, "errors": ["No locked form config. Run /analyze first."]}

    driver = session.driver
    results: list[dict] = []
    errors: list[str] = []

    fields = session.form_config.get("fields", [])
    field_map = {f["field_key"]: f for f in fields}

    for field_key, value in answers.items():
        if not value:
            continue

        field_def = field_map.get(field_key)
        if not field_def:
            errors.append(f"Unknown field_key: {field_key}")
            continue

        result = _fill_field(driver, session, field_def, value)
        results.append(result)
        if not result["ok"]:
            errors.append(f"{field_key}: {result['error']}")

        session.fill_history.append({
            "field_key": field_key,
            "value": value,
            "result": result,
        })
        time.sleep(0.25)  # small pause between fields — looks more human

    return {
        "results": results,
        "success": len(errors) == 0,
        "errors": errors,
    }


def click_submit(session: FormSession) -> dict:
    """Click the submit button identified in form_config."""
    driver = session.driver
    submit = (session.form_config or {}).get("submit", {})
    selector = submit.get("selector")

    if not selector:
        # Fallback: find any submit-type input or button
        try:
            btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit']")
            btn.click()
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    try:
        el = _find(driver, selector)
        _scroll_to(driver, el)
        el.click()
        time.sleep(1.5)
        return {"ok": True, "current_url": driver.current_url}
    except Exception as e:
        return {"ok": False, "error": str(e)}


# ── Field filling ─────────────────────────────────────────────────────────────

def _fill_field(driver, session: FormSession, field_def: dict, value: str) -> dict:
    selector = field_def["selector"]
    field_type = field_def.get("type", "text")
    field_key = field_def["field_key"]

    try:
        el = _find(driver, selector, timeout=8)
        _scroll_to(driver, el)
        _apply_value(driver, el, field_type, value, field_def)
        return {"field_key": field_key, "ok": True, "value": value}

    except Exception as primary_err:
        # ── AI-assisted recovery ──────────────────────────────────────────────
        screenshot_b64 = driver.get_screenshot_as_base64()
        recovery = ai_agent.resolve_fill_error(
            session, field_key, str(primary_err), screenshot_b64
        )

        alt_selector = recovery.get("alternative_selector") or selector
        strategy = recovery.get("strategy", "direct")
        js_snippet = recovery.get("js_snippet")

        try:
            if js_snippet:
                driver.execute_script(js_snippet)
                time.sleep(0.3)

            el = _find(driver, alt_selector, timeout=6)
            _scroll_to(driver, el)

            if strategy == "js_click":
                driver.execute_script("arguments[0].click();", el)
                time.sleep(0.2)
                _apply_value(driver, el, field_type, value, field_def)
            elif strategy == "select_by_text":
                Select(el).select_by_visible_text(value)
            elif strategy == "select_by_value":
                Select(el).select_by_value(value)
            elif strategy == "checkbox_toggle":
                current = el.is_selected()
                want = value.lower() in ("true", "yes", "1", "on")
                if current != want:
                    el.click()
            else:
                _apply_value(driver, el, field_type, value, field_def)

            return {"field_key": field_key, "ok": True, "value": value, "recovery": strategy}

        except Exception as retry_err:
            return {
                "field_key": field_key,
                "ok": False,
                "value": value,
                "error": f"Primary: {primary_err} | Retry ({strategy}): {retry_err}",
            }


def _apply_value(driver, el, field_type: str, value: str, field_def: dict) -> None:
    if field_type in ("checkbox", "radio"):
        want = value.lower() in ("true", "yes", "1", "on")
        if el.is_selected() != want:
            el.click()

    elif field_type == "select":
        sel = Select(el)
        try:
            sel.select_by_visible_text(value)
        except Exception:
            try:
                sel.select_by_value(value)
            except Exception:
                # Try partial match
                for opt in sel.options:
                    if value.lower() in opt.text.lower():
                        opt.click()
                        break

    elif field_type == "file":
        el.send_keys(value)  # value should be an absolute file path

    elif field_type == "date":
        # Clear and type; date inputs are finicky across browsers
        driver.execute_script("arguments[0].value = '';", el)
        el.send_keys(value)
        # Some date pickers need a blur to register
        el.send_keys(Keys.TAB)

    else:
        # Standard text-like inputs
        el.click()
        # Triple-click to select all existing text, then replace
        el.send_keys(Keys.CONTROL + "a")
        time.sleep(0.05)
        el.send_keys(Keys.DELETE)
        time.sleep(0.05)
        el.send_keys(value)


# ── Selenium helpers ──────────────────────────────────────────────────────────

def _find(driver, selector: str, timeout: int = 10):
    """
    Find element by CSS selector. Falls back to XPath if selector starts with '/'.
    """
    by = By.XPATH if selector.startswith("/") else By.CSS_SELECTOR
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((by, selector))
    )


def _scroll_to(driver, el) -> None:
    driver.execute_script(
        "arguments[0].scrollIntoView({block:'center', behavior:'smooth'});", el
    )
    time.sleep(0.3)
