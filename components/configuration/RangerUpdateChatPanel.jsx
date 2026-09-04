"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { ChevronRight, SendHorizontal, Wrench } from "lucide-react";
import { useCustomSelector } from "@/customHooks/customSelector";
import { getAuthToken } from "@/utils/interceptor";
import ReactMarkdown from "../LazyMarkdown";
import { mdComponentsDark, mdProseClass, mdRemarkPlugins } from "@/utils/markdownComponents";
import { applyRangerUpdates, targetForTool, UPDATE_TARGET } from "./chatUpdateTargets";

const STARTERS = ["Rename it to Support Ranger", "Give it a shorter name", "What is this ranger called?"];

let messageSeq = 0;
const nextMessageId = () => {
  messageSeq += 1;
  return `ru-${messageSeq}`;
};

const nowLabel = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * The agent is asked for a structured reply, but a plain-prose turn is just as valid and
 * far more common once it is only asking a question. Rendering the raw JSON would be the
 * worst of both, so an object with a `response` string is unwrapped and anything else is
 * shown as written.
 */
const displayText = (raw) => {
  const text = (raw || "").trim();
  if (!text.startsWith("{")) return text;
  try {
    const parsed = JSON.parse(text);
    return typeof parsed?.response === "string" ? parsed.response : text;
  } catch {
    // Mid-stream this is a half-written object; hold it back rather than flashing braces.
    return "";
  }
};

/**
 * Targets the agent declared in a structured reply.
 *
 * Belt and braces alongside the tool events: an agent whose response format is `text`
 * declares nothing and is refreshed purely off its tool calls, while one with a
 * json_schema can also name what it touched. Unknown targets are dropped rather than
 * trusted, so a typo agent-side is inert instead of throwing.
 */
const declaredChanges = (raw) => {
  const text = (raw || "").trim();
  if (!text.startsWith("{")) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed?.changes)) return [];
    return parsed.changes
      .filter((change) => change?.status === "success" && UPDATE_TARGET[change.target])
      .map((change) => ({ target: change.target, status: "success" }));
  } catch {
    return [];
  }
};

/** One tool call, rendered like the playground's — name, args, and how it ended. */
const ToolCallChip = ({ call }) => (
  <div className="rg-chat-trace" data-testid={`ranger-update-tool-${call.name}`}>
    <Wrench size={11} className="opacity-70" />
    <span className="font-semibold">{call.name}</span>
    <span>{call.status === "calling" ? "running…" : call.status === "failed" ? "failed" : "done"}</span>
  </div>
);

/**
 * "Update the ranger" — the chat that edits this agent instead of talking to it.
 *
 * The agent does the writing itself (its tools call the GTWY APIs as the signed-in
 * user), so this panel's job after each turn is to bring the left pane back in sync.
 * What to refresh is derived from the stream's tool_result events — a tool that
 * demonstrably ran — not from the agent's own account of what it did.
 */
