/**
 * /api/form-submission
 *
 * Three modes:
 *
 *  POST  (no auth required)
 *    Browser extension submits a scanned form + filled answers.
 *    Body: { sessionToken, pageUrl, pageTitle, formFields, answers }
 *    Returns: { submissionId }
 *
 *  GET ?sessionToken=<token>
 *    Extension polls its own recent submissions (last 10).
 *
 *  GET  Authorization: Bearer <BROADCAST_SECRET>
 *    Agents pull all pending submissions to process.
 *
 *  PATCH  Authorization: Bearer <BROADCAST_SECRET>
 *    Agents update a submission's status.
 *    Body: { id, status: "processing" | "done" }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/server/lib/supabase";
import { broadcastFormSubmitted } from "@/server/lib/realtime-broadcast";
import { sanitizeForAgent } from "@/lib/form-field-display";

type SubmissionRow = {
  session_token: string;
  page_url: string;
  page_title: string;
  raw_form_fields: unknown;
  raw_answers: unknown;
  form_fields: unknown;
  answers: unknown;
  status: "pending" | "processing" | "done";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ── POST: extension submits form data ──────────────────────────────────────
  if (req.method === "POST") {
    const { sessionToken, pageUrl, pageTitle, formFields, answers } = (req.body ?? {}) as {
      sessionToken?: string;
      pageUrl?: string;
      pageTitle?: string;
      formFields?: unknown[];
      answers?: Record<string, string>;
    };

    if (!sessionToken || !pageUrl || !Array.isArray(formFields) || !answers) {
      return res.status(400).json({
        error: "sessionToken, pageUrl, formFields (array), and answers are required",
      });
    }

    const sanitizedFormFields = formFields.map((f) => {
      if (!f || typeof f !== "object") return f;
      const field = f as Record<string, unknown>;
      return typeof field.label === "string"
        ? { ...field, label: sanitizeForAgent(field.label) }
        : field;
    });
    const sanitizedAnswers = Object.fromEntries(
      Object.entries(answers).map(([k, v]) => [k, sanitizeForAgent(v)]),
    );

    const row: SubmissionRow = {
      session_token: sessionToken,
      page_url: pageUrl,
      page_title: pageTitle ?? "",
      raw_form_fields: formFields,
      raw_answers: answers,
      form_fields: sanitizedFormFields,
      answers: sanitizedAnswers,
      status: "pending",
    };

    const { data, error } = await supabaseAdmin
      .from("form_submissions")
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("[Unidad] form_submission insert failed:", error.message);
      return res.status(500).json({ error: "Failed to save submission" });
    }

    console.log(`[Unidad] Form submission saved: ${data.id} | ${pageUrl}`);

    try {
      const broadcastPayload: Record<string, unknown> = {
        submissionId: data.id,
        pageUrl,
        pageTitle: pageTitle ?? "",
        sessionToken,
        fieldCount: formFields.length,
        formFields: sanitizedFormFields,
        answers: sanitizedAnswers,
      };
      const approxSize = JSON.stringify(broadcastPayload).length;
      if (approxSize > 240_000) {
        console.warn(
          `[Unidad] broadcast payload large (${approxSize} chars); omitting formFields/answers`,
        );
        delete broadcastPayload.formFields;
        delete broadcastPayload.answers;
      }
      await broadcastFormSubmitted(broadcastPayload);
    } catch (err) {
      console.warn("[Unidad] broadcast failed (non-fatal):", err);
    }

    return res.status(201).json({ submissionId: data.id });
  }

  // ── GET: fetch submissions ─────────────────────────────────────────────────
  if (req.method === "GET") {
    const authHeader = req.headers.authorization ?? "";
    const isAgent = authHeader === `Bearer ${process.env.BROADCAST_SECRET}`;
    const { sessionToken, status } = req.query as {
      sessionToken?: string;
      status?: string;
    };

    if (!isAgent && !sessionToken) {
      return res.status(401).json({ error: "Provide sessionToken query param or agent auth header" });
    }

    if (isAgent) {
      // Agents get pending (or filtered) submissions
      const targetStatus = status ?? "pending";
      const { data, error } = await supabaseAdmin
        .from("form_submissions")
        .select("*")
        .eq("status", targetStatus)
        .order("created_at", { ascending: true });

      if (error) {
        return res.status(500).json({ error: "Failed to fetch submissions" });
      }
      return res.status(200).json({ submissions: data });
    }

    // Extension polls its own submissions
    const { data, error } = await supabaseAdmin
      .from("form_submissions")
      .select("id, page_url, page_title, status, created_at")
      .eq("session_token", sessionToken!)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      return res.status(500).json({ error: "Failed to fetch submissions" });
    }
    return res.status(200).json({ submissions: data });
  }

  // ── PATCH: agents update submission status ─────────────────────────────────
  if (req.method === "PATCH") {
    const authHeader = req.headers.authorization ?? "";
    if (authHeader !== `Bearer ${process.env.BROADCAST_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id, status } = (req.body ?? {}) as { id?: string; status?: string };
    if (!id || !status) {
      return res.status(400).json({ error: "id and status are required" });
    }

    const valid = ["pending", "processing", "done"];
    if (!valid.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${valid.join(", ")}` });
    }

    const { error } = await supabaseAdmin
      .from("form_submissions")
      .update({ status })
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: "Failed to update submission" });
    }
    console.log(`[Unidad] Submission ${id} → ${status}`);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
