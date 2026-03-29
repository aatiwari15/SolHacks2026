/**
 * popup.js — Simplify-style autofill extension.
 *
 * No inline event handlers (CSP-compliant).
 * No AI / API keys needed.
 *
 * Flow:
 *  Profile tab → save your info once in chrome.storage.local
 *  Autofill tab → Scan Page → fields extracted from DOM
 *                           → labels fuzzy-matched to profile
 *                           → matched fields pre-filled (teal border)
 *                           → user adjusts → Fill Form → injected into page
 */

// ── Profile field definitions ─────────────────────────────────────────────────

const PROFILE_KEYS = [
  "firstName","lastName","email","phone",
  "address","city","state","zip","country",
  "linkedin","website","github",
  "currentTitle","currentCompany","yearsExp","salary",
  "authorized","sponsorship",
  "gender","veteran","disability","ethnicity",
];

/**
 * Label patterns used to match a DOM field to a profile key.
 * Each entry: [profileKey, [...keywords]]
 * Matching is case-insensitive substring search on the field's label/placeholder/name.
 */
const MATCHERS = [
  ["firstName",    ["first name","firstname","given name","fname","first_name","forename"]],
  ["lastName",     ["last name","lastname","surname","family name","lname","last_name"]],
  ["email",        ["email","e-mail","email address"]],
  ["phone",        ["phone","mobile","cell","telephone","contact number","phone number"]],
  ["address",      ["address line 1","street address","address","street"]],
  ["city",         ["city","town","municipality"]],
  ["state",        ["state","province","region"]],
  ["zip",          ["zip code","postal code","zip","postal","postcode"]],
  ["country",      ["country","nation"]],
  ["linkedin",     ["linkedin"]],
  ["website",      ["portfolio","personal website","personal site","website","homepage","personal url"]],
  ["github",       ["github"]],
  ["currentTitle", ["current title","job title","title","current position","position","role"]],
  ["currentCompany",["current company","company","employer","current employer","organization"]],
  ["yearsExp",     ["years of experience","years experience","experience years","years exp"]],
  ["salary",       ["salary","compensation","desired salary","expected salary","pay"]],
  ["authorized",   ["authorized to work","legally authorized","eligible to work","work authorization","us work auth"]],
  ["sponsorship",  ["require sponsorship","visa sponsorship","sponsorship","work visa","sponsor"]],
  ["gender",       ["gender","sex","pronoun"]],
  ["veteran",      ["veteran","military","protected veteran"]],
  ["disability",   ["disability","disabled","accommodation"]],
  ["ethnicity",    ["ethnicity","race","racial","ethnic"]],
];

// ── Unidad API ────────────────────────────────────────────────────────────────
// Change this to your deployed URL in production.
const UNIDAD_API_URL = "http://localhost:3000";

// ── State ─────────────────────────────────────────────────────────────────────

let currentTabId   = null;
let formConfig     = null;  // { form_title, fields[], submitSelector }
let profile        = {};    // saved profile from storage
let sessionToken   = null;  // persistent extension identity (UUID)

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;

  try {
    document.getElementById("header-url").textContent = new URL(tab.url).hostname;
  } catch (_) {}

  // Load profile and session token in parallel
  [profile, sessionToken] = await Promise.all([loadProfile(), getOrCreateSessionToken()]);
  renderProfileForm(profile);

  // Wire tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Wire autofill tab buttons
  document.getElementById("scan-btn").addEventListener("click",   () => scanPage());
  document.getElementById("rescan-btn").addEventListener("click", () => scanPage());
  document.getElementById("fill-btn").addEventListener("click",   () => fillForm());
  document.getElementById("send-btn").addEventListener("click",   () => sendToUnidad());
  document.getElementById("submit-btn").addEventListener("click", () => submitForm());
  document.getElementById("clear-btn").addEventListener("click",  () => clearSession());

  // Wire profile tab
  document.getElementById("save-profile-btn").addEventListener("click", () => saveProfile());
  PROFILE_KEYS.forEach((key) => {
    const el = document.getElementById(`p-${key}`);
    if (el) el.addEventListener("input", () => markProfileDirty());
  });

  // Restore cached context for this tab
  const ctx = await bg("GET_CONTEXT", { tabId: currentTabId });
  if (ctx?.formConfig) {
    formConfig = ctx.formConfig;
    renderFields(formConfig);
    showAlert("info", `Restored ${formConfig.fields.length} field(s) from last scan.`);
  }
});

