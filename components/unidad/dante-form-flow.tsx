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
  { label: "Full Legal Name",          labelEs: "Nombre Legal Completo",          value: "Ana María García",        filled: true },
  { label: "Date of Birth",            labelEs: "Fecha de Nacimiento",            value: "14 de marzo, 1992",       filled: true },
  { label: "Country of Birth",         labelEs: "País de Nacimiento",             value: "México",                  filled: true },
  { label: "Alien Registration #",     labelEs: "Número de Registro (USCIS)",     value: "A-204 812 937",           filled: true },
  { label: "Entry Date",               labelEs: "Fecha de Entrada a EE.UU.",      value: "08 de enero, 2019",       filled: true },
  { label: "Current Status",           labelEs: "Estatus Migratorio Actual",      value: "F-1 Estudiante",          filled: true },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentBubble({
  agent,
  children,
  delay = 0,
}: {
  agent: "dante" | "habla" | "simpli";
  children: React.ReactNode;
  delay?: number;
}) {
  const meta = {
    dante:  { color: "bg-nexus-dante",  label: "Dante",  tag: "The Doer",       text: "text-nexus-dante", border: "border-nexus-dante/20", bg: "bg-white" },
    habla:  { color: "bg-nexus-mismo",  label: "Habla",  tag: "The Translator", text: "text-nexus-mismo", border: "border-nexus-mismo/20", bg: "bg-white" },
    simpli: { color: "bg-nexus-simpli", label: "Simpli", tag: "The Decoder",    text: "text-nexus-simpli", border: "border-nexus-simpli/20", bg: "bg-white" },
  }[agent];

  return (
    <div
      className={cn("flex gap-3 fade-up", meta.border, meta.bg, "rounded-2xl p-4 border")}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white", meta.color)}>
        {meta.label.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className={cn("text-xs font-bold", meta.text)}>{meta.label}</span>
          <span className="text-[10px] text-nexus-muted">· {meta.tag}</span>
        </div>
        <div className="text-sm leading-relaxed text-nexus-text">{children}</div>
      </div>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end fade-up">
      <div className="max-w-[80%] rounded-2xl rounded-br-md border border-nexus-accent/20 bg-nexus-accent/8 px-4 py-3">
        <p className="text-sm leading-relaxed text-nexus-text">{children}</p>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span className="pulse-dot h-2 w-2 rounded-full bg-nexus-muted" />
      <span className="pulse-dot-2 h-2 w-2 rounded-full bg-nexus-muted" />
      <span className="pulse-dot-3 h-2 w-2 rounded-full bg-nexus-muted" />
    </div>
  );
}

function ParsingAnimation() {
  return (
    <div className="space-y-2 py-1">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-nexus-dante">
        <Zap className="h-3.5 w-3.5" />
        Reading document structure…
      </p>
      {["Detecting form fields", "Identifying required fields", "Extracting field labels", "Mapping to profile data"].map((step, i) => (
        <div key={step} className="flex items-center gap-2.5 shimmer h-6 rounded-lg" style={{ animationDelay: `${i * 150}ms`, width: `${70 + i * 5}%` }} />
      ))}
    </div>
  );
}

function HablaConnectAnimation() {
  return (
    <div className="py-2">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold text-nexus-mismo">
        <Languages className="h-3.5 w-3.5" />
        Connecting with Habla for translation…
      </p>

      {/* Agent communication visual */}
      <div className="flex items-center gap-3 mb-4">
        {/* Dante */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nexus-dante text-xs font-bold text-white shadow-lg shadow-nexus-dante/20">
            Da
          </div>
          <span className="text-[10px] font-semibold text-nexus-dante">Dante</span>
        </div>

        {/* Animated connection line */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <svg viewBox="0 0 120 20" className="w-full" height="20">
            <line x1="0" y1="10" x2="120" y2="10" stroke="#d6e4d8" strokeWidth="2" />
            <line
              x1="0" y1="10" x2="120" y2="10"
              stroke="#0d9488"
              strokeWidth="2"
              strokeDasharray="8 4"
              className="agent-comm"
            />
            {/* Packet circles */}
            <circle cx="30" cy="10" r="3" fill="#16a34a" opacity="0.8">
              <animate attributeName="cx" from="0" to="120" dur="1.4s" repeatCount="indefinite" />
            </circle>
          </svg>
          <span className="text-[9px] uppercase tracking-wider text-nexus-muted">translating fields</span>
        </div>

        {/* Habla */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nexus-mismo text-xs font-bold text-white shadow-lg shadow-nexus-mismo/20">
            Ha
          </div>
          <span className="text-[10px] font-semibold text-nexus-mismo">Habla</span>
        </div>
      </div>

      {/* Translation lines shimmer */}
      <div className="space-y-2">
        {["Full Legal Name → Nombre Legal Completo", "Date of Birth → Fecha de Nacimiento", "Country of Birth → País de Nacimiento"].map((line, i) => (
          <div key={line} className="flex items-center gap-2 text-[11px] text-nexus-muted" style={{ animationDelay: `${i * 200}ms` }}>
            <div className="pulse-dot h-1.5 w-1.5 rounded-full bg-nexus-mismo/60" />
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
          className="fade-up flex items-center justify-between rounded-xl border border-nexus-mismo/20 bg-nexus-mismo/6 px-3 py-2.5"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div>
            <p className="text-[11px] font-semibold text-nexus-mismo">{field.labelEs}</p>
            <p className="text-[9px] text-nexus-muted">{field.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-nexus-text">{field.value}</span>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-nexus-mismo" />
          </div>
        </div>
      ))}

      <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-nexus-accent py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 active:scale-[0.98]">
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

  // Auto-advance through animated steps
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
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-nexus-border bg-white/70 px-5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-nexus-dante text-[10px] font-bold text-white">
            Da
          </div>
          <span className="text-sm font-semibold text-nexus-text">Document Fill</span>
        </div>
        <ChevronRight className="h-4 w-4 text-nexus-muted" />
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-nexus-mismo text-[10px] font-bold text-white">
            Ha
          </div>
          <span className="text-sm text-nexus-muted">+ Habla Translation</span>
        </div>
        <span className="ml-auto rounded-full bg-nexus-card px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-nexus-muted">
          Demo
        </span>
      </div>

      {/* Chat thread */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(to_bottom,#f8fbf9,#f1f8f2)] px-5 py-5">

        {/* Step 1: Dante prompts */}
        <AgentBubble agent="dante">
          <p>
            ¡Hola! I&apos;m <strong className="text-orange-400">Dante</strong>. To get started,
            paste your government form text below — it can be in{" "}
            <strong className="text-orange-300">any language</strong>. I&apos;ll parse the fields
            and hand them to <strong className="text-teal-400">Habla</strong> for translation.
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
                className="flex items-center gap-1 rounded-full border border-orange-500/25 bg-orange-500/8 px-2.5 py-1 text-xs text-orange-400 hover:bg-orange-500/16 transition-colors"
              >
                <FileText className="h-3 w-3" />
                {s}
              </button>
            ))}
          </div>
        </AgentBubble>

        {/* Step 2+: User's pasted text */}
        {pastedText && <UserBubble>{pastedText}</UserBubble>}

        {/* Step 3: Parsing */}
        {(step === "dante-parsing" || step === "habla-connect" || step === "filling" || step === "done") && (
          <AgentBubble agent="dante" delay={100}>
            {step === "dante-parsing" ? (
              <ParsingAnimation />
            ) : (
              <p>
                ✅ I&apos;ve identified <strong className="text-nexus-dante">6 form fields</strong>.
                Sending to Habla for Spanish translation…
              </p>
            )}
          </AgentBubble>
        )}

        {/* Step 4: Habla connecting */}
        {(step === "habla-connect" || step === "filling" || step === "done") && (
          <AgentBubble agent="habla" delay={200}>
            {step === "habla-connect" ? (
              <HablaConnectAnimation />
            ) : (
              <p>
                Translation complete! All fields translated to{" "}
                <strong className="text-nexus-mismo">Español</strong>. Sending back to Dante to fill the form…
              </p>
            )}
          </AgentBubble>
        )}

        {/* Step 5: Filling */}
        {step === "filling" && (
          <AgentBubble agent="dante" delay={100}>
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-nexus-dante">
              <Zap className="h-4 w-4" />
              Filling form fields…
            </p>
            <ThinkingDots />
          </AgentBubble>
        )}

        {/* Step 6: Done */}
        {step === "done" && (
          <AgentBubble agent="dante" delay={0}>
            <p className="mb-3">
              🎉 Done! Here&apos;s your form — all 6 fields filled in{" "}
              <strong className="text-nexus-mismo">Español</strong>. Review before submitting.
            </p>
            <FilledFormCard fields={MOCK_FIELDS} />
          </AgentBubble>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {showInput && (
        <div className="shrink-0 border-t border-nexus-border bg-white/85 px-5 py-4">
          <div className="flex items-end gap-3 rounded-2xl border border-nexus-border bg-white px-4 py-3 transition-colors focus-within:border-nexus-accent/40">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (step === "dante-prompt" && e.target.value.length > 0) setStep("user-pasting");
              }}
              placeholder="Paste your form text here (any language)…"
              rows={3}
              className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-nexus-text outline-none placeholder:text-nexus-muted"
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
                  ? "bg-nexus-accent text-white shadow-md shadow-nexus-accent/25 hover:brightness-110"
                  : "cursor-not-allowed bg-nexus-card text-nexus-muted",
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] text-nexus-muted">
            ⌘ + Enter to submit · Supports any language
          </p>
        </div>
      )}
    </div>
  );
}
