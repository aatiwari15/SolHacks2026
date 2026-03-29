/**
 * Centralised environment variable validation for Unidad.
 * Call getVoiceCallEnv() inside route handlers — not at module scope —
 * so missing vars surface as a clear runtime error, not a build failure.
 */

import { z } from "zod";

const voiceCallSchema = z.object({
  TWILIO_ACCOUNT_SID: z.string().min(1, "TWILIO_ACCOUNT_SID is required"),
  TWILIO_AUTH_TOKEN: z.string().min(1, "TWILIO_AUTH_TOKEN is required"),
  TWILIO_PHONE_NUMBER: z.string().min(1, "TWILIO_PHONE_NUMBER is required"),
  TWILIO_WEBHOOK_BASE_URL: z
    .string()
    .url("TWILIO_WEBHOOK_BASE_URL must be a valid URL (e.g. https://your-ngrok.ngrok-free.app)"),
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  // IBM Orchestrate — optional until AI is wired in
  IBM_ORCHESTRATE_AGENT_URL: z.string().url().optional(),
  IBM_ORCHESTRATE_API_KEY: z.string().optional(),
  IBM_ORCHESTRATE_AGENT_ID: z.string().optional(),
});

export type VoiceCallEnv = z.infer<typeof voiceCallSchema>;

export function getVoiceCallEnv(): VoiceCallEnv {
  const result = voiceCallSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${String(i.path[0])}: ${i.message}`)
      .join("\n");
    throw new Error(`[Unidad] Voice call environment misconfigured:\n${issues}`);
  }
  return result.data;
}
