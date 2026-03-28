/**
 * Edge Function: generate-cheat-sheet
 *
 * Triggered when Simpli is active. Pulls the last N agent_logs for a session,
 * builds a linguistic context from what Mismo said, then calls Gemini to
 * generate a Markdown cheat sheet.
 *
 * POST body: { sessionId: string; targetLanguage?: string }
 * Response:  { markdown: string }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const { sessionId, targetLanguage = "Spanish" } = await req.json();

    if (!sessionId) {
      return Response.json({ error: "sessionId is required" }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── 1. Pull linguistic context from Mismo's agent_logs ───────────────────
    const { data: logs, error } = await supabase
      .from("agent_logs")
      .select("chain_of_thought, created_at")
      .eq("session_id", sessionId)
      .eq("agent", "mismo")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    const linguisticContext = (logs ?? [])
      .map((log) => {
        const cot = log.chain_of_thought as Record<string, unknown>;
        return cot?.transcript ?? cot?.summary ?? JSON.stringify(cot);
      })
      .filter(Boolean)
      .join("\n");

    // ── 2. Call Gemini ────────────────────────────────────────────────────────
    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: buildCheatSheetPrompt(linguisticContext, targetLanguage),
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      throw new Error(`Gemini error: ${err}`);
    }

    const geminiData = await geminiRes.json();
    const markdown: string =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // ── 3. Log Simpli's output ────────────────────────────────────────────────
    await supabase.from("agent_logs").insert({
      session_id: sessionId,
      agent: "simpli",
      chain_of_thought: {
        linguistic_context: linguisticContext,
        generated_markdown: markdown,
        target_language: targetLanguage,
        model: "gemini-2.0-flash",
      },
    });

    return Response.json(
      { markdown },
      { headers: { "Access-Control-Allow-Origin": "*" } },
    );
  } catch (err) {
    console.error(err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCheatSheetPrompt(
  linguisticContext: string,
  targetLanguage: string,
): string {
  return `You are Simpli, an AI assistant for immigrants navigating complex government forms.
Based on the conversation context below, generate a concise Markdown cheat sheet in ${targetLanguage}.

Include:
- Key terms with plain-language definitions
- Step-by-step instructions for any form fields mentioned
- Common mistakes to avoid
- Any deadlines or important numbers referenced

Keep it under 400 words. Use headers, bullet points, and bold for emphasis.

Conversation Context:
${linguisticContext || "(No prior context — generate a general immigration form guide)"}

Cheat Sheet:`;
}
