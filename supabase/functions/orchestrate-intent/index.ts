/**
 * Edge Function: orchestrate-intent
 *
 * Receives a voice transcript from LiveKit and routes it to IBM watsonx
 * Orchestrate to determine which agent (dante / mismo / simpli) should respond.
 *
 * POST body: { transcript: string; sessionId: string }
 * Response:  { agent: "dante" | "mismo" | "simpli"; intent: string; confidence: number }
 */

import { createClient } from "jsr:@supabase/supabase-js@2";

const WATSONX_API_KEY = Deno.env.get("IBMWATSONX_API_KEY")!;
const WATSONX_INSTANCE_ID = Deno.env.get("IBMWATSONX_INSTANCE_ID")!;
const WATSONX_BASE_URL =
  Deno.env.get("IBMWATSONX_BASE_URL") ??
  "https://us-south.ml.cloud.ibm.com/ml/v1";

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
    const { transcript, sessionId } = await req.json();

    if (!transcript || !sessionId) {
      return Response.json(
        { error: "transcript and sessionId are required" },
        { status: 400 },
      );
    }

    // ── 1. Call IBM watsonx Orchestrate ──────────────────────────────────────
    const watsonxRes = await fetch(`${WATSONX_BASE_URL}/text/generation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WATSONX_API_KEY}`,
      },
      body: JSON.stringify({
        model_id: "ibm/granite-13b-instruct-v2",
        instance_id: WATSONX_INSTANCE_ID,
        input: buildOrchestrationPrompt(transcript),
        parameters: { max_new_tokens: 100, temperature: 0 },
      }),
    });

    if (!watsonxRes.ok) {
      const err = await watsonxRes.text();
      throw new Error(`watsonx error: ${err}`);
    }

    const watsonxData = await watsonxRes.json();
    const rawOutput: string =
      watsonxData.results?.[0]?.generated_text ?? "";

    const parsed = parseOrchestrationOutput(rawOutput);

    // ── 2. Log the chain-of-thought to agent_logs ────────────────────────────
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    await supabase.from("agent_logs").insert({
      session_id: sessionId,
      agent: parsed.agent,
      chain_of_thought: {
        transcript,
        raw_output: rawOutput,
        parsed,
        model: "ibm/granite-13b-instruct-v2",
      },
    });

    return Response.json(parsed, {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildOrchestrationPrompt(transcript: string): string {
  return `You are an AI orchestrator for an immigrant assistance platform.
Given a user's voice transcript, respond with a JSON object:
  { "agent": "dante"|"mismo"|"simpli", "intent": "<short description>", "confidence": 0-1 }

Agents:
- dante: Handles browser automation and form filling.
- mismo: Provides real-time bilingual translation assistance.
- simpli: Generates simplified cheat sheets and summaries.

Transcript: "${transcript}"
JSON:`;
}

type AgentName = "dante" | "mismo" | "simpli";

interface OrchestrationResult {
  agent: AgentName;
  intent: string;
  confidence: number;
}

function parseOrchestrationOutput(raw: string): OrchestrationResult {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as OrchestrationResult;
      const validAgents: AgentName[] = ["dante", "mismo", "simpli"];
      if (validAgents.includes(parsed.agent)) return parsed;
    }
  } catch {
    // fall through to default
  }
  return { agent: "mismo", intent: "unknown", confidence: 0 };
}