// ── Tab switching ─────────────────────────────────────────────────────────────

function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tabName)
  );
  document.querySelectorAll(".tab-panel").forEach((p) =>
    p.classList.toggle("active", p.id === `tab-${tabName}`)
  );
  document.getElementById("action-bar").className =
    tabName === "fill" && formConfig ? "show" : "";
  document.getElementById("profile-save-bar").style.display =
    tabName === "profile" ? "flex" : "none";
  clearAlert("status");
}

// ── Profile persistence ───────────────────────────────────────────────────────

async function loadProfile() {
  const result = await chrome.storage.local.get("unidadProfile");
  return result.unidadProfile || {};
}

function renderProfileForm(p) {
  PROFILE_KEYS.forEach((key) => {
    const el = document.getElementById(`p-${key}`);
    if (el && p[key] !== undefined) el.value = p[key];
  });
  setSaveNote("All changes saved", true);
}

function markProfileDirty() {
  setSaveNote("Unsaved changes", false);
}

async function saveProfile() {
  const p = {};
  PROFILE_KEYS.forEach((key) => {
    const el = document.getElementById(`p-${key}`);
    if (el) p[key] = el.value.trim();
  });
  await chrome.storage.local.set({ unidadProfile: p });
  profile = p;
  setSaveNote("Saved ✓", true);

  // If we have a current form, re-apply matches with updated profile
  if (formConfig) {
    applyProfileMatches(formConfig.fields, p);
  }
}

// ── Session token ─────────────────────────────────────────────────────────────

/** Returns a stable UUID for this extension install, creating one if needed. */
async function getOrCreateSessionToken() {
  const result = await chrome.storage.local.get("unidadSessionToken");
  if (result.unidadSessionToken) return result.unidadSessionToken;
  const token = crypto.randomUUID();
  await chrome.storage.local.set({ unidadSessionToken: token });
  return token;
}

function setSaveNote(msg, saved) {
  const el = document.getElementById("save-note");
  el.textContent = msg;
  el.className   = saved ? "save-note saved" : "save-note";
}

// ── Profile → field matching ──────────────────────────────────────────────────

/**
 * Given a field label (and name/placeholder), return the best matching profile key.
 * Uses substring matching with priority: earlier MATCHERS entries win.
 */
function matchProfileKey(field) {
  const haystack = [field.label, field.hint, field.field_key]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  for (const [key, patterns] of MATCHERS) {
    for (const pattern of patterns) {
      if (haystack.includes(pattern)) return key;
    }
  }
  return null;
}

/** Apply profile values to rendered input elements. */
function applyProfileMatches(fields, p) {
  let matched = 0;
  fields.forEach((field) => {
    const profileKey = field._profileKey;
    if (!profileKey || !p[profileKey]) return;
    const input = document.querySelector(`[data-field-key="${field.field_key}"]`);
    if (!input) return;

    // Only pre-fill if user hasn't typed something different
    const alreadyChanged = input.dataset.userEdited === "1";
    if (!alreadyChanged) {
      input.value = p[profileKey];
      input.classList.add("matched");
      matched++;
    }
  });
  return matched;
}

// ── Scan ──────────────────────────────────────────────────────────────────────

