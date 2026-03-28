"""
scraper.py — Navigate to a URL and extract everything the AI needs:
  - Page title + current URL
  - Cleaned HTML (only interactive + labelling elements, ~10 KB)
  - Full-page screenshot (base64 PNG)
  - Raw field inventory (inputs, selects, textareas) with best-guess selectors
"""

from __future__ import annotations

import base64
import time
from typing import Any

from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from session_store import FormSession


# ── Public entry point ────────────────────────────────────────────────────────

def scrape_page(session: FormSession, url: str | None = None) -> dict:
    """
    Navigate to `url` (or stay on current page if None) and return a
    page-info dict ready to be passed to the AI agent.
    """
    driver = session.driver
    target = url or session.url

    if url:
        driver.get(url)

    # Wait for the DOM to settle
    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
    except Exception:
        pass
    time.sleep(1.5)  # JS frameworks need a moment after DOMContentLoaded

    screenshot_b64 = driver.get_screenshot_as_base64()
    session.screenshot_history.append(screenshot_b64)

    html = driver.page_source
    cleaned_html = _clean_html(html)
    raw_fields = _extract_raw_fields(driver, html)

    return {
        "url": driver.current_url,
        "title": driver.title,
        "screenshot_b64": screenshot_b64,
        "cleaned_html": cleaned_html,
        "raw_fields": raw_fields,
        "page_text": _visible_text(html)[:4000],
    }


# ── HTML cleaning ─────────────────────────────────────────────────────────────

_KEEP_TAGS = {
    "form", "input", "select", "textarea", "label", "button",
    "legend", "fieldset", "optgroup", "option",
    "h1", "h2", "h3", "h4", "p", "span", "div", "a",
    "li", "ul", "ol", "table", "tr", "td", "th",
}

_DROP_ATTRS = {
    "style", "class", "onclick", "onchange", "onblur", "onfocus",
    "onkeyup", "onkeydown", "data-reactid", "data-v-",
}


def _clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "svg", "img", "meta", "link", "noscript"]):
        tag.decompose()

    # Strip noisy attributes but keep id, name, type, placeholder, for, value
    for tag in soup.find_all(True):
        attrs_to_remove = [
            k for k in list(tag.attrs)
            if any(k.startswith(d) for d in _DROP_ATTRS)
        ]
        for a in attrs_to_remove:
            del tag.attrs[a]

    return str(soup)[:12_000]  # cap at 12 KB for the AI prompt


def _visible_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    return " ".join(soup.get_text(" ", strip=True).split())


# ── Raw field extraction ──────────────────────────────────────────────────────

def _best_selector(el) -> str:
    """Return the most reliable CSS selector for a Selenium element."""
    el_id = el.get_attribute("id")
    if el_id:
        return f"#{el_id}"
    name = el.get_attribute("name")
    if name:
        tag = el.tag_name
        return f"{tag}[name='{name}']"
    # Fall back to XPath-ish description — AI will refine
    return f"{el.tag_name}"


def _extract_raw_fields(driver, html: str) -> list[dict]:
    """
    Return a list of dict descriptors for every interactive field visible
    in the current DOM, with best-effort selectors.
    """
    soup = BeautifulSoup(html, "html.parser")
    results: list[dict] = []
    seen_selectors: set[str] = set()

    interactive_selectors = [
        "input:not([type='hidden']):not([type='submit']):not([type='button'])",
        "select",
        "textarea",
    ]

    try:
        elements = driver.find_elements(
            By.CSS_SELECTOR,
            ", ".join(interactive_selectors),
        )
    except Exception:
        elements = []

    for el in elements:
        try:
            if not el.is_displayed():
                continue

            sel = _best_selector(el)
            if sel in seen_selectors:
                continue
            seen_selectors.add(sel)

            el_type = el.get_attribute("type") or el.tag_name
            el_id = el.get_attribute("id") or ""
            el_name = el.get_attribute("name") or ""
            placeholder = el.get_attribute("placeholder") or ""
            el_value = el.get_attribute("value") or ""
            required = el.get_attribute("required") is not None

            # Look up <label> in BeautifulSoup for context
            label_text = ""
            if el_id:
                lbl = soup.find("label", attrs={"for": el_id})
                if lbl:
                    label_text = lbl.get_text(strip=True)

            # Options for <select>
            options: list[str] = []
            if el.tag_name == "select":
                try:
                    from selenium.webdriver.support.ui import Select
                    sel_obj = Select(el)
                    options = [o.text.strip() for o in sel_obj.options if o.text.strip()]
                except Exception:
                    pass

            results.append({
                "selector": sel,
                "tag": el.tag_name,
                "type": el_type,
                "id": el_id,
                "name": el_name,
                "label": label_text,
                "placeholder": placeholder,
                "current_value": el_value,
                "required": required,
                "options": options,
            })
        except Exception:
            continue

    return results
