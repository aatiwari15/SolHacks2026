/**
 * content.js — Injected into every frame (all_frames: true).
 *
 * When running in a child frame it still responds to EXTRACT/FILL/SUBMIT.
 * The popup targets whichever frame actually has the form.
 */

const IS_FRAME = window !== window.top;

// ── Message router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "EXTRACT":
          sendResponse({ ok: true, data: extractPageData() });
          break;
        case "EXTRACT_BEST_FRAME":
          // Top-level only: scan self + same-origin iframes, return richest result
          sendResponse({ ok: true, data: extractBestFrame() });
          break;
        case "FILL":
          sendResponse(await fillFields(msg.answers, msg.fields));
          break;
        case "SUBMIT":
          sendResponse(clickSubmit(msg.selector));
          break;
        case "PING":
          sendResponse({ ok: true, isFrame: IS_FRAME, url: location.href });
          break;
        default:
          sendResponse({ error: "Unknown type" });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
  })();
  return true;
});

// ── Best-frame extraction (handles ATS iframes like Workday / Greenhouse) ────

function extractBestFrame() {
  const self = extractPageData();

  // Collect same-origin iframes
  const iframeResults = [];
  const frames = document.querySelectorAll("iframe");
  for (const iframe of frames) {
    try {
      const doc = iframe.contentDocument;
      if (!doc) continue; // cross-origin — can't read
      const raw = extractRawFieldsFromDoc(doc);
      if (raw.length === 0) continue;
      iframeResults.push({
        url: iframe.src || location.href,
        title: doc.title || self.title,
        cleanedHtml: cleanHtmlDoc(doc),
        rawFields: raw,
        pageText: (doc.body?.innerText ?? "").slice(0, 4000),
        fromIframe: true,
        iframeIndex: iframeResults.length,
      });
    } catch (_) {
      // cross-origin iframe — silently skip
    }
  }

  // Check for cross-origin iframes (can still inject into them via all_frames)
  const crossOriginIframes = [];
  for (const iframe of frames) {
    try {
      if (iframe.contentDocument) continue; // same-origin, already handled
    } catch (_) {}
    if (iframe.src && !iframe.src.startsWith("javascript")) {
      crossOriginIframes.push(iframe.src);
    }
  }

  // Return richest source (most fields wins)
  let best = self;
  for (const r of iframeResults) {
    if (r.rawFields.length > best.rawFields.length) best = r;
  }

  best.crossOriginIframes = crossOriginIframes;
  best.allFrameFieldCounts = {
    mainFrame: self.rawFields.length,
    iframes: iframeResults.map((r) => ({ url: r.url, count: r.rawFields.length })),
    crossOrigin: crossOriginIframes,
  };

  return best;
}

// ── Page data extraction ──────────────────────────────────────────────────────

function extractPageData() {
  return {
    url: location.href,
    title: document.title,
    cleanedHtml: cleanHtmlDoc(document),
    rawFields: extractRawFieldsFromDoc(document),
    pageText: (document.body?.innerText ?? "").slice(0, 4000),
    fromIframe: IS_FRAME,
    crossOriginIframes: [],
    allFrameFieldCounts: null,
  };
}

function cleanHtmlDoc(doc) {
  const clone = doc.documentElement.cloneNode(true);
  const tmp = document.createElement("div");
  tmp.appendChild(clone);

  ["script", "style", "svg", "img", "meta", "link", "noscript", "iframe"].forEach(
    (tag) => tmp.querySelectorAll(tag).forEach((el) => el.remove())
  );

  const KEEP = new Set([
    "form","input","select","textarea","label","button",
    "legend","fieldset","option","optgroup",
    "h1","h2","h3","h4","p","span","div","a",
  ]);
  tmp.querySelectorAll("*").forEach((el) => {
    if (!KEEP.has(el.tagName.toLowerCase())) el.remove();
  });

  return tmp.innerHTML.slice(0, 12000);
}

function extractRawFieldsFromDoc(doc) {
  const seen = new Set();
  const fields = [];

  const interactive = doc.querySelectorAll(
    "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset'])," +
    "select, textarea"
  );

  interactive.forEach((el) => {
    if (!isVisibleEl(el)) return;

    const sel = bestSelector(el);
    if (seen.has(sel)) return;
    seen.add(sel);

    const options =
      el.tagName === "SELECT"
        ? Array.from(el.options).map((o) => o.text.trim()).filter(Boolean)
        : [];

    fields.push({
      selector: sel,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute("type") || el.tagName.toLowerCase(),
      id: el.id || "",
      name: el.name || "",
      label: findLabelInDoc(el, doc),
      placeholder: el.placeholder || "",
      currentValue: el.value || "",
      required: el.required,
      options,
    });
  });

  return fields;
}

