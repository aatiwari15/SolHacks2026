import { cn } from "@/utils/cn";
import { Bot, Brain, Eye, Zap } from "lucide-react";

export type ActiveAgent = "dante" | "mismo" | "simpli" | null;

type Agent = {
  id: ActiveAgent;
  name: string;
  tagline: string;
  icon: React.ReactNode;
  activeClass: string;
  inactiveClass: string;
  dotClass: string;
  description: string;
};

const AGENTS: Agent[] = [
  {
    id: "dante",
    name: "Dante",
    tagline: "The Doer",
    icon: <Zap className="h-4 w-4" />,
    activeClass: "bg-orange-600 text-white border-orange-500 shadow-orange-500/30 shadow-lg",
    inactiveClass:
      "border-white/10 text-white/50 hover:border-orange-500/50 hover:text-orange-400 hover:bg-orange-600/10",
    dotClass: "bg-orange-500",
    description: "Auto-fills government forms via Selenium",
  },
  {
    id: "mismo",
    name: "Mismo",
    tagline: "The Mirror",
    icon: <Eye className="h-4 w-4" />,
    activeClass: "bg-blue-600 text-white border-blue-500 shadow-blue-500/30 shadow-lg",
    inactiveClass:
      "border-white/10 text-white/50 hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-600/10",
    dotClass: "bg-blue-500",
    description: "LiveKit AI avatar for fluency roleplay",
  },
  {
    id: "simpli",
    name: "Simpli",
    tagline: "The Decoder",
    icon: <Brain className="h-4 w-4" />,
    activeClass: "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/30 shadow-lg",
    inactiveClass:
      "border-white/10 text-white/50 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-600/10",
    dotClass: "bg-emerald-500",
    description: "Decodes legal & medical jargon in real-time",
  },
];

type AgentToggleBarProps = {
  activeAgent: ActiveAgent;
  onToggle: (agent: ActiveAgent) => void;
};

export function AgentToggleBar({ activeAgent, onToggle }: AgentToggleBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
      <div className="flex items-center gap-1 mr-2">
        <Bot className="h-4 w-4 text-white/30" />
        <span className="text-xs font-medium text-white/30 uppercase tracking-wider">
          AI Agents
        </span>
      </div>

      <div className="flex gap-2">
        {AGENTS.map((agent) => {
          const isActive = activeAgent === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => onToggle(isActive ? null : agent.id)}
              title={agent.description}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                isActive ? agent.activeClass : agent.inactiveClass,
              )}
            >
              {isActive && (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full animate-pulse",
                    agent.dotClass,
                  )}
                />
              )}
              {agent.icon}
              <span>{agent.name}</span>
              <span className="hidden sm:inline opacity-60">· {agent.tagline}</span>
            </button>
          );
        })}
      </div>

      {activeAgent && (
        <div className="ml-auto flex items-center gap-1.5 text-xs text-white/40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {AGENTS.find((a) => a.id === activeAgent)?.description}
        </div>
      )}
    </div>
  );
}
