import type { NextApiRequest, NextApiResponse } from "next";
import { askUnidad, clearUnidadSession, type RawField } from "@/lib/agents/unidad";
import { supabaseAdmin } from "@/server/lib/supabase";

type ErrorBody = { error: string };
type OkBody = {
  reply: string;
  phase: string;
  injectPayload?: Array<{ field_id: string; english_answer: string }>;
  formQuestions?: Array<{ step: number; field_id: string; question: string }>;
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
    message?: string;
    sessionId?: string;
    language?: string;
    /** Raw form fields from DANTE — triggers the UNIDAD pipeline */
    formFields?: RawField[];
    /** Bulk answers from the form table — triggers reversal directly */
    formAnswers?: Array<{ field_id: string; user_answer: string }>;
    /** When true, clears session state (new conversation) */
    reset?: boolean;
  };

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim()
      : auth.user.id;
  const language =
    typeof body.language === "string" && body.language.trim()
      ? body.language.trim().slice(0, 32)
      : "en";

  if (body.reset) {
    clearUnidadSession(sessionId);
    return res.status(200).json({ reply: "New conversation started.", phase: "chat" });
  }

  if (!message && (!body.formFields || body.formFields.length === 0)) {
    return res.status(400).json({ error: "message or formFields is required" });
  }

  try {
    const result = await askUnidad({
      sessionId,
      userMessage: message,
      language,
      formFields: Array.isArray(body.formFields) ? body.formFields : undefined,
      formAnswers: Array.isArray(body.formAnswers) ? body.formAnswers : undefined,
    });

    return res.status(200).json({
      reply: result.reply,
      phase: result.phase,
      injectPayload: result.injectPayload,
      formQuestions: result.formQuestions,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Orchestrator error";
    console.error("[orchestrate/chat]", msg);
    return res.status(500).json({ error: msg });
  }
}
