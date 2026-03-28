import { useState } from "react";
import { ServerSidebar } from "@/components/hivemind/server-sidebar";
import { ChannelSidebar } from "@/components/hivemind/channel-sidebar";
import { ChatArea } from "@/components/hivemind/chat-area";
import { ActionSpace } from "@/components/hivemind/action-space";

const ACTIVE_CHANNEL = "general-chat";

export default function HiveMindPage() {
  const [showActionSpace, setShowActionSpace] = useState(true);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#1a1a2e]">
      {/* Narrow server / app icon bar */}
      <ServerSidebar />

      {/* Channel list + member list sidebar */}
      <ChannelSidebar activeChannelName={ACTIVE_CHANNEL} />

      {/* Main chat area — fills remaining width */}
      <ChatArea
        channelName={ACTIVE_CHANNEL}
        showActionSpace={showActionSpace}
        onToggleActionSpace={() => setShowActionSpace((v) => !v)}
      />

      {/* Right pane: Action Space (Selenium Stage) — toggled by header button */}
      {showActionSpace && <ActionSpace />}
    </div>
  );
}
