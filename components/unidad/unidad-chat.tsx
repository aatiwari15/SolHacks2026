"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Check, HelpCircle, Loader2, LogOut, Send, Settings, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { humanizeFieldKey, resolveApplicantLanguageCode } from "@/lib/form-field-display";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/utils/cn";

// ── Types ─────────────────────────────────────────────────────────────────────

type ChatRole = "user" | "assistant" | "system";
export type AgentId = "dante" | "habla" | "linda";

export type ApplicationFieldRow = {
  fieldKey: string;
  questionEn: string;
  questionTranslated: string;
  value: string;
};

export type ApplicationTablePayload = {
  submissionId: string;
  pageTitle?: string;
  pageUrl?: string;
  targetLanguage: string;
  targetLanguageLabel: string;
  rows: ApplicationFieldRow[];
};

type PipelineQuestion = { field_id: string; question: string };

export type ChatLine = {
  id: string;
  role: ChatRole;
  content: string;
  processing?: boolean;
  /** When set, renders as a colored agent bubble instead of the default UNIDAD bubble */
  agentId?: AgentId;
  /** When set, renders an inline fillable form table */
  applicationTable?: ApplicationTablePayload;
};

const AGENT_CONFIG: Record<AgentId, { name: string; initials: string; color: string; bgStyle: React.CSSProperties; borderStyle: React.CSSProperties; label: string }> = {
  dante: { name: "DANTE", initials: "DA", color: "#f97316", bgStyle: { background: "rgba(67,20,7,0.45)" },   borderStyle: { borderColor: "rgba(194,65,12,0.5)" },    label: "text-orange-400" },
  habla: { name: "HABLA", initials: "HA", color: "#14b8a6", bgStyle: { background: "rgba(4,47,46,0.45)" },   borderStyle: { borderColor: "rgba(15,118,110,0.5)" },   label: "text-teal-400"   },
  linda: { name: "LINDA", initials: "LI", color: "#84cc16", bgStyle: { background: "rgba(26,46,5,0.45)" },   borderStyle: { borderColor: "rgba(77,124,15,0.5)" },    label: "text-lime-400"   },
};

// Pipeline context — stored while a form fill is in progress
type PipelineCtx = {
  sessionToken: string;
  submissionId: string;
  /** Original extension fields, includes selector/type for DANTE to fill */
  fields: unknown[];
  /** Original formFields (with labels) for English column */
  formFields: unknown[];
};

// ── Constants ─────────────────────────────────────────────────────────────────

const STORAGE_LINES   = "unidad-chat-lines-v3";
const STORAGE_SESSION = "unidad-orchestrate-session-id";
const STORAGE_SEEN    = "unidad-chat-seen-submission-ids";

const DEFAULT_LINES: ChatLine[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "I'm **UNIDAD**. Ask me about immigration forms and paperwork, or click **Send to UNIDAD** in the Dante extension on any form page — I'll translate every field and show you a table to fill out in your language.",
  },
];

const SUGGESTIONS = [
  "Help me understand a USCIS form",
  "What documents might I need for a driver's license?",
  "Explain adjustment of status in plain language",
];

// ── Session helpers ───────────────────────────────────────────────────────────

function loadStoredLines(): ChatLine[] {
  if (typeof window === "undefined") return DEFAULT_LINES;
  try {
    const raw = sessionStorage.getItem(STORAGE_LINES);
    if (!raw) return DEFAULT_LINES;
    const parsed = JSON.parse(raw) as ChatLine[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_LINES;
  } catch { return DEFAULT_LINES; }
}

function loadSeenIds(): Set<string> {
  const set = new Set<string>();
  if (typeof window === "undefined") return set;
  try {
    const arr = JSON.parse(sessionStorage.getItem(STORAGE_SEEN) ?? "[]") as unknown;
    if (Array.isArray(arr)) arr.forEach((id) => typeof id === "string" && set.add(id));
  } catch { /* ignore */ }
  return set;
}

function persistSeenIds(set: Set<string>) {
  try { sessionStorage.setItem(STORAGE_SEEN, JSON.stringify([...set].slice(-400))); }
  catch { /* ignore */ }
}

function normalizePipelineQuestions(payload: unknown): PipelineQuestion[] {
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  const candidates = Array.isArray(obj.questions)
    ? obj.questions
    : Array.isArray(obj.items)
      ? obj.items
      : [];

  const out: PipelineQuestion[] = [];
  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    const q = item as Record<string, unknown>;
    const fieldId = typeof q.field_id === "string" ? q.field_id.trim() : "";
    const question = typeof q.question === "string" ? q.question.trim() : "";
    if (!fieldId || !question) continue;
    if (out.some((x) => x.field_id === fieldId)) continue;
    out.push({ field_id: fieldId, question });
  }
  return out;
}

