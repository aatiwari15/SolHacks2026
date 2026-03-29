"use client";

import { useEffect } from "react";
import { ChevronDown, HelpCircle, X } from "lucide-react";

const FAQS = [
  {
    question: "What does Unidad save for me?",
    answer:
      "Unidad saves the common details you choose to provide, like your name, phone number, language, and address information, so future forms can start prefilled.",
  },
  {
    question: "Can I change my information later?",
    answer:
      "Yes. Open the settings cog in the sidebar any time to review and update your saved autofill details without starting over.",
  },
  {
    question: "Will Unidad submit forms automatically?",
    answer:
      "Not by default. Unidad helps prepare and fill information, but you can still review everything before a final submission.",
  },
  {
    question: "What if a form asks for something I have not saved yet?",
    answer:
      "Unidad can still help you field by field. Saved profile details are only used when a form asks for common information you have already provided.",
  },
];

export function FaqModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-white/80 px-4 py-6 backdrop-blur-md" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-nexus-border bg-nexus-surface shadow-[0_28px_90px_rgba(15,23,42,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-nexus-border bg-[radial-gradient(circle_at_top,rgba(21,128,61,0.12),transparent_48%)] px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-nexus-border bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-nexus-accent">
                <HelpCircle className="h-3.5 w-3.5" />
                FAQ
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-nexus-text">Frequently asked questions</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-nexus-muted">
                A few quick answers about how Unidad stores information and helps with forms.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-nexus-muted transition-colors hover:bg-nexus-card hover:text-nexus-text"
              aria-label="Close FAQ"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-6 py-6 sm:px-8">
          {FAQS.map((item) => (
            <div key={item.question} className="rounded-2xl border border-nexus-border bg-white/80 p-5">
              <div className="flex items-start gap-3">
                <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-nexus-accent" />
                <div>
                  <h3 className="text-base font-semibold text-nexus-text">{item.question}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-nexus-muted">{item.answer}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
