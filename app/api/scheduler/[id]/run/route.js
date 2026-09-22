import { NextResponse } from "next/server";
import { requireAgentAccess, errorResponse, AuthError } from "@/lib/apiAuth";
import { getRangerSchedulesCollection } from "@/lib/mongo";
import { toObjectId } from "@/lib/rangerSchedules";
import { executeScheduleRun } from "@/lib/schedulerExecute";

export const runtime = "nodejs";

/**
 * POST /api/scheduler/:id/run
 *
 * Authenticated "run now" for testing. Same work as the EasyCron URL, but:
 * - requires agent access
 * - runs even when the schedule is paused (cron still skips disabled rows)
 *
 * Returns 202 immediately; last_run / run_count update when the work finishes.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const objectId = toObjectId(id);
    if (!objectId) throw new AuthError("Schedule not found", 404);

    const schedules = await getRangerSchedulesCollection();
    const row = await schedules.findOne({ _id: objectId });
    if (!row) throw new AuthError("Schedule not found", 404);

    await requireAgentAccess(request, { agentId: row.agent_id, versionId: row.version_id });

    executeScheduleRun(row).catch((error) => console.error("[scheduler] manual run crashed", error?.message || error));

    return NextResponse.json({ success: true, accepted: true, schedule: String(row._id) }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[scheduler] manual run failed", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Could not start the run" }, { status: 400 });
  }
}
