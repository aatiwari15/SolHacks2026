"""
main.py — FastAPI server for the Unidad Form Automation backend.

Endpoints:
  POST /analyze         — Open URL in browser, AI-analyze the form, return locked config
  POST /fill            — Fill form fields using locked config + user answers
  POST /submit          — Click the submit button
  POST /login           — Fill login credentials and navigate to the form URL
  GET  /screenshot/{id} — Current browser screenshot (base64 PNG)
  GET  /sessions        — List active sessions
  DELETE /sessions/{id} — Close a session and quit the browser
  GET  /                — Serve the HTML UI

Run:
  cd backend
  uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import atexit
import os
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, HttpUrl

import agent as ai_agent
import form_filler
import scraper
import session_store

load_dotenv()

app = FastAPI(title="Unidad Form Bot", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Close all browser sessions on server shutdown
atexit.register(session_store.close_all)


# ── Request / response models ─────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    url: str

class LoginRequest(BaseModel):
    session_id: str
    username: str
    password: str
    username_selector: str | None = None
    password_selector: str | None = None
    submit_selector: str | None = None

class FillRequest(BaseModel):
    session_id: str
    answers: dict[str, str]   # field_key → value

class SubmitRequest(BaseModel):
    session_id: str


# ── API routes ────────────────────────────────────────────────────────────────

@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    """
    1. Creates a new browser session.
    2. Navigates to the URL.
    3. Scrapes the page.
    4. AI-analyzes and locks the form config.
    Returns the session_id + locked FormConfig.
    """
    session = session_store.create_session(req.url)
    try:
        page_info = scraper.scrape_page(session, req.url)
        form_config = ai_agent.analyze_page(session, page_info)
        login_info = ai_agent.detect_login(session, page_info)

        return {
            "session_id": session.session_id,
            "form_config": form_config,
            "login_detected": login_info["has_login"],
            "screenshot_b64": page_info["screenshot_b64"],
            "page_title": page_info["title"],
            "current_url": page_info["url"],
        }
    except Exception as e:
        session_store.close_session(session.session_id)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/login")
def login(req: LoginRequest) -> dict:
    """
    Fill login credentials, submit the login form, then re-scrape and
    re-analyze the destination page (if config not yet locked to a form).
    """
    session = session_store.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    driver = session.driver
    try:
        # Use AI-detected selectors or fall back to provided ones
        config = session.form_config or {}
        fields = config.get("fields", [])

        u_sel = req.username_selector or next(
            (f["selector"] for f in fields if f["type"] in ("email", "text")), "input[type='email'], input[type='text']"
        )
        p_sel = req.password_selector or next(
            (f["selector"] for f in fields if f["type"] == "password"), "input[type='password']"
        )
        s_sel = req.submit_selector or "button[type='submit'], input[type='submit']"

        import time
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC

        # Fill username
        u_el = WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, u_sel)))
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", u_el)
        u_el.clear()
        u_el.send_keys(req.username)
        time.sleep(0.3)

        # Fill password
        p_el = driver.find_element(By.CSS_SELECTOR, p_sel)
        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", p_el)
        p_el.clear()
        p_el.send_keys(req.password)
        time.sleep(0.3)

        # Submit
        s_el = driver.find_element(By.CSS_SELECTOR, s_sel)
        s_el.click()
        time.sleep(2.5)

        # Re-scrape destination
        page_info = scraper.scrape_page(session)

        # If session already has a locked non-login config, keep it.
        # Otherwise re-analyze the new page.
        if not session.context_locked or config.get("form_type") == "login":
            session.context_locked = False
            session.form_config = None
            new_config = ai_agent.analyze_page(session, page_info)
        else:
            new_config = session.form_config

        return {
            "session_id": session.session_id,
            "form_config": new_config,
            "screenshot_b64": page_info["screenshot_b64"],
            "current_url": page_info["url"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/fill")
def fill(req: FillRequest) -> dict:
    """Fill form fields with provided answers."""
    session = session_store.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = form_filler.fill_form(session, req.answers)
    screenshot_b64 = session.driver.get_screenshot_as_base64()
    session.screenshot_history.append(screenshot_b64)

    return {**result, "screenshot_b64": screenshot_b64}


@app.post("/submit")
def submit(req: SubmitRequest) -> dict:
    """Click the submit button."""
    session = session_store.get_session(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = form_filler.click_submit(session)
    import time; time.sleep(1.5)
    screenshot_b64 = session.driver.get_screenshot_as_base64()

    return {**result, "screenshot_b64": screenshot_b64, "current_url": session.driver.current_url}


@app.get("/screenshot/{session_id}")
def screenshot(session_id: str) -> dict:
    session = session_store.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"screenshot_b64": session.driver.get_screenshot_as_base64()}


@app.get("/sessions")
def list_sessions() -> dict:
    return {"sessions": session_store.list_sessions()}


@app.delete("/sessions/{session_id}")
def close_session(session_id: str) -> dict:
    session_store.close_session(session_id)
    return {"closed": session_id}


# ── HTML UI ───────────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
def ui() -> str:
    return _HTML_UI


_HTML_UI = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Unidad · Form Bot</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:      #faf8f5;
    --bg2:     #f2ede5;
    --panel:   #ffffff;
    --border:  #e2d9cc;
    --text:    #1f1309;
    --muted:   #7a6045;
    --amber:   #d97706;
    --amber-l: #fef3c7;
    --orange:  #ea580c;
    --teal:    #0d9488;
    --red:     #dc2626;
    --green:   #16a34a;
    --radius:  10px;
    --shadow:  0 1px 4px rgba(0,0,0,.08);
  }

  body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); font-size: 14px; min-height: 100vh; }

  header { display: flex; align-items: center; gap: 10px; padding: 14px 24px; background: var(--panel); border-bottom: 1px solid var(--border); }
  header .logo { width: 28px; height: 28px; background: var(--amber); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  header h1 { font-size: 16px; font-weight: 700; }
  header span { font-size: 12px; color: var(--muted); }

  main { max-width: 900px; margin: 0 auto; padding: 24px 16px; }

  /* URL bar */
  .url-bar { display: flex; gap: 8px; margin-bottom: 20px; }
  .url-bar input { flex: 1; border: 1.5px solid var(--border); border-radius: var(--radius); padding: 10px 14px; font-size: 14px; background: var(--panel); color: var(--text); outline: none; transition: border .15s; }
  .url-bar input:focus { border-color: var(--amber); }
  .url-bar button { padding: 10px 20px; background: var(--amber); color: #fff; border: none; border-radius: var(--radius); font-weight: 600; cursor: pointer; font-size: 14px; transition: background .15s; }
  .url-bar button:hover { background: #b45309; }
  .url-bar button:disabled { background: #d1c0aa; cursor: not-allowed; }

  /* Status bar */
  #status { padding: 10px 14px; border-radius: var(--radius); font-size: 13px; font-weight: 500; display: none; margin-bottom: 16px; }
  #status.info  { background: var(--amber-l); color: #92400e; border: 1px solid #fde68a; display: block; }
  #status.error { background: #fee2e2; color: var(--red); border: 1px solid #fca5a5; display: block; }
  #status.ok    { background: #dcfce7; color: var(--green); border: 1px solid #86efac; display: block; }

  /* Two-column layout */
  .layout { display: grid; grid-template-columns: 1fr 340px; gap: 16px; }
  @media (max-width: 720px) { .layout { grid-template-columns: 1fr; } }

  /* Panels */
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
  .panel-header { padding: 12px 16px; border-bottom: 1px solid var(--border); font-weight: 700; font-size: 13px; display: flex; align-items: center; gap: 8px; }
  .panel-body { padding: 16px; }

  /* Login section */
  #login-section { margin-bottom: 16px; display: none; }
  .login-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .login-row input { border: 1.5px solid var(--border); border-radius: 8px; padding: 8px 12px; font-size: 13px; background: var(--bg); outline: none; }
  .login-row input:focus { border-color: var(--amber); }

  /* Form table */
  #field-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  #field-table th { text-align: left; padding: 8px 12px; background: var(--bg2); border-bottom: 2px solid var(--border); font-weight: 600; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
  #field-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); vertical-align: top; }
  #field-table tr:last-child td { border-bottom: none; }
  #field-table tr:hover td { background: var(--bg); }
  .field-key { font-family: monospace; font-size: 11px; color: var(--muted); }
  .field-label { font-weight: 600; }
  .field-question { color: var(--muted); font-size: 12px; margin-top: 2px; }
  .field-required { color: var(--orange); font-size: 11px; font-weight: 700; }

  .answer-input { width: 100%; border: 1.5px solid var(--border); border-radius: 7px; padding: 7px 10px; font-size: 13px; background: var(--bg); outline: none; transition: border .15s; }
  .answer-input:focus { border-color: var(--amber); background: #fff; }
  .answer-input.select-input { appearance: auto; }

  /* Action buttons */
  .actions { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  .btn { padding: 9px 20px; border: none; border-radius: var(--radius); font-weight: 600; font-size: 13px; cursor: pointer; transition: all .15s; }
  .btn-fill   { background: var(--orange); color: #fff; }
  .btn-fill:hover { background: #c2410c; }
  .btn-submit { background: var(--green); color: #fff; }
  .btn-submit:hover { background: #15803d; }
  .btn-close  { background: var(--bg2); color: var(--text); border: 1px solid var(--border); }
  .btn-close:hover { background: var(--border); }
  .btn:disabled { opacity: .45; cursor: not-allowed; }

  /* Screenshot panel */
  #screenshot-panel img { width: 100%; border-radius: 8px; border: 1px solid var(--border); display: block; }
  .screenshot-placeholder { height: 200px; background: var(--bg2); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 13px; }

  /* Fill result chips */
  .result-chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; margin: 2px; }
  .result-chip.ok  { background: #dcfce7; color: var(--green); }
  .result-chip.err { background: #fee2e2; color: var(--red); }

  /* Session info */
  .session-badge { font-family: monospace; font-size: 11px; background: var(--bg2); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; color: var(--muted); }

  /* Loading spinner */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid #ddd; border-top-color: var(--amber); border-radius: 50%; animation: spin .6s linear infinite; vertical-align: middle; margin-right: 6px; }

  /* Form type badge */
  .type-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 6px; background: var(--amber-l); color: #92400e; }
  .type-badge.login { background: #ede9fe; color: #5b21b6; }
  .type-badge.government_form { background: #dbeafe; color: #1e40af; }
</style>
</head>
<body>

<header>
  <div class="logo">🔥</div>
  <h1>Unidad · Form Bot</h1>
  <span>AI-powered form filler</span>
</header>

<main>
  <!-- URL bar -->
  <div class="url-bar">
    <input id="url-input" type="url" placeholder="https://example.gov/form" autocomplete="off" />
    <button id="analyze-btn" onclick="analyzeUrl()">Analyze</button>
  </div>

  <div id="status"></div>

  <!-- Login section (shown when login detected) -->
  <div id="login-section" class="panel" style="margin-bottom:16px;">
    <div class="panel-header">🔐 Login Required</div>
    <div class="panel-body">
      <p style="color:var(--muted);margin-bottom:12px;font-size:13px;">This page requires login. Enter credentials to proceed.</p>
      <div class="login-row">
        <input id="login-username" type="text" placeholder="Username / Email" />
        <input id="login-password" type="password" placeholder="Password" />
      </div>
      <button class="btn btn-fill" onclick="doLogin()">Sign In & Continue</button>
    </div>
  </div>

  <div class="layout">
    <!-- Left: form fields -->
    <div>
      <div id="fields-panel" class="panel" style="display:none;">
        <div class="panel-header">
          <span id="form-title-badge">Form Fields</span>
          <span id="form-type-badge" class="type-badge" style="margin-left:auto;"></span>
          <span id="session-id-badge" class="session-badge" style="margin-left:8px;"></span>
        </div>
        <div class="panel-body" style="padding:0;">
          <table id="field-table">
            <thead>
              <tr>
                <th style="width:35%">Field</th>
                <th>Your Answer</th>
              </tr>
            </thead>
            <tbody id="field-rows"></tbody>
          </table>
        </div>
        <div class="panel-body" style="padding-top:0;">
          <div class="actions">
            <button class="btn btn-fill" onclick="fillForm()">Fill Form in Browser</button>
            <button class="btn btn-submit" onclick="submitForm()">Submit Form</button>
            <button class="btn btn-close" onclick="closeSession()">Close Browser</button>
          </div>
          <div id="fill-results" style="margin-top:12px;"></div>
        </div>
      </div>

      <div id="notes-panel" class="panel" style="display:none;margin-top:12px;">
        <div class="panel-header">📝 Agent Notes</div>
        <div class="panel-body">
          <p id="agent-notes" style="font-size:13px;color:var(--muted);line-height:1.6;"></p>
        </div>
      </div>
    </div>

    <!-- Right: screenshot -->
    <div>
      <div id="screenshot-panel" class="panel">
        <div class="panel-header">🖥 Browser Preview</div>
        <div class="panel-body" id="screenshot-body">
          <div class="screenshot-placeholder">No browser session yet</div>
        </div>
      </div>
    </div>
  </div>
</main>

<script>
const API = '';   // same origin
let sessionId = null;
let formConfig = null;

// ── Status helpers ────────────────────────────────────────────────────────────
function setStatus(msg, type = 'info') {
  const el = document.getElementById('status');
  el.className = type;
  el.innerHTML = msg;
}
function clearStatus() {
  const el = document.getElementById('status');
  el.className = '';
  el.style.display = 'none';
}
function setLoading(msg) {
  setStatus(`<span class="spinner"></span>${msg}`, 'info');
}

// ── Screenshot ────────────────────────────────────────────────────────────────
function setScreenshot(b64) {
  const body = document.getElementById('screenshot-body');
  if (!b64) { body.innerHTML = '<div class="screenshot-placeholder">No screenshot</div>'; return; }
  body.innerHTML = `<img src="data:image/png;base64,${b64}" alt="Browser screenshot" />`;
}

// ── Analyze ───────────────────────────────────────────────────────────────────
async function analyzeUrl() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) { setStatus('Please enter a URL.', 'error'); return; }

  document.getElementById('analyze-btn').disabled = true;
  setLoading('Opening browser and analyzing page…');
  document.getElementById('fields-panel').style.display = 'none';

  try {
    const res = await fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Analysis failed');

    sessionId = data.session_id;
    formConfig = data.form_config;

    setScreenshot(data.screenshot_b64);

    if (data.login_detected) {
      document.getElementById('login-section').style.display = 'block';
      setStatus('🔐 Login detected. Enter credentials below.', 'info');
    } else {
      document.getElementById('login-section').style.display = 'none';
      renderFields(formConfig);
      setStatus(`✅ Analyzed "${data.page_title}" — ${(formConfig.fields||[]).length} fields found.`, 'ok');
    }

  } catch (e) {
    setStatus(`Error: ${e.message}`, 'error');
  } finally {
    document.getElementById('analyze-btn').disabled = false;
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function doLogin() {
  if (!sessionId) return;
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username || !password) { setStatus('Enter username and password.', 'error'); return; }

  setLoading('Logging in…');
  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, username, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Login failed');

    formConfig = data.form_config;
    setScreenshot(data.screenshot_b64);
    document.getElementById('login-section').style.display = 'none';
    renderFields(formConfig);
    setStatus(`✅ Logged in — ${(formConfig.fields||[]).length} fields found.`, 'ok');
  } catch (e) {
    setStatus(`Login error: ${e.message}`, 'error');
  }
}

// ── Render fields table ───────────────────────────────────────────────────────
function renderFields(config) {
  if (!config) return;
  const tbody = document.getElementById('field-rows');
  tbody.innerHTML = '';

  const titleBadge = document.getElementById('form-title-badge');
  titleBadge.textContent = config.form_title || 'Form Fields';

  const typeBadge = document.getElementById('form-type-badge');
  typeBadge.textContent = config.form_type || '';
  typeBadge.className = `type-badge ${config.form_type || ''}`;

  document.getElementById('session-id-badge').textContent = `session: ${sessionId}`;

  (config.fields || []).forEach(field => {
    const tr = document.createElement('tr');

    // Field info cell
    const tdInfo = document.createElement('td');
    tdInfo.innerHTML = `
      <div class="field-label">${field.label || field.field_key}
        ${field.required ? '<span class="field-required">*</span>' : ''}
      </div>
      <div class="field-question">${field.question || ''}</div>
      <div class="field-key">${field.field_key}</div>
    `;

    // Answer cell
    const tdAnswer = document.createElement('td');
    let inputEl;

    if (field.type === 'select' && field.options && field.options.length) {
      inputEl = document.createElement('select');
      inputEl.className = 'answer-input select-input';
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '— select —';
      inputEl.appendChild(blank);
      field.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        inputEl.appendChild(o);
      });
    } else if (field.type === 'checkbox') {
      inputEl = document.createElement('input');
      inputEl.type = 'checkbox';
      inputEl.style.width = 'auto';
    } else if (field.type === 'textarea') {
      inputEl = document.createElement('textarea');
      inputEl.className = 'answer-input';
      inputEl.rows = 3;
    } else if (field.type === 'password') {
      inputEl = document.createElement('input');
      inputEl.type = 'password';
      inputEl.className = 'answer-input';
    } else {
      inputEl = document.createElement('input');
      inputEl.type = field.type || 'text';
      inputEl.className = 'answer-input';
      inputEl.placeholder = field.hint || '';
    }

    inputEl.dataset.fieldKey = field.field_key;
    inputEl.id = `answer-${field.field_key}`;
    tdAnswer.appendChild(inputEl);

    tr.appendChild(tdInfo);
    tr.appendChild(tdAnswer);
    tbody.appendChild(tr);
  });

  if (config.notes) {
    document.getElementById('agent-notes').textContent = config.notes;
    document.getElementById('notes-panel').style.display = 'block';
  }

  document.getElementById('fields-panel').style.display = 'block';
}

// ── Collect answers from the table ────────────────────────────────────────────
function collectAnswers() {
  const answers = {};
  document.querySelectorAll('[data-field-key]').forEach(el => {
    const key = el.dataset.fieldKey;
    if (el.type === 'checkbox') {
      answers[key] = el.checked ? 'true' : 'false';
    } else {
      answers[key] = el.value.trim();
    }
  });
  return answers;
}

// ── Fill form ─────────────────────────────────────────────────────────────────
async function fillForm() {
  if (!sessionId) { setStatus('No active session.', 'error'); return; }
  const answers = collectAnswers();
  setLoading('Filling form in browser…');

  try {
    const res = await fetch(`${API}/fill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, answers }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Fill failed');

    setScreenshot(data.screenshot_b64);

    const chips = (data.results || []).map(r =>
      `<span class="result-chip ${r.ok ? 'ok' : 'err'}">
        ${r.ok ? '✓' : '✗'} ${r.field_key}
       </span>`
    ).join('');
    document.getElementById('fill-results').innerHTML = chips;

    if (data.success) {
      setStatus('✅ All fields filled successfully.', 'ok');
    } else {
      setStatus(`⚠️ Some fields failed: ${data.errors.join(', ')}`, 'error');
    }
  } catch (e) {
    setStatus(`Fill error: ${e.message}`, 'error');
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────
async function submitForm() {
  if (!sessionId) return;
  setLoading('Submitting form…');

  try {
    const res = await fetch(`${API}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId }),
    });
    const data = await res.json();
    setScreenshot(data.screenshot_b64);
    if (data.ok) {
      setStatus(`✅ Submitted! Now at: ${data.current_url}`, 'ok');
    } else {
      setStatus(`Error submitting: ${data.error}`, 'error');
    }
  } catch (e) {
    setStatus(`Submit error: ${e.message}`, 'error');
  }
}

// ── Close session ─────────────────────────────────────────────────────────────
async function closeSession() {
  if (!sessionId) return;
  await fetch(`${API}/sessions/${sessionId}`, { method: 'DELETE' });
  sessionId = null;
  formConfig = null;
  document.getElementById('fields-panel').style.display = 'none';
  document.getElementById('login-section').style.display = 'none';
  document.getElementById('notes-panel').style.display = 'none';
  setScreenshot(null);
  setStatus('Browser session closed.', 'info');
}

// Enter key on URL input
document.getElementById('url-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') analyzeUrl();
});
</script>
</body>
</html>
"""
