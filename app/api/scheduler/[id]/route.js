import { NextResponse } from "next/server";
import { requireAgentAccess, errorResponse, AuthError } from "@/lib/apiAuth";
import { getRangerSchedulesCollection } from "@/lib/mongo";
import { deleteSchedule, sanitizeSchedule, toObjectId, updateSchedule } from "@/lib/rangerSchedules";

export const runtime = "nodejs";

/**
 * One schedule: retime it, pause it, rewrite its query, or remove it.
 *
 * Ownership is checked against the agent and version stored on the row, not
 * against ids in the request — the row is the authority on which ranger this
 * schedule belongs to, so a caller cannot pass an agent they own to reach a
 * schedule they do not.
 */
async function loadOwned(request, id) {
  const objectId = toObjectId(id);
  if (!objectId) throw new AuthError("Schedule not found", 404);

  const schedules = await getRangerSchedulesCollection();
  const row = await schedules.findOne({ _id: objectId });
  if (!row) throw new AuthError("Schedule not found", 404);

  await requireAgentAccess(request, { agentId: row.agent_id, versionId: row.version_id });
  return row;
}

/** PATCH /api/scheduler/:id — retime, relabel, rewrite, enable or disable. */
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const row = await loadOwned(request, id);
    const patch = await request.json();
    const schedule = await updateSchedule(row, patch);
    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[scheduler] update failed", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not update the schedule" },
      { status: 400 }
    );
  }
}

/** DELETE /api/scheduler/:id — removes the EasyCron job first, then the row. */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const row = await loadOwned(request, id);
    await deleteSchedule(row);
    return NextResponse.json({ success: true, deleted: String(row._id) });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[scheduler] delete failed", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not delete the schedule" },
      { status: 400 }
    );
  }
}

/** GET /api/scheduler/:id — one row, for a detail view or a tool read-back. */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const row = await loadOwned(request, id);
    return NextResponse.json({ success: true, schedule: sanitizeSchedule(row) });
  } catch (error) {
    if (!(error instanceof AuthError)) console.error("[scheduler] read failed", error?.message || error);
    return errorResponse(error, "Could not load the schedule");
  }
}
