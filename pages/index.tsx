"use client";

import { useState } from "react";
import { ChatSidebar } from "@/components/unidad/chat-sidebar";
import { WelcomeScreen } from "@/components/unidad/welcome-screen";
import { TaskSelector, type SelectedTask } from "@/components/unidad/task-selector";
import { DanteFormFlow } from "@/components/unidad/dante-form-flow";

type AppView =
  | { type: "welcome" }
  | { type: "task-select" }
  | { type: "chat"; task: SelectedTask };

export default function UnidadPage() {
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [view, setView] = useState<AppView>({ type: "welcome" });

  function handleNewChat() {
    setActiveChatId(null);
    setView({ type: "task-select" });
  }

  function handleSelectChat(id: string) {
    setActiveChatId(id);
    // For demo: always go to dante flow when selecting a past chat
    setView({ type: "chat", task: "dante" });
  }

  function handleStartTask(task: SelectedTask) {
    setView({ type: "chat", task });
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0d0905]">
      <ChatSidebar
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
      />

      <main className="flex flex-1 flex-col overflow-hidden bg-[#120d07]">
        {view.type === "welcome" && (
          <WelcomeScreen onNewChat={handleNewChat} />
        )}

        {view.type === "task-select" && (
          <TaskSelector onStart={handleStartTask} />
        )}

        {view.type === "chat" && view.task === "dante" && (
          <DanteFormFlow />
        )}

        {view.type === "chat" && view.task === "habla" && (
          <PlaceholderChat agent="habla" label="Habla · Translation Practice" />
        )}

        {view.type === "chat" && view.task === "simpli" && (
          <PlaceholderChat agent="simpli" label="Simpli · Jargon Decoder" />
        )}
      </main>
    </div>
  );
}

// Placeholder for Habla/Simpli flows (to be built next)
function PlaceholderChat({ agent, label }: { agent: string; label: string }) {
  const color = agent === "habla" ? "text-teal-400 bg-teal-500" : "text-lime-400 bg-lime-500";
  const [c1, c2] = color.split(" ");
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white ${c2}`}>
        {agent === "habla" ? "Ha" : "Si"}
      </div>
      <div>
        <p className={`text-base font-semibold ${c1}`}>{label}</p>
        <p className="text-sm text-[#7a6045] mt-1">Coming soon — this flow is being built.</p>
      </div>
    </div>
  );
}
