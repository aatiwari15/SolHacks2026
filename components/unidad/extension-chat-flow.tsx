"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/utils/cn";
import {
  Zap, Languages, BookOpen, CheckCircle2, ChevronRight, Download, ExternalLink,
} from "lucide-react";
import { sanitizeForAgent } from "@/lib/form-field-display";

// ── Types ─────────────────────────────────────────────────────────────────────

type FlowStep = "received" | "dante-parsing" | "habla-translating" | "simpli-decoding" | "done";

export type ExtensionSubmission = {
  submissionId: string;
  pageUrl: string;
  pageTitle: string;
  sessionToken: string;
  fieldCount: number;
  formFields: Array<{ key: string; label: string; [k: string]: unknown }>;
  answers: Record<string, string>;
};

// ── Jargon dictionary ─────────────────────────────────────────────────────────

const JARGON: Record<string, string> = {
  "alien registration":   "A unique USCIS number that identifies non-citizens in the U.S. immigration system.",
  "i-94":                 "Arrival/Departure Record — proof of your legal entry and authorized length of stay.",
  "priority date":        "The date your petition was filed — determines when a visa number becomes available.",
  "ssn":                  "Social Security Number — 9-digit ID used for taxes and benefit tracking.",
  "ein":                  "Employer Identification Number — IRS identifier for businesses.",
  "ead":                  "Employment Authorization Document — proves you are legally allowed to work in the U.S.",
  "adjustment of status": "Applying for a Green Card while remaining inside the United States.",
  "beneficiary":          "The person who will receive benefits from a petition or insurance policy.",
  "petitioner":           "The person or organization filing a petition on someone else's behalf.",
  "affidavit":            "A written statement sworn to be true and signed before a notary or officer.",
  "notarized":            "A document certified by a notary public as authentic and properly signed.",
  "domicile":             "Your permanent legal home — the place you intend to return to.",
  "uscis":                "U.S. Citizenship and Immigration Services — the agency handling immigration.",
  "snap":                 "Supplemental Nutrition Assistance Program — commonly known as food stamps.",
  "medicaid":             "Joint federal/state health insurance for people with low income.",
  "w-4":                  "Tax form telling your employer how much federal income tax to withhold.",
  "1099":                 "Tax form reporting income from sources other than an employer.",
};

function findJargon(fields: ExtensionSubmission["formFields"]) {
  const results: Array<{ term: string; definition: string }> = [];
  for (const field of fields) {
    const lower = field.label.toLowerCase();
    for (const [key, def] of Object.entries(JARGON)) {
      if (lower.includes(key) && !results.some((r) => r.definition === def)) {
        results.push({ term: field.label, definition: def });
        if (results.length >= 3) return results;
      }
    }
  }
  return results;
}

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
    dante:  { color: "bg-nexus-dante",  label: "Dante",  tag: "The Doer",       text: "text-nexus-dante",  border: "border-nexus-dante/20"  },
    habla:  { color: "bg-nexus-mismo",  label: "Habla",  tag: "The Translator", text: "text-nexus-mismo",  border: "border-nexus-mismo/20"  },
    simpli: { color: "bg-nexus-simpli", label: "Simpli", tag: "The Decoder",    text: "text-nexus-simpli", border: "border-nexus-simpli/20" },
  }[agent];

  return (
    <div
      className={cn("flex gap-3 fade-up rounded-2xl border bg-white p-4", meta.border)}
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
        <div key={step} className="shimmer h-6 rounded-lg" style={{ animationDelay: `${i * 150}ms`, width: `${70 + i * 5}%` }} />
      ))}
    </div>
  );
}

