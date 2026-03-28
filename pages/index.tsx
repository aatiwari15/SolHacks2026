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
      <ServerSidebar />

      <ChannelSidebar activeChannelName={ACTIVE_CHANNEL} />

      <ChatArea
        channelName={ACTIVE_CHANNEL}
        showActionSpace={showActionSpace}
        onToggleActionSpace={() => setShowActionSpace((v) => !v)}
      />

      {showActionSpace && <ActionSpace />}
    </div>
  );
}
