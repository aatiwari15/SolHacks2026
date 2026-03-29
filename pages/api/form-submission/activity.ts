/**
 * GET /api/form-submission/activity?since=<ISO8601>
 *
 * Authenticated users poll for new Dante submissions when Realtime misses a broadcast.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/server/lib/supabase";

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

function parseSince(raw: string | undefined): string {
  if (!raw) return new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date(Date.now() - 5 * 60 * 1000).toISOString();
  return d.toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await getAuthorizedUser(req);
  if (!auth.ok) {
    return res.status(401).json({ error: auth.error });
  }

  const since = parseSince(typeof req.query.since === "string" ? req.query.since : undefined);

  const { data, error } = await supabaseAdmin
    .from("form_submissions")
    .select("id, page_url, page_title, form_fields, answers, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(40);

  if (error) {
    console.error("[Unidad] activity query failed:", error.message);
    return res.status(500).json({ error: "Failed to load activity" });
  }

  const submissions = (data ?? []).map((row) => {
    const formFields = Array.isArray(row.form_fields) ? row.form_fields : [];
    const ans = row.answers;
    const answers =
      ans && typeof ans === "object" && !Array.isArray(ans)
        ? (ans as Record<string, string>)
        : {};
    return {
      id: row.id as string,
      pageUrl: row.page_url as string,
      pageTitle: (row.page_title as string) || "Form",
      fieldCount: formFields.length,
      createdAt: row.created_at as string,
      formFields,
      answers,
    };
  });

  return res.status(200).json({ submissions });
}
