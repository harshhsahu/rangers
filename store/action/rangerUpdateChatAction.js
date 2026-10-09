import { addUserMessage, addAssistantMessage, addToolCallToMessage, editMessage } from "../reducer/chatReducer";
import { addChatErrorMessage, setChatLoading } from "./chatAction";
import { getAuthToken } from "@/utils/interceptor";
import { getLocalTimezone } from "@/utils/timezoneData";
import { toast } from "@/utils/toast";
import unsavedPromptGuard from "@/utils/unsavedPromptGuard";
import {
  applyRangerUpdates,
  isReadOnlyTool,
  targetForTool,
  TARGET_LABEL,
  UPDATE_TARGET,
} from "@/components/configuration/chatUpdateTargets";

/**
 * The "update the ranger" half of the ranger chat.
 *
 * It used to be a chat of its own, with its own message list. It now writes into the same redux
 * channel as the playground so one window can hold both, in the order they happened. Messages from
 * this flow carry `flow: "update"` so the window can tell whose turn it is: the ranger answers a test,
 * the helper agent answers an update.
 *
 * The agent does the writing itself (its tools call the GTWY APIs as the signed-in user), so after a
 * turn this brings the rest of the screen back in sync. What to refresh comes from the stream's
 * tool_result events — a tool that demonstrably ran — not from the agent's own account of it.
 */

const nowLabel = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

let messageSeq = 0;
const nextMessageId = (prefix) => {
  messageSeq += 1;
  return `${prefix}_${Date.now()}_${messageSeq}`;
};

/**
 * The agent is asked for a structured reply, but a plain-prose turn is just as valid and far more
 * common once it is only asking a question. Rendering the raw JSON would be the worst of both, so an
 * object with a `response` string is unwrapped and anything else is shown as written.
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
 * Belt and braces alongside the tool events: an agent whose response format is `text` declares
 * nothing and is refreshed purely off its tool calls, while one with a json_schema can also name what
 * it touched. Unknown targets are dropped rather than trusted, so a typo agent-side is inert.
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
 * The user may be reading the left pane while the agent works, so a change that only shows up as a
 * refreshed row is easy to miss. One toast per reported change, using the agent's own one-line detail.
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

/**
 * Did the tool actually succeed?
 *
 * A tool_result event only means the tool returned — it fires just the same when the API answered
 * 401. Every tool reports a false success flag and an error string when it fails, so the result body
 * is what decides, not the event.
 */
const toolSucceeded = (content) => {
  let value = content;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed.startsWith("{")) return !/^error/i.test(trimmed);
    try {
      value = JSON.parse(trimmed);
    } catch {
      return true;
    }
  }
  if (!value || typeof value !== "object") return true;
  if (value.success === false) return false;
  if (value.error) return false;
  return true;
};

/**
 * Everything the agent needs that only the store knows, read at send time rather than passed in: the
 * user can edit these in the left pane while the chat is open, and a stale copy would have the agent
 * write back entries they just deleted.
 */
const readUpdateContext = (state, { bridgeId, versionId }) => {
  const version = state?.bridgeReducer?.bridgeVersionMapping?.[bridgeId]?.[versionId];
  const orgId = state?.bridgeReducer?.allBridgesMap?.[bridgeId]?.org_id || "";
  const knowledgeBases = state?.knowledgeBaseReducer?.knowledgeBaseData?.[orgId];

  return {
    // Model lookups are scoped by category, so a non-chat ranger is not offered chat models.
    modelType: String(version?.configuration?.type || "chat").toLowerCase(),
    // What "5 pm" means to this team: the org's own zone if it has one, otherwise the browser's.
    orgTimezone: state?.userDetailsReducer?.organizations?.[orgId]?.timezone || getLocalTimezone(),
    // Only what the agent needs to resolve a name to an id — not the whole knowledge base record.
    availableKnowledgeBases: Array.isArray(knowledgeBases)
      ? knowledgeBases.map((item) => ({
          resource_id: item?._id,
          collection_id: item?.collectionId,
          name: item?.title,
          description: item?.description,
        }))
      : [],
  };
};

/**
 * Sends one message to the "Update the ranger" agent and plays the turn into the chat channel.
 *
 * The thread id is derived from the channel's own thread id, which is regenerated whenever the chat is
 * cleared — so "New thread" gives this agent a genuinely fresh conversation as well.
 */
