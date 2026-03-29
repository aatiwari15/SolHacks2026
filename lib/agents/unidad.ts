/**
 * UNIDAD — Warm, bilingual User-Facing Orchestrator.
 *
 * Manages a three-phase pipeline:
 *   PHASE 1 — INGESTION:   Calls LINDA (→ HABLA) to bulk-translate and reorder ALL form fields
 *                           at once, then returns the full sorted list as JSON for the UI to
 *                           render as a single fillable table.
 *   PHASE 2 — FORM TABLE:  User fills ALL fields in the table at once and submits in bulk.
 *                           No one-by-one interview — the complete answer set arrives together.
 *   PHASE 3 — REVERSAL:    Calls HABLA reverse (bulk) to translate ALL answers back to English,
 *                           then stores the payload for DANTE to inject into the real form and
 *                           submit it on the user's behalf.
 *
 * Also handles general freeform chat using the UNIDAD persona.
 *
 * Session state is kept in a module-level Map (single-server; fine for hackathon).
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { lindaReorder, type LindaOutputItem } from "./linda";
import { hablaReverse } from "./habla";

const MODEL = "gemma-3-27b-it";

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("[UNIDAD] GEMINI_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: MODEL });
}

// ── Session state ──────────────────────────────────────────────────────────────

type Phase = "chat" | "ingestion" | "interview" | "form_ready" | "reversal" | "done";

type HistoryEntry = { role: "user" | "model"; parts: [{ text: string }] };

type UnidadSession = {
  phase: Phase;
  language: string;
  questions: LindaOutputItem[];
  currentIndex: number;
  answers: Array<{ field_id: string; user_answer: string }>;
  history: HistoryEntry[];
};

const sessions = new Map<string, UnidadSession>();

function getOrCreate(sessionId: string, language: string): UnidadSession {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      phase: "chat",
      language,
      questions: [],
      currentIndex: 0,
      answers: [],
      history: [],
    });
  }
  return sessions.get(sessionId)!;
}

// ── System prompts ─────────────────────────────────────────────────────────────

const UNIDAD_SYSTEM = `You are UNIDAD, a warm, empathetic, and highly capable bilingual assistant.
Your core mission is to help non-native speakers successfully navigate and complete complex,
intimidating online forms — like job applications, government portals, or legal documents.

You are patient, encouraging, and clear. You act as their personal advocate.

How the form pipeline works (do NOT expose this to the user):
1. When the user sends a form from their browser, all fields are translated and sorted at once
   into a single fillable table — no one-by-one interview.
2. The user fills in the entire table at once, in their own language.
3. When the user submits the table, their answers are translated to English and injected
   directly into the real form on the webpage by the browser extension, which then submits it.

Important rules:
- Never expose internal architecture, agent names (Habla, Linda, Dante), or raw JSON to the user.
- Never ask the user form questions one-by-one. The table handles all data collection at once.
- Speak in the user's preferred language when possible.
- Keep answers concise and reassuring.
- If you don't know something specific to a form, guide the user to verify with the issuing authority.`;

// ── Exported params / result types ─────────────────────────────────────────────

export type RawField = { field_id: string; label?: string; question?: string };

export interface AskUnidadParams {
  sessionId: string;
  userMessage: string;
  language: string;
  /** Raw scraped form fields from DANTE — triggers the pipeline when provided */
  formFields?: RawField[];
  /** All answers submitted at once from the form table — triggers reversal directly */
  formAnswers?: Array<{ field_id: string; user_answer: string }>;
}

export interface AskUnidadResult {
  reply: string;
  /** Populated when Phase 3 finishes — final English answers ready for DANTE */
  injectPayload?: Array<{ field_id: string; english_answer: string }>;
  phase: Phase;
  /** All questions (translated + ordered) — sent when form_ready so UI can render the table */
  formQuestions?: LindaOutputItem[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function pushHistory(session: UnidadSession, role: "user" | "model", text: string) {
  session.history.push({ role, parts: [{ text }] });
  // Keep last 40 turns to stay within context limits
  if (session.history.length > 40) session.history.splice(0, 2);
}

// ── Main entry point ───────────────────────────────────────────────────────────

export async function askUnidad(params: AskUnidadParams): Promise<AskUnidadResult> {
  const { sessionId, userMessage, language, formFields, formAnswers } = params;
  const session = getOrCreate(sessionId, language);
  session.language = language;

  // ── PHASE 1: Ingestion — triggered when DANTE passes form fields ──────────────
  if (formFields && formFields.length > 0 && (session.phase === "chat" || session.phase === "done")) {
    // Reset state so a new form starts fresh
    session.answers = [];
    session.questions = [];
    session.currentIndex = 0;
    session.history = [];
    session.phase = "ingestion";

    // Map raw fields to the shape LINDA expects
    const lindaFields = formFields.map((f) => ({
      field_id: f.field_id,
      question: f.question ?? f.label,
    }));

    const ordered = await lindaReorder(lindaFields, language);
    // Filter out any error sentinels
    session.questions = ordered.filter((q) => q.field_id !== "error");

    if (!session.questions.length) {
      session.phase = "chat";
      return { reply: "I wasn't able to read those form fields. Could you try again?", phase: "chat" };
    }

    session.currentIndex = 0;
    session.answers = [];
    session.phase = "form_ready";

    return {
      reply: "All fields are ready! I've organized them from easiest to hardest. Fill in every row below **in your language**, then press **Submit to DANTE** — I'll translate your answers and fill the form on the page for you automatically.",
      phase: "form_ready",
      formQuestions: session.questions,
    };
  }

  // ── PHASE 2: Bulk form answers — user submitted the form table at once ────────
  if (formAnswers && formAnswers.length > 0 && session.phase === "form_ready") {
    session.answers = formAnswers;
    session.phase = "reversal";

    const reversed = await hablaReverse(session.answers);

    session.phase = "done";
    const finalReply = "I am filling out the form on the screen for you right now. Let me know when you see it, and you can hit submit!";

    // Reset so the session can be reused for a new form
    setTimeout(() => sessions.delete(sessionId), 5 * 60 * 1000);

    return {
      reply: finalReply,
      injectPayload: reversed,
      phase: "done",
    };
  }

  // ── PHASE: General freeform chat ──────────────────────────────────────────────
  pushHistory(session, "user", userMessage);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!.trim());
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: UNIDAD_SYSTEM,
  });
  const result = await model.generateContent({
    contents: session.history,
    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
  });

  const reply = result.response.text().trim();
  pushHistory(session, "model", reply);

  return { reply, phase: session.phase };
}

/** Clears session state — call when user starts a new conversation */
export function clearUnidadSession(sessionId: string): void {
  sessions.delete(sessionId);
}

