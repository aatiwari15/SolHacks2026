"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/utils/cn";
import {
  Zap, Languages, CheckCircle2, Send, FileText, ChevronRight, Download
} from "lucide-react";

// ── Types & mock data ─────────────────────────────────────────────────────────

type FlowStep =
  | "dante-prompt"
  | "user-pasting"
  | "dante-parsing"
  | "habla-connect"
  | "filling"
  | "done";

type FormField = {
  label: string;
  labelEs: string;
  value: string;
  filled: boolean;
};

const MOCK_FIELDS: FormField[] = [
  { label: "Full Legal Name",        labelEs: "Nombre Legal Completo",       value: "Ana María García",      filled: true },
  { label: "Date of Birth",          labelEs: "Fecha de Nacimiento",         value: "14 de marzo, 1992",     filled: true },
  { label: "Country of Birth",       labelEs: "País de Nacimiento",          value: "México",                filled: true },
  { label: "Alien Registration #",   labelEs: "Número de Registro (USCIS)",  value: "A-204 812 937",         filled: true },
  { label: "Entry Date",             labelEs: "Fecha de Entrada a EE.UU.",   value: "08 de enero, 2019",     filled: true },
  { label: "Current Status",         labelEs: "Estatus Migratorio Actual",   value: "F-1 Estudiante",        filled: true },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentBubble({
  agent, children, delay = 0,
}: {
  agent: "dante" | "habla" | "simpli";
  children: React.ReactNode;
  delay?: number;
}) {
  const meta = {
    dante:  { color: "bg-orange-500",  label: "Dante",  tag: "The Doer",       text: "text-orange-500", border: "border-orange-500/20", bg: "bg-orange-500/6" },
    habla:  { color: "bg-teal-500",    label: "Habla",  tag: "The Translator", text: "text-teal-600 dark:text-teal-400",   border: "border-teal-500/20",   bg: "bg-teal-500/6" },
    simpli: { color: "bg-lime-500",    label: "Simpli", tag: "The Decoder",    text: "text-lime-600 dark:text-lime-400",   border: "border-lime-500/20",   bg: "bg-lime-500/6" },
  }[agent];

  return (
    <div
      className={cn("flex gap-3 fade-up rounded-2xl p-4 border", meta.border, meta.bg)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white", meta.color)}>
        {meta.label.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={cn("text-xs font-bold", meta.text)}>{meta.label}</span>
          <span className="text-[10px] text-fg-muted">· {meta.tag}</span>
        </div>
        <div className="text-sm text-fg-body leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end fade-up">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-amber-500/15 border border-amber-500/25 px-4 py-3">
        <p className="text-sm text-fg-primary leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="h-2 w-2 rounded-full bg-fg-secondary pulse-dot" />
      <span className="h-2 w-2 rounded-full bg-fg-secondary pulse-dot-2" />
      <span className="h-2 w-2 rounded-full bg-fg-secondary pulse-dot-3" />
    </div>
  );
}

function ParsingAnimation() {
  return (
    <div className="space-y-2 py-1">
      <p className="text-xs text-orange-500 font-semibold mb-3 flex items-center gap-2">
        <Zap className="h-3.5 w-3.5" />
        Reading document structure…
      </p>
      {["Detecting form fields", "Identifying required fields", "Extracting field labels", "Mapping to profile data"].map((step, i) => (
        <div key={step} className="shimmer h-6 rounded-lg" style={{ animationDelay: `${i * 150}ms`, width: `${70 + i * 5}%` }} />
      ))}
    </div>
  );
}

function HablaConnectAnimation() {
  return (
    <div className="py-2">
      <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold mb-4 flex items-center gap-2">
        <Languages className="h-3.5 w-3.5" />
        Connecting with Habla for translation…
      </p>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-xs font-bold text-white shadow-lg shadow-orange-500/20">
            Da
          </div>
          <span className="text-[10px] text-orange-500 font-semibold">Dante</span>
        </div>

        <div className="flex-1 flex flex-col items-center gap-1">
          <svg viewBox="0 0 120 20" className="w-full" height="20">
            <line x1="0" y1="10" x2="120" y2="10" stroke="var(--border-base)" strokeWidth="2" />
            <line
              x1="0" y1="10" x2="120" y2="10"
              stroke="#2dd4bf"
              strokeWidth="2"
              strokeDasharray="8 4"
              className="agent-comm"
            />
            <circle cx="30" cy="10" r="3" fill="#f59e0b" opacity="0.8">
              <animate attributeName="cx" from="0" to="120" dur="1.4s" repeatCount="indefinite" />
            </circle>
          </svg>
          <span className="text-[9px] text-fg-muted tracking-wider uppercase">translating fields</span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-xs font-bold text-white shadow-lg shadow-teal-500/20">
            Ha
          </div>
          <span className="text-[10px] text-teal-600 dark:text-teal-400 font-semibold">Habla</span>
        </div>
      </div>

      <div className="space-y-2">
        {["Full Legal Name → Nombre Legal Completo", "Date of Birth → Fecha de Nacimiento", "Country of Birth → País de Nacimiento"].map((line, i) => (
          <div key={line} className="flex items-center gap-2 text-[11px] text-fg-secondary" style={{ animationDelay: `${i * 200}ms` }}>
            <div className="h-1.5 w-1.5 rounded-full bg-teal-500/60 pulse-dot" />
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function FilledFormCard({ fields }: { fields: FormField[] }) {
  return (
    <div className="space-y-1.5 py-1">
      {fields.map((field, i) => (
        <div
          key={field.label}
          className="flex items-center justify-between rounded-xl border border-teal-500/20 bg-teal-500/5 px-3 py-2.5 fade-up"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div>
            <p className="text-[11px] font-semibold text-teal-600 dark:text-teal-400">{field.labelEs}</p>
            <p className="text-[9px] text-fg-muted">{field.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-fg-primary">{field.value}</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-teal-500 shrink-0" />
          </div>
        </div>
      ))}

      <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-fg-amber-btn hover:bg-amber-400 transition-colors active:scale-[0.98]">
        <Download className="h-4 w-4" />
        Download Filled Form
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DanteFormFlow() {
  const [step, setStep] = useState<FlowStep>("dante-prompt");
  const [inputValue, setInputValue] = useState("");
  const [pastedText, setPastedText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (step === "dante-parsing") {
      const t = setTimeout(() => setStep("habla-connect"), 2500);
      return () => clearTimeout(t);
    }
    if (step === "habla-connect") {
      const t = setTimeout(() => setStep("filling"), 2800);
      return () => clearTimeout(t);
    }
    if (step === "filling") {
      const t = setTimeout(() => setStep("done"), 1200);
      return () => clearTimeout(t);
    }
  }, [step]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step]);

  function handleSubmitForm() {
    if (!inputValue.trim()) return;
    setPastedText(inputValue.trim());
    setInputValue("");
    setStep("dante-parsing");
  }

  const showInput = step === "dante-prompt" || step === "user-pasting";

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border-base px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500 text-[10px] font-bold text-white">Da</div>
          <span className="text-sm font-semibold text-fg-primary">Document Fill</span>
        </div>
        <ChevronRight className="h-4 w-4 text-fg-muted" />
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500 text-[10px] font-bold text-white">Ha</div>
          <span className="text-sm text-fg-secondary">+ Habla Translation</span>
        </div>
        <span className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-fg-disabled bg-border-base px-2 py-1 rounded-full">
          Demo
        </span>
      </div>

      {/* Chat thread */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        <AgentBubble agent="dante">
          <p>
            ¡Hola! I&apos;m <strong className="text-orange-500">Dante</strong>. To get started,
            paste your government form text below — it can be in{" "}
            <strong className="text-orange-500">any language</strong>. I&apos;ll parse the fields
            and hand them to <strong className="text-teal-600 dark:text-teal-400">Habla</strong> for translation.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["DMV Form", "USCIS I-485", "Social Security", "Tax Form W-4"].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInputValue(`[Example: ${s} form text in Spanish]`);
                  setStep("user-pasting");
                  inputRef.current?.focus();
                }}
                className="flex items-center gap-1 rounded-full border border-orange-500/25 bg-orange-500/8 px-2.5 py-1 text-xs text-orange-500 hover:bg-orange-500/16 transition-colors"
              >
                <FileText className="h-3 w-3" />
                {s}
              </button>
            ))}
          </div>
        </AgentBubble>

        {pastedText && <UserBubble>{pastedText}</UserBubble>}

        {(step === "dante-parsing" || step === "habla-connect" || step === "filling" || step === "done") && (
          <AgentBubble agent="dante" delay={100}>
            {step === "dante-parsing" ? (
              <ParsingAnimation />
            ) : (
              <p>✅ I&apos;ve identified <strong className="text-orange-500">6 form fields</strong>. Sending to Habla for Spanish translation…</p>
            )}
          </AgentBubble>
        )}

        {(step === "habla-connect" || step === "filling" || step === "done") && (
          <AgentBubble agent="habla" delay={200}>
            {step === "habla-connect" ? (
              <HablaConnectAnimation />
            ) : (
              <p>Translation complete! All fields translated to <strong className="text-teal-600 dark:text-teal-400">Español</strong>. Sending back to Dante to fill the form…</p>
            )}
          </AgentBubble>
        )}

        {step === "filling" && (
          <AgentBubble agent="dante" delay={100}>
            <p className="text-sm text-orange-500 font-semibold flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4" />
              Filling form fields…
            </p>
            <ThinkingDots />
          </AgentBubble>
        )}

        {step === "done" && (
          <AgentBubble agent="dante" delay={0}>
            <p className="mb-3">
              🎉 Done! Here&apos;s your form — all 6 fields filled in{" "}
              <strong className="text-teal-600 dark:text-teal-400">Español</strong>. Review before submitting.
            </p>
            <FilledFormCard fields={MOCK_FIELDS} />
          </AgentBubble>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {showInput && (
        <div className="shrink-0 border-t border-border-base px-5 py-4">
          <div className="flex items-end gap-3 rounded-2xl border border-border-input bg-surface-card px-4 py-3 focus-within:border-amber-500/40 transition-colors">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (step === "dante-prompt" && e.target.value.length > 0) setStep("user-pasting");
              }}
              placeholder="Paste your form text here (any language)…"
              rows={3}
              className="flex-1 resize-none bg-transparent text-sm text-fg-primary placeholder-[var(--fg-disabled)] outline-none leading-relaxed"
              style={{ maxHeight: "180px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleSubmitForm();
                }
              }}
            />
            <button
              onClick={handleSubmitForm}
              disabled={!inputValue.trim()}
              className={cn(
                "shrink-0 flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
                inputValue.trim()
                  ? "bg-amber-500 text-fg-amber-btn hover:bg-amber-400 shadow-md shadow-amber-500/20"
                  : "bg-border-base text-fg-disabled cursor-not-allowed",
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-fg-disabled">
            ⌘ + Enter to submit · Supports any language
          </p>
        </div>
      )}
    </div>
  );
}
