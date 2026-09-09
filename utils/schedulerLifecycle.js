import { authHeaders } from "@/utils/internalAuth";

/**
 * Keep a ranger's schedules in step with the ranger itself.
 *
 * Best-effort by design: pausing or deleting an agent must not fail because the
 * cron service was briefly unreachable. What this cannot guarantee,
 * /api/scheduler/reconcile reports later.
 *
 * For "delete", call this *before* the agent is deleted — afterwards the server
 * can no longer verify that the caller owned it.
 */
export async function syncSchedulesForAgent(agentId, action, { versionId } = {}) {
  if (!agentId) return { success: false };
  try {
    const res = await fetch("/api/scheduler/lifecycle", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ agent_id: agentId, version_id: versionId, action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.success) console.error("Syncing schedules failed", data?.error);
    return data;
  } catch (error) {
    console.error("Syncing schedules failed", error?.message || error);
    return { success: false };
  }
}
