/**
 * /api/form-submission/fill-ready
 *
 * In-memory handoff between the UNIDAD chat (web app) and DANTE (browser extension).
 *
 * POST — Web app stores the English answers produced by HABLA reverse.
 *   Body: { sessionToken, answers: { field_key: english_value }, fields: [{field_key, selector, type, …}] }
 *
 * GET  ?sessionToken=<token>
 *   Extension polls this. Returns { ready: true, answers, fields } once available,
 *   then clears the entry so it can only be consumed once.
 *   Returns { ready: false } when no payload is waiting.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { storeFillPayload, consumeFillPayload } from "@/lib/fill-queue";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST — web app stores the fill payload
  if (req.method === "POST") {
    const { sessionToken, answers, fields } = (req.body ?? {}) as {
      sessionToken?: string;
      answers?: Record<string, string>;
      fields?: unknown[];
    };

    if (!sessionToken || !answers || !Array.isArray(fields)) {
      return res.status(400).json({ error: "sessionToken, answers, and fields are required" });
    }

    storeFillPayload(sessionToken, answers, fields);

    console.log(`[fill-ready] stored payload for session ${sessionToken.slice(0, 8)}… (${Object.keys(answers).length} answers)`);
    return res.status(201).json({ ok: true });
  }

  // GET — extension polls for its payload
  if (req.method === "GET") {
    const sessionToken = typeof req.query.sessionToken === "string" ? req.query.sessionToken : "";

    if (!sessionToken) {
      return res.status(400).json({ error: "sessionToken query param required" });
    }

    const payload = consumeFillPayload(sessionToken);
    if (!payload) {
      return res.status(200).json({ ready: false });
    }

    return res.status(200).json({
      ready: true,
      answers: payload.answers,
      fields: payload.fields,
    });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
