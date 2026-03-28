"use client";

import { cn } from "@/utils/cn";
import { MessageSquarePlus, Flame, Clock, ChevronDown, Settings, HelpCircle } from "lucide-react";
import { useAuth } from "@/lib/auth";

export type Chat = {
  id: string;
  title: string;
  preview: string;
  timestamp: string;
  agent?: "dante" | "habla" | "simpli";
};

const MOCK_CHATS: Chat[] = [
  { id: "1", title: "DMV Form — Texas", preview: "Dante filled 6/7 fields", timestamp: "Today", agent: "dante" },
  { id: "2", title: "I-485 Translation", preview: "Habla translated to Spanish", timestamp: "Today", agent: "habla" },
  { id: "3", title: "USCIS jargon decoder", preview: "12 terms decoded", timestamp: "Yesterday", agent: "simpli" },
  { id: "4", title: "Driver's license form", preview: "Dante filled 5/5 fields", timestamp: "Mar 26", agent: "dante" },
  { id: "5", title: "Bank account opening", preview: "Decoded banking terms", timestamp: "Mar 25", agent: "simpli" },
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
  const { user } = useAuth();
  const today    = MOCK_CHATS.filter((c) => c.timestamp === "Today");
  const previous = MOCK_CHATS.filter((c) => c.timestamp !== "Today");
  const initials = user?.name?.slice(0, 2).toUpperCase() || "UN";

  return (
    <aside className="flex w-72 flex-col border-r border-nexus-border bg-white/95 backdrop-blur-sm">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-nexus-accent shadow-[0_0_18px_rgba(21,128,61,0.22)]">
          <Flame className="h-4 w-4 text-white" strokeWidth={2.5} />
        </div>
        <span className="text-lg font-bold tracking-tight text-nexus-text">Unidad</span>
      </div>

      {/* New Chat button */}
      <div className="px-3 pb-3">
        <button
          onClick={onNewChat}
          className="flex w-full items-center gap-2.5 rounded-xl border border-nexus-accent/20 bg-nexus-accent/8 px-4 py-2.5 text-sm font-semibold text-nexus-accent transition-all hover:border-nexus-accent/35 hover:bg-nexus-accent/14 active:scale-[0.98]"
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
              <Clock className="h-3 w-3 text-nexus-muted" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-nexus-muted">Today</span>
            </div>
            {today.map((chat) => (
              <ChatRow key={chat.id} chat={chat} active={activeChatId === chat.id} onSelect={onSelectChat} />
            ))}
          </section>
        )}

        {previous.length > 0 && (
          <section>
            <div className="flex items-center gap-1.5 px-2 pb-1">
              <ChevronDown className="h-3 w-3 text-nexus-muted" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-nexus-muted">Previous 7 days</span>
            </div>
            {previous.map((chat) => (
              <ChatRow key={chat.id} chat={chat} active={activeChatId === chat.id} onSelect={onSelectChat} />
            ))}
          </section>
        )}
      </div>

      {/* Bottom user strip */}
      <div className="flex items-center gap-3 border-t border-nexus-border px-3 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-nexus-mismo/30 bg-nexus-mismo/12 text-xs font-bold text-nexus-mismo">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-nexus-text">{user?.name || "Guest User"}</p>
          <p className="text-[10px] text-nexus-muted">{user?.preferredLanguage || "English"} · Learner</p>
        </div>
        <button className="rounded-lg p-1 text-nexus-muted transition-colors hover:bg-nexus-card hover:text-nexus-text">
          <Settings className="h-3.5 w-3.5" />
        </button>
        <button className="rounded-lg p-1 text-nexus-muted transition-colors hover:bg-nexus-card hover:text-nexus-text">
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </aside>
  );
}

function ChatRow({
  chat,
  active,
  onSelect,
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
          ? "border border-nexus-accent/25 bg-nexus-accent/8"
          : "border border-transparent hover:bg-nexus-card",
      )}
    >
      {chat.agent && (
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", AGENT_DOT[chat.agent])} />
      )}
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", active ? "text-nexus-text" : "text-nexus-text/82")}>
          {chat.title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-nexus-muted">{chat.preview}</p>
      </div>
    </button>
  );
}
