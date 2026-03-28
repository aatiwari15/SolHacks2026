"use client";

import { useState } from "react";
import { cn } from "@/utils/cn";
import { FileText, Languages, BookOpen, Zap, ArrowRight } from "lucide-react";

export type SelectedTask = "dante" | "habla" | "simpli";

const TASKS = [
  {
    id: "dante" as SelectedTask,
    icon: <FileText className="h-5 w-5" />,
    agent: "Dante",
    title: "Fill a Document",
    description: "Paste any government form — Dante reads it, Habla translates it, and the form fills itself in your language.",
    color: "text-nexus-dante",
    border: "border-nexus-dante/30",
    activeBg: "bg-nexus-dante/10 border-nexus-dante/45",
    check: "border-nexus-dante bg-nexus-dante",
  },
  {
    id: "habla" as SelectedTask,
    icon: <Languages className="h-5 w-5" />,
    agent: "Habla",
    title: "Translate & Practice",
    description: "Practice English in real conversations. Habla plays a native speaker, officer, or interviewer.",
    color: "text-nexus-mismo",
    border: "border-nexus-mismo/30",
    activeBg: "bg-nexus-mismo/10 border-nexus-mismo/45",
    check: "border-nexus-mismo bg-nexus-mismo",
  },
  {
    id: "simpli" as SelectedTask,
    icon: <BookOpen className="h-5 w-5" />,
    agent: "Simpli",
    title: "Decode Jargon",
    description: "Paste confusing legal, medical, or government text. Simpli explains every term in plain language.",
    color: "text-nexus-simpli",
    border: "border-nexus-simpli/30",
    activeBg: "bg-nexus-simpli/10 border-nexus-simpli/45",
    check: "border-nexus-simpli bg-nexus-simpli",
  },
];

type TaskSelectorProps = {
  onStart: (task: SelectedTask) => void;
};

export function TaskSelector({ onStart }: TaskSelectorProps) {
  const [selected, setSelected] = useState<SelectedTask | null>(null);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(21,128,61,0.08),transparent_45%)] px-6">
      <div className="w-full max-w-xl fade-up">
        {/* Header */}
        <div className="mb-7 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-nexus-accent/25 bg-nexus-accent/10 px-4 py-1.5">
            <Zap className="h-3.5 w-3.5 text-nexus-accent" />
            <span className="text-xs font-semibold tracking-wide text-nexus-accent">New Chat</span>
          </div>
          <h2 className="text-2xl font-bold text-nexus-text">What do you need help with?</h2>
          <p className="mt-1.5 text-sm text-nexus-muted">Choose one to get started — your AI agent will guide you through the rest.</p>
        </div>

        {/* Task cards */}
        <div className="space-y-3">
          {TASKS.map((task) => {
            const isSelected = selected === task.id;
            return (
              <button
                key={task.id}
                onClick={() => setSelected(isSelected ? null : task.id)}
                className={cn(
                  "flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
                  isSelected
                    ? task.activeBg
                    : "border-nexus-border bg-white hover:border-nexus-accent/25 hover:bg-nexus-card",
                )}
              >
                {/* Checkbox */}
                <div
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-200",
                    isSelected ? task.check : "border-nexus-border",
                  )}
                >
                  {isSelected && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 12 12">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>

                {/* Icon */}
                <div className={cn("mt-0.5 shrink-0", task.color)}>{task.icon}</div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-xs font-bold uppercase tracking-wider", task.color)}>{task.agent}</span>
                    <span className="text-sm font-semibold text-nexus-text">{task.title}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-nexus-muted">{task.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Start button */}
        <button
          disabled={!selected}
          onClick={() => selected && onStart(selected)}
          className={cn(
            "mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-sm font-semibold transition-all duration-200",
            selected
              ? "bg-nexus-accent text-white hover:brightness-110 active:scale-[0.98] shadow-lg shadow-nexus-accent/20"
              : "cursor-not-allowed bg-nexus-border text-nexus-muted",
          )}
        >
          Start Session
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