async function scanPage() {
  clearAlert("iframe");
  showAlert("info", null, true); // spinner
  const scanBtn = document.getElementById("scan-btn");
  scanBtn.disabled = true;

  try {
    const extract = await send("EXTRACT_BEST_FRAME", {});
    if (!extract.ok) throw new Error(extract.error || "Could not read the page.");

    const data = extract.data;

    // Cross-origin iframe warning
    if (data.crossOriginIframes?.length && !data.rawFields.length) {
      try {
        showIframeAlert(
          "Form is inside a protected iframe",
          `Loaded from ${new URL(data.crossOriginIframes[0]).hostname}. ` +
          `Open that page directly for best results.`
        );
      } catch (_) {}
    }

    if (data.rawFields.length === 0) {
      showAlert("error", "No form fields found on this page. Navigate to the form and try again.");
      return;
    }

    formConfig = buildConfig(data);

    // Cache
    await bg("SET_CONTEXT", { tabId: currentTabId, context: { formConfig, url: data.url } });

    renderFields(formConfig);

    // Apply profile matches
    const matched = applyProfileMatches(formConfig.fields, profile);
    const total   = formConfig.fields.length;
    updateMatchCount(matched, total);
    clearAlert("status");

    if (matched > 0) {
      showAlert("ok", `${matched} of ${total} field${total !== 1 ? "s" : ""} filled from your profile. Review and click Fill Form.`);
    } else {
      showAlert("info", `${total} field${total !== 1 ? "s" : ""} found. Fill them in and click Fill Form.`);
    }

    // Auto-switch to fill tab
    switchTab("fill");
  } catch (e) {
    showAlert("error", `Error: ${e.message}`);
  } finally {
    scanBtn.disabled = false;
  }
}

// ── Build formConfig from raw DOM fields ──────────────────────────────────────

function buildConfig(data) {
  const fields = data.rawFields.map((f, i) => {
    const key   = sanitizeKey(f.id || f.name || `field_${i}`);
    const label = f.label || f.placeholder || f.name || `Field ${i + 1}`;
    const type  =
      f.tag === "select"    ? "select"   :
      f.tag === "textarea"  ? "textarea" :
      (f.type === "checkbox" || f.type === "radio") ? f.type :
      f.type || "text";

    const field = {
      field_key:   key,
      label,
      type,
      selector:    f.selector,
      required:    f.required,
      options:     f.options || [],
      hint:        f.placeholder || "",
    };

    // Pre-compute profile match
    field._profileKey = matchProfileKey(field);
    return field;
  });

  return {
    form_title:     data.title || "Form",
    fields,
    submitSelector: null,
  };
}

function sanitizeKey(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/, "")
    .slice(0, 40) || "field";
}

// ── Render fields ─────────────────────────────────────────────────────────────

function renderFields(config) {
  const section = document.getElementById("fields-section");
  section.innerHTML = "";
  document.getElementById("fill-chips").className   = "";
  document.getElementById("fill-chips").innerHTML   = "";
  document.getElementById("empty-state").style.display = "none";

  const meta = document.getElementById("form-meta");
  meta.className = "form-meta show";
  document.getElementById("form-title-text").textContent = config.form_title;
  document.getElementById("field-count").textContent =
    `${config.fields.length} field${config.fields.length !== 1 ? "s" : ""}`;

  config.fields.forEach((field) => {
    const row = document.createElement("div");
    row.className = "field-row";

    const top = document.createElement("div");
    top.className = "field-top";
    top.innerHTML = `
      <span class="field-label">${esc(field.label)}</span>
      ${field.required       ? '<span class="field-req">required</span>' : ""}
      ${field._profileKey    ? '<span class="field-matched">from profile</span>' : ""}
    `;
    row.appendChild(top);

    // Selector hint (small monospace)
    const sel = document.createElement("span");
    sel.className   = "field-sel";
    sel.textContent = field.selector;
    row.appendChild(sel);

    const input = makeInput(field);
    // Track user edits so we don't overwrite them on re-match
    if (input.tagName !== "LABEL") {
      input.addEventListener("input", () => { input.dataset.userEdited = "1"; });
    }
    row.appendChild(input);
    section.appendChild(row);
  });

  document.getElementById("action-bar").className = "show";
}

function updateMatchCount(matched, total) {
  const el = document.getElementById("match-count");
  el.textContent = matched > 0 ? `${matched} auto-filled` : "";
}

function makeInput(field) {
  let el;

  if (field.type === "select" && field.options.length) {
    el = document.createElement("select");
    el.className = "answer-input";
    const blank = document.createElement("option");
    blank.value = ""; blank.textContent = "— choose —";
    el.appendChild(blank);
    field.options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt; o.textContent = opt;
      el.appendChild(o);
    });
  } else if (field.type === "checkbox") {
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;";
    el = document.createElement("input");
    el.type = "checkbox"; el.style.width = "auto";
    wrap.appendChild(el);
    wrap.appendChild(document.createTextNode("Yes"));
    el.dataset.fieldKey = field.field_key;
    return wrap;
  } else if (field.type === "textarea") {
    el = document.createElement("textarea");
    el.className = "answer-input"; el.rows = 2;
  } else if (field.type === "password") {
    el = document.createElement("input");
    el.type = "password"; el.className = "answer-input";
  } else {
    el = document.createElement("input");
    el.type        = field.type === "radio" ? "text" : (field.type || "text");
    el.className   = "answer-input";
    el.placeholder = field.hint || "";
  }

  el.dataset.fieldKey = field.field_key;
  return el;
}

