import { cn } from "@/utils/cn";
import {
  Globe,
  Home,
  Plus,
  Settings,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

type Server = {
  id: string;
  label: string;
  initials: string;
  color: string;
  active?: boolean;
};

const SERVERS: Server[] = [
  { id: "home", label: "Home", initials: "H", color: "bg-indigo-600", active: true },
  { id: "uscis", label: "USCIS Help", initials: "US", color: "bg-blue-700" },
  { id: "dmv", label: "DMV Corner", initials: "DM", color: "bg-emerald-700" },
  { id: "esl", label: "ESL Practice", initials: "ESL", color: "bg-orange-700" },
  { id: "bank", label: "Banking Guide", initials: "BK", color: "bg-purple-700" },
];

type ServerIconProps = {
  server: Server;
  onClick?: () => void;
};

function ServerIcon({ server, onClick }: ServerIconProps) {
  return (
    <div className="group relative flex items-center" onClick={onClick}>
      {/* Active pill indicator */}
      <div
        className={cn(
          "absolute -left-3 w-1 rounded-r-full bg-white transition-all duration-200",
          server.active ? "h-8" : "h-0 group-hover:h-5",
        )}
      />
      <button
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-2xl text-xs font-bold text-white transition-all duration-200 group-hover:rounded-xl",
          server.color,
          server.active && "rounded-xl",
        )}
        title={server.label}
      >
        {server.id === "home" ? <Home className="h-5 w-5" /> : server.initials}
      </button>
    </div>
  );
}

export function ServerSidebar() {
  return (
    <div className="flex w-[72px] flex-col items-center gap-2 bg-[#1a1a2e] py-3">
      {/* HiveMind logo */}
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 hover:rounded-xl transition-all duration-200">
        <Globe className="h-6 w-6 text-white" />
      </div>

      <Separator className="w-8 bg-white/10" />

      <div className="flex flex-col items-center gap-2 overflow-y-auto">
        {SERVERS.map((s) => (
          <ServerIcon key={s.id} server={s} />
        ))}
      </div>

      <Separator className="w-8 bg-white/10" />

      {/* Add server */}
      <button className="group flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-emerald-400 transition-all duration-200 hover:rounded-xl hover:bg-emerald-600 hover:text-white">
        <Plus className="h-5 w-5" />
      </button>

      {/* Settings at bottom */}
      <div className="mt-auto">
        <button className="flex h-10 w-10 items-center justify-center rounded-xl text-white/40 transition-colors hover:bg-white/10 hover:text-white/80">
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
