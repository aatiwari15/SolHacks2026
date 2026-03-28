"use client";

import { useState } from "react";
import { cn } from "@/utils/cn";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  CheckCircle,
  ChevronDown,
  Chrome,
  ExternalLink,
  Globe,
  Loader2,
  RefreshCw,
  Shield,
  X,
  Zap,
} from "lucide-react";

type BrowserTab = {
  id: string;
  label: string;
  url: string;
  favicon: string;
  active?: boolean;
};

const MOCK_TABS: BrowserTab[] = [
  {
    id: "uscis",
    label: "USCIS - I-485",
    url: "uscis.gov/i-485",
    favicon: "🏛️",
    active: true,
  },
  { id: "dmv", label: "DMV Online", url: "dmv.gov/online", favicon: "🚗" },
];

type FormField = {
  label: string;
  value: string;
  filled: boolean;
  required: boolean;
};

const MOCK_FORM_FIELDS: FormField[] = [
  { label: "Full Legal Name", value: "Anh Thi Tran", filled: true, required: true },
  { label: "Date of Birth", value: "03/14/1992", filled: true, required: true },
  { label: "Country of Birth", value: "Vietnam", filled: true, required: true },
  { label: "Alien Registration #", value: "", filled: false, required: true },
  { label: "Entry Date (mm/dd/yyyy)", value: "", filled: false, required: true },
  { label: "Current Immigration Status", value: "F-1 Student", filled: true, required: true },
  { label: "Signature", value: "", filled: false, required: true },
];

const TERM_HINTS = [
  {
    term: "Alien Registration Number",
    plain: "Your USCIS ID. It starts with 'A' and has 9 digits. Found on your I-94 or visa documents.",
  },
  {
    term: "Adjustment of Status",
    plain: "Changing your visa type to a Green Card without leaving the US.",
  },
];

export function ActionSpace() {
  const [tabs, setTabs] = useState<BrowserTab[]>(MOCK_TABS);
  const [showTermHints, setShowTermHints] = useState(true);
  const [formAssistStatus] = useState<"idle" | "filling" | "done">("done");

  const activeTab = tabs.find((t) => t.active);
  const filledCount = MOCK_FORM_FIELDS.filter((f) => f.filled).length;
  const totalCount = MOCK_FORM_FIELDS.length;

  return (
    <div className="flex w-[380px] flex-col border-l border-white/5 bg-[#1a1a2e]">
      {/* Action Space header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Action Space</span>
          <span className="rounded bg-indigo-600/20 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400 uppercase">
            Selenium Stage
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded p-1 text-white/30 hover:text-white/60">
            <Shield className="h-4 w-4" />
          </button>
          <button className="rounded p-1 text-white/30 hover:text-white/60">
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Browser chrome */}
      <div className="shrink-0 border-b border-white/5 bg-[#16162a]">
        {/* Tabs row */}
        <div className="flex items-center gap-1 overflow-x-auto px-2 pt-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() =>
                setTabs(tabs.map((t) => ({ ...t, active: t.id === tab.id })))
              }
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 py-1.5 text-xs transition-colors",
                tab.active
                  ? "border-white/10 bg-[#1a1a2e] text-white"
                  : "border-transparent text-white/40 hover:text-white/60",
              )}
            >
              <span>{tab.favicon}</span>
              <span className="max-w-[100px] truncate">{tab.label}</span>
              <X className="h-3 w-3 opacity-40 hover:opacity-100" />
            </button>
          ))}
          <button className="shrink-0 rounded p-1 text-white/30 hover:text-white/60">
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* URL bar */}
        <div className="flex items-center gap-2 px-3 pb-2">
          <button className="text-white/30 hover:text-white/60">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button className="text-white/30 hover:text-white/60">
            <ArrowRight className="h-4 w-4" />
          </button>
          <button className="text-white/30 hover:text-white/60">
            <RefreshCw className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1">
            <Shield className="h-3 w-3 shrink-0 text-emerald-400" />
            <span className="flex-1 truncate text-xs text-white/50">
              https://{activeTab?.url}
            </span>
          </div>
          <button className="text-white/30 hover:text-white/60">
            <Chrome className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main content: scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Form assist panel */}
        <div className="border-b border-white/5 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-orange-400" />
              <span className="text-xs font-semibold text-orange-400">Form assist</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/40">
                {filledCount}/{totalCount} fields
              </span>
              {formAssistStatus === "done" && (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              )}
              {formAssistStatus === "filling" && (
                <Loader2 className="h-3.5 w-3.5 text-orange-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-orange-500 transition-all duration-500"
              style={{ width: `${(filledCount / totalCount) * 100}%` }}
            />
          </div>

          {/* Form fields */}
          <div className="space-y-1.5">
            {MOCK_FORM_FIELDS.map((field) => (
              <div
                key={field.label}
                className={cn(
                  "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                  field.filled
                    ? "border-orange-500/20 bg-orange-600/5"
                    : "border-white/5 bg-white/3",
                )}
              >
                <span
                  className={cn(
                    "truncate mr-2",
                    field.required ? "text-white/70" : "text-white/40",
                  )}
                >
                  {field.label}
                  {field.required && (
                    <span className="ml-0.5 text-orange-400">*</span>
                  )}
                </span>
                {field.filled ? (
                  <span className="shrink-0 text-orange-300 font-mono text-[10px]">
                    {field.value}
                  </span>
                ) : (
                  <span className="shrink-0 rounded border border-dashed border-white/15 px-1.5 py-0.5 text-[10px] text-white/25">
                    Needs input
                  </span>
                )}
              </div>
            ))}
          </div>

          <button className="mt-2 w-full rounded-md bg-orange-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50">
            Review & Submit →
          </button>
        </div>

        {/* Plain-language terms */}
        <div className="border-b border-white/5 p-3">
          <button
            onClick={() => setShowTermHints(!showTermHints)}
            className="flex w-full items-center justify-between"
          >
            <div className="flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">
                Plain-language terms
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 text-white/30 transition-transform",
                !showTermHints && "-rotate-90",
              )}
            />
          </button>

          {showTermHints && (
            <div className="mt-2 space-y-2">
              {TERM_HINTS.map((item) => (
                <div
                  key={item.term}
                  className="rounded-md border border-emerald-500/20 bg-emerald-600/5 p-2"
                >
                  <p className="text-[11px] font-semibold text-emerald-400">
                    {item.term}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/60 leading-relaxed">
                    {item.plain}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Co-pilot controls */}
        <div className="p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white/50">
            <Globe className="h-3.5 w-3.5" />
            Co-Pilot Mode
          </p>
          <div className="space-y-1.5">
            <button className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/50 transition-colors hover:border-indigo-500/40 hover:bg-indigo-600/10 hover:text-white/80">
              Invite a Guide to co-control this browser →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