function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(STORAGE_SESSION);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(STORAGE_SESSION, id); }
    return id;
  } catch { return crypto.randomUUID(); }
}

// ── Form submitted payload ────────────────────────────────────────────────────

type FormSubmittedPayload = {
  submissionId?: string;
  pageUrl?: string;
  pageTitle?: string;
  fieldCount?: number;
  formFields?: unknown[];
  answers?: Record<string, string>;
  sessionToken?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function UnidadChat({
  applicantLanguage,
  onOpenFaq,
  onOpenProfileSettings,
}: {
  applicantLanguage: string;
  onOpenFaq: () => void;
  onOpenProfileSettings: () => void;
}) {
  const { session, user, logout } = useAuth();
  const [lines, setLines] = useState<ChatLine[]>(DEFAULT_LINES);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittingLineId, setSubmittingLineId] = useState<string | null>(null);
  const bottomRef     = useRef<HTMLDivElement>(null);
  const seenIdsRef    = useRef<Set<string>>(new Set());
  const activityRef   = useRef<string>(new Date(Date.now() - 5 * 60 * 1000).toISOString());
  const restoredRef   = useRef(false);
  const sessionIdRef  = useRef<string>("");
  const pipelineCtx   = useRef<PipelineCtx | null>(null);

  const resolvedLanguage = (applicantLanguage?.trim()) || user?.preferredLanguage?.trim() || "en";

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    seenIdsRef.current  = loadSeenIds();
    sessionIdRef.current = getOrCreateSessionId();
    const stored = loadStoredLines();
    if (stored.length > 0) setLines(stored);
  }, []);

  // ── Scroll ──────────────────────────────────────────────────────────────────

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [lines, scrollToBottom]);

  // ── Persist lines ────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => {
      try { sessionStorage.setItem(STORAGE_LINES, JSON.stringify(lines.filter(l => !l.processing))); }
      catch { /* quota */ }
    }, 250);
    return () => clearTimeout(t);
  }, [lines]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  // Stable refs so callbacks captured in useCallback always get fresh setLines
  const addLine = useCallback((line: Omit<ChatLine, "id"> & { id?: string }) => {
    const full: ChatLine = { id: line.id ?? `line-${Date.now()}-${Math.random()}`, ...line };
    setLines(prev => [...prev, full]);
    return full.id;
  }, []);

  const updateLine = useCallback((id: string, patch: Partial<ChatLine>) => {
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

  // ── Update answer in an application table line ────────────────────────────────

  const onApplicationRowChange = useCallback((lineId: string, fieldKey: string, value: string) => {
    setLines(prev => prev.map(line => {
      if (line.id !== lineId || !line.applicationTable) return line;
      return {
        ...line,
        applicationTable: {
          ...line.applicationTable,
          rows: line.applicationTable.rows.map(r => r.fieldKey === fieldKey ? { ...r, value } : r),
        },
      };
    }));
  }, []);

  // ── Submit a filled table to DANTE ────────────────────────────────────────────

  const submitTableAnswers = useCallback(async (lineId: string, rows: ApplicationFieldRow[]) => {
    const token      = pipelineCtx.current?.sessionToken;
    const fields     = pipelineCtx.current?.fields ?? [];
    setSubmittingLineId(lineId);

    const answers = rows.map(r => ({ field_id: r.fieldKey, user_answer: r.value }));

    const danteId = `dante-fill-${Date.now()}`;
    addLine({ id: danteId, role: "assistant", agentId: "dante", processing: true, content: "Translating all answers to English and packaging for form injection…" });

    try {
      const res = await fetch("/api/form-submission/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken: token, answers, fields }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      updateLine(danteId, {
        processing: false,
        content: "Answers translated and packaged ✓ — DANTE is filling and submitting your form now.",
      });
      addLine({
        role: "assistant",
        content: "Your answers are being injected into the form right now and it will be submitted automatically. Let me know if anything needs correcting!",
      });
      pipelineCtx.current = null;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      updateLine(danteId, { processing: false, content: `Could not store answers: ${msg}` });
    } finally {
      setSubmittingLineId(null);
    }
  }, [addLine, updateLine]);

  // ── Start pipeline when a form arrives ──────────────────────────────────────

  const appendFormSubmission = useCallback((p: FormSubmittedPayload) => {
    const fullId = p.submissionId != null ? String(p.submissionId) : "";
    if (!fullId || seenIdsRef.current.has(fullId)) return;

    // Mark seen immediately — prevents duplicate processing from concurrent poll calls
    seenIdsRef.current.add(fullId);
    persistSeenIds(seenIdsRef.current);

    const unmarkSeen = () => {
      seenIdsRef.current.delete(fullId);
      persistSeenIds(seenIdsRef.current);
    };

    const token = session?.access_token;
    if (!token) {
      setLines(prev => [...prev, {
        id: `auth-${fullId}`,
        role: "system" as ChatRole,
        content: "Sign in on /app to process forms from the Dante extension.",
      }]);
      return;
    }

    let host = "";
    try { host = p.pageUrl ? new URL(p.pageUrl).hostname : ""; } catch { host = p.pageUrl ?? ""; }
    const title = p.pageTitle || "Form";
    const payloadFields = Array.isArray(p.formFields) ? p.formFields : [];
    const n = typeof p.fieldCount === "number" ? p.fieldCount : payloadFields.length;
    const runId = `${fullId}-${Date.now()}`;

    const hablaId     = `habla-${runId}`;
    const lindaId     = `linda-${runId}`;
    const tableLineId = `form-table-${runId}`;

    // Add all three agent bubbles in ONE atomic setLines call — they all render together
    setLines(prev => [...prev,
      {
        id: `dante-${runId}`,
        role: "assistant" as ChatRole,
        agentId: "dante" as AgentId,
        content: `Received **"${title}"** from ${host} — ${n} field(s) detected`,
      },
      {
        id: hablaId,
        role: "assistant" as ChatRole,
        agentId: "habla" as AgentId,
        processing: true,
        content: `Translating ${n} field${n === 1 ? "" : "s"} to ${resolvedLanguage === "en" ? "English" : resolvedLanguage}…`,
      },
      {
        id: lindaId,
        role: "assistant" as ChatRole,
        agentId: "linda" as AgentId,
        processing: true,
        content: "Organizing questions from easiest to hardest…",
      },
    ]);

    void (async () => {
      let formFields = payloadFields;
      let sessionToken = typeof p.sessionToken === "string" ? p.sessionToken : "";

      // Realtime broadcast omits formFields for large payloads — load from DB if needed
      if (formFields.length === 0) {
        try {
          const r = await fetch(
            `/api/form-submission/activity?submissionId=${encodeURIComponent(fullId)}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (r.ok) {
            const d = (await r.json()) as { submissions?: Array<{ formFields?: unknown[]; sessionToken?: string }> };
            const row = d.submissions?.[0];
            if (row && Array.isArray(row.formFields) && row.formFields.length > 0) {
              formFields = row.formFields;
              if (!sessionToken && typeof row.sessionToken === "string") sessionToken = row.sessionToken;
            }
          }
        } catch { /* network hiccup — stay silent */ }
      }

      if (formFields.length === 0) {
        setLines(prev => prev.map(l =>
          l.id === hablaId ? { ...l, processing: false, content: "No form fields found." } :
          l.id === lindaId ? { ...l, processing: false, content: "Skipped — no fields." } : l,
        ));
        // If DB row wasn't ready yet, allow the next poll cycle to retry.
        unmarkSeen();
        return;
      }

      pipelineCtx.current = { sessionToken, submissionId: fullId, fields: formFields, formFields };

      // Build API fields and English label map for the table
      const apiFields = formFields.map((f) => {
        const field = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
        return {
          field_id: String(field.field_key ?? field.field_id ?? field.name ?? "field"),
          label:    typeof field.label    === "string" ? field.label    : undefined,
          question: typeof field.question === "string" ? field.question : undefined,
        };
      });

      const labelMap = new Map(
        formFields.map((f) => {
          const field = (f && typeof f === "object" ? f : {}) as Record<string, unknown>;
          const key   = String(field.field_key ?? field.field_id ?? field.name ?? "");
          const label = typeof field.label === "string" && field.label.trim() ? field.label.trim() : "";
          return [key, label];
        }),
      );

      try {
        // HABLA translates, LINDA reorders — single pipeline call returns sorted translated questions
        const res = await fetch("/api/form-fields/process", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ formFields: apiFields, language: resolvedLanguage }),
        });

        const data = (await res.json().catch(() => ({}))) as unknown;

        if (!res.ok) {
          const errObj = data as { error?: string };
          throw new Error(errObj.error ?? `Request failed (${res.status})`);
        }

        const { code: langCode, label: langLabel } = resolveApplicantLanguageCode(resolvedLanguage);
        const questions = normalizePipelineQuestions(data);
        const ordered = questions.length > 0
          ? questions
          : apiFields.map((f) => ({
              field_id: f.field_id,
              question: f.label?.trim() || f.question?.trim() || humanizeFieldKey(f.field_id),
            }));

        // Always build a single table from pipeline output (or fallback rows).
        const rows: ApplicationFieldRow[] = ordered.map(q => ({
          fieldKey:           q.field_id,
          questionEn:         labelMap.get(q.field_id) || humanizeFieldKey(q.field_id),
          questionTranslated: q.question,
          value:              "",
        }));

        // Resolve HABLA/LINDA to done and append the fillable table — one atomic update
        setLines(prev => [
          ...prev.map(l => {
            if (l.id === hablaId) return { ...l, processing: false, content: "Fields translated ✓" };
            if (l.id === lindaId) {
              return {
                ...l,
                processing: false,
                content: questions.length > 0 ? "Questions organized ✓" : "Questions organized (fallback) ✓",
              };
            }
            return l;
          }),
          {
            id: tableLineId,
            role: "assistant" as ChatRole,
            agentId: "linda" as AgentId,
            content: "All fields ready! Fill in your language below, then press **Submit to DANTE** — I'll translate and fill the form automatically.",
            applicationTable: {
              submissionId: fullId,
              pageTitle: p.pageTitle,
              pageUrl: p.pageUrl,
              targetLanguage: langCode,
              targetLanguageLabel: langLabel,
              rows,
            },
          },
        ]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Pipeline error";
        // If we already have fields, render a fallback table immediately instead of failing hard.
        if (apiFields.length > 0) {
          const { code: langCode, label: langLabel } = resolveApplicantLanguageCode(resolvedLanguage);
          const rows: ApplicationFieldRow[] = apiFields.map((f) => ({
            fieldKey: f.field_id,
            questionEn: labelMap.get(f.field_id) || humanizeFieldKey(f.field_id),
            questionTranslated: f.label?.trim() || f.question?.trim() || humanizeFieldKey(f.field_id),
            value: "",
          }));
          setLines(prev => [
            ...prev.map(l =>
              l.id === hablaId ? { ...l, processing: false, content: `Translation unavailable: ${msg}` } :
              l.id === lindaId ? { ...l, processing: false, content: "Questions organized (fallback) ✓" } : l,
            ),
            {
              id: tableLineId,
              role: "assistant" as ChatRole,
              agentId: "linda" as AgentId,
              content: "I could not fully parse the model output, but your full form is ready below. Fill all fields, then press **Submit to DANTE**.",
              applicationTable: {
                submissionId: fullId,
                pageTitle: p.pageTitle,
                pageUrl: p.pageUrl,
                targetLanguage: langCode,
                targetLanguageLabel: langLabel,
                rows,
              },
            },
          ]);
          return;
        }

        // Network/model errors with no available fields should be retryable.
        unmarkSeen();
        setLines(prev => prev.map(l =>
          l.id === hablaId ? { ...l, processing: false, content: `Translation failed: ${msg}` } :
          l.id === lindaId ? { ...l, processing: false, content: "Skipped." } : l,
        ));
      }
    })();
  }, [session?.access_token, resolvedLanguage]);

  // ── Supabase broadcast listener ──────────────────────────────────────────────

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel  = supabase
      .channel("unidad:agents")
      .on("broadcast", { event: "form_submitted" }, ({ payload }) => {
        appendFormSubmission(payload as FormSubmittedPayload);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [appendFormSubmission]);

  // ── Polling fallback ─────────────────────────────────────────────────────────

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const since = activityRef.current;
        const res = await fetch(`/api/form-submission/activity?since=${encodeURIComponent(since)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          submissions?: Array<{
            id: string; sessionToken?: string; pageUrl: string; pageTitle: string; fieldCount: number;
            createdAt: string; formFields?: unknown[]; answers?: Record<string, string>;
          }>;
        };
        let latest = since;
        for (const s of data.submissions ?? []) {
          appendFormSubmission({
            submissionId: s.id, sessionToken: s.sessionToken, pageUrl: s.pageUrl,
            pageTitle: s.pageTitle, fieldCount: s.fieldCount, formFields: s.formFields,
            answers: s.answers,
          });
          if (s.createdAt > latest) latest = s.createdAt;
        }
        if (latest !== since) activityRef.current = latest;
      } catch { /* ignore */ }
    }

    void poll();
    const interval = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [session?.access_token, appendFormSubmission]);

  // ── Send message ─────────────────────────────────────────────────────────────

  async function sendMessage(text: string) {
    if (!session?.access_token || !text.trim()) return;
    const trimmed = text.trim();
    setError(null);
    setInput("");
    addLine({ role: "user", content: trimmed });
    setSending(true);

    try {
      const res = await fetch("/api/orchestrate/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ message: trimmed, sessionId: sessionIdRef.current, language: resolvedLanguage }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        phase?: string;
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      addLine({ role: "assistant", content: data.reply ?? "(No reply)" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      addLine({ role: "assistant", content: `Sorry — I couldn't reach UNIDAD: ${msg}` });
    } finally {
      setSending(false);
    }
  }

  // ── New conversation ─────────────────────────────────────────────────────────

  async function newConversation() {
    try {
      const token = session?.access_token;
      if (token) {
        await fetch("/api/orchestrate/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: "", sessionId: sessionIdRef.current, language: resolvedLanguage, reset: true }),
        });
      }
      sessionStorage.removeItem(STORAGE_SESSION);
      sessionIdRef.current = getOrCreateSessionId();
    } catch { sessionIdRef.current = crypto.randomUUID(); }

    pipelineCtx.current = null;
    const fresh: ChatLine[] = [{ id: `welcome-${Date.now()}`, role: "assistant", content: "New conversation. How can UNIDAD help?" }];
    setLines(fresh);
    setError(null);
    try { sessionStorage.setItem(STORAGE_LINES, JSON.stringify(fresh)); } catch { /* ignore */ }
  }

  const initials = user?.name?.slice(0, 2).toUpperCase() ?? "U";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0d0905]">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/10 bg-[#110c07]/90 px-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f59e0b] shadow-[0_0_20px_rgba(245,158,11,0.3)]">
            <span className="text-sm font-black text-[#0d0905]">UN</span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight text-[#f2dfc4]">UNIDAD</h1>
            <p className="truncate text-[11px] text-[#a08060]">Bilingual Form Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => void newConversation()}
            className="hidden rounded-lg px-3 py-1.5 text-xs font-medium text-[#a08060] hover:bg-white/10 hover:text-[#f2dfc4] sm:inline-flex">
            New chat
          </button>
          <button type="button" onClick={onOpenFaq} className="rounded-lg p-2 text-[#a08060] hover:bg-white/10 hover:text-[#f2dfc4]" aria-label="Help">
            <HelpCircle className="h-4 w-4" />
          </button>
          <button type="button" onClick={onOpenProfileSettings} className="rounded-lg p-2 text-[#a08060] hover:bg-white/10 hover:text-[#f2dfc4]" aria-label="Profile">
            <Settings className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => void logout()} className="rounded-lg p-2 text-[#a08060] hover:bg-red-500/20 hover:text-red-400" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
          <div className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f59e0b]/20 text-[10px] font-bold text-[#f59e0b]" title={user?.email}>
            {initials}
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-3 pb-3 pt-4 sm:px-6">
          <div className="flex flex-1 flex-col overflow-y-auto rounded-2xl border border-white/10 bg-[#110c07]/60 shadow-[0_8px_40px_rgba(0,0,0,0.4)] backdrop-blur-sm">
            <div className="flex-1 space-y-4 p-4 sm:p-6">
              {lines.map((line) => (
                <MessageBlock
                  key={line.id}
                  line={line}
                  submittingLineId={submittingLineId}
                  onApplicationRowChange={onApplicationRowChange}
                  onSubmitTable={submitTableAnswers}
                />
              ))}
              {sending && (
                <div className="flex items-center gap-2 text-sm text-[#a08060]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#f59e0b]" />
                  Thinking…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Suggestions */}
            {lines.length <= 1 && !sending && (
              <div className="border-t border-white/10 px-4 py-3 sm:px-6">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#a08060]">Try asking</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => void sendMessage(s)}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-left text-xs text-[#f2dfc4] transition hover:border-[#f59e0b]/40 hover:bg-[#f59e0b]/10">
                      <Sparkles className="mr-1 inline h-3 w-3 text-[#f59e0b]" />{s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="mt-3 shrink-0">
            {error && <p className="mb-2 text-center text-xs text-red-400">{error}</p>}
            <form
              className="flex items-end gap-2 rounded-2xl border border-white/15 bg-[#110c07] p-2 shadow-sm"
              onSubmit={(e) => { e.preventDefault(); void sendMessage(input); }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(input); } }}
                placeholder="Message UNIDAD…"
                rows={1}
                className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-[#f2dfc4] placeholder:text-[#a08060]/60 outline-none"
              />
              <button type="submit" disabled={sending || !input.trim()}
                className={cn(
                  "mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
                  input.trim() && !sending
                    ? "bg-[#f59e0b] text-[#0d0905] shadow-md hover:bg-[#f59e0b]/90"
                    : "bg-white/10 text-[#a08060]",
                )}
                aria-label="Send"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── MessageBlock ──────────────────────────────────────────────────────────────

function MessageBlock({
  line,
  submittingLineId,
  onApplicationRowChange,
  onSubmitTable,
}: {
  line: ChatLine;
  submittingLineId: string | null;
  onApplicationRowChange: (lineId: string, fieldKey: string, value: string) => void;
  onSubmitTable: (lineId: string, rows: ApplicationFieldRow[]) => void;
}) {
  // Agent-branded bubbles (DANTE / HABLA / LINDA)
  if (line.agentId && !line.applicationTable) {
    return <AgentBubble line={line} />;
  }

  // User message
  if (line.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-[#f59e0b]/25 bg-[#f59e0b]/10 px-4 py-3 text-sm leading-relaxed text-[#f2dfc4]">
          {line.content}
        </div>
      </div>
    );
  }

  // System message
  if (line.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="max-w-[95%] whitespace-pre-wrap rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs leading-relaxed text-[#a08060]">
          {formatMarkdownish(line.content)}
        </div>
      </div>
    );
  }

  // UNIDAD processing spinner
  if (line.processing) {
    return (
      <div className="flex justify-start">
        <div className="flex max-w-[90%] gap-3">
          <UnidadAvatar />
          <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-white/10 bg-[#1a1008] px-4 py-3 text-sm text-[#a08060] shadow-sm">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#f59e0b]" />
            {line.content}
          </div>
        </div>
      </div>
    );
  }

  // UNIDAD message with inline form table (LINDA-branded when agentId is set — same pattern as DANTE/HABLA bubbles)
  if (line.applicationTable) {
    const t = line.applicationTable;
    const showTranslated = t.targetLanguage !== "en";
    const tableAgent = line.agentId && AGENT_CONFIG[line.agentId] ? line.agentId : null;
    const ac = tableAgent ? AGENT_CONFIG[tableAgent] : null;
    return (
      <div className="flex justify-start">
        <div className="flex w-full max-w-full gap-3">
          {tableAgent ? <AgentAvatar agentId={tableAgent} /> : <UnidadAvatar />}
          <div
            className="min-w-0 flex-1 rounded-2xl rounded-bl-sm border px-4 py-4 text-sm shadow-sm"
            style={ac ? { ...ac.bgStyle, ...ac.borderStyle } : { borderColor: "rgba(255,255,255,0.1)", background: "#1a1008" }}
          >
            {ac && (
              <div className={cn("mb-2 text-[10px] font-bold uppercase tracking-wider", ac.label)}>
                {ac.name}
              </div>
            )}
            <p className="mb-3 leading-relaxed text-[#f2dfc4]">{formatMarkdownish(line.content)}</p>
            <ApplicationQuestionsTable
              table={t}
              lineId={line.id}
              showTranslated={showTranslated}
              submitting={submittingLineId === line.id}
              onRowChange={onApplicationRowChange}
              onSubmit={onSubmitTable}
            />
          </div>
        </div>
      </div>
    );
  }

  // Normal UNIDAD message
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] gap-3">
        <UnidadAvatar />
        <div className="rounded-2xl rounded-bl-sm border border-white/10 bg-[#1a1008] px-4 py-3 text-sm leading-relaxed text-[#f2dfc4] shadow-sm">
          {formatMarkdownish(line.content)}
        </div>
      </div>
    </div>
  );
}

// ── AgentBubble ───────────────────────────────────────────────────────────────

function AgentAvatar({ agentId }: { agentId: AgentId }) {
  const cfg = AGENT_CONFIG[agentId];
  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-bold text-white"
      style={{ background: cfg.color }}
    >
      {cfg.initials}
    </div>
  );
}

function AgentBubble({ line }: { line: ChatLine }) {
  const cfg = AGENT_CONFIG[line.agentId!];

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] gap-3">
        <AgentAvatar agentId={line.agentId!} />
        <div
          className="rounded-2xl rounded-bl-sm border px-4 py-3 text-sm leading-relaxed shadow-sm"
          style={{ ...cfg.bgStyle, ...cfg.borderStyle }}
        >
          <div className={cn("mb-1 text-[10px] font-bold uppercase tracking-wider", cfg.label)}>
            {cfg.name}
          </div>
          {line.processing ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" style={{ color: cfg.color }} />
              <span className="flex gap-1">
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: cfg.color, animationDelay: "0ms" }} />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: cfg.color, animationDelay: "150ms" }} />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: cfg.color, animationDelay: "300ms" }} />
              </span>
              <span className="text-[#a08060]">{line.content}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[#c8b090]">
              {line.content.includes("✓") && (
                <Check className="h-3.5 w-3.5 shrink-0" style={{ color: cfg.color }} />
              )}
              <span>{formatMarkdownish(line.content.replace(/^✓\s*/, ""))}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── ApplicationQuestionsTable ─────────────────────────────────────────────────

function ApplicationQuestionsTable({
  table,
  lineId,
  showTranslated,
  submitting,
  onRowChange,
  onSubmit,
}: {
  table: ApplicationTablePayload;
  lineId: string;
  showTranslated: boolean;
  submitting: boolean;
  onRowChange: (lineId: string, fieldKey: string, value: string) => void;
  onSubmit: (lineId: string, rows: ApplicationFieldRow[]) => void;
}) {
  if (table.rows.length === 0) {
    return <p className="text-xs text-[#a08060]">No fields in this submission.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      {/* Table header */}
      <div className="grid border-b border-white/10 bg-white/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#a08060]"
        style={{ gridTemplateColumns: showTranslated ? "1fr 1fr 1.2fr" : "1fr 1.2fr" }}>
        <span>Field (English)</span>
        {showTranslated && <span>{table.targetLanguageLabel}</span>}
        <span>Your Answer</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-white/5">
        {table.rows.map((row) => (
          <div
            key={row.fieldKey}
            className="grid items-start gap-2 px-3 py-2.5"
            style={{ gridTemplateColumns: showTranslated ? "1fr 1fr 1.2fr" : "1fr 1.2fr" }}
          >
            <span className="pt-1 text-xs text-[#c8b090]">{row.questionEn}</span>
            {showTranslated && (
              <span className="pt-1 text-xs text-[#a08060]">{row.questionTranslated}</span>
            )}
            <textarea
              value={row.value}
              onChange={(e) => onRowChange(lineId, row.fieldKey, e.target.value)}
              rows={1}
              placeholder={showTranslated ? row.questionTranslated : "Your answer…"}
              className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-[#f2dfc4] placeholder:text-[#a08060]/50 outline-none focus:border-[#f59e0b]/50 focus:bg-[#f59e0b]/5 transition"
              aria-label={`Answer for ${row.questionEn}`}
            />
          </div>
        ))}
      </div>

      {/* Submit bar */}
      <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-3 py-2.5">
        <span className="text-[11px] text-[#a08060]">
          {table.rows.length} field{table.rows.length !== 1 ? "s" : ""} · {table.targetLanguageLabel}
        </span>
        <button
          type="button"
          disabled={submitting}
          onClick={() => onSubmit(lineId, table.rows)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition",
            submitting
              ? "bg-white/10 text-[#a08060] cursor-not-allowed"
              : "bg-[#f59e0b] text-[#0d0905] hover:bg-[#f59e0b]/90 shadow-md",
          )}
        >
          {submitting
            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
            : <><Send className="h-3.5 w-3.5" /> Submit to DANTE</>
          }
        </button>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function UnidadAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f59e0b] text-[10px] font-bold text-[#0d0905]">
      UN
    </div>
  );
}

function formatMarkdownish(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-[#f59e0b]">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
