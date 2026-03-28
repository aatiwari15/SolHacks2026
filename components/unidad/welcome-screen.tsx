"use client";

import { FileText, Languages, BookOpen, ArrowRight } from "lucide-react";

type WelcomeScreenProps = {
  onNewChat: () => void;
};

const SUGGESTIONS = [
  {
    icon: <FileText className="h-5 w-5 text-orange-400" />,
    label: "Fill a government form",
    sub: "Dante auto-fills in your language",
    bg: "bg-orange-500/8 border-orange-500/20 hover:bg-orange-500/14 hover:border-orange-500/35",
  },
  {
    icon: <Languages className="h-5 w-5 text-teal-400" />,
    label: "Translate & practice English",
    sub: "Habla guides real conversations",
    bg: "bg-teal-500/8 border-teal-500/20 hover:bg-teal-500/14 hover:border-teal-500/35",
  },
  {
    icon: <BookOpen className="h-5 w-5 text-lime-400" />,
    label: "Decode complex terms",
    sub: "Simpli breaks down legal jargon",
    bg: "bg-lime-500/8 border-lime-500/20 hover:bg-lime-500/14 hover:border-lime-500/35",
  },
];

export function WelcomeScreen({ onNewChat }: WelcomeScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6">
      {/* Greeting */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-3">
          <span className="text-3xl">🌅</span>
        </div>
        <h1 className="text-3xl font-bold text-[#f2dfc4] tracking-tight">
          ¡Bienvenido a Unidad
        </h1>
        <p className="text-base text-[#a8906c] max-w-sm">
          Your AI co-pilot for navigating life in a new country — forms, language, and more.
        </p>
      </div>

      {/* Suggestion cards */}
      <div className="grid grid-cols-1 gap-3 w-full max-w-lg">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            onClick={onNewChat}
            className={`flex items-center gap-4 rounded-2xl border px-5 py-4 text-left transition-all duration-200 ${s.bg}`}
          >
            <div className="shrink-0">{s.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#f2dfc4]">{s.label}</p>
              <p className="text-xs text-[#a8906c] mt-0.5">{s.sub}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#7a6045]" />
          </button>
        ))}
      </div>
    </div>
  );
}