function FilledFieldsList({
  fields,
  answers,
}: {
  fields: ExtensionSubmission["formFields"];
  answers: Record<string, string>;
}) {
  const filled = fields.filter((f) => answers[f.key]);
  return (
    <div className="mt-2 space-y-1.5">
      {filled.map((field, i) => (
        <div
          key={field.key}
          className="fade-up flex items-center justify-between rounded-xl border border-nexus-dante/15 bg-nexus-dante/5 px-3 py-2"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <span className="text-xs text-nexus-muted">{sanitizeForAgent(field.label)}</span>
          <div className="flex items-center gap-2">
            <span className="max-w-[160px] truncate font-mono text-xs text-nexus-text">
              {sanitizeForAgent(answers[field.key])}
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-nexus-dante" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HablaTranslatingAnimation({
  fields,
}: {
  fields: ExtensionSubmission["formFields"];
}) {
  const sample = fields.slice(0, 3);
  return (
    <div className="py-2">
      <p className="mb-4 flex items-center gap-2 text-xs font-semibold text-nexus-mismo">
        <Languages className="h-3.5 w-3.5" />
        Translating field labels for clarity…
      </p>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nexus-dante text-xs font-bold text-white shadow-lg shadow-nexus-dante/20">Da</div>
          <span className="text-[10px] font-semibold text-nexus-dante">Dante</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1">
          <svg viewBox="0 0 120 20" className="w-full" height="20">
            <line x1="0" y1="10" x2="120" y2="10" stroke="#d6e4d8" strokeWidth="2" />
            <line x1="0" y1="10" x2="120" y2="10" stroke="#0d9488" strokeWidth="2" strokeDasharray="8 4" className="agent-comm" />
            <circle cx="30" cy="10" r="3" fill="#16a34a" opacity="0.8">
              <animate attributeName="cx" from="0" to="120" dur="1.4s" repeatCount="indefinite" />
            </circle>
          </svg>
          <span className="text-[9px] uppercase tracking-wider text-nexus-muted">translating fields</span>
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nexus-mismo text-xs font-bold text-white shadow-lg shadow-nexus-mismo/20">Ha</div>
          <span className="text-[10px] font-semibold text-nexus-mismo">Habla</span>
        </div>
      </div>
      <div className="space-y-2">
        {sample.map((f, i) => (
          <div key={f.key} className="flex items-center gap-2 text-[11px] text-nexus-muted" style={{ animationDelay: `${i * 200}ms` }}>
            <div className="pulse-dot h-1.5 w-1.5 rounded-full bg-nexus-mismo/60" />
            {f.label} → traducido
          </div>
        ))}
      </div>
    </div>
  );
}

function BilingualFieldsList({
  fields,
  answers,
}: {
  fields: ExtensionSubmission["formFields"];
  answers: Record<string, string>;
}) {
  const filled = fields.filter((f) => answers[f.key]);
  return (
    <div className="mt-2 space-y-1.5">
      {filled.map((field, i) => (
        <div
          key={field.key}
          className="fade-up rounded-xl border border-nexus-mismo/20 bg-nexus-mismo/6 px-3 py-2.5"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-nexus-mismo">{sanitizeForAgent(field.label)}</p>
              <p className="text-[9px] text-nexus-muted">EN · translated</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="max-w-[140px] truncate font-mono text-xs text-nexus-text">
                {sanitizeForAgent(answers[field.key])}
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-nexus-mismo" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpliDecodingAnimation({ fields }: { fields: ExtensionSubmission["formFields"] }) {
  return (
    <div className="py-2">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-nexus-simpli">
        <BookOpen className="h-3.5 w-3.5" />
        Scanning for complex terms…
      </p>
      <div className="space-y-2">
        {fields.slice(0, 4).map((f, i) => (
          <div key={f.key} className="shimmer h-5 rounded-lg" style={{ animationDelay: `${i * 120}ms`, width: `${60 + i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}

function SimpliSummary({ fields }: { fields: ExtensionSubmission["formFields"] }) {
  const found = findJargon(fields);
  if (found.length === 0) {
    return (
      <p className="text-sm text-nexus-muted">
        ✅ No complex jargon detected — this form uses plain language.
      </p>
    );
  }
  return (
    <div className="space-y-2.5">
      <p className="text-sm text-nexus-simpli font-semibold">
        Found {found.length} term{found.length > 1 ? "s" : ""} worth knowing:
      </p>
      {found.map(({ term, definition }) => (
        <div key={term} className="rounded-xl border border-nexus-simpli/20 bg-nexus-simpli/6 px-3 py-2.5">
          <p className="text-xs font-bold text-nexus-simpli">{term}</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-nexus-muted">{definition}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ExtensionChatFlow({ submission }: { submission: ExtensionSubmission }) {
  const [step, setStep] = useState<FlowStep>("received");
  const bottomRef = useRef<HTMLDivElement>(null);

  const filledFields = submission.formFields.filter((f) => submission.answers[f.key]);

  // Auto-advance
  useEffect(() => {
    const delays: Partial<Record<FlowStep, number>> = {
      received:          600,
      "dante-parsing":   2500,
      "habla-translating": 2500,
      "simpli-decoding": 2500,
    };
    const next: Partial<Record<FlowStep, FlowStep>> = {
      received:            "dante-parsing",
      "dante-parsing":     "habla-translating",
      "habla-translating": "simpli-decoding",
      "simpli-decoding":   "done",
    };
    if (step === "done") return;
    const t = setTimeout(() => setStep(next[step]!), delays[step]);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [step]);

  const hostname = (() => {
    try { return new URL(submission.pageUrl).hostname; } catch { return submission.pageUrl; }
  })();

  const title = submission.pageTitle || hostname;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header — 3-agent pipeline */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-nexus-border bg-white/70 px-5">
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-nexus-dante text-[10px] font-bold text-white">Da</div>
          <span className="text-xs font-semibold text-nexus-text">Form Fill</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-nexus-muted" />
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-nexus-mismo text-[10px] font-bold text-white">Ha</div>
          <span className="text-xs text-nexus-muted">Translation</span>
        </div>
        <ChevronRight className="h-3.5 w-3.5 text-nexus-muted" />
        <div className="flex items-center gap-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-nexus-simpli text-[10px] font-bold text-white">Si</div>
          <span className="text-xs text-nexus-muted">Jargon Decode</span>
        </div>
        <a
          href={submission.pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 rounded-full bg-nexus-card px-2 py-1 text-[10px] text-nexus-muted hover:text-nexus-text transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          {hostname}
        </a>
      </div>

      {/* Chat thread */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-[linear-gradient(to_bottom,#f8fbf9,#f1f8f2)] px-5 py-5">

        {/* Always shown: receipt */}
        <AgentBubble agent="dante">
          <p>
            📥 Got your form from <strong className="text-nexus-text">{title}</strong>.
            Detected <strong className="text-nexus-dante">{submission.fieldCount} field{submission.fieldCount !== 1 ? "s" : ""}</strong> — analyzing now…
          </p>
        </AgentBubble>

        {/* Dante parsing → results */}
        {step !== "received" && (
          <AgentBubble agent="dante" delay={100}>
            {step === "dante-parsing" ? (
              <ParsingAnimation />
            ) : (
              <div>
                <p>
                  ✅ Matched <strong className="text-nexus-dante">{filledFields.length} / {submission.fieldCount}</strong> fields from your profile. Passing to Habla for translation…
                </p>
                <FilledFieldsList fields={submission.formFields} answers={submission.answers} />
              </div>
            )}
          </AgentBubble>
        )}

        {/* Habla translating → results */}
        {(step === "habla-translating" || step === "simpli-decoding" || step === "done") && (
          <AgentBubble agent="habla" delay={200}>
            {step === "habla-translating" ? (
              <HablaTranslatingAnimation fields={submission.formFields} />
            ) : (
              <div>
                <p>
                  Translation complete — all labels are now in your language. Sending to Simpli to decode any jargon…
                </p>
                <BilingualFieldsList fields={submission.formFields} answers={submission.answers} />
              </div>
            )}
          </AgentBubble>
        )}

        {/* Simpli decoding → results */}
        {(step === "simpli-decoding" || step === "done") && (
          <AgentBubble agent="simpli" delay={100}>
            {step === "simpli-decoding" ? (
              <SimpliDecodingAnimation fields={submission.formFields} />
            ) : (
              <SimpliSummary fields={submission.formFields} />
            )}
          </AgentBubble>
        )}

        {/* Done — final summary */}
        {step === "done" && (
          <AgentBubble agent="dante" delay={0}>
            <p className="mb-3">
              🎉 All done! <strong className="text-nexus-dante">{filledFields.length} fields filled</strong> and ready for review.
            </p>
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-nexus-accent py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 active:scale-[0.98]">
              <Download className="h-4 w-4" />
              Download Filled Form
            </button>
          </AgentBubble>
        )}

        {/* In-progress indicator */}
        {step !== "done" && (
          <AgentBubble
            agent={
              step === "dante-parsing" ? "dante"
              : step === "habla-translating" ? "habla"
              : "simpli"
            }
            delay={300}
          >
            <ThinkingDots />
          </AgentBubble>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
