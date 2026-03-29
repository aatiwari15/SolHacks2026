/**
 * LINDA — Data Sorting Node and Pipeline Orchestrator.
 *
 * Receives a raw array of scraped form fields and a target language.
 * Workflow (strict order):
 *   Step 1. Invoke HABLA to translate ALL field IDs into polite questions in bulk.
 *   Step 2. Reorder ALL questions from easiest / least-intrusive to hardest / most-sensitive.
 *   Step 3. Output ONE complete, sorted JSON array covering every field.
 *
 * LINDA is non-conversational and non-sequential.
 * It processes every field in a SINGLE batch and emits exactly ONE JSON array.
 * It never asks questions one-by-one. The output is consumed by the UI to render a
 * fillable form table that the user completes all at once.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { hablaLocalize, type HablaLocalizeInput } from "./habla";

const MODEL = "gemma-3-27b-it";

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("[LINDA] GEMINI_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: MODEL });
}

function stripFence(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

function parseJsonArray(rawText: string): unknown[] | null {
  const cleaned = stripFence(rawText);

  // Fast path: response is directly a JSON array.
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (Array.isArray(parsed)) return parsed;
    if (
      parsed &&
      typeof parsed === "object" &&
      "questions" in parsed &&
      Array.isArray((parsed as { questions?: unknown[] }).questions)
    ) {
      return (parsed as { questions: unknown[] }).questions;
    }
  } catch {
    // Fall through to bracket extraction.
  }

  // Recovery path: extract the first bracketed JSON array from mixed text.
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start < 0 || end < 0 || end <= start) return null;
  try {
    const sliced = cleaned.slice(start, end + 1);
    const parsed = JSON.parse(sliced) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export type LindaField = { field_id: string; question?: string };
export type LindaOutputItem = { step: number; field_id: string; question: string };

const SORT_SYSTEM = `You are LINDA, a strict Data Sorting Node. You do NOT converse with users.

You receive a JSON array of ALL translated form questions at once.
Your ONLY job is to reorder ALL of them by cognitive load and emit ONE complete JSON array.

CRITICAL BEHAVIOUR:
- Process ALL fields in a SINGLE response. Never split output across multiple replies.
- Do NOT ask questions one by one. Do NOT interview the user.
- Output the ENTIRE sorted list in one shot so it can be rendered as a fillable table.

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

export async function lindaReorder(
  scrapedFields: LindaField[],
  targetLanguage: string,
): Promise<LindaOutputItem[]> {
  if (!scrapedFields.length) {
    return [{ step: 1, field_id: "error", question: "INVALID_INPUT_DATA" }];
  }

  console.log(`[LINDA] ▶ received ${scrapedFields.length} fields for language="${targetLanguage}"`);
  console.log(`[LINDA] step 1 → calling HABLA to translate`);

  // Step 1: Invoke HABLA to translate
  const hablaInput: HablaLocalizeInput = scrapedFields.map((f) => ({
    field_id: f.field_id,
    label: f.question, // pass the human-readable label so HABLA generates proper questions
  }));
  const translated = await hablaLocalize(hablaInput, targetLanguage);

  // Merge any pre-existing question text with HABLA output
  const mergedMap = new Map<string, string>();
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

  console.log(`[LINDA] step 2 → calling gemma-3-27b-it (${MODEL}) to sort ${translatedArray.length} translated fields`);

  // Step 2: Ask gemma-3-27b-it to sort by cognitive load
  const model = getModel();
  const prompt = `${SORT_SYSTEM}\n\nInput array to sort:\n${JSON.stringify(translatedArray)}`;

  const t0 = Date.now();
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, maxOutputTokens: 2048 },
  });
  console.log(`[LINDA] ✓ gemma-3-27b-it sort responded in ${Date.now() - t0}ms`);

  const raw = result.response.text();
  const parsed = parseJsonArray(raw);
  if (!parsed) {
    console.error("[LINDA] ✗ JSON parse failed:", raw.slice(0, 200));
    return translatedArray.map((item, idx) => ({
      step: idx + 1,
      field_id: item.field_id,
      question: item.question,
    }));
  }

  const allowed = new Map(translatedArray.map((x) => [x.field_id, x.question]));
  const normalized: Array<{ field_id: string; question: string }> = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const fieldId = typeof obj.field_id === "string" ? obj.field_id : "";
    const question = typeof obj.question === "string" ? obj.question.trim() : "";
    if (!fieldId || !question || !allowed.has(fieldId)) continue;
    if (normalized.some((x) => x.field_id === fieldId)) continue;
    normalized.push({ field_id: fieldId, question });
  }

  // Ensure complete coverage even if model drops fields.
  for (const item of translatedArray) {
    if (!normalized.some((x) => x.field_id === item.field_id)) {
      normalized.push(item);
    }
  }

  const reindexed: LindaOutputItem[] = normalized.map((item, idx) => ({
    step: idx + 1,
    field_id: item.field_id,
    question: item.question,
  }));
  console.log(`[LINDA] ✓ sorted ${reindexed.length} fields successfully`);
  return reindexed;
}
