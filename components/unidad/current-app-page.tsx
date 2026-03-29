"use client";

import { useState } from "react";
import { ChatSidebar } from "@/components/unidad/chat-sidebar";
import { DanteFormFlow } from "@/components/unidad/dante-form-flow";
import { TaskSelector, type SelectedTask } from "@/components/unidad/task-selector";
import { WelcomeScreen } from "@/components/unidad/welcome-screen";

type AppView =
  | { type: "welcome" }
  | { type: "task-select" }
  | { type: "chat"; task: SelectedTask };

export function CurrentAppPage({
  onOpenFaq,
  onOpenProfileSettings,
}: {
  onOpenFaq: () => void;
  onOpenProfileSettings: () => void;
}) {
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
    <div className="flex h-screen w-screen overflow-hidden bg-nexus-bg">
      <ChatSidebar
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onOpenFaq={onOpenFaq}
        onOpenProfileSettings={onOpenProfileSettings}
        onSelectChat={handleSelectChat}
      />

      <main className="flex flex-1 flex-col overflow-hidden bg-[linear-gradient(to_bottom,#ffffff,#f4faf5)]">
        {view.type === "welcome" ? <WelcomeScreen onNewChat={handleNewChat} /> : null}
        {view.type === "task-select" ? <TaskSelector onStart={handleStartTask} /> : null}
        {view.type === "chat" && view.task === "dante" ? <DanteFormFlow /> : null}
        {view.type === "chat" && view.task === "habla" ? (
          <PlaceholderChat agent="habla" label="Habla · Translation Practice" />
        ) : null}
        {view.type === "chat" && view.task === "simpli" ? (
          <PlaceholderChat agent="simpli" label="Simpli · Jargon Decoder" />
        ) : null}
      </main>
    </div>
  );
}

function PlaceholderChat({ agent, label }: { agent: string; label: string }) {
  const colorClasses =
    agent === "habla" ? "text-nexus-mismo bg-nexus-mismo" : "text-nexus-simpli bg-nexus-simpli";
  const [textClassName, backgroundClassName] = colorClasses.split(" ");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top,rgba(21,128,61,0.08),transparent_42%)] px-6 text-center">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-white ${backgroundClassName}`}
      >
        {agent === "habla" ? "Ha" : "Si"}
      </div>
      <div>
        <p className={`text-base font-semibold ${textClassName}`}>{label}</p>
        <p className="mt-1 text-sm text-nexus-muted">Coming soon — this flow is being built.</p>
      </div>
    </div>
  );
}