const RangerUpdateChatPanel = ({ bridgeId, versionId, onChannelsChanged, idPrefix = "ranger-update" }) => {
  const dispatch = useDispatch();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState("");
  /**
   * Bumped by the header's "New thread" button. It is part of the thread id, so a reset
   * gives the agent a genuinely fresh conversation rather than just clearing the screen
   * while it keeps answering with the old context.
   */
  const [threadSeq, setThreadSeq] = useState(0);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const bridgeName = useCustomSelector((state) => state?.bridgeReducer?.allBridgesMap?.[bridgeId]?.name || "");
  const agentInitial = (bridgeName || "R").trim().charAt(0).toUpperCase();

  /** One thread per version, so switching versions does not inherit the other's context. */
  const threadId = useMemo(
    () => `ranger-update-${versionId || "unknown"}${threadSeq ? `-${threadSeq}` : ""}`,
    [versionId, threadSeq]
  );

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages]);

  // Raised by the tab bar's "New thread" button, which is not an ancestor of this pane.
  useEffect(() => {
    const startNewThread = () => {
      setMessages([]);
      setSendError("");
      setInput("");
      setThreadSeq((seq) => seq + 1);
    };
    window.addEventListener("gtwy:new-ranger-update-thread", startNewThread);
    return () => window.removeEventListener("gtwy:new-ranger-update-thread", startNewThread);
  }, []);

  /** Replaces the in-flight assistant message; called on every delta. */
  const patchLast = useCallback((messageId, patch) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...patch } : m)));
  }, []);

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;
      if (!versionId) {
        setSendError("Open a draft version before updating the ranger from chat.");
        return;
      }

      setSendError("");
      setInput("");
      const replyId = nextMessageId();
      setMessages((prev) => [
        ...prev,
        { id: nextMessageId(), sender: "user", content: trimmed, time: nowLabel() },
        { id: replyId, sender: "assistant", content: "", time: nowLabel(), isLoading: true, toolCalls: [] },
      ]);
      setIsSending(true);

      // Tool calls seen this turn, so the refresh runs once at the end rather than
      // mid-stream while the agent may still be working.
      const firedTools = [];
      let raw = "";

      try {
        const token = getAuthToken();
        const res = await fetch("/api/ranger-ai/update", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
          body: JSON.stringify({ message: trimmed, thread_id: threadId, agent_id: bridgeId, version_id: versionId }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "The assistant did not respond. Try again.");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // The last piece may be a partial line; it is completed by the next chunk.
          buffer = lines.pop();

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine.startsWith("data:")) continue;
            const payload = trimmedLine.slice(5).trim();
            if (!payload) continue;

            let parsed;
            try {
              parsed = JSON.parse(payload);
            } catch {
              continue;
            }

            if (parsed.event === "delta") {
              raw += parsed.content || "";
              patchLast(replyId, { content: displayText(raw), isLoading: false });
            } else if (parsed.event === "tool_call") {
              firedTools.push({ name: parsed.name, status: "calling" });
              patchLast(replyId, { toolCalls: [...firedTools] });
            } else if (parsed.event === "tool_result") {
              const entry = firedTools.find((t) => t.name === parsed.name && t.status === "calling");
              if (entry) entry.status = "done";
              patchLast(replyId, { toolCalls: [...firedTools] });
            } else if (parsed.event === "error") {
              throw new Error(parsed.error || parsed.content || "The assistant hit an error.");
            }
          }
        }

        const finalText = displayText(raw);
        patchLast(replyId, {
          content: finalText || "Done.",
          isLoading: false,
        });

        // A tool that ran is what invalidates the screen — dedupe by target so two
        // calls to the same tool cause one refetch.
        const fromTools = firedTools
          .filter((tool) => tool.status === "done" && targetForTool(tool.name))
          .map((tool) => ({ target: targetForTool(tool.name), status: "success" }));
        // applyRangerUpdates de-dupes by target, so overlap between the two sources
        // costs nothing.
        applyRangerUpdates([...fromTools, ...declaredChanges(raw)], {
          dispatch,
          bridgeId,
          versionId,
          onChannelsChanged,
        });
      } catch (err) {
        setSendError(err?.message || "Something went wrong. Try again.");
        setMessages((prev) => prev.filter((m) => m.id !== replyId));
      } finally {
        setIsSending(false);
      }
    },
    [bridgeId, dispatch, isSending, onChannelsChanged, patchLast, threadId, versionId]
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    send(input);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send(input);
    }
  };

  return (
    <div id={`${idPrefix}-pane`} data-testid="ranger-update-pane" className="rg-chat-pane flex min-h-0 flex-1 flex-col">
      <div
        ref={listRef}
        data-testid="ranger-update-messages"
        className="rg-chat-scroll flex w-full min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto overflow-x-hidden"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-1 items-center justify-center p-2">
            <div className="rg-chat-card">
              <div className="rg-chat-card-head">
                <span className="rg-chat-card-avatar">{agentInitial}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-base-content">
                    {bridgeName || "This ranger"}
                  </span>
                  <span className="rg-chat-eyebrow block">ready to update</span>
                </span>
                <span className="rg-chat-live" aria-hidden="true" />
              </div>

              <div className="p-4">
                <div className="rg-chat-eyebrow pb-2.5">Try one</div>
                <div className="flex flex-col gap-1.5">
                  {STARTERS.map((starter, index) => (
                    <button
                      key={starter}
                      type="button"
                      data-testid={`ranger-update-starter-${index}`}
                      className="rg-chat-starter transition-colors duration-150"
                      onClick={() => send(starter)}
                    >
                      <ChevronRight size={14} className="flex-none opacity-40" />
                      <span className="min-w-0 flex-1">{starter}</span>
                    </button>
                  ))}
                </div>
                <div className="pt-3 text-[11.5px] leading-relaxed text-soft">
                  Changes here are written to this draft version straight away.
                </div>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const isMine = message.sender === "user";
            return (
              <div
                key={message.id}
                data-testid={`ranger-update-message-${message.id}`}
                className={`rg-chat-row ${isMine ? "rg-chat-row-mine mt-2" : ""}`}
              >
                <div className={`flex w-full flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div className="rg-chat-sender">
                    <span className={`rg-chat-avatar ${isMine ? "rg-chat-avatar-mine" : ""}`} aria-hidden="true">
                      {isMine ? "Y" : agentInitial}
                    </span>
                    <span>{isMine ? "you" : bridgeName || "ranger"}</span>
                    <time className="whitespace-nowrap opacity-70">{message.time}</time>
                  </div>

                  <div
                    className={`flex w-full min-w-0 max-w-[720px] gap-2 ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex flex-col ${isMine ? "w-fit max-w-[78%] shrink-0" : "w-full min-w-0"}`}>
                      {message.toolCalls?.map((call, index) => (
                        <ToolCallChip key={`${call.name}-${index}`} call={call} />
                      ))}

                      {message.isLoading && !message.content ? (
                        <div className="rg-chat-bubble flex items-center gap-2 text-soft">
                          <span className="loading loading-dots loading-xs" />
                        </div>
                      ) : (
                        <div
                          className={`relative justify-start ${
                            isMine
                              ? "rg-chat-bubble rg-chat-bubble-mine !max-w-full whitespace-pre-wrap"
                              : `${message.content ? "rg-chat-bubble" : ""} !max-w-full`
                          }`}
                        >
                          {isMine ? (
                            message.content
                          ) : (
                            <div className={mdProseClass.dark}>
                              <ReactMarkdown components={mdComponentsDark} remarkPlugins={mdRemarkPlugins}>
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {sendError && (
        <p data-testid="ranger-update-error" className="border-t border-line px-[18px] py-2 text-[11.5px] text-error">
          {sendError}
        </p>
      )}

      <form onSubmit={handleSubmit} className="rg-chat-composer">
        <div className="flex items-end gap-[9px]">
          {/* Never disabled while a turn is in flight — same as the playground: the user
              can keep typing their next message while the agent is still answering. */}
          <textarea
            ref={inputRef}
            rows={1}
            data-testid="ranger-update-input"
            className="rg-chat-input max-h-[200px] w-full overflow-y-auto"
            placeholder="Type here"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onInput={(event) => {
              event.target.style.height = "auto";
              event.target.style.height = `${Math.min(event.target.scrollHeight, 200)}px`;
            }}
          />
          <button
            type="submit"
            data-testid="ranger-update-send"
            className={`rg-chat-send transition-opacity duration-200 ${
              isSending ? "cursor-not-allowed" : "hover:opacity-90"
            }`}
            disabled={isSending || !input.trim()}
          >
            {isSending ? <span className="rg-spinner" /> : <SendHorizontal size={15} />}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RangerUpdateChatPanel;
