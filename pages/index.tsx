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
    setView({ type: "chat", task: "dante" });
  }

  function handleStartTask(task: SelectedTask) {
    setView({ type: "chat", task });
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-base">
      <ChatSidebar
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
      />

      <main className="flex flex-1 flex-col overflow-hidden bg-surface-main">
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

function PlaceholderChat({ agent, label }: { agent: string; label: string }) {
  const isTeal = agent === "habla";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white ${isTeal ? "bg-teal-500" : "bg-lime-500"}`}>
        {isTeal ? "Ha" : "Si"}
      </div>
      <div>
        <p className={`text-base font-semibold ${isTeal ? "text-teal-500" : "text-lime-500"}`}>{label}</p>
        <p className="text-sm text-fg-muted mt-1">Coming soon — this flow is being built.</p>
      </div>
    </div>
  );
}
