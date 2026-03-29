/**
 * IBM watsonx Orchestrate client for Unidad.
 *
 * STATUS: Commented out — demo uses scripted lines in interactive-call.ts.
 * To enable: uncomment the real implementation below and delete the stub.
 *
 * Required env vars (add to .env):
 *   IBM_ORCHESTRATE_AGENT_URL   — full agent endpoint URL
 *   IBM_ORCHESTRATE_API_KEY     — IBM Cloud IAM API key
 *   IBM_ORCHESTRATE_AGENT_ID    — agent/assistant ID
 */

export interface OrchestrateParams {
  sessionId: string;
  userMessage: string;
  language: string; // ISO 639-1 code, e.g. "es"
  context?: string; // optional document context
}

// ---------------------------------------------------------------------------
// REAL IMPLEMENTATION — uncomment when IBM Orchestrate is ready
// ---------------------------------------------------------------------------
/*
import { getVoiceCallEnv } from "./env";

export async function askOrchestrate(params: OrchestrateParams): Promise<string> {
  const env = getVoiceCallEnv();
  const { sessionId, userMessage, language, context } = params;

  if (!env.IBM_ORCHESTRATE_AGENT_URL || !env.IBM_ORCHESTRATE_API_KEY) {
    throw new Error("[Unidad] IBM Orchestrate is not configured");
  }

  const response = await fetch(`${env.IBM_ORCHESTRATE_AGENT_URL}/message?version=2021-06-14`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.IBM_ORCHESTRATE_API_KEY}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      input: {
        message_type: "text",
        text: userMessage,
        options: { return_context: true },
      },
      context: {
        global: {
          system: {
            user_defined: {
              language,
              document_context: context ?? "",
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[Unidad] IBM Orchestrate ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    output?: { generic?: Array<{ response_type: string; text?: string }> };
  };

  const text = (data.output?.generic ?? [])
    .filter((g) => g.response_type === "text" && g.text)
    .map((g) => g.text!)
    .join(" ");

  return text || "Lo siento, no pude procesar tu solicitud en este momento.";
}
*/

// ---------------------------------------------------------------------------
// STUB — returns a canned response so call flow works end-to-end
// ---------------------------------------------------------------------------
export async function askOrchestrate(
  _params: OrchestrateParams, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<string> {
  // TODO: remove stub and uncomment real implementation above
  return "Gracias. Un agente de Unidad revisará tu caso y te contactará muy pronto.";
}
