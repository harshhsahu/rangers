import { NextResponse } from "next/server";
import { getRangerSchedulesCollection } from "@/lib/mongo";
import { listCronJobs } from "@/lib/easycron";

export const runtime = "nodejs";

/**
 * GET /api/scheduler/reconcile
 * Header: x-scheduler-admin-key: <SCHEDULER_ADMIN_KEY>
 *
 * Two systems hold half a schedule each, so they can drift — a crash between
 * the Mongo write and the EasyCron call, a job deleted by hand in their
 * dashboard. This diffs them and names the strays.
 *
 * Read-only on purpose. Deleting an unexpected job automatically is how you
 * lose a schedule to a transient list failure; this reports, a human decides.
 *
 * Not user-facing, so it is not session-authed — it spans every org. It is
 * gated by a server-side admin key and returns 404 without one.
 */
export async function GET(request) {
  const adminKey = process.env.SCHEDULER_ADMIN_KEY;
  if (!adminKey || request.headers.get("x-scheduler-admin-key") !== adminKey) {
    return NextResponse.json({ success: false }, { status: 404 });
  }

  try {
    const schedules = await getRangerSchedulesCollection();
    const rows = await schedules.find({}).toArray();
    const jobs = await listCronJobs();

    const rowsByJobId = new Map(rows.filter((row) => row.easycron_id).map((row) => [String(row.easycron_id), row]));
    const jobIds = new Set(jobs.map((job) => String(job.cron_job_id ?? job.id)));

    return NextResponse.json({
      success: true,
      totals: { rows: rows.length, jobs: jobs.length },
      // Live jobs with no row behind them: these fire at a URL we cannot serve.
      // The billable, invisible failure — delete them in EasyCron.
      orphan_jobs: jobs
        .filter((job) => !rowsByJobId.has(String(job.cron_job_id ?? job.id)))
        .map((job) => ({
          cron_job_id: String(job.cron_job_id ?? job.id),
          name: job.cron_job_name || null,
          url: job.url || null,
        })),
      // Rows whose job is gone: harmless but dead — they will never fire.
      dead_rows: rows
        .filter((row) => row.easycron_id && !jobIds.has(String(row.easycron_id)))
        .map((row) => ({ id: String(row._id), label: row.label, version_id: row.version_id })),
      // Rows that never got a job — a create that failed midway.
      pending_rows: rows
        .filter((row) => !row.easycron_id)
        .map((row) => ({ id: String(row._id), label: row.label, created_at: row.created_at })),
      // Worth a look before a user reports it.
      failing: rows
        .filter((row) => (row.fail_streak || 0) >= 3)
        .map((row) => ({
          id: String(row._id),
          label: row.label,
          fail_streak: row.fail_streak,
          error: row.last_run?.error || null,
        })),
    });
  } catch (error) {
    console.error("[scheduler] reconcile failed", error?.message || error);
    return NextResponse.json({ success: false, error: "Reconcile failed" }, { status: 500 });
  }
}
