import { cn } from "@/utils/cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Brain, Eye, Tag, Zap } from "lucide-react";

export type MessageAuthor =
  | { type: "user"; name: string; initials: string; role: "Guide" | "Learner" }
  | { type: "agent"; agent: "dante" | "mismo" | "simpli" };

export type Message = {
  id: string;
  author: MessageAuthor;
  content: string;
  timestamp: string;
  translation?: string;
  tags?: string[];
  agentAction?: string;
};

const AGENT_META = {
  dante: {
    name: "Dante",
    tagline: "The Doer",
    color: "bg-orange-600",
    border: "border-orange-500/30",
    bg: "bg-orange-600/5",
    icon: <Zap className="h-3.5 w-3.5" />,
    textColor: "text-orange-400",
  },
  mismo: {
    name: "Mismo",
    tagline: "The Mirror",
    color: "bg-blue-600",
    border: "border-blue-500/30",
    bg: "bg-blue-600/5",
    icon: <Eye className="h-3.5 w-3.5" />,
    textColor: "text-blue-400",
  },
  simpli: {
    name: "Simpli",
    tagline: "The Decoder",
    color: "bg-emerald-600",
    border: "border-emerald-500/30",
    bg: "bg-emerald-600/5",
    icon: <Brain className="h-3.5 w-3.5" />,
    textColor: "text-emerald-400",
  },
};

function AuthorAvatar({ author }: { author: MessageAuthor }) {
  if (author.type === "agent") {
    const meta = AGENT_META[author.agent];
    return (
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={cn("text-xs font-bold text-white", meta.color)}
        >
          {meta.name.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
    );
  }
  return (
    <Avatar className="h-8 w-8 shrink-0">
      <AvatarFallback
        className={cn(
          "text-xs font-bold text-white",
          author.role === "Guide" ? "bg-purple-700" : "bg-zinc-600",
        )}
      >
        {author.initials}
      </AvatarFallback>
    </Avatar>
  );
}

export function MessageBubble({ message }: { message: Message }) {
  const isAgent = message.author.type === "agent";
  const agentMeta =
    isAgent ? AGENT_META[(message.author as { type: "agent"; agent: "dante" | "mismo" | "simpli" }).agent] : null;

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-2 hover:bg-white/[0.02] transition-colors",
        isAgent && agentMeta && `border-l-2 ${agentMeta.border} ${agentMeta.bg}`,
      )}
    >
      <AuthorAvatar author={message.author} />

      <div className="min-w-0 flex-1">
        {/* Author row */}
        <div className="flex items-baseline gap-2 flex-wrap">
          {isAgent && agentMeta ? (
            <span className={cn("flex items-center gap-1 text-sm font-semibold", agentMeta.textColor)}>
              {agentMeta.icon}
              {agentMeta.name}
              <span className="text-xs font-normal opacity-60">· {agentMeta.tagline}</span>
            </span>
          ) : message.author.type === "user" ? (
            <span
              className={cn(
                "text-sm font-semibold",
                message.author.role === "Guide" ? "text-purple-400" : "text-white/80",
              )}
            >
              {message.author.name}
              <span className="ml-2 text-[10px] font-normal opacity-50">
                {message.author.role}
              </span>
            </span>
          ) : null}
          <span className="text-[11px] text-white/25 group-hover:text-white/40 transition-colors">
            {message.timestamp}
          </span>
        </div>

        {/* Message content */}
        <p className="mt-0.5 text-sm leading-relaxed text-white/80">{message.content}</p>

        {/* Translation overlay (Simpli) */}
        {message.translation && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-600/5 px-2 py-1.5">
            <Brain className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
            <p className="text-xs text-emerald-300/80 italic">{message.translation}</p>
          </div>
        )}

        {/* Smart tags (Simpli) */}
        {message.tags && message.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {message.tags.map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Agent action card (Dante) */}
        {message.agentAction && (
          <div className="mt-1.5 flex items-center gap-2 rounded-md border border-orange-500/20 bg-orange-600/5 px-3 py-2">
            <Zap className="h-3.5 w-3.5 shrink-0 text-orange-400" />
            <p className="text-xs text-orange-300/80">{message.agentAction}</p>
          </div>
        )}
      </div>
    </div>
  );
}
