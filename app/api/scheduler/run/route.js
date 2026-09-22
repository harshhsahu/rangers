import { NextResponse } from "next/server";
import { getRangerSchedulesCollection } from "@/lib/mongo";
import { toObjectId } from "@/lib/rangerSchedules";
import { executeScheduleRun } from "@/lib/schedulerExecute";

export const runtime = "nodejs";

/**
 * GET /api/scheduler/run?id=<schedule_id>
 *
 * The URL handed to EasyCron. EasyCron has no session and no payload, so the
 * whole instruction is the id — everything about the run is read from the row.
 *
 * The endpoint is unauthenticated by decision: anyone who knows a schedule id
 * can trigger that schedule's run. Ids are Mongo ObjectIds, which are sequential
 * enough to enumerate from a single leaked URL, so treat the id as public and
 * keep schedules to work that is safe to run more often than planned.
 *
 * It acknowledges before it works. EasyCron gives up around 30s and marks the
 * job failed, and a failed job invites a retry that would run the ranger twice.
 * The row's `last_run` is the real record of what happened.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  const objectId = toObjectId(id);
  if (!objectId) return NextResponse.json({ success: false }, { status: 404 });

  let row;
  try {
    const schedules = await getRangerSchedulesCollection();
    row = await schedules.findOne({ _id: objectId });
  } catch (error) {
    console.error("[cron] schedule lookup failed", error?.message || error);
    return NextResponse.json({ success: false, error: "Lookup failed" }, { status: 500 });
  }

  if (!row) return NextResponse.json({ success: false }, { status: 404 });

  // Answered 200, not an error: a disabled schedule is a normal state, and an
  // error here would show up as a failing job in EasyCron's dashboard.
  if (!row.enabled) {
    return NextResponse.json({ success: true, skipped: "disabled" }, { status: 200 });
  }

  // Deliberately not awaited — the response goes out first. Node keeps the
  // handler's microtasks running after the response is flushed.
  executeScheduleRun(row).catch((error) => console.error("[cron] run crashed", error?.message || error));

  return NextResponse.json({ success: true, accepted: true, schedule: String(row._id) }, { status: 202 });
}

/** EasyCron can be configured to POST; same handling either way. */
export const POST = GET;
