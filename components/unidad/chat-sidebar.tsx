"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/utils/cn";
import {
  MessageSquarePlus, Flame, Clock, ChevronDown,
  Settings, HelpCircle, Sun, Moon,
} from "lucide-react";

export type Chat = {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  agent?: "dante" | "habla" | "simpli";
};

const MOCK_CHATS: Chat[] = [
  { id: "1", title: "DMV Form — Texas",      preview: "Dante filled 6/7 fields",        timestamp: "Today",    agent: "dante"  },
  { id: "2", title: "I-485 Translation",     preview: "Habla translated to Spanish",    timestamp: "Today",    agent: "habla"  },
  { id: "3", title: "USCIS jargon decoder",  preview: "12 terms decoded",               timestamp: "Yesterday",agent: "simpli" },
  { id: "4", title: "Driver's license form", preview: "Dante filled 5/5 fields",        timestamp: "Mar 26",   agent: "dante"  },
  { id: "5", title: "Bank account opening",  preview: "Decoded banking terms",          timestamp: "Mar 25",   agent: "simpli" },
];

const AGENT_DOT: Record<string, string> = {
  dante:  "bg-orange-400",
  habla:  "bg-teal-400",
  simpli: "bg-lime-400",
};

type ChatSidebarProps = {
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
};

export function ChatSidebar({ activeChatId, onSelectChat, onNewChat }: ChatSidebarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const today    = MOCK_CHATS.filter((c) => c.timestamp === "Today");
  const previous = MOCK_CHATS.filter((c) => c.timestamp !== "Today");

  return (
    <aside className="flex w-64 flex-col bg-surface-sidebar border-r border-border-base">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500">
          <Flame className="h-4 w-4 text-fg-amber-btn" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold tracking-tight text-fg-primary">Unidad</span>
      </div>

      {/* New Chat button */}
      <div className="px-3 pb-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 px-4 py-2.5 text-sm font-semibold text-amber-600 dark:text-amber-400 transition-all hover:bg-amber-500/20 hover:border-amber-500/40 hover:text-amber-700 dark:hover:text-amber-300 active:scale-[0.98]"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4">
        {today.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 px-2 pb-1">
              <Clock className="h-3 w-3 text-fg-muted" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Today</span>
            </div>
            {today.map((chat) => (
              <ChatRow key={chat.id} chat={chat} active={activeChatId === chat.id} onSelect={onSelectChat} />
            ))}
          </section>
        )}

        {previous.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 px-2 pb-1">
              <ChevronDown className="h-3 w-3 text-fg-muted" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">Previous 7 days</span>
            </div>
            {previous.map((chat) => (
              <ChatRow key={chat.id} chat={chat} active={activeChatId === chat.id} onSelect={onSelectChat} />
            ))}
          </section>
        )}
      </div>

      {/* Bottom user strip */}
      <div className="border-t border-border-base px-3 py-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20 text-xs font-bold text-amber-700 dark:text-amber-300">
          You
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-semibold text-fg-primary">Guest User</p>
          <p className="text-[10px] text-fg-muted">ES → EN · Learner</p>
        </div>

        {/* Theme toggle */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1 rounded-lg text-fg-muted hover:text-fg-secondary hover:bg-surface-active transition-colors"
            aria-label="Toggle theme"
          >
            {theme === "dark"
              ? <Sun className="h-3.5 w-3.5" />
              : <Moon className="h-3.5 w-3.5" />}
          </button>
        )}

        <button className="p-1 rounded-lg text-fg-muted hover:text-fg-secondary hover:bg-surface-active transition-colors">
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
        <button className="p-1 rounded-lg text-fg-muted hover:text-fg-secondary hover:bg-surface-active transition-colors">
          <Settings className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}

function ChatRow({
  chat, active, onSelect,
}: {
  chat: Chat;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(chat.id)}
      className={cn(
        "group flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-all",
        active
          ? "bg-surface-active border border-border-active"
          : "hover:bg-surface-card border border-transparent",
      )}
    >
      {chat.agent && (
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", AGENT_DOT[chat.agent])} />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", active ? "text-fg-primary" : "text-fg-chat-title")}>
          {chat.title}
        </p>
        <p className="truncate text-[11px] text-fg-muted mt-0.5">{chat.preview}</p>
      </div>
    </button>
  );
}
