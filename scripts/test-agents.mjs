/**
 * Standalone agent test script
 * Uses GEMINI_API_KEY2 + Supabase service role key
 * Fetches a real form_submissions row and runs it through HABLA → LINDA
 *
 * Run:  node scripts/test-agents.mjs
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Load .env manually ──────────────────────────────────────────────────────
const envPath = join(__dirname, "../.env");
const envRaw = readFileSync(envPath, "utf-8");
const env = {};
for (const line of envRaw.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  // Strip surrounding quotes
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}

// Use GEMINI_API_KEY2 as the primary key for this test
const GEMINI_API_KEY = env["GEMINI_API_KEY2"] || env["GEMINI_API_KEY"];
if (!GEMINI_API_KEY) {
  console.error("❌  No Gemini API key found (GEMINI_API_KEY2 or GEMINI_API_KEY)");
  process.exit(1);
}
console.log(`✓ Gemini key loaded (ends …${GEMINI_API_KEY.slice(-6)})`);

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SUPABASE_SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
console.log(`✓ Supabase URL: ${SUPABASE_URL}`);

const MODEL = "gemma-3-27b-it";

// ── Helpers ─────────────────────────────────────────────────────────────────

function stripFence(text) {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

function getModel() {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: MODEL });
}

async function generateWithRetry(model, request, label = "Gemini", maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await model.generateContent(request);
    } catch (e) {
      const is429 = e?.status === 429 || String(e?.message).includes("429");
      if (!is429 || attempt === maxRetries) throw e;
      // Parse retry-after from error if available
      const retryMatch = String(e?.message).match(/retry in ([\d.]+)s/i);
      const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : 15 * (attempt + 1);
      console.log(`[${label}] ⏳ rate limited — waiting ${waitSec}s before retry ${attempt + 1}/${maxRetries}...`);
      await new Promise((r) => setTimeout(r, waitSec * 1000));
    }
  }
}

// ── HABLA localize ──────────────────────────────────────────────────────────

const LOCALIZE_SYSTEM = `You are HABLA, a strictly mechanical bulk-translation sub-agent. You only output valid JSON arrays.
You do not output conversational text, markdown formatting, or explanations.

CRITICAL: You must NEVER alter, translate, or delete the "field_id" string in any payload.

TASK — LOCALIZATION MODE (BULK):
You receive ALL form fields at once. Convert EVERY field into a polite, formal question in
the specified target language in a SINGLE response.

Each input item has a "field_id" (machine key, never translate) and an optional "label".

For each item:
1. Use the "label" field if present to determine the English intent.
   If no label, infer intent from the field_id by removing underscores/camelCase.
2. Translate the intent into the target language.
3. Format as a polite, formal question.

Return ONLY a single JSON array covering ALL input fields:
[{"field_id":"EXACT_ORIGINAL_ID","question":"The polite translated question?"}]

If input is empty or invalid, output exactly: [{"error":"invalid_input"}]`;

async function hablaLocalize(fields, targetLanguage) {
  console.log(`\n[HABLA] ▶ localizing ${fields.length} fields → language="${targetLanguage}"`);
  const model = getModel();
  const prompt = `${LOCALIZE_SYSTEM}\n\nTarget language: ${targetLanguage}\n\nInput:\n${JSON.stringify(fields)}`;

  const t0 = Date.now();
  const result = await generateWithRetry(model, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  }, "HABLA");
  console.log(`[HABLA] ✓ responded in ${Date.now() - t0}ms`);

  const raw = result.response.text();
  console.log(`[HABLA] raw (first 300): ${raw.slice(0, 300)}`);
  try {
    const parsed = JSON.parse(stripFence(raw));
    console.log(`[HABLA] ✓ parsed ${parsed.length} questions`);
    return parsed;
  } catch {
    console.error("[HABLA] ✗ JSON parse failed:", raw.slice(0, 200));
    return fields.map((f) => ({ field_id: f.field_id, question: f.label || f.field_id }));
  }
}

// ── HABLA reverse ───────────────────────────────────────────────────────────

const REVERSE_SYSTEM = `You are HABLA, a strictly mechanical bulk-translation sub-agent. You only output valid JSON arrays.

CRITICAL: You must NEVER alter, translate, or delete the "field_id" string in any payload.

TASK — REVERSAL MODE (BULK):
Translate EVERY user answer back to formal English in a SINGLE response.
Strip filler words. Do NOT translate proper nouns, emails, dates, or numbers.

Return ONLY a single JSON array:
[{"field_id":"EXACT_ORIGINAL_ID","english_answer":"The extracted, translated English data"}]

If input is empty or invalid, output exactly: [{"error":"invalid_input"}]`;

async function hablaReverse(answers) {
  console.log(`\n[HABLA] ▶ reversing ${answers.length} answers → English`);
  const model = getModel();
  const prompt = `${REVERSE_SYSTEM}\n\nInput:\n${JSON.stringify(answers)}`;

  const t0 = Date.now();
  const result = await generateWithRetry(model, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  }, "HABLA-reverse");
  console.log(`[HABLA reverse] ✓ responded in ${Date.now() - t0}ms`);

  const raw = result.response.text();
  console.log(`[HABLA reverse] raw (first 300): ${raw.slice(0, 300)}`);
  try {
    const parsed = JSON.parse(stripFence(raw));
    console.log(`[HABLA reverse] ✓ parsed ${parsed.length} english answers`);
    return parsed;
  } catch {
    console.error("[HABLA reverse] ✗ JSON parse failed:", raw.slice(0, 200));
    return answers.map((a) => ({ field_id: a.field_id, english_answer: a.user_answer }));
  }
}

// ── LINDA sort ──────────────────────────────────────────────────────────────

const SORT_SYSTEM = `You are LINDA, a strict Data Sorting Node. You do NOT converse with users.

You receive a JSON array of ALL translated form questions at once.
Your ONLY job is to reorder ALL of them by cognitive load and emit ONE complete JSON array.

Ordering rule — easiest / least-intrusive fields first:
  1. Name (first, preferred, middle, last)
  2. Contact (email, phone)
  3. Address (street, city, state, zip)
  4. Employment / education history
  5. Financial information
  6. Legal disclosures, SSN, government IDs

RULES:
- Output ONLY a valid JSON array. Your entire response MUST start with [ and end with ].
- Do NOT add markdown, comments, or any text outside the brackets.
- Preserve ALL items from the input — no data loss, no skipped fields.
- Add a "step" field starting at 1 for the reordered sequence.
- Do NOT alter field_id or question values.

Output schema:
[{"step":1,"field_id":"original_id","question":"Translated question text"}]

If input is empty or malformed: [{"error":"INVALID_INPUT_DATA"}]`;

async function lindaReorder(scrapedFields, targetLanguage) {
  console.log(`\n[LINDA] ▶ received ${scrapedFields.length} fields`);

  // Step 1: HABLA translate
  const hablaInput = scrapedFields.map((f) => ({ field_id: f.field_id, label: f.question }));
  const translated = await hablaLocalize(hablaInput, targetLanguage);

  const mergedMap = new Map();
  for (const t of translated) {
    if (t.field_id !== "error") mergedMap.set(t.field_id, t.question);
  }
  for (const f of scrapedFields) {
    if (f.question && !mergedMap.has(f.field_id)) {
      mergedMap.set(f.field_id, f.question);
    }
  }

  const translatedArray = Array.from(mergedMap.entries()).map(([field_id, question]) => ({
    field_id,
    question,
  }));

  if (!translatedArray.length) {
    return [{ step: 1, field_id: "error", question: "INVALID_INPUT_DATA" }];
  }

  console.log(`\n[LINDA] step 2 → sorting ${translatedArray.length} translated fields`);

  // Step 2: Gemini sort
  const model = getModel();
  const prompt = `${SORT_SYSTEM}\n\nInput array to sort:\n${JSON.stringify(translatedArray)}`;

  const t0 = Date.now();
  const result = await generateWithRetry(model, {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 2048 },
  }, "LINDA");
  console.log(`[LINDA] ✓ sort responded in ${Date.now() - t0}ms`);

  const raw = result.response.text();
  try {
    const sorted = JSON.parse(stripFence(raw));
    const reindexed = sorted.map((item, idx) => ({ ...item, step: idx + 1 }));
    console.log(`[LINDA] ✓ sorted ${reindexed.length} fields`);
    return reindexed;
  } catch {
    console.error("[LINDA] ✗ JSON parse failed:", raw.slice(0, 200));
    return translatedArray.map((item, idx) => ({
      step: idx + 1,
      field_id: item.field_id,
      question: item.question,
    }));
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Connect to Supabase
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  console.log("\n[SUPABASE] fetching most recent form_submissions row...");
  const { data, error } = await supabase
    .from("form_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error("[SUPABASE] ✗ query failed:", error.message);
    // Fall back to a hardcoded test payload
    console.log("[TEST] falling back to hardcoded test fields...");
    await runPipeline([
      { field_id: "first_name", question: "First Name" },
      { field_id: "last_name", question: "Last Name" },
      { field_id: "email", question: "Email Address" },
      { field_id: "phone", question: "Phone Number" },
      { field_id: "ssn", question: "Social Security Number" },
      { field_id: "street_address", question: "Street Address" },
      { field_id: "city", question: "City" },
      { field_id: "state", question: "State" },
      { field_id: "zip_code", question: "Zip Code" },
      { field_id: "employer", question: "Current Employer" },
    ], "Spanish");
    return;
  }

  console.log(`[SUPABASE] ✓ got row id=${data.id} from ${data.created_at}`);
  console.log(`[SUPABASE] raw row keys: ${Object.keys(data).join(", ")}`);

  // Extract form fields — try common column names
  let fields = [];
  if (Array.isArray(data.fields)) {
    fields = data.fields;
  } else if (Array.isArray(data.form_fields)) {
    fields = data.form_fields;
  } else if (typeof data.fields === "string") {
    try { fields = JSON.parse(data.fields); } catch {}
  } else if (typeof data.form_fields === "string") {
    try { fields = JSON.parse(data.form_fields); } catch {}
  }

  if (!fields.length) {
    console.log("[TEST] no fields array found in row — using full row keys as synthetic fields");
    // Treat each non-meta column as a field
    const skip = new Set(["id", "created_at", "updated_at", "user_id", "session_token"]);
    fields = Object.keys(data)
      .filter((k) => !skip.has(k))
      .map((k) => ({ field_id: k, question: k.replace(/_/g, " ") }));
  }

  // Normalize: Supabase stores field_key (not field_id) and label (not question)
  fields = fields.map((f) => ({
    field_id: f.field_id ?? f.field_key ?? f.id ?? String(f),
    question: f.question ?? f.label ?? f.field_id ?? f.field_key,
  })).filter((f) => f.field_id);

  console.log(`[TEST] ${fields.length} fields extracted:`, fields.map((f) => f.field_id));

  const language = data.language || "Spanish";
  await runPipeline(fields, language);
}

async function runPipeline(fields, language) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`PIPELINE TEST  language="${language}"  fields=${fields.length}`);
  console.log("=".repeat(60));

  // Run HABLA → LINDA
  const sorted = await lindaReorder(fields, language);

  console.log(`\n${"=".repeat(60)}`);
  console.log("LINDA OUTPUT — sorted question table:");
  console.log("=".repeat(60));
  console.log(JSON.stringify(sorted, null, 2));

  // Round-trip test: dummy answers through HABLA reverse
  const dummyAnswers = sorted
    .filter((q) => q.field_id !== "error")
    .map((q) => ({
      field_id: q.field_id,
      user_answer: `[respuesta de prueba para ${q.field_id}]`,
    }));

  if (dummyAnswers.length) {
    const english = await hablaReverse(dummyAnswers);
    console.log(`\n${"=".repeat(60)}`);
    console.log("HABLA REVERSE OUTPUT — english answers:");
    console.log("=".repeat(60));
    console.log(JSON.stringify(english, null, 2));
  }

  console.log("\n✅  Pipeline test complete.");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