function bestSelector(el) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
  for (const attr of ["data-testid", "aria-label", "placeholder"]) {
    const val = el.getAttribute(attr);
    if (val) return `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(val)}"]`;
  }
  return el.tagName.toLowerCase();
}

function findLabelInDoc(el, doc) {
  if (el.id) {
    const lbl = doc.querySelector(`label[for="${el.id}"]`);
    if (lbl) return lbl.innerText.trim();
  }
  const parentLabel = el.closest("label");
  if (parentLabel) return parentLabel.innerText.replace(el.value, "").trim();
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ref = doc.getElementById(labelledBy);
    if (ref) return ref.innerText.trim();
  }
  const prev = el.previousElementSibling;
  if (prev && prev.innerText) return prev.innerText.trim().slice(0, 80);
  return el.placeholder || el.name || "";
}

function isVisibleEl(el) {
  const rect = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0"
  );
}

// ── Form filling ──────────────────────────────────────────────────────────────

async function fillFields(answers, fields) {
  const results = [];
  const fieldMap = Object.fromEntries(fields.map((f) => [f.field_key, f]));

  for (const [key, value] of Object.entries(answers)) {
    if (!value && value !== false) continue;
    const fieldDef = fieldMap[key];
    if (!fieldDef) {
      results.push({ field_key: key, ok: false, error: "Unknown field" });
      continue;
    }
    const result = fillOne(fieldDef.selector, fieldDef.type, value);
    results.push({ field_key: key, ...result });
    await sleep(120);
  }

  return { ok: results.every((r) => r.ok), results };
}

function fillOne(selector, type, value) {
  let el;
  try {
    el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);
  } catch (e) {
    return { ok: false, error: e.message };
  }

  try {
    scrollTo(el);
    if (type === "select") fillSelect(el, value);
    else if (type === "checkbox" || type === "radio") fillCheckable(el, value);
    else if (type === "date") fillDate(el, value);
    else fillText(el, value);
    return { ok: true };
  } catch (e) {
    try {
      setNativeValue(el, value);
      return { ok: true, recovery: "native" };
    } catch (e2) {
      return { ok: false, error: `${e.message} | fallback: ${e2.message}` };
    }
  }
}

function fillText(el, value) {
  el.focus();
  setNativeValue(el, "");
  fireEvent(el, "input");
  setNativeValue(el, value);
  fireEvent(el, "input");
  fireEvent(el, "change");
  el.blur();
}

function fillSelect(el, value) {
  const opts = Array.from(el.options);
  let match =
    opts.find((o) => o.text.trim().toLowerCase() === value.toLowerCase()) ||
    opts.find((o) => o.value.toLowerCase() === value.toLowerCase()) ||
    opts.find((o) => o.text.toLowerCase().includes(value.toLowerCase()));
  if (!match) throw new Error(`Option not found: "${value}"`);
  el.value = match.value;
  fireEvent(el, "change");
}

function fillCheckable(el, value) {
  const want =
    typeof value === "boolean"
      ? value
      : ["true", "yes", "1", "on"].includes(String(value).toLowerCase());
  if (el.checked !== want) {
    el.click();
    fireEvent(el, "change");
  }
}

function fillDate(el, value) {
  let normalized = value;
  const m = value.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (m) {
    const [, mo, d, y] = m;
    normalized = `${y.length === 2 ? "20" + y : y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  setNativeValue(el, normalized);
  fireEvent(el, "input");
  fireEvent(el, "change");
}

function setNativeValue(el, value) {
  const proto =
    el.tagName === "TEXTAREA"
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
  if (descriptor?.set) descriptor.set.call(el, value);
  else el.value = value;
}

function fireEvent(el, type) {
  el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
}

function scrollTo(el) {
  el.scrollIntoView({ block: "center", behavior: "smooth" });
}

function clickSubmit(selector) {
  const btn =
    (selector && document.querySelector(selector)) ||
    document.querySelector("button[type='submit'], input[type='submit']") ||
    document.querySelector("button");
  if (!btn) return { ok: false, error: "No submit button found" };
  scrollTo(btn);
  btn.click();
  return { ok: true };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
