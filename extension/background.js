/**
 * background.js — Service worker (Manifest V3).
 *
 * Gemini AI analysis is commented out.
 * The popup now extracts raw fields directly from the DOM and renders them
 * without any AI call. This file is kept for future re-enablement.
 */

// ── Per-tab context (kept for clear/cache) ────────────────────────────────────
const tabContexts = new Map();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case "GET_CONTEXT":
          sendResponse(tabContexts.get(msg.tabId) ?? null);
          break;
        case "SET_CONTEXT":
          tabContexts.set(msg.tabId, msg.context);
          sendResponse({ ok: true });
          break;
        case "CLEAR_CONTEXT":
          tabContexts.delete(msg.tabId);
          sendResponse({ ok: true });
          break;

        // ── Gemini AI analysis — commented out ──────────────────────────────
        // case "ANALYZE":
        //   sendResponse(await handleAnalyze(msg));
        //   break;
        // case "GET_API_KEY":
        //   sendResponse(await getApiKey());
        //   break;
        // case "SET_API_KEY":
        //   await setApiKey(msg.key);
        //   sendResponse({ ok: true });
        //   break;
        // ────────────────────────────────────────────────────────────────────

        default:
          sendResponse({ error: "Unknown message type" });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
  })();
  return true;
});

// ── Gemini implementation — commented out ─────────────────────────────────────
//
// const GEMINI_URL =
//   "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
//
// async function handleAnalyze({ tabId, pageData, forceReanalyze }) {
//   if (!forceReanalyze && tabContexts.has(tabId)) {
//     return { formConfig: tabContexts.get(tabId).formConfig, cached: true };
//   }
//   const apiKey = await getApiKey();
//   if (!apiKey) throw new Error("No Gemini API key set.");
//   const formConfig = await callGemini(apiKey, pageData);
//   tabContexts.set(tabId, { formConfig, lockedAt: Date.now(), url: pageData.url });
//   return { formConfig, cached: false };
// }
//
// const SYSTEM_PROMPT = `You are FormBot, an expert at analyzing web forms. ...`;
//
// async function callGemini(apiKey, pageData) {
//   const body = { contents: [{ parts: [{ text: SYSTEM_PROMPT }, { text: "..." }] }],
//                  generationConfig: { temperature: 0, maxOutputTokens: 2048 } };
//   const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
//     method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
//   });
//   if (!res.ok) { const err = await res.text(); throw new Error(`Gemini error ${res.status}: ${err}`); }
//   const data = await res.json();
//   const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
//   const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
//   return JSON.parse(cleaned);
// }
//
// async function getApiKey() {
//   const result = await chrome.storage.local.get("geminiApiKey");
//   return result.geminiApiKey ?? "";
// }
// async function setApiKey(key) {
//   await chrome.storage.local.set({ geminiApiKey: key.trim() });
// }