// ── Collect answers ───────────────────────────────────────────────────────────

function collectAnswers() {
  const answers = {};
  document.querySelectorAll("[data-field-key]").forEach((el) => {
    const key = el.dataset.fieldKey;
    if (!key) return;
    if (el.type === "checkbox") {
      answers[key] = el.checked ? "true" : "false";
    } else {
      const v = el.value?.trim();
      if (v) answers[key] = v;
    }
  });
  return answers;
}

// ── Fill ──────────────────────────────────────────────────────────────────────

async function fillForm() {
  if (!formConfig) { showAlert("error", "Scan the page first."); return; }

  const answers = collectAnswers();
  if (!Object.keys(answers).length) {
    showAlert("error", "Fill in at least one field above.");
    return;
  }

  showAlert("info", null, true);

  try {
    const result = await send("FILL", { answers, fields: formConfig.fields });
    if (result.error) throw new Error(result.error);

    const chips = document.getElementById("fill-chips");
    chips.innerHTML = (result.results || [])
      .map((r) => `<span class="chip ${r.ok ? "ok" : "err"}">${r.ok ? "✓" : "✗"} ${esc(r.field_key)}</span>`)
      .join("");
    chips.className = "show";

    showAlert(
      result.ok ? "ok" : "error",
      result.ok ? "✅ All fields filled!" : "⚠️ Some fields failed — check the page."
    );
  } catch (e) {
    showAlert("error", `Fill error: ${e.message}`);
  }
}

// ── Send to Unidad ────────────────────────────────────────────────────────────

let fillPollInterval = null;  // polls for UNIDAD fill-ready answers

/**
 * POSTs the current formConfig + answers to the Unidad API so HABLA/LINDA/UNIDAD
 * can translate, reorder, and interview the user. Then polls for the resulting
 * fill payload and auto-fills the form when UNIDAD finishes.
 */
async function sendToUnidad() {
  if (!formConfig) { showAlert("error", "Scan the page first."); return; }

  const answers = collectAnswers();
  const [tab]   = await chrome.tabs.query({ active: true, currentWindow: true });
  const token   = sessionToken ?? await getOrCreateSessionToken();

  const sendBtn = document.getElementById("send-btn");
  sendBtn.disabled = true;
  showAlert("info", null, true);

  // Stop any previous polling
  if (fillPollInterval) { clearInterval(fillPollInterval); fillPollInterval = null; }

  try {
    const resp = await fetch(`${UNIDAD_API_URL}/api/form-submission`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionToken: token,
        pageUrl:      tab.url,
        pageTitle:    formConfig.form_title,
        formFields:   formConfig.fields,
        answers,
      }),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      throw new Error(body.error || `HTTP ${resp.status}`);
    }

    await resp.json();
    showAlert("info", "✅ Sent to UNIDAD! Answer the questions in the app, then come back here — I'll auto-fill when ready.");

    // ── Start polling for fill-ready answers ─────────────────────────────────
    let pollCount = 0;
    const MAX_POLLS = 120; // ~4 minutes at 2s intervals

    fillPollInterval = setInterval(async () => {
      pollCount++;
      if (pollCount > MAX_POLLS) {
        clearInterval(fillPollInterval);
        fillPollInterval = null;
        showAlert("info", "Timed out waiting for answers. Re-send the form or fill manually.");
        return;
      }

      try {
        const pr = await fetch(
          `${UNIDAD_API_URL}/api/form-submission/fill-ready?sessionToken=${encodeURIComponent(token)}`,
        );
        if (!pr.ok) return;

        const pd = await pr.json();
        if (!pd.ready) return; // not ready yet — keep polling

        // ── Answers are ready — fill the form ───────────────────────────────
        clearInterval(fillPollInterval);
        fillPollInterval = null;

        showAlert("info", null, true); // spinner
        const fillResult = await send("FILL", { answers: pd.answers, fields: pd.fields });

        if (fillResult?.ok) {
          // Render result chips
          const chips = document.getElementById("fill-chips");
          chips.innerHTML = (fillResult.results || [])
            .map((r) => `<span class="chip ${r.ok ? "ok" : "err"}">${r.ok ? "✓" : "✗"} ${esc(r.field_key)}</span>`)
            .join("");
          chips.className = "show";

          // Auto-submit the form
          showAlert("info", "Fields filled — submitting form…", true);
          await new Promise((r) => setTimeout(r, 600));
          const submitResult = await send("SUBMIT", { selector: formConfig?.submitSelector ?? null });
          if (submitResult?.ok) {
            showAlert("ok", "✅ Form filled and submitted by UNIDAD!");
          } else {
            showAlert("ok", "✅ UNIDAD filled your form! Click Submit on the page to finish.");
          }
        } else {
          showAlert("error", `Some fields couldn't be filled: ${fillResult?.error ?? "unknown error"}`);
        }
      } catch (_) {
        // Network hiccup — keep polling silently
      }
    }, 2000);

  } catch (e) {
    showAlert("error", `Could not reach Unidad: ${e.message}. Is the app running at ${UNIDAD_API_URL}?`);
  } finally {
    sendBtn.disabled = false;
  }
}

