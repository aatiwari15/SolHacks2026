import type { NextApiRequest, NextApiResponse } from "next";
import { hablaLocalize } from "@/lib/agents/habla";
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
  translationSource: "habla" | "none";
};

async function getAuthorizedUser(req: NextApiRequest) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false as const, error: "Missing authorization token" };

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData.user) return { ok: false as const, error: "Invalid session" };

  return { ok: true as const, user: authData.user };
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
  if (!auth.ok) return res.status(401).json({ error: auth.error });

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

  let translationSource: "habla" | "none" = "none";
  let rows: ApplicationFieldRow[] = slice.map((r) => ({
    fieldKey: r.fieldKey,
    questionEn: r.questionEn,
    questionTranslated: r.questionEn,
    value: r.value,
  }));

  if (code !== "en") {
    try {
      const hablaInput = slice.map((r) => ({ field_id: r.fieldKey }));
      const translated = await hablaLocalize(hablaInput, label);

      const transMap = new Map<string, string>();
      for (const t of translated) {
        if (t.field_id !== "error" && "question" in t) {
          transMap.set(t.field_id, t.question);
        }
      }

      if (transMap.size > 0) {
        translationSource = "habla";
        rows = slice.map((r) => ({
          fieldKey: r.fieldKey,
          questionEn: r.questionEn,
          questionTranslated: transMap.get(r.fieldKey) ?? r.questionEn,
          value: r.value,
        }));
      }
    } catch (e) {
      console.error("[form-fields/prepare] HABLA translation failed:", e);
    }
  }

  const summary =
    code === "en"
      ? "Review and complete the fields below using the values Dante captured where shown."
      : translationSource === "habla"
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
