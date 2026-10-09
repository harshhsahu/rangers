import { authHeaders } from "@/utils/internalAuth";

/**
 * "update" is only believed at or above this. It is the one outcome that writes real changes to the
 * ranger, so a coin-flip must not decide it: "Can you answer in Hindi?" scores 0.64 and is run as a test.
 */
export const INTENT_CONFIDENCE_THRESHOLD = 0.75;

export const ROUTE = { TEST: "test", UPDATE: "update" };

/**
 * Asks the server whether a chat message is a test run or an instruction to change the ranger.
 * Resolves to { intent, confidence }, or null when the check could not be made.
 */
export async function classifyRangerMessage({ message, agentId, versionId }) {
  try {
    const res = await fetch("/api/ranger-ai/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ message, agent_id: agentId, version_id: versionId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) return null;
    return { intent: data.intent, confidence: Number(data.confidence) || 0 };
  } catch (error) {
    console.error("ranger intent check failed", error);
    return null;
  }
}

/**
 * Which flow the conversation is in: the flow of the latest user or assistant turn, or null for an
 * empty thread. Cards, errors and tool rows are not turns. Test turns carry no marker, so anything
 * that is not an update turn is a test turn.
 */
export function lastFlowOf(messages) {
  if (!Array.isArray(messages)) return null;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.sender === "user" || message?.sender === "assistant") {
      return message.flow === ROUTE.UPDATE ? ROUTE.UPDATE : ROUTE.TEST;
    }
  }
  return null;
}

// "yes", "no", "Ranger Pro", "go ahead" — answers to the helper's question, not requests of their own.
const MAX_REPLY_WORDS = 3;

/**
 * A short message right after the helper spoke is an answer to it. On its own it means nothing — "yes"
 * scores as unsure, and even with the question attached the check misreads follow-ups, rating "and for
 * digital goods?" after a test as an update — so this is decided from where the conversation is, not by
 * the model, and costs no call. Returns null when the message is not such a reply.
 *
 * Only the update side has a shortcut: a short message after a test run can just as well be a command
 * ("Rename it"), and sending that to the playground would silently drop it.
 */
export function replyRoute(message, lastFlow) {
  if (lastFlow !== ROUTE.UPDATE) return null;
  const words = String(message || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return words.length > 0 && words.length <= MAX_REPLY_WORDS ? ROUTE.UPDATE : null;
}

/**
 * Update only when the check says so with confidence; everything else is a test. There is no third
 * outcome and nobody is asked: a test can never change the ranger, and the helper agent itself asks
 * before it writes, so defaulting to test is the cheap way to be wrong.
 *
 * The exception is mid-conversation. An unsure or failed check right after the helper spoke carries on
 * with the helper, because the message is more likely an answer to it than a fresh test.
 */
export function routeFromClassification(result, lastFlow = null) {
  if (result && result.confidence >= INTENT_CONFIDENCE_THRESHOLD && result.intent === ROUTE.UPDATE) {
    return ROUTE.UPDATE;
  }
  if (result && result.confidence >= INTENT_CONFIDENCE_THRESHOLD) return ROUTE.TEST;
  return lastFlow === ROUTE.UPDATE ? ROUTE.UPDATE : ROUTE.TEST;
}
