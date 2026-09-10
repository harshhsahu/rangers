import { NextResponse } from "next/server";
import { requireAgentAccess, errorResponse, AuthError } from "@/lib/apiAuth";
import { getRangerSchedulesCollection } from "@/lib/mongo";
import { createSchedule, sanitizeSchedule, schedulerBaseUrl } from "@/lib/rangerSchedules";

export const runtime = "nodejs";

/**
 * Schedules for one ranger version.
 *
 * Both methods are gated by `requireAgentAccess`, exactly like the channel
 * setup routes: the caller must hold a valid GTWY session and own the agent the
 * version belongs to. org_id is taken from the verified agent, never the body,
 * so a caller cannot file a schedule under someone else's org.
 *
 * These are the routes the Scheduler tab and the ranger AI's schedule tool both
 * call — there is no second path that writes schedules.
 */

/** GET /api/scheduler?agent_id=&version_id= */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agent_id");
    const versionId = url.searchParams.get("version_id");
    if (!versionId) {
      return NextResponse.json({ success: false, error: "version_id is required" }, { status: 400 });
    }

    await requireAgentAccess(request, { agentId, versionId });

    const schedules = await getRangerSchedulesCollection();
    const rows = await schedules
      .find({ version_id: String(versionId) })
      .sort({ created_at: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      // Tells the UI to explain why scheduling is unavailable rather than
      // failing on save, mirroring `channels_available` in the AI route.
      scheduler_available: Boolean(schedulerBaseUrl()),
      schedules: rows.map(sanitizeSchedule),
    });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[scheduler] list failed", error?.message || error);
    return errorResponse(error, "Could not load schedules");
  }
}

/**
 * POST /api/scheduler
 * Body: { agent_id, version_id, message, frequency, time?, weekday?,
 *         day_of_month?, minute?, cron_expression?, timezone, label?,
 *         thread_mode?, group_id? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const agentId = body?.agent_id;
    const versionId = body?.version_id;
    if (!versionId) {
      return NextResponse.json({ success: false, error: "version_id is required" }, { status: 400 });
    }

    const { orgId } = await requireAgentAccess(request, { agentId, versionId });

    const schedule = await createSchedule({
      orgId,
      agentId,
      versionId,
      // Only ever used to show who added a schedule; the token itself is not stored.
      createdBy: body?.created_by || null,
      input: body,
    });

    return NextResponse.json({ success: true, schedule }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    // A bad expression, an unknown timezone or the per-ranger cap are all the
    // caller's to fix, and the message is written for them to read.
    console.error("[scheduler] create failed", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not create the schedule" },
      { status: 400 }
    );
  }
}
