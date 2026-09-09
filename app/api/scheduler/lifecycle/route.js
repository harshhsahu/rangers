import { NextResponse } from "next/server";
import { requireAgentAccess, errorResponse, AuthError } from "@/lib/apiAuth";
import { deleteSchedulesForAgent, setSchedulesEnabledForAgent } from "@/lib/rangerSchedules";

export const runtime = "nodejs";

/**
 * POST /api/scheduler/lifecycle, taking an agent_id, an optional version_id and
 * an action of pause, resume or delete.
 *
 * Keeps schedules in step with the ranger they belong to. Two states are wrong
 * enough to be worth a dedicated route:
 *
 *  - A paused ranger whose crons still fire. The runs would go through as if
 *    nothing had changed, which is not what "paused" means to anyone.
 *  - A deleted ranger whose jobs live on. They fire forever against an agent
 *    that no longer exists, burning cron quota, and nothing in the app can find
 *    them again — the row they were reachable through is gone too.
 *
 * Delete must therefore be called *before* the agent is deleted, while the
 * caller's ownership of it can still be verified.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const agentId = body?.agent_id;
    const action = String(body?.action || "");

    if (!agentId) return NextResponse.json({ success: false, error: "agent_id is required" }, { status: 400 });
    if (!["pause", "resume", "delete"].includes(action)) {
      return NextResponse.json({ success: false, error: "action must be pause, resume or delete" }, { status: 400 });
    }

    await requireAgentAccess(request, { agentId, versionId: body?.version_id });

    if (action === "delete") {
      const result = await deleteSchedulesForAgent(agentId, { versionId: body?.version_id });
      return NextResponse.json({ success: true, ...result });
    }

    const result = await setSchedulesEnabledForAgent(agentId, action === "resume");
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[scheduler] lifecycle failed", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Could not sync schedules" }, { status: 400 });
  }
}
