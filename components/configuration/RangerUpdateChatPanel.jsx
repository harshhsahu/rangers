"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useDispatch } from "react-redux";
import { ChevronRight, SendHorizontal, Wrench } from "lucide-react";
import { useCustomSelector } from "@/customHooks/customSelector";
import { toast } from "@/utils/toast";
import unsavedPromptGuard from "@/utils/unsavedPromptGuard";
import { getAuthToken } from "@/utils/interceptor";
import ReactMarkdown from "../LazyMarkdown";
import { mdComponentsDark, mdProseClass, mdRemarkPlugins } from "@/utils/markdownComponents";
import { applyRangerUpdates, targetForTool, TARGET_LABEL, UPDATE_TARGET } from "./chatUpdateTargets";

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
      .filter((change) => UPDATE_TARGET[change?.target])
      .map((change) => ({
        target: change.target,
        status: change.status === "success" ? "success" : "failed",
        detail: typeof change.detail === "string" ? change.detail : "",
      }));
  } catch {
    return [];
  }
};

/**
 * The chat pane can be scrolled away from, or the user may be reading the left pane while
 * the agent works, so a change that only shows up as a refreshed row is easy to miss. One
 * toast per reported change, using the agent's own one-line detail where it wrote one.
 */
const announceChanges = (changes) => {
  changes.forEach((change) => {
    const label = TARGET_LABEL[change.target] || change.target;
    if (change.status === "success") {
      toast.success(change.detail || `${label} updated`);
    } else {
      toast.error(change.detail || `${label} could not be updated`);
    }
  });
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
   * Set by the header's "New thread" button. It is part of the thread id, so a reset
   * gives the agent a genuinely fresh conversation rather than just clearing the screen
   * while it keeps answering with the old context. Random rather than a counter, so a
   * reset after a page reload does not land back on a thread that was already used.
   */
  const [threadKey, setThreadKey] = useState("");

  const hasUnsavedPrompt = useSyncExternalStore(
    unsavedPromptGuard.subscribe,
    unsavedPromptGuard.getSnapshot,
    () => false
  );
  // Read at send time rather than render time — the guard flips while a turn is in flight.
  const hasUnsavedPromptRef = useRef(hasUnsavedPrompt);
  hasUnsavedPromptRef.current = hasUnsavedPrompt;
  const listRef = useRef(null);
  const inputRef = useRef(null);

  const bridgeName = useCustomSelector((state) => state?.bridgeReducer?.allBridgesMap?.[bridgeId]?.name || "");

  /**
   * Current MCP servers and knowledge bases, plus what the org has available to attach.
   *
   * Both are stored as whole arrays — the version API replaces `mcp_config.servers` and
   * `doc_ids` outright rather than merging — so the agent has to send every entry it
   * wants kept. Sending the current state as variables lets it do that without a read
   * tool and without a second round trip: the store already holds all of it.
   */
  const versionState = useCustomSelector((state) => {
    const version = state?.bridgeReducer?.bridgeVersionMapping?.[bridgeId]?.[versionId];
    const servers = version?.configuration?.mcp_config?.servers;
    const config = version?.configuration || {};
    // The prompt is {role, goal, instruction} on newer versions and a bare string on
    // older ones; both are passed through as written rather than coerced, so the agent
    // sees what is actually stored.
    const prompt = config.prompt;
    return {
      mcpServers: Array.isArray(servers) ? servers : [],
      docIds: Array.isArray(version?.doc_ids) ? version.doc_ids : [],
      orgId: state?.bridgeReducer?.allBridgesMap?.[bridgeId]?.org_id || "",
      promptRole: typeof prompt === "object" ? prompt?.role || "" : "",
      promptGoal: typeof prompt === "object" ? prompt?.goal || "" : "",
      promptInstruction:
        typeof prompt === "object" ? prompt?.instruction || "" : typeof prompt === "string" ? prompt : "",
      service: version?.service || "",
      model: config.model || "",
      temperature: config.temperature ?? "",
    };
  });

  /**
   * Models the org can actually use, paired with the service that serves them.
   *
   * Kept paired rather than flattened to a name list because service and model are
   * written together: moving to another provider's model without also changing `service`
   * leaves the version pointing at a model its service does not have, which fails at the
   * ranger's next message rather than at write time.
   *
   * Narrowed to the version's own model type so image and embedding models are never
   * offered as chat models.
   */
  const availableModels = useCustomSelector((state) => {
    const serviceModels = state?.modelReducer?.serviceModels || {};
    const defaults = state?.serviceReducer?.default_model || {};
    const modelType =
      state?.bridgeReducer?.bridgeVersionMapping?.[bridgeId]?.[versionId]?.configuration?.type || "chat";

    return Object.entries(serviceModels)
      .map(([service, byType]) => ({
        service,
        // The model a service falls back to when one is not chosen, matching what
        // ServiceDropdown writes on a service change — so switching provider from the
        // chat lands on the same model it would from the UI.
        default_model: defaults?.[service]?.model || null,
        models: Object.keys(byType?.[modelType] || {}),
      }))
      .filter((entry) => entry.models.length > 0);
  });

  // Only what the agent needs to resolve a name to an id — descriptions and titles, not
  // the whole knowledge base record.
  const availableKnowledgeBases = useCustomSelector((state) => {
    const list = state?.knowledgeBaseReducer?.knowledgeBaseData?.[versionState.orgId];
    if (!Array.isArray(list)) return [];
    return list.map((item) => ({
      resource_id: item?._id,
      collection_id: item?.collectionId,
      name: item?.title,
      description: item?.description,
    }));
  });
  const agentInitial = (bridgeName || "R").trim().charAt(0).toUpperCase();

  /** One thread per version, so switching versions does not inherit the other's context. */
  const threadId = useMemo(
    () => `ranger-update-${versionId || "unknown"}${threadKey ? `-${threadKey}` : ""}`,
    [versionId, threadKey]
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
      setThreadKey(Math.random().toString(36).slice(2, 10));
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
          body: JSON.stringify({
            message: trimmed,
            thread_id: threadId,
            agent_id: bridgeId,
            version_id: versionId,
            // Sent per turn rather than held server-side: the user can edit either list
            // in the left pane while the chat is open, and a stale copy would have the
            // agent write back entries the user just deleted.
            current_mcp_servers: versionState.mcpServers,
            current_doc_ids: versionState.docIds,
            available_knowledge_bases: availableKnowledgeBases,
            available_models: availableModels,
            current_prompt_role: versionState.promptRole,
            current_prompt_goal: versionState.promptGoal,
            current_prompt_instruction: versionState.promptInstruction,
            current_service: versionState.service,
            current_model: versionState.model,
            current_temperature: versionState.temperature,
          }),
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
        const declared = declaredChanges(raw);
        // Only what the agent reported is announced: the tool-derived entries exist to
        // drive refreshes and carry no wording of their own, and the blanket fallback
        // below is a safety net, not something worth four toasts.
        announceChanges(declared);

        let changes = [...fromTools, ...declared.filter((change) => change.status === "success")];

        /**
         * A tool ran but nothing named a target — the tool was renamed agent-side, or the
         * reply was not structured. Refreshing everything is a few cheap reads and is far
         * better than the alternative: the user watching the agent report success against
         * a screen that still shows the old value.
         */
        if (!changes.length && firedTools.length) {
          changes = Object.values(UPDATE_TARGET).map((target) => ({ target, status: "success" }));
          // Nothing named a target, so there is no detail to quote — but the user still
          // ran something and deserves to be told it landed.
          toast.success("Ranger updated");
        }

        /**
         * A version refetch replaces the prompt in redux, which is what the editor renders
         * from. If the user has typed there without saving, refreshing would discard it —
         * so their unsaved text wins: the agent's write still landed, it is just not
         * pulled onto the screen until they save or discard.
         */
        const blockPrompt =
          hasUnsavedPromptRef.current && changes.some((change) => change.target === UPDATE_TARGET.PROMPT);
        if (blockPrompt) {
          toast.warning("Prompt updated, but you have unsaved edits open — save or discard them to see it.");
        }

        applyRangerUpdates(changes, {
          dispatch,
          bridgeId,
          versionId,
          onChannelsChanged,
          blockedTargets: blockPrompt ? [UPDATE_TARGET.PROMPT] : [],
        });
      } catch (err) {
        setSendError(err?.message || "Something went wrong. Try again.");
        setMessages((prev) => prev.filter((m) => m.id !== replyId));
      } finally {
        setIsSending(false);
      }
    },
    [
      availableKnowledgeBases,
      availableModels,
      bridgeId,
      dispatch,
      isSending,
      onChannelsChanged,
      patchLast,
      threadId,
      versionId,
      versionState.docIds,
      versionState.mcpServers,
      versionState.model,
      versionState.promptGoal,
      versionState.promptInstruction,
      versionState.promptRole,
      versionState.service,
      versionState.temperature,
    ]
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
