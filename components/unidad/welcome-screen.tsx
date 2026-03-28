"use client";

import { FileText, Languages, BookOpen, ArrowRight } from "lucide-react";

type WelcomeScreenProps = {
  onNewChat: () => void;
};

const SUGGESTIONS = [
  {
    icon: <FileText className="h-5 w-5 text-nexus-dante" />,
    label: "Fill a government form",
    sub: "Dante auto-fills in your language",
    bg: "bg-nexus-dante/8 border-nexus-dante/20 hover:bg-nexus-dante/14 hover:border-nexus-dante/35",
  },
  {
    icon: <Languages className="h-5 w-5 text-nexus-mismo" />,
    label: "Translate & practice English",
    sub: "Habla guides real conversations",
    bg: "bg-nexus-mismo/8 border-nexus-mismo/20 hover:bg-nexus-mismo/14 hover:border-nexus-mismo/35",
  },
  {
    icon: <BookOpen className="h-5 w-5 text-nexus-simpli" />,
    label: "Decode complex terms",
    sub: "Simpli breaks down legal jargon",
    bg: "bg-nexus-simpli/8 border-nexus-simpli/20 hover:bg-nexus-simpli/14 hover:border-nexus-simpli/35",
  },
];

export function WelcomeScreen({ onNewChat }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 bg-[radial-gradient(circle_at_top,rgba(21,128,61,0.08),transparent_42%)] px-6">
      {/* Greeting */}
      <div className="space-y-2 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-3xl">🌅</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-nexus-text">
          ¡Bienvenido a Unidad
        </h1>
        <p className="max-w-sm text-base text-nexus-muted">
          Your AI co-pilot for navigating life in a new country — forms, language, and more.
        </p>
      </div>

      {/* Suggestion cards */}
      <div className="grid w-full max-w-lg grid-cols-1 gap-3">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={onNewChat}
            className={`flex items-center gap-4 rounded-2xl border bg-white px-5 py-4 text-left shadow-[0_20px_50px_rgba(14,34,18,0.05)] transition-all duration-200 ${s.bg}`}
          >
            <div className="shrink-0">{s.icon}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-nexus-text">{s.label}</p>
              <p className="mt-0.5 text-xs text-nexus-muted">{s.sub}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-nexus-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}
