import type { NextApiRequest, NextApiResponse } from "next";
import { askOrchestrate } from "@/lib/ibm-orchestrate";
import { supabaseAdmin } from "@/server/lib/supabase";

type ErrorBody = { error: string };
type OkBody = { reply: string };

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
    message?: string;
    sessionId?: string;
    language?: string;
  };

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim()
      : auth.user.id;

  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim().slice(0, 16)
      : "en";

  try {
    const reply = await askOrchestrate({
      sessionId,
      userMessage: message,
      language,
    });
    return res.status(200).json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Orchestrator error";
    console.error("[orchestrate/chat]", msg);
    return res.status(500).json({ error: msg });
  }
}
