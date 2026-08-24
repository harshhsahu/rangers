"use client";

import React, { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import {
  AI_CHAT_GREETING,
  AI_CHAT_SUGGESTIONS,
  DRAFT_CONFIG_SIDEBAR_FIELDS,
  draftFieldDisplay,
} from "./aiChatConstants";

let messageSeq = 0;
const nextMessageId = () => {
  messageSeq += 1;
  return `msg-${messageSeq}`;
};

/**
 * Chat surface for the "Build with AI" ranger wizard. Talks to a thin
 * server-side proxy in front of the GTWY chat completion API, so the real
 * pauthkey never reaches the browser.
 *
 * draftConfig is lifted to the parent (CreateRangerModal) because the
 * "Morph & Deploy" gate and the eventual form mapping both live there;
 * messages, input and the suggestion chips all stay local to this panel.
 */
const AiBuildChatPanel = ({ threadId, draftConfig, onDraftConfigChange }) => {
  const [messages, setMessages] = useState(() => [{ id: nextMessageId(), role: "agent", text: AI_CHAT_GREETING }]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const listRef = useRef(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, isSending]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    setShowSuggestions(false);
    setSendError("");
    setMessages((prev) => [...prev, { id: nextMessageId(), role: "user", text: trimmed }]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/ranger-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, thread_id: threadId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "The assistant did not respond. Try again.");
      }
      setMessages((prev) => [...prev, { id: nextMessageId(), role: "agent", text: data.response }]);
      if (data.draft_config) onDraftConfigChange(data.draft_config);
    } catch (err) {
      setSendError(err?.message || "Something went wrong. Try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    send(input);
  };

  return (
    <div data-testid="ranger-step-chat-pane" className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_220px]">
      <div className="flex h-[420px] flex-col overflow-hidden rounded-[14px] border-2 border-stroke bg-card">
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "agent" && (
                <span className="mr-2 mt-1 grid h-6 w-6 flex-none place-items-center rounded-full border-2 border-stroke bg-acc text-acc-ink">
                  <Sparkles size={12} />
                </span>
              )}
              <div
                className={`max-w-[80%] whitespace-pre-wrap rounded-[12px] px-3 py-2 text-[12.5px] leading-relaxed ${
                  message.role === "user"
                    ? "bg-acc text-acc-ink"
                    : "border-2 border-stroke bg-base-100 text-base-content"
                }`}
              >
                {message.text}
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <span className="mr-2 mt-1 grid h-6 w-6 flex-none place-items-center rounded-full border-2 border-stroke bg-acc text-acc-ink">
                <Sparkles size={12} />
              </span>
              <div className="flex items-center gap-2 rounded-[12px] border-2 border-stroke bg-base-100 px-3 py-2 text-[12px] text-soft">
                <span className="loading loading-dots loading-xs" />
                thinking
              </div>
            </div>
          )}
          {showSuggestions && !isSending && (
            <div className="flex flex-wrap gap-1.5 pl-8">
              {AI_CHAT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  data-testid="ranger-chat-suggestion"
                  onClick={() => send(suggestion)}
                  className="rounded-full border-2 border-stroke bg-base-100 px-3 py-1 text-[11.5px] text-ink transition-colors hover:border-acc"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {sendError && <p className="border-t-2 border-stroke px-4 py-2 text-[11.5px] text-error">{sendError}</p>}

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t-2 border-stroke p-3">
          <input
            type="text"
            data-testid="ranger-chat-input"
            placeholder="Type your answer..."
            className="input input-bordered input-sm w-full"
            value={input}
            disabled={isSending}
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            type="submit"
            data-testid="ranger-chat-send-button"
            className="btn btn-primary btn-sm btn-square"
            disabled={isSending || !input.trim()}
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      <div className="overflow-hidden rounded-[14px] border-2 border-stroke bg-card">
        <div className="border-b-2 border-stroke px-3 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-[.08em] text-ink">Draft Config</p>
          <p className="text-[10.5px] text-soft">Fills in as you answer</p>
        </div>
        {DRAFT_CONFIG_SIDEBAR_FIELDS.map(({ key, label }) => {
          const value = draftFieldDisplay(draftConfig, key);
          return (
            <div key={key} className="border-b-2 border-stroke px-3 py-2 last:border-b-0">
              <p className="text-[9.5px] font-bold uppercase tracking-[.08em] text-soft">{label}</p>
              <p className={`mt-0.5 truncate text-[12px] ${value ? "text-ink" : "italic text-soft"}`}>
                {value || "pending"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AiBuildChatPanel;
