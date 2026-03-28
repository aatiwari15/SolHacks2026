import { cn } from "@/utils/cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Brain, Tag } from "lucide-react";

export type MessageAuthor = {
  type: "user";
  name: string;
  initials: string;
  role: "Guide" | "Learner";
};

export type Message = {
  id: string;
  author: MessageAuthor;
  content: string;
  timestamp: string;
  translation?: string;
  tags?: string[];
};

function AuthorAvatar({ author }: { author: MessageAuthor }) {
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
  return (
    <div className="group flex gap-3 px-4 py-2 hover:bg-white/[0.02] transition-colors">
      <AuthorAvatar author={message.author} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
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
          <span className="text-[11px] text-white/25 group-hover:text-white/40 transition-colors">
            {message.timestamp}
          </span>
        </div>

        <p className="mt-0.5 text-sm leading-relaxed text-white/80">{message.content}</p>

        {message.translation && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-600/5 px-2 py-1.5">
            <Brain className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
            <p className="text-xs text-emerald-300/80 italic">{message.translation}</p>
          </div>
        )}

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
      </div>
    </div>
  );
}
