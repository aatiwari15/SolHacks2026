/**
 * HABLA — Bulk Translation sub-agent.
 *
 * MODE 1 (localize): Convert ALL raw developer field IDs into polite questions in the target
 *                    language in a single batch. Output is consumed by LINDA for reordering,
 *                    then rendered as a fillable table — never asked one-by-one.
 * MODE 2 (reverse):  Translate ALL of the user's native-language answers back to formal English
 *                    in a single batch so DANTE can inject them into the form.
 *
 * Rules:
 *  - Process ALL fields / answers in ONE response. Never split or sequence output.
 *  - NEVER alter or translate the field_id string.
 *  - Strip filler words from answers ("umm", "I think", etc.).
 *  - Do not translate proper nouns, emails, dates, or numbers.
 *  - Always return valid JSON only — no prose, no markdown fences.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemma-3-27b-it";

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("[HABLA] GEMINI_API_KEY is not set");
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

export type HablaLocalizeInput = Array<{ field_id: string; label?: string }>;
export type HablaLocalizeOutput = Array<{ field_id: string; question: string }>;

export type HablaReverseInput = Array<{ field_id: string; user_answer: string }>;
export type HablaReverseOutput = Array<{ field_id: string; english_answer: string }>;

const LOCALIZE_SYSTEM = `You are HABLA, a strictly mechanical bulk-translation sub-agent. You only output valid JSON arrays.
You do not output conversational text, markdown formatting, or explanations.

CRITICAL: You must NEVER alter, translate, or delete the "field_id" string in any payload.

TASK — LOCALIZATION MODE (BULK):
You receive ALL form fields at once. Convert EVERY field into a polite, formal question in
the specified target language in a SINGLE response. The output will be used by LINDA to
reorder by cognitive load and then displayed as a fillable table — NOT asked one-by-one.

Each input item has a "field_id" (machine key, never translate) and an optional "label"
(the human-readable field name — USE THIS for translation).

For each item:
1. Use the "label" field if present to determine the English intent (e.g. label "email Address" → ask for email).
   If no label, infer intent from the field_id by removing underscores/camelCase.
2. Translate the intent into the target language.
3. Format as a polite, formal question.

Return ONLY a single JSON array covering ALL input fields:
[{"field_id":"EXACT_ORIGINAL_ID","question":"The polite translated question?"}]

If input is empty or invalid, output exactly: [{"error":"invalid_input"}]`;

const REVERSE_SYSTEM = `You are HABLA, a strictly mechanical bulk-translation sub-agent. You only output valid JSON arrays.
You do not output conversational text, markdown formatting, or explanations.

CRITICAL: You must NEVER alter, translate, or delete the "field_id" string in any payload.

TASK — REVERSAL MODE (BULK):
You receive ALL user answers at once from the filled form table. Translate EVERY answer from
the user's native language back to formal English in a SINGLE response. The translated answers
will be passed directly to DANTE, which injects them into the real form fields on the webpage.

For each item:
1. Read the user_answer.
2. Extract ONLY relevant data (ignore filler like "umm", "I think", "well,").
3. Translate the relevant data into formal English.
4. Do NOT translate proper nouns, emails, dates, or numbers.

Return ONLY a single JSON array covering ALL input answers:
[{"field_id":"EXACT_ORIGINAL_ID","english_answer":"The extracted, translated English data"}]

If input is empty or invalid, output exactly: [{"error":"invalid_input"}]`;

export async function hablaLocalize(
  fields: HablaLocalizeInput,
  targetLanguage: string,
): Promise<HablaLocalizeOutput> {
  if (!fields.length) return [{ field_id: "error", question: "invalid_input" }];

  console.log(`[HABLA] ▶ localize: ${fields.length} fields → language="${targetLanguage}" using model=${MODEL}`);
  console.log(`[HABLA] GEMINI_API_KEY set: ${!!process.env.GEMINI_API_KEY?.trim()}`);

  const model = getModel();
  const prompt = `Target language: ${targetLanguage}\n\nInput:\n${JSON.stringify(fields)}`;

  const t0 = Date.now();
  const result = await model.generateContent({
    contents: [
      { role: "user", parts: [{ text: `${LOCALIZE_SYSTEM}\n\n${prompt}` }] },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  });
  console.log(`[HABLA] ✓ gemma-3-27b-it localize responded in ${Date.now() - t0}ms`);

  const raw = result.response.text();
  console.log(`[HABLA] raw response (first 300 chars): ${raw.slice(0, 300)}`);
  try {
    const parsed = JSON.parse(stripFence(raw)) as HablaLocalizeOutput;
    console.log(`[HABLA] ✓ parsed ${parsed.length} translated questions`);
    return parsed;
  } catch {
    console.error("[HABLA] ✗ localize JSON parse failed:", raw.slice(0, 200));
    return fields.map((f) => ({ field_id: f.field_id, question: f.field_id }));
  }
}

export async function hablaReverse(
  answers: HablaReverseInput,
): Promise<HablaReverseOutput> {
  if (!answers.length) return [{ field_id: "error", english_answer: "invalid_input" }];

  console.log(`[HABLA] ▶ reverse: ${answers.length} answers → English using model=${MODEL}`);

  const model = getModel();
  const prompt = `Input:\n${JSON.stringify(answers)}`;

  const t0 = Date.now();
  const result = await model.generateContent({
    contents: [
      { role: "user", parts: [{ text: `${REVERSE_SYSTEM}\n\n${prompt}` }] },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  });
  console.log(`[HABLA] ✓ gemma-3-27b-it reverse responded in ${Date.now() - t0}ms`);

  const raw = result.response.text();
  console.log(`[HABLA] raw reverse response (first 300 chars): ${raw.slice(0, 300)}`);
  try {
    const parsed = JSON.parse(stripFence(raw)) as HablaReverseOutput;
    console.log(`[HABLA] ✓ parsed ${parsed.length} English answers`);
    return parsed;
  } catch {
    console.error("[HABLA] ✗ reverse JSON parse failed:", raw.slice(0, 200));
    return answers.map((a) => ({ field_id: a.field_id, english_answer: a.user_answer }));
  }
}
