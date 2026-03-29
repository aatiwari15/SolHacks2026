/**
 * /api/form-submission/submit
 *
 * Direct submit path — bypasses UNIDAD session state entirely.
 *
 * Receives the user's filled form answers (in their native language),
 * calls HABLA reverse to translate them to English, then stores the
 * result in the fill-ready queue for DANTE to pick up.
 *
 * POST body:
 *   {
 *     sessionToken: string,            // extension session token (keyed to DANTE)
 *     answers: Array<{ field_id, user_answer }>,
 *     fields: unknown[],               // original extension fields (selector/type)
 *   }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { hablaReverse } from "@/lib/agents/habla";
import { storeFillPayload } from "@/lib/fill-queue";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionToken, answers, fields } = (req.body ?? {}) as {
    sessionToken?: string;
    answers?: Array<{ field_id: string; user_answer: string }>;
    fields?: unknown[];
  };

  if (!sessionToken || !Array.isArray(answers) || !Array.isArray(fields)) {
    return res.status(400).json({ error: "sessionToken, answers[], and fields[] are required" });
  }

  console.log(`\n[SUBMIT] /api/form-submission/submit called`);
  console.log(`[SUBMIT] sessionToken=${sessionToken.slice(0,8)}… | answers=${answers.length} | fields=${fields.length}`);
  console.log(`[SUBMIT] → calling HABLA reverse to translate answers to English`);

  try {
    // Translate answers from user's language → English via HABLA
    const reversed = await hablaReverse(answers);

    const englishAnswers = Object.fromEntries(
      reversed
        .filter((r) => r.field_id !== "error")
        .map((r) => [r.field_id, r.english_answer]),
    );

    // Store in shared fill-ready queue for DANTE to poll
    storeFillPayload(sessionToken, englishAnswers, fields);

    console.log(
      `[form-submission/submit] stored payload for session ${sessionToken.slice(0, 8)}… (${Object.keys(englishAnswers).length} answers)`,
    );

    return res.status(200).json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Submit error";
    console.error("[form-submission/submit]", msg);
    return res.status(500).json({ error: msg });
  }
}
