"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Flame,
  HelpCircle,
  Loader2,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { ApplicationFieldRow } from "@/lib/form-field-display";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { cn } from "@/utils/cn";

type ChatRole = "user" | "assistant" | "system";

export type ApplicationTablePayload = {
  submissionId: string;
  pageTitle?: string;
  pageUrl?: string;
  targetLanguage: string;
  targetLanguageLabel: string;
  rows: ApplicationFieldRow[];
};

export type ChatLine = {
  id: string;
  role: ChatRole;
  content: string;
  processing?: boolean;
  applicationTable?: ApplicationTablePayload;
};

const STORAGE_LINES = "unidad-chat-lines-v1";
const STORAGE_SESSION = "unidad-orchestrate-session-id";
const STORAGE_SEEN_SUBMISSIONS = "unidad-chat-seen-submission-ids";

const DEFAULT_LINES: ChatLine[] = [
  {
    id: "welcome",
    role: "assistant",
    content:
      "I'm **UNIDAD**. Ask about immigration forms and paperwork, or use the **Dante** browser extension on another tab to scan a form and **Send to Unidad** — submissions appear here with a table in your profile language.",
  },
];

function loadStoredLines(): ChatLine[] {
  if (typeof window === "undefined") return DEFAULT_LINES;
  try {
    const raw = sessionStorage.getItem(STORAGE_LINES);
    if (!raw) return DEFAULT_LINES;
    const parsed = JSON.parse(raw) as ChatLine[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_LINES;
    return parsed;
  } catch {
    return DEFAULT_LINES;
  }
}

function loadSeenSubmissionIds(): Set<string> {
  const set = new Set<string>();
  if (typeof window === "undefined") return set;
  try {
    const raw = sessionStorage.getItem(STORAGE_SEEN_SUBMISSIONS);
    if (!raw) return set;
    const arr = JSON.parse(raw) as unknown;
    if (Array.isArray(arr)) {
      arr.forEach((id) => {
        if (typeof id === "string") set.add(id);
      });
    }
  } catch {
    /* ignore */
  }
  return set;
}

function persistSeenSubmissionIds(set: Set<string>) {
  try {
    sessionStorage.setItem(
      STORAGE_SEEN_SUBMISSIONS,
      JSON.stringify([...set].slice(-400)),
    );
  } catch {
    /* ignore */
  }
}

function getOrCreateOrchestrateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(STORAGE_SESSION);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(STORAGE_SESSION, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

const SUGGESTIONS = [
  "Help me understand a USCIS form",
  "What documents might I need for a driver's license?",
  "Explain adjustment of status in plain language",
];

type FormSubmittedPayload = {
  submissionId?: string;
  pageUrl?: string;
  pageTitle?: string;
  fieldCount?: number;
  formFields?: unknown[];
  answers?: Record<string, string>;
};

export function UnidadChat({
  applicantLanguage,
  onOpenFaq,
  onOpenProfileSettings,
}: {
  /** From Supabase `profiles.native_language` via `/api/profile` → `preferredLanguage` */
  applicantLanguage: string;
  onOpenFaq: () => void;
  onOpenProfileSettings: () => void;
}) {
  const { session, user, logout } = useAuth();
  const [lines, setLines] = useState<ChatLine[]>(DEFAULT_LINES);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const seenSubmissionIdsRef = useRef<Set<string>>(new Set());
  const activitySinceRef = useRef<string>(
    new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  );
  const restoredRef = useRef(false);
  const sessionIdRef = useRef<string>("");

  const resolvedLanguage =
    (applicantLanguage && applicantLanguage.trim()) ||
    user?.preferredLanguage?.trim() ||
    "";

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    seenSubmissionIdsRef.current = loadSeenSubmissionIds();
    sessionIdRef.current = getOrCreateOrchestrateSessionId();
    const stored = loadStoredLines();
    if (stored.length > 0) setLines(stored);
  }, []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const toSave = lines.filter((l) => !l.processing);
        sessionStorage.setItem(STORAGE_LINES, JSON.stringify(toSave));
      } catch {
        /* quota */
      }
    }, 250);
    return () => clearTimeout(t);
  }, [lines]);

  const onApplicationRowChange = useCallback(
    (lineId: string, fieldKey: string, value: string) => {
      setLines((prev) =>
        prev.map((line) => {
          if (line.id !== lineId || !line.applicationTable) return line;
          return {
            ...line,
            applicationTable: {
              ...line.applicationTable,
              rows: line.applicationTable.rows.map((r) =>
                r.fieldKey === fieldKey ? { ...r, value } : r,
              ),
            },
          };
        }),
      );
    },
    [],
  );

  const appendFormSubmission = useCallback(
    (p: FormSubmittedPayload) => {
      const fullId = p.submissionId != null ? String(p.submissionId) : "";
      if (!fullId || seenSubmissionIdsRef.current.has(fullId)) return;
      seenSubmissionIdsRef.current.add(fullId);
      persistSeenSubmissionIds(seenSubmissionIdsRef.current);

      const shortId = fullId.slice(0, 8);
      let host = "";
      try {
        host = p.pageUrl ? new URL(p.pageUrl).hostname : "";
      } catch {
        host = p.pageUrl ?? "";
      }
      const title = p.pageTitle || "Form";
      const n =
        typeof p.fieldCount === "number"
          ? p.fieldCount
          : Array.isArray(p.formFields)
            ? p.formFields.length
            : "?";

      const tableLineId = `app-table-${fullId}`;
      const formFields = Array.isArray(p.formFields) ? p.formFields : [];
      const answers =
        p.answers && typeof p.answers === "object" && !Array.isArray(p.answers)
          ? p.answers
          : {};

      setLines((prev) => [
        ...prev,
        {
          id: `form-${fullId}`,
          role: "system",
          content: `**Dante** — New submission (\`${shortId}…\`)\n• ${title}\n• ${host}\n• ${n} field(s)`,
        },
        {
          id: tableLineId,
          role: "assistant",
          content: "Preparing questions in your profile language…",
          processing: true,
        },
      ]);

      const token = session?.access_token;
      if (!token || formFields.length === 0) {
        setLines((prev) =>
          prev.map((line) =>
            line.id === tableLineId
              ? {
                  id: tableLineId,
                  role: "assistant",
                  content:
                    token && formFields.length === 0
                      ? "No form fields were included in this submission."
                      : "Sign in on /app to load translated questions and answer fields.",
                  processing: false,
                }
              : line,
          ),
        );
        return;
      }

      void (async () => {
        try {
          const res = await fetch("/api/form-fields/prepare", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              formFields,
              answers,
              applicantLanguage: resolvedLanguage,
            }),
          });
          const data = (await res.json().catch(() => ({}))) as {
            ok?: boolean;
            error?: string;
            rows?: ApplicationFieldRow[];
            summary?: string;
            targetLanguage?: string;
            targetLanguageLabel?: string;
            translationSource?: string;
          };

          if (!res.ok || !data.ok || !Array.isArray(data.rows)) {
            throw new Error(data.error || `Request failed (${res.status})`);
          }

          const preparedRows = data.rows as ApplicationFieldRow[];

          setLines((prev) =>
            prev.map((line) =>
              line.id === tableLineId
                ? {
                    id: tableLineId,
                    role: "assistant",
                    content:
                      data.summary ??
                      "Review and complete the fields below. Copy answers back to the employer site when ready.",
                    processing: false,
                    applicationTable: {
                      submissionId: fullId,
                      pageTitle: p.pageTitle,
                      pageUrl: p.pageUrl,
                      targetLanguage: data.targetLanguage ?? "en",
                      targetLanguageLabel: data.targetLanguageLabel ?? "English",
                      rows: preparedRows,
                    },
                  }
                : line,
            ),
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Request failed";
          setLines((prev) =>
            prev.map((line) =>
              line.id === tableLineId
                ? {
                    id: tableLineId,
                    role: "assistant",
                    content: `Could not build the application table: ${msg}`,
                    processing: false,
                  }
                : line,
            ),
          );
        }
      })();
    },
    [session?.access_token, resolvedLanguage],
  );

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel("unidad:agents")
      .on("broadcast", { event: "form_submitted" }, ({ payload }) => {
        appendFormSubmission(payload as FormSubmittedPayload);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appendFormSubmission]);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const since = activitySinceRef.current;
        const res = await fetch(
          `/api/form-submission/activity?since=${encodeURIComponent(since)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          submissions?: Array<{
            id: string;
            pageUrl: string;
            pageTitle: string;
            fieldCount: number;
            createdAt: string;
            formFields?: unknown[];
            answers?: Record<string, string>;
          }>;
        };
        let latestSince = since;
        for (const s of data.submissions ?? []) {
          appendFormSubmission({
            submissionId: s.id,
            pageUrl: s.pageUrl,
            pageTitle: s.pageTitle,
            fieldCount: s.fieldCount,
            formFields: s.formFields,
            answers: s.answers,
          });
          if (s.createdAt && s.createdAt > latestSince) {
            latestSince = s.createdAt;
          }
        }
        if (latestSince !== since) {
          activitySinceRef.current = latestSince;
        }
      } catch {
        /* ignore */
      }
    }

    void poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [session?.access_token, appendFormSubmission]);

  async function sendMessage(text: string) {
    if (!session?.access_token || !text.trim()) return;
    const trimmed = text.trim();
    setError(null);
    setInput("");
    setLines((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: trimmed }]);
    setSending(true);

    try {
      const res = await fetch("/api/orchestrate/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: trimmed,
          sessionId: sessionIdRef.current || undefined,
          language: user?.preferredLanguage,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setLines((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.reply ?? "(No reply)",
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
      setLines((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `Sorry — I couldn't reach the orchestrator: ${msg}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function newConversation() {
    try {
      sessionStorage.removeItem(STORAGE_SESSION);
      sessionIdRef.current = getOrCreateOrchestrateSessionId();
    } catch {
      sessionIdRef.current = crypto.randomUUID();
    }
    const fresh: ChatLine[] = [
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: "New conversation. How can UNIDAD help?",
      },
    ];
    setLines(fresh);
    setError(null);
    try {
      sessionStorage.setItem(STORAGE_LINES, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
  }

  const initials = user?.name?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <div className="flex h-screen w-screen flex-col bg-[linear-gradient(165deg,#f6faf7_0%,#eef6f0_45%,#e8f2eb_100%)]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-nexus-border/80 bg-white/90 px-4 backdrop-blur-md">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-nexus-accent shadow-[0_0_20px_rgba(21,128,61,0.2)]">
            <Flame className="h-4 w-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold tracking-tight text-nexus-text">UNIDAD</h1>
            <p className="truncate text-[11px] text-nexus-muted">Orchestrator</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={newConversation}
            className="hidden rounded-lg px-3 py-1.5 text-xs font-medium text-nexus-muted hover:bg-nexus-accent/10 hover:text-nexus-accent sm:inline-flex"
          >
            New chat
          </button>
          <button
            type="button"
            onClick={onOpenFaq}
            className="rounded-lg p-2 text-nexus-muted hover:bg-nexus-border/40 hover:text-nexus-text"
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenProfileSettings}
            className="rounded-lg p-2 text-nexus-muted hover:bg-nexus-border/40 hover:text-nexus-text"
            aria-label="Profile"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg p-2 text-nexus-muted hover:bg-red-500/10 hover:text-red-700"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <div
            className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nexus-accent/15 text-[10px] font-bold text-nexus-accent"
            title={user?.email}
          >
            {initials}
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-3 pb-3 pt-4 sm:px-6">
          <div className="flex flex-1 flex-col overflow-y-auto rounded-2xl border border-nexus-border/60 bg-white/70 shadow-[0_8px_40px_rgba(14,34,18,0.06)] backdrop-blur-sm">
            <div className="flex-1 space-y-4 p-4 sm:p-6">
              {lines.map((line) => (
                <MessageBlock
                  key={line.id}
                  line={line}
                  onApplicationRowChange={onApplicationRowChange}
                />
              ))}
              {sending ? (
                <div className="flex items-center gap-2 text-sm text-nexus-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking…
                </div>
              ) : null}
              <div ref={bottomRef} />
            </div>

            {lines.length <= 1 && !sending ? (
              <div className="border-t border-nexus-border/50 px-4 py-3 sm:px-6">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-nexus-muted">
                  Try asking
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => void sendMessage(s)}
                      className="rounded-full border border-nexus-border bg-white/80 px-3 py-1.5 text-left text-xs text-nexus-text transition hover:border-nexus-accent/40 hover:bg-nexus-accent/5"
                    >
                      <Sparkles className="mr-1 inline h-3 w-3 text-nexus-accent" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mt-3 shrink-0">
            {error ? (
              <p className="mb-2 text-center text-xs text-red-600">{error}</p>
            ) : null}
            <form
              className="flex items-end gap-2 rounded-2xl border border-nexus-border/80 bg-white p-2 shadow-sm"
              onSubmit={(e) => {
                e.preventDefault();
                void sendMessage(input);
              }}
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Message UNIDAD…"
                rows={1}
                className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-nexus-text placeholder:text-nexus-muted/60 outline-none"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className={cn(
                  "mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
                  input.trim() && !sending
                    ? "bg-nexus-accent text-white shadow-md hover:bg-nexus-accent/90"
                    : "bg-nexus-border/50 text-nexus-muted",
                )}
                aria-label="Send"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </form>
            <p className="mt-2 text-center text-[10px] leading-relaxed text-nexus-muted">
              Profile language (Supabase <strong>native_language</strong>) drives Spanish translations. Set{" "}
              <strong>GEMINI_API_KEY</strong> in <code className="text-nexus-text">.env</code> for live translation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBlock({
  line,
  onApplicationRowChange,
}: {
  line: ChatLine;
  onApplicationRowChange: (lineId: string, fieldKey: string, value: string) => void;
}) {
  if (line.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm border border-nexus-accent/25 bg-nexus-accent/12 px-4 py-3 text-sm leading-relaxed text-nexus-text">
          {line.content}
        </div>
      </div>
    );
  }

  if (line.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="max-w-[95%] whitespace-pre-wrap rounded-xl border border-amber-500/35 bg-amber-50/90 px-4 py-3 text-xs leading-relaxed text-amber-950">
          {formatMarkdownish(line.content)}
        </div>
      </div>
    );
  }

  if (line.role === "assistant" && line.applicationTable) {
    const t = line.applicationTable;
    const langCol =
      t.targetLanguage === "en" ? "Your language" : t.targetLanguageLabel;
    return (
      <div className="flex justify-start">
        <div className="flex w-full max-w-[min(100%,48rem)] gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-nexus-accent text-[10px] font-bold text-white">
            UN
          </div>
          <div className="min-w-0 flex-1 rounded-2xl rounded-bl-sm border border-nexus-border/80 bg-white px-3 py-3 text-sm leading-relaxed text-nexus-text shadow-sm sm:px-4">
            <p className="mb-3 text-sm text-nexus-text">{formatMarkdownish(line.content)}</p>
            <ApplicationQuestionsTable
              lineId={line.id}
              table={t}
              langColumnLabel={langCol}
              onRowChange={onApplicationRowChange}
            />
          </div>
        </div>
      </div>
    );
  }

  if (line.role === "assistant" && line.processing) {
    return (
      <div className="flex justify-start">
        <div className="flex max-w-[90%] gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-nexus-accent text-[10px] font-bold text-white">
            UN
          </div>
          <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-nexus-border/80 bg-white px-4 py-3 text-sm text-nexus-muted shadow-sm">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-nexus-accent" />
            {line.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-nexus-accent text-[10px] font-bold text-white">
          UN
        </div>
        <div className="rounded-2xl rounded-bl-sm border border-nexus-border/80 bg-white px-4 py-3 text-sm leading-relaxed text-nexus-text shadow-sm">
          {formatMarkdownish(line.content)}
        </div>
      </div>
    </div>
  );
}

function ApplicationQuestionsTable({
  table,
  lineId,
  langColumnLabel,
  onRowChange,
}: {
  table: ApplicationTablePayload;
  lineId: string;
  langColumnLabel: string;
  onRowChange: (lineId: string, fieldKey: string, value: string) => void;
}) {
  if (table.rows.length === 0) {
    return (
      <p className="text-xs text-nexus-muted">No fields in this submission.</p>
    );
  }

  const showTranslationCol = table.targetLanguage !== "en";

  return (
    <div className="overflow-x-auto rounded-xl border border-nexus-border/60 bg-nexus-accent/[0.03]">
      <table className="w-full min-w-[560px] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-nexus-border/60 bg-white/90">
            <th className="px-2 py-2 font-semibold text-nexus-text sm:px-3">Question (English)</th>
            {showTranslationCol ? (
              <th className="px-2 py-2 font-semibold text-nexus-text sm:px-3">{langColumnLabel}</th>
            ) : null}
            <th className="min-w-[180px] px-2 py-2 font-semibold text-nexus-text sm:px-3">
              Your answer
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr
              key={row.fieldKey}
              className="border-b border-nexus-border/40 last:border-0"
            >
              <td className="align-top px-2 py-2 text-nexus-text sm:px-3">{row.questionEn}</td>
              {showTranslationCol ? (
                <td className="align-top px-2 py-2 text-nexus-muted sm:px-3">
                  {row.questionTranslated}
                </td>
              ) : null}
              <td className="align-top px-2 py-2 sm:px-3">
                <textarea
                  value={row.value}
                  onChange={(e) => onRowChange(lineId, row.fieldKey, e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-lg border border-nexus-border/70 bg-white px-2 py-1.5 text-xs text-nexus-text outline-none ring-nexus-accent/30 focus:border-nexus-accent/50 focus:ring-2"
                  aria-label={`Answer for ${row.questionEn}`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatMarkdownish(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-nexus-accent">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
