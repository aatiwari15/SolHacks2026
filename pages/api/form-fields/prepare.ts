import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  buildRowsFromFormFields,
  resolveApplicantLanguageCode,
  type ApplicationFieldRow,
} from "@/lib/form-field-display";
import { supabaseAdmin } from "@/server/lib/supabase";

type ErrorBody = { ok?: false; error: string };
type OkBody = {
  ok: true;
  targetLanguage: string;
  targetLanguageLabel: string;
  rows: ApplicationFieldRow[];
  summary: string;
  translationSource: "gemini" | "none";
};

async function getAuthorizedUser(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { ok: false as const, error: "Missing authorization token" };
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authData.user) {
    return { ok: false as const, error: "Invalid session" };
  }

  return { ok: true as const, user: authData.user };
}

function stripCodeFence(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  }
  return t.trim();
}

async function translateWithGemini(
  items: { field_key: string; question_en: string }[],
  languageLabel: string,
  languageCode: string,
): Promise<Map<string, string>> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || items.length === 0) {
    return new Map();
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You translate job or government form field labels for applicants whose preferred language is ${languageLabel} (code: ${languageCode}).

For each item, translate "question_en" into natural ${languageLabel}. Keep the same meaning; use concise phrasing suitable for a form label.

Input JSON:
${JSON.stringify(items)}

Return ONLY a JSON array (no markdown), same length and order, with this shape:
[{"field_key":"string","question_translated":"string"}]

field_key must match input exactly.`;

  let text: string;
  try {
    const result = await model.generateContent(prompt);
    text = result.response.text();
  } catch (e) {
    console.warn("[form-fields/prepare] Gemini request failed:", e);
    return new Map();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(text));
  } catch {
    console.warn("[form-fields/prepare] Gemini JSON parse failed");
    return new Map();
  }

  const map = new Map<string, string>();
  if (!Array.isArray(parsed)) {
    return map;
  }
  for (const row of parsed) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const k = typeof r.field_key === "string" ? r.field_key : "";
    const q = typeof r.question_translated === "string" ? r.question_translated.trim() : "";
    if (k && q) map.set(k, q);
  }
  return map;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OkBody | ErrorBody>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await getAuthorizedUser(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error });
  }

  const body = (req.body ?? {}) as {
    formFields?: unknown[];
    answers?: Record<string, string>;
    applicantLanguage?: string;
  };

  const formFields = Array.isArray(body.formFields) ? body.formFields : [];
  const answers =
    body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? (body.answers as Record<string, string>)
      : {};

  if (formFields.length === 0) {
    return res.status(400).json({ error: "formFields array is required" });
  }

  const { code, label } = resolveApplicantLanguageCode(
    typeof body.applicantLanguage === "string" ? body.applicantLanguage : "",
  );

  const baseRows = buildRowsFromFormFields(formFields, answers);
  const slice = baseRows.slice(0, 80);

  let translationSource: "gemini" | "none" = "none";
  let rows: ApplicationFieldRow[] = slice.map((r) => ({
    fieldKey: r.fieldKey,
    questionEn: r.questionEn,
    questionTranslated: r.questionEn,
    value: r.value,
  }));

  if (code !== "en") {
    try {
      const items = slice.map((r) => ({
        field_key: r.fieldKey,
        question_en: r.questionEn,
      }));
      const translated = await translateWithGemini(items, label, code);
      translationSource = translated.size > 0 ? "gemini" : "none";
      rows = slice.map((r) => ({
        fieldKey: r.fieldKey,
        questionEn: r.questionEn,
        questionTranslated: translated.get(r.fieldKey) ?? r.questionEn,
        value: r.value,
      }));
    } catch (e) {
      console.error("[form-fields/prepare] translation failed:", e);
      translationSource = "none";
      rows = slice.map((r) => ({
        fieldKey: r.fieldKey,
        questionEn: r.questionEn,
        questionTranslated: r.questionEn,
        value: r.value,
      }));
    }
  }

  const summary =
    code === "en"
      ? "Review and complete the fields below using the values Dante captured where shown."
      : translationSource === "gemini"
        ? `Questions are shown in **English** and **${label}** (from your profile). Edit answers as needed.`
        : `Your profile language is **${label}**, but automatic translation is unavailable (set GEMINI_API_KEY). Showing English only.`;

  return res.status(200).json({
    ok: true,
    targetLanguage: code,
    targetLanguageLabel: label,
    rows,
    summary,
    translationSource,
  });
}
