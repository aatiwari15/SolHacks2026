/**
 * POST /api/alerts/interactive-call
 *
 * Dual-purpose endpoint:
 *
 *  1. INITIATION — client sends { to, language } to start an outbound call.
 *     Twilio dials the number and hits this same URL at ?step=1 for instructions.
 *
 *  2. TWIML WEBHOOK — Twilio hits ?step=N to get the next set of instructions.
 *     The call walks through 3 scripted lines with a <Gather> listen window
 *     between each one.  IBM Orchestrate is commented out; swap in
 *     askOrchestrate() once the AI layer is ready.
 *
 * Flow:
 *   step 1 → say greeting  → listen (5 s) → step 2
 *   step 2 → say follow-up → listen (5 s) → step 3
 *   step 3 → say goodbye   → hang up
 */

import type { NextApiRequest, NextApiResponse } from "next";
import twilio from "twilio";
import { languageToSayLocale } from "@/lib/language-utils";

// ---------------------------------------------------------------------------
// Scripted demo lines (Spanish-first)
// Replace these with askOrchestrate() responses when AI is enabled.
// ---------------------------------------------------------------------------
const DEMO_LINES = [
  "Hola, bienvenido a Unidad. Soy tu asistente virtual. ¿Con qué documento necesitas ayuda hoy?",
  "Gracias por la información. ¿Tienes alguna pregunta específica sobre ese documento?",
  "Perfecto. Un agente de Unidad revisará tu caso y te contactará muy pronto. ¡Hasta luego!",
];

// ---------------------------------------------------------------------------
// TwiML builder — one step at a time
// ---------------------------------------------------------------------------
function buildStepTwiml(step: number, webhookBase: string, locale: string): string {
  const response = new twilio.twiml.VoiceResponse();

  const lineIndex = Math.min(step - 1, DEMO_LINES.length - 1);
  const line = DEMO_LINES[lineIndex];
  const isLastStep = step >= DEMO_LINES.length;

  if (isLastStep) {
    // Final line — say goodbye and end the call
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    response.say({ language: locale as any, voice: "Polly.Lupe" }, line);
    response.hangup();
  } else {
    const nextUrl = `${webhookBase}/api/alerts/interactive-call?step=${step + 1}&lang=${encodeURIComponent(locale)}`;

    // Say the line while Twilio listens for speech
    const gather = response.gather({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      input: ["speech"] as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      language: locale as any,
      timeout: 5,          // seconds of silence before giving up
      speechTimeout: "auto", // cut off as soon as the caller stops speaking
      action: nextUrl,
      method: "POST",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gather.say({ language: locale as any, voice: "Polly.Lupe" }, line);

    // Fallback: if no speech at all, advance to the next step anyway
    response.redirect({ method: "POST" }, nextUrl);
  }

  return response.toString();
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookBase = process.env.TWILIO_WEBHOOK_BASE_URL;
  if (!webhookBase) {
    return res
      .status(500)
      .json({ error: "[Unidad] TWILIO_WEBHOOK_BASE_URL is not set" });
  }

  // ------------------------------------------------------------------
  // TwiML WEBHOOK MODE — Twilio is asking what to do next on a live call
  // ------------------------------------------------------------------
  const stepParam = req.query.step;
  if (stepParam !== undefined) {
    const step = Number(stepParam);
    if (isNaN(step) || step < 1) {
      return res.status(400).json({ error: "Invalid step" });
    }

    const lang = ((req.query.lang as string) || "es").split("-")[0];
    const locale = languageToSayLocale(lang);

    console.log(`[Unidad] TwiML step=${step} lang=${lang} locale=${locale}`);
    res.setHeader("Content-Type", "text/xml");
    return res.status(200).send(buildStepTwiml(step, webhookBase, locale));
  }

  // ------------------------------------------------------------------
  // INITIATION MODE — start an outbound call to the given number
  // ------------------------------------------------------------------
  const { to, language = "es" } = (req.body ?? {}) as {
    to?: string;
    language?: string;
  };

  if (!to) {
    return res.status(400).json({
      error: "`to` is required (E.164 format, e.g. +12125551234)",
    });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return res.status(500).json({
      error: "[Unidad] Twilio credentials are not configured (check TWILIO_ACCOUNT_SID / AUTH_TOKEN / PHONE_NUMBER)",
    });
  }

  const lang = language.toLowerCase().split("-")[0];
  const startUrl = `${webhookBase}/api/alerts/interactive-call?step=1&lang=${encodeURIComponent(lang)}`;

  const client = twilio(accountSid, authToken);

  try {
    const call = await client.calls.create({
      to,
      from,
      url: startUrl,
      method: "POST",
    });
    console.log(`[Unidad] Outbound call started → ${to} (sid: ${call.sid})`);
    return res.status(200).json({ callSid: call.sid, status: call.status });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[Unidad] Failed to start call to ${to}:`, detail);
    return res.status(500).json({ error: "Failed to start call", detail });
  }
}