export const sendRangerUpdateMessage =
  ({ channelId, message, bridgeId, versionId, onChannelsChanged }) =>
  async (dispatch, getState) => {
    const text = (message || "").trim();
    if (!text || !channelId) return;

    if (!versionId) {
      dispatch(addChatErrorMessage(channelId, "Open a draft version before updating the ranger from chat."));
      return;
    }

    const state = getState();
    const threadId = `ranger-update-${versionId}-${state?.chatReducer?.threadIdByChannel?.[channelId] || "main"}`;
    const context = readUpdateContext(state, { bridgeId, versionId });
    const time = nowLabel();
    const replyId = nextMessageId("ranger_update");

    dispatch(setChatLoading(channelId, true));
    dispatch(
      addUserMessage({
        channelId,
        message: {
          id: nextMessageId("user"),
          sender: "user",
          flow: "update",
          playground: true,
          time,
          // Markdown line break, as the playground's own user messages do.
          content: text.replace(/\n/g, "  \n"),
        },
      })
    );
    dispatch(
      addAssistantMessage({
        channelId,
        message: {
          id: replyId,
          sender: "assistant",
          flow: "update",
          time,
          content: "",
          isLoading: true,
          toolCalls: [],
        },
      })
    );

    const patchReply = (patch) => dispatch(editMessage({ channelId, messageId: replyId, newContent: patch }));

    // Tool calls seen this turn, so the refresh runs once at the end rather than mid-stream while the
    // agent may still be working. Copies go to the store: what it holds is frozen.
    const calls = [];
    const pushCalls = () => patchReply({ toolCalls: calls.map((call) => ({ ...call })) });
    let raw = "";

    try {
      const token = getAuthToken();
      const res = await fetch("/api/ranger-ai/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
        body: JSON.stringify({
          message: text,
          thread_id: threadId,
          agent_id: bridgeId,
          version_id: versionId,
          model_type: context.modelType,
          // The one list the pre-function cannot supply to a tool: the resources tool resolves a
          // knowledge base name to its ids from this.
          available_knowledge_bases: context.availableKnowledgeBases,
          org_timezone: context.orgTimezone,
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
            patchReply({ content: displayText(raw), isLoading: false });
          } else if (parsed.event === "tool_call") {
            const call = {
              call_id: parsed.call_id || `${parsed.name}_${calls.length}`,
              name: parsed.name,
              args: parsed.args || {},
              status: "calling",
              result: null,
            };
            calls.push(call);
            dispatch(addToolCallToMessage({ channelId, messageId: replyId, toolCall: { ...call } }));
          } else if (parsed.event === "tool_result") {
            const call =
              calls.find((c) => parsed.call_id && c.call_id === parsed.call_id) ||
              calls.find((c) => c.name === parsed.name && c.status === "calling");
            if (call) {
              call.status = "done";
              call.failed = !toolSucceeded(parsed.content);
              call.result = typeof parsed.content === "string" ? parsed.content : JSON.stringify(parsed.content ?? "");
              pushCalls();
            }
          } else if (parsed.event === "error") {
            throw new Error(parsed.error || parsed.content || "The assistant hit an error.");
          }
        }
      }

      patchReply({ content: displayText(raw) || "Done.", isLoading: false });

      // A tool that ran is what invalidates the screen — applyRangerUpdates de-dupes by target, so two
      // calls to the same tool cause one refetch.
      const fromTools = calls
        .filter((call) => call.status === "done" && !call.failed && targetForTool(call.name))
        .map((call) => ({ target: targetForTool(call.name), status: "success" }));
      const declared = declaredChanges(raw);
      // Only what the agent reported is announced: the tool-derived entries exist to drive refreshes and
      // carry no wording of their own, and the blanket fallback below is a safety net, not worth toasts.
      announceChanges(declared);

      let changes = [...fromTools, ...declared.filter((change) => change.status === "success")];

      /**
       * A tool ran but nothing named a target — the tool was renamed agent-side, or the reply was not
       * structured. Refreshing everything is a few cheap reads and far better than the alternative: the
       * agent reporting success against a screen that still shows the old value. Read-only tools are
       * excluded so a lookup that changed nothing does not flash every row.
       */
      const wroteSomething = calls.some((call) => call.status === "done" && !call.failed && !isReadOnlyTool(call.name));
      if (!changes.length && wroteSomething) {
        changes = Object.values(UPDATE_TARGET).map((target) => ({ target, status: "success" }));
        toast.success("Ranger updated");
      }

      /**
       * A version refetch replaces the prompt in redux, which is what the editor renders from. If the
       * user has typed there without saving, refreshing would discard it — so their unsaved text wins:
       * the agent's write still landed, it is just not pulled onto the screen until they save or discard.
       * Read now, not at send time — the guard flips while a turn is in flight.
       */
      const blockPrompt =
        unsavedPromptGuard.hasUnsavedChanges && changes.some((change) => change.target === UPDATE_TARGET.PROMPT);
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
      // Replaces the still-loading reply with the error row; if text had already streamed in, the error
      // follows it instead.
      dispatch(addChatErrorMessage(channelId, err?.message || "Something went wrong. Try again."));
    } finally {
      dispatch(setChatLoading(channelId, false));
    }
  };
