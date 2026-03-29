/**
 * POST /api/form-fields/process
 *
 * Stateless ingestion endpoint — no session, no UNIDAD.
 *
 * Takes raw form fields from DANTE, calls HABLA (translate) → LINDA (reorder),
 * and returns the translated, sorted question list ready for the form table.
 *
 * Body: { formFields: Array<{ field_id, label?, question? }>, language: string }
 * Response: { questions: Array<{ step, field_id, question }> }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { lindaReorder } from "@/lib/agents/linda";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { formFields, language } = (req.body ?? {}) as {
    formFields?: Array<{ field_id: string; label?: string; question?: string }>;
    language?: string;
  };

  if (!Array.isArray(formFields) || formFields.length === 0) {
    return res.status(400).json({ error: "formFields array is required" });
  }

  const lang = typeof language === "string" && language.trim() ? language.trim() : "en";

  console.log(`\n${"=".repeat(60)}`);
  console.log(`[PIPELINE] /api/form-fields/process triggered`);
  console.log(`[PIPELINE] language="${lang}" | fields=${formFields.length}`);
  console.log(`[PIPELINE] field_ids: ${formFields.map(f => f.field_id).join(", ")}`);
  console.log(`[PIPELINE] → handing off to LINDA (which calls HABLA first) — BULK mode, all fields at once`);

  try {
    const t0 = Date.now();
    const questions = await lindaReorder(
      formFields.map((f) => ({ field_id: f.field_id, question: f.question ?? f.label })),
      lang,
    );
    const elapsed = Date.now() - t0;

    const valid = questions.filter((q) => q.field_id !== "error");
    console.log(`[PIPELINE] ✓ LINDA returned ${valid.length} questions as JSON in ${elapsed}ms → rendering as table`);
    valid.forEach(q => console.log(`  step ${q.step}: [${q.field_id}] "${q.question}"`));
    console.log(`${"=".repeat(60)}\n`);

    return res.status(200).json({ questions: valid });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pipeline error";
    console.error(`[PIPELINE] ✗ ERROR: ${msg}`);
    console.log(`${"=".repeat(60)}\n`);
    return res.status(500).json({ error: msg });
  }
}