// ── Submit ────────────────────────────────────────────────────────────────────

async function submitForm() {
  if (!formConfig) return;
  showAlert("info", null, true);
  try {
    const result = await send("SUBMIT", { selector: formConfig.submitSelector ?? null });
    showAlert(result.ok ? "ok" : "error", result.ok ? "✅ Submit clicked!" : `Submit failed: ${result.error}`);
  } catch (e) {
    showAlert("error", `Submit error: ${e.message}`);
  }
}

// ── Clear ─────────────────────────────────────────────────────────────────────

async function clearSession() {
  await bg("CLEAR_CONTEXT", { tabId: currentTabId });
  formConfig = null;
  document.getElementById("fields-section").innerHTML       = "";
  document.getElementById("form-meta").className           = "form-meta";
  document.getElementById("action-bar").className          = "";
  document.getElementById("fill-chips").className          = "";
  document.getElementById("fill-chips").innerHTML          = "";
  document.getElementById("match-count").textContent       = "";
  document.getElementById("empty-state").style.display     = "block";
  clearAlert("iframe");
  clearAlert("status");
}

// ── Messaging ─────────────────────────────────────────────────────────────────

function bg(type, data) {
  return chrome.runtime.sendMessage({ type, ...data });
}

async function send(type, data) {
  try {
    return await chrome.tabs.sendMessage(currentTabId, { type, ...data });
  } catch (_) {
    await chrome.scripting.executeScript({
      target: { tabId: currentTabId, allFrames: true },
      files: ["content.js"],
    });
    await new Promise((r) => setTimeout(r, 150));
    return chrome.tabs.sendMessage(currentTabId, { type, ...data });
  }
}

// ── Alert helpers ─────────────────────────────────────────────────────────────

function showAlert(type, msg, loading = false) {
  const el   = document.getElementById("alert-status");
  const icon = document.getElementById("alert-icon");
  const body = document.getElementById("alert-body");

  if (loading) {
    el.className = "alert show info";
    icon.innerHTML = '<span class="spin"></span>';
    body.textContent = msg || "Working…";
    return;
  }

  const icons = { info: "ℹ️", ok: "✅", error: "❌" };
  el.className    = `alert show ${type}`;
  icon.textContent = icons[type] || "";
  body.textContent = msg || "";
}

function clearAlert(which) {
  if (which === "status") {
    const el = document.getElementById("alert-status");
    el.className = "alert"; el.querySelector("#alert-body").textContent = "";
  } else if (which === "iframe") {
    document.getElementById("alert-iframe").className = "alert notice";
  }
}

function showIframeAlert(title, msg) {
  document.getElementById("alert-iframe").className = "alert notice show";
  document.getElementById("iframe-title").textContent = title;
  document.getElementById("iframe-msg").textContent   = msg;
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
