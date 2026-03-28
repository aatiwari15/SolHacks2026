import { cn } from "@/utils/cn";
import {
  ChevronDown,
  Hash,
  Headphones,
  Mic,
  Phone,
  Shield,
  Video,
  Volume2,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

type Channel = {
  id: string;
  name: string;
  type: "text" | "voice" | "video";
  unread?: number;
  active?: boolean;
};

type ChannelCategory = {
  id: string;
  label: string;
  channels: Channel[];
};

const CHANNELS: ChannelCategory[] = [
  {
    id: "general",
    label: "General",
    channels: [
      { id: "welcome", name: "welcome", type: "text" },
      { id: "general", name: "general-chat", type: "text", unread: 3, active: true },
      { id: "announcements", name: "announcements", type: "text" },
    ],
  },
  {
    id: "immigration",
    label: "Immigration Help",
    channels: [
      { id: "asylum-help", name: "asylum-help", type: "text", unread: 12 },
      { id: "green-card", name: "green-card-docs", type: "text" },
      { id: "work-permits", name: "work-permits", type: "text", unread: 5 },
      { id: "uscis-forms", name: "uscis-forms", type: "text" },
    ],
  },
  {
    id: "daily-life",
    label: "Daily Life",
    channels: [
      { id: "drivers-license", name: "drivers-license", type: "text", unread: 2 },
      { id: "banking-help", name: "banking-help", type: "text" },
      { id: "medical-docs", name: "medical-docs", type: "text" },
      { id: "esl-practice", name: "esl-practice", type: "text" },
    ],
  },
  {
    id: "voice",
    label: "Voice & Video",
    channels: [
      { id: "practice-room-1", name: "Practice Room 1", type: "voice" },
      { id: "practice-room-2", name: "Practice Room 2", type: "voice" },
      { id: "mentor-session", name: "Mentor Session", type: "video" },
    ],
  },
];

const ONLINE_MEMBERS = [
  { id: "1", name: "Maria G.", role: "Guide", lang: "ES→EN" },
  { id: "2", name: "Anh T.", role: "Learner", lang: "VI→EN" },
];

function ChannelIcon({ type }: { type: Channel["type"] }) {
  if (type === "voice") return <Volume2 className="h-4 w-4 shrink-0 text-white/40" />;
  if (type === "video") return <Video className="h-4 w-4 shrink-0 text-white/40" />;
  return <Hash className="h-4 w-4 shrink-0 text-white/40" />;
}

function CategorySection({ category }: { category: ChannelCategory }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="mb-1">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center gap-1 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white/40 hover:text-white/70"
      >
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            collapsed && "-rotate-90",
          )}
        />
        {category.label}
      </button>
      {!collapsed &&
        category.channels.map((ch) => (
          <button
            key={ch.id}
            className={cn(
              "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
              ch.active
                ? "bg-white/10 text-white"
                : "text-white/50 hover:bg-white/5 hover:text-white/80",
            )}
          >
            <ChannelIcon type={ch.type} />
            <span className="flex-1 truncate text-left">{ch.name}</span>
            {ch.unread && ch.unread > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                {ch.unread}
              </span>
            )}
          </button>
        ))}
    </div>
  );
}

type ChannelSidebarProps = {
  activeChannelName: string;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ChannelSidebar({ activeChannelName: _activeChannelName }: ChannelSidebarProps) {
  return (
    <div className="flex w-60 flex-col bg-[#1e1e32] text-sm">
      {/* Server header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-4 shadow-sm">
        <span className="font-semibold text-white">HiveMind</span>
        <Shield className="h-4 w-4 text-indigo-400" />
      </div>

      {/* Channels */}
      <div className="flex-1 overflow-y-auto px-2 pt-3">
        {CHANNELS.map((cat) => (
          <CategorySection key={cat.id} category={cat} />
        ))}
      </div>

      <Separator className="bg-white/5" />

      {/* Online members */}
      <div className="px-2 py-3">
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-white/40">
          Online — {ONLINE_MEMBERS.length}
        </p>
        <div className="space-y-0.5">
          {ONLINE_MEMBERS.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-white/5"
            >
              <div className="relative">
                <Avatar className="h-7 w-7">
                  <AvatarFallback
                    className={cn(
                      "text-[10px] font-bold",
                      m.role === "Guide"
                        ? "bg-purple-700 text-white"
                        : "bg-zinc-600 text-white",
                    )}
                  >
                    {m.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                {/* Online dot */}
                <span className="absolute right-0 bottom-0 h-2 w-2 rounded-full border border-[#1e1e32] bg-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-white/70">{m.name}</p>
                <p className="text-[10px] text-white/30">{m.lang}</p>
              </div>
              {m.role === "AI" && (
                <span className="ml-auto rounded px-1 py-0.5 text-[9px] font-bold bg-white/10 text-white/40">
                  AI
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* User bar */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-t border-white/5 bg-[#16162a] px-3">
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-indigo-600 text-xs font-bold text-white">
              You
            </AvatarFallback>
          </Avatar>
          <span className="absolute right-0 bottom-0 h-2 w-2 rounded-full border border-[#16162a] bg-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-semibold text-white">You</p>
          <p className="text-[10px] text-white/40">ES → EN · Learner</p>
        </div>
        <div className="flex gap-1">
          <button className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/80">
            <Mic className="h-4 w-4" />
          </button>
          <button className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/80">
            <Headphones className="h-4 w-4" />
          </button>
          <button className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white/80">
            <Phone className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
