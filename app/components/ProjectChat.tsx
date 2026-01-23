"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/app/components/Button";

type ChatMessage = {
  id: string;
  body: string;
  user_id: string;
  inserted_at: string;
};

type Props = {
  projectId: string;
  userId: string | null;
  messages: ChatMessage[];
  sendMessage: (body: string) => Promise<void>;
  markRead?: () => void;
  labelForUser: (userId: string) => string;
};

export default function ProjectChat({
  projectId,
  userId,
  messages,
  sendMessage,
  markRead,
  labelForUser,
}: Props) {
  const [newMsg, setNewMsg] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to last message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    if (!newMsg.trim()) return;
    await sendMessage(newMsg.trim());
    setNewMsg("");
  }

  return (
    <div className="mt-6 border rounded-lg bg-white flex flex-col h-[420px] sm:h-[480px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-sm text-gray-600">No messages yet.</div>
        )}

        {messages.map((m) => {
          const isMine = !!userId && m.user_id === userId;

          return (
            <div
              key={m.id}
              className={`flex ${isMine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={[
                  "max-w-[85%] sm:max-w-[70%]",
                  "rounded-2xl px-3 py-2 text-sm shadow-sm",
                  "whitespace-pre-wrap break-words",
                  isMine
                    ? "bg-blue-600 text-white rounded-br-md"
                    : "bg-white text-gray-900 border rounded-bl-md",
                ].join(" ")}
              >
                <div
                  className={`text-[11px] mb-1 ${
                    isMine ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  {!isMine && (
                    <span className="font-medium text-gray-700">
                      {labelForUser(m.user_id)} ·{" "}
                    </span>
                  )}
                  {new Date(m.inserted_at).toLocaleString()}
                </div>

                {m.body}
              </div>
            </div>
          );
        })}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <div className="border-t p-3 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm min-h-[42px] max-h-[120px]
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Write a message…"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onFocus={markRead}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button onClick={handleSend}>Send</Button>
        </div>
      </div>
    </div>
  );
}
