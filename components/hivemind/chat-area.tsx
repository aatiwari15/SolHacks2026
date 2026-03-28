"use client";

import { useRef, useState } from "react";
import { cn } from "@/utils/cn";
import {
  AtSign,
  Hash,
  ImagePlus,
  Mic,
  Phone,
  Pin,
  Search,
  Send,
  Smile,
  Users,
  Video,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { MessageBubble, type Message } from "./message-bubble";

// ---------------------------------------------------------------------------
// Mock messages for UI demonstration
// ---------------------------------------------------------------------------
const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    author: { type: "user", name: "Maria G.", initials: "MG", role: "Guide" },
    content:
      "Welcome! I can help you understand the I-485 form. I went through this process last year.",
    timestamp: "Today at 10:02 AM",
  },
  {
    id: "2",
    author: { type: "user", name: "Anh T.", initials: "AT", role: "Learner" },
    content:
      "I don't understand what 'adjustment of status' means. The form is very confusing.",
    timestamp: "Today at 10:04 AM",
  },
  {
    id: "3",
    author: { type: "user", name: "Maria G.", initials: "MG", role: "Guide" },
    content:
      '"Adjustment of Status" means you are changing your immigration category from a temporary visa (like a tourist or student visa) to a permanent resident (Green Card holder) while staying inside the United States.',
    timestamp: "Today at 10:04 AM",
    tags: ["Legal Jargon", "I-485", "Green Card"],
    translation:
      '"Điều chỉnh tình trạng" có nghĩa là bạn đang thay đổi danh mục nhập cư của mình để trở thành thường trú nhân.',
  },
  {
    id: "4",
    author: { type: "user", name: "Anh T.", initials: "AT", role: "Learner" },
    content: "Thank you! Can someone help me fill out section 2? I'm at the DMV website now.",
    timestamp: "Today at 10:07 AM",
  },
  {
    id: "5",
    author: { type: "user", name: "Maria G.", initials: "MG", role: "Guide" },
    content:
      "I'm looking at the DMV form in the Action Space. We can walk through name, date of birth, and address from your profile — review everything before you submit.",
    timestamp: "Today at 10:07 AM",
  },
  {
    id: "6",
    author: { type: "user", name: "Maria G.", initials: "MG", role: "Guide" },
    content:
      "Whenever you're ready, we can do a short practice round for the DMV interview — I can play the officer and you practice your answers.",
    timestamp: "Today at 10:09 AM",
  },
  {
    id: "7",
    author: { type: "user", name: "Maria G.", initials: "MG", role: "Guide" },
    content:
      "Great job everyone. Anh, the key phrase they'll ask is: 'What is your primary residence?' — just give your home address.",
    timestamp: "Today at 10:11 AM",
  },
];

type ChatAreaProps = {
  channelName: string;
  showActionSpace: boolean;
  onToggleActionSpace: () => void;
};

export function ChatArea({
  channelName,
  showActionSpace,
  onToggleActionSpace,
}: ChatAreaProps) {
  const [inputValue, setInputValue] = useState("");
  const [messages] = useState<Message[]>(MOCK_MESSAGES);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    // TODO: connect to real message sending logic
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#23233a]">
      {/* Channel header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/5 px-4">
        <div className="flex items-center gap-2">
          <Hash className="h-5 w-5 text-white/40" />
          <span className="font-semibold text-white">{channelName}</span>
          <Separator orientation="vertical" className="h-4 bg-white/10 mx-1" />
          <span className="text-sm text-white/40 hidden md:block">
            Immigration & language support community
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded p-2 text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors">
            <Phone className="h-4 w-4" />
          </button>
          <button className="rounded p-2 text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors">
            <Video className="h-4 w-4" />
          </button>
          <button className="rounded p-2 text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors">
            <Pin className="h-4 w-4" />
          </button>
          <button
            onClick={onToggleActionSpace}
            className={cn(
              "rounded p-2 transition-colors",
              showActionSpace
                ? "bg-indigo-600/20 text-indigo-400"
                : "text-white/40 hover:bg-white/10 hover:text-white/80",
            )}
            title="Toggle Action Space"
          >
            <Users className="h-4 w-4" />
          </button>
          <button className="rounded p-2 text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors">
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Channel intro */}
        <div className="px-4 pb-4 pt-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600/20">
            <Hash className="h-6 w-6 text-indigo-400" />
          </div>
          <h2 className="mt-2 text-xl font-bold text-white">#{channelName}</h2>
          <p className="text-sm text-white/50">
            This is the beginning of #{channelName}. A safe space to ask questions,
            share experiences, and get help from the community.
          </p>
        </div>
        <Separator className="mx-4 mb-4 bg-white/5" />

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input area */}
      <div className="shrink-0 px-4 pb-4">
        <div className="flex items-end gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 focus-within:border-white/20 transition-colors">
          <button className="shrink-0 p-1 text-white/30 hover:text-white/60 transition-colors">
            <ImagePlus className="h-5 w-5" />
          </button>

          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-white placeholder-white/25 outline-none"
            style={{ maxHeight: "120px" }}
          />

          <div className="flex shrink-0 items-center gap-1">
            <button className="p-1 text-white/30 hover:text-white/60 transition-colors">
              <AtSign className="h-4 w-4" />
            </button>
            <button className="p-1 text-white/30 hover:text-white/60 transition-colors">
              <Smile className="h-4 w-4" />
            </button>
            <button className="p-1 text-white/30 hover:text-white/60 transition-colors">
              <Mic className="h-4 w-4" />
            </button>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className={cn(
                "rounded p-1 transition-colors",
                inputValue.trim()
                  ? "text-indigo-400 hover:text-indigo-300"
                  : "text-white/20 cursor-not-allowed",
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
