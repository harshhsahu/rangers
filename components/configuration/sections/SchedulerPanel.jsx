"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Pause, Play, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "@/utils/toast";
import { authHeaders } from "@/utils/internalAuth";
import { useCustomSelector } from "@/customHooks/customSelector";
import timezoneData, { getLocalTimezone } from "@/utils/timezoneData";
import { describeCron, nextCronRuns } from "@/lib/cronExpression";
import { useConfigurationContext } from "../ConfigurationContext";

/**
 * Scheduled runs for an existing ranger.
 *
 * A schedule is two things in two places: an EasyCron job that knows only *when*,
 * and a row in our own database that knows *what* — which ranger, which query,
 * where the answer goes. This panel only ever talks to /api/scheduler, which
 * owns both sides; nothing here knows EasyCron exists.
 *
 * The user picks a frequency and a time, never a cron expression — the server
 * compiles it. `next_runs` comes back from the server for the same reason, so
 * the times shown are the times that will actually fire.
 */

const FREQUENCIES = [
  { key: "daily", label: "Every day" },
  { key: "weekdays", label: "Weekdays (Mon–Fri)" },
  { key: "weekly", label: "Every week" },
  { key: "monthly", label: "Every month" },
  { key: "hourly", label: "Every hour" },
];

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

const emptyDraft = (timezone) => ({
  label: "",
  message: "",
  frequency: "daily",
  time: "09:00",
  weekday: 1,
  day_of_month: 1,
  minute: 0,
  timezone,
});

/** Absolute date, in the schedule's own zone — a relative "in 3h" hides mistakes. */
const formatInZone = (value, timeZone) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
};

const SchedulerPanel = () => {
  const { params, searchParams, isPublished, isEditor } = useConfigurationContext();
  const agentId = params?.id;
  const versionId = searchParams?.version;
  const isReadOnly = isPublished || !isEditor;

  const orgTimezone = useCustomSelector(
    (state) => state?.userDetailsReducer?.organizations?.[params?.org_id]?.timezone || ""
  );
  // The org's zone is what "5 pm" means to this team; the browser's is the
  // fallback so the field is never empty.
  const defaultTimezone = orgTimezone || getLocalTimezone();

  const [schedules, setSchedules] = useState([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  // The row waiting for its delete to be confirmed. Inline rather than a modal so the
  // schedule being removed stays on screen while the user decides.
  const [confirmingId, setConfirmingId] = useState(null);
  // What the busy row is doing, so the spinner can say which.
  const [busyAction, setBusyAction] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft(defaultTimezone));
  // A cadence written by the cron assistant. While it is set it replaces the preset
  // controls entirely — two sources for one schedule would leave the user guessing which
  // one is about to be saved.
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  useEffect(() => {
    setDraft((prev) => (prev.timezone ? prev : { ...prev, timezone: defaultTimezone }));
  }, [defaultTimezone]);

  const load = useCallback(async () => {
    if (!versionId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/scheduler?version_id=${encodeURIComponent(versionId)}&agent_id=${encodeURIComponent(agentId || "")}`,
        { headers: authHeaders() }
      );
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Could not load schedules");
      setSchedules(data.schedules || []);
      setAvailable(data.scheduler_available !== false);
    } catch (err) {
      console.error("Loading schedules failed", err);
      toast.error(err?.message || "Could not load schedules");
    } finally {
      setLoading(false);
    }
  }, [agentId, versionId]);

  useEffect(() => {
    load();
  }, [load]);

  // The update-ranger chat can add a schedule through the same API, so the panel
  // re-reads on its event instead of showing what it loaded with.
  useEffect(() => {
    window.addEventListener("gtwy:schedules-changed", load);
    return () => window.removeEventListener("gtwy:schedules-changed", load);
  }, [load]);

  /**
   * The cadence the assistant proposed, read in whatever timezone is currently selected.
   * Recomputed here rather than reused from the response so changing the zone after
   * generating moves the preview with it instead of leaving a stale time on screen.
   */
  const aiPreview = useMemo(() => {
    if (!aiResult?.cron_expression) return null;
    try {
      return {
        description: describeCron(aiResult.cron_expression, draft.timezone),
        nextRuns: nextCronRuns(aiResult.cron_expression, draft.timezone, 3),
      };
    } catch {
      return { description: aiResult.description, nextRuns: [] };
    }
  }, [aiResult, draft.timezone]);

  const canSave = useMemo(
    () => Boolean(draft.message.trim()) && !isReadOnly && available && !saving,
    [available, draft.message, isReadOnly, saving]
  );

  const generateCron = async () => {
    const text = aiText.trim();
    if (!text || aiBusy) return;
    setAiBusy(true);
    try {
      const res = await fetch("/api/scheduler/cron-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ agent_id: agentId, version_id: versionId, text, timezone: draft.timezone }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not read that schedule");
      setAiResult(data);
    } catch (err) {
      toast.error(err?.message || "Could not read that schedule");
    } finally {
      setAiBusy(false);
    }
  };

  const clearAi = () => {
    setAiResult(null);
    setAiText("");
  };

  const createSchedule = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch("/api/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          agent_id: agentId,
          version_id: versionId,
          label: draft.label.trim() || undefined,
          message: draft.message.trim(),
          // The generated expression wins when there is one; the preset fields are not
          // sent alongside it, so there is no question which produced the schedule.
          ...(aiResult
            ? { cron_expression: aiResult.cron_expression }
            : {
                frequency: draft.frequency,
                time: draft.time,
                weekday: Number(draft.weekday),
                day_of_month: Number(draft.day_of_month),
                minute: Number(draft.minute),
              }),
          timezone: draft.timezone,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not create the schedule");

      setSchedules((prev) => [data.schedule, ...prev]);
      setDraft(emptyDraft(draft.timezone));
      clearAi();
      toast.success(`Scheduled — ${data.schedule.description}`);
    } catch (err) {
      toast.error(err?.message || "Could not create the schedule");
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (schedule) => {
    setBusyId(schedule._id);
    setBusyAction(schedule.enabled ? "Pausing" : "Resuming");
    try {
      const res = await fetch(`/api/scheduler/${schedule._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ enabled: !schedule.enabled }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not update the schedule");
      setSchedules((prev) => prev.map((row) => (row._id === schedule._id ? data.schedule : row)));
    } catch (err) {
      toast.error(err?.message || "Could not update the schedule");
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  };

  const removeSchedule = async (schedule) => {
    setConfirmingId(null);
    setBusyId(schedule._id);
    setBusyAction("Deleting");
    try {
      const res = await fetch(`/api/scheduler/${schedule._id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not delete the schedule");
      setSchedules((prev) => prev.filter((row) => row._id !== schedule._id));
      toast.success("Schedule removed");
    } catch (err) {
      toast.error(err?.message || "Could not delete the schedule");
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  };

  if (!versionId) {
    return <p className="text-[12.5px] text-soft">Open a ranger version to schedule runs.</p>;
  }

  return (
    <div data-testid="ranger-scheduler-panel" className="flex flex-col gap-4">
      {!available && (
        <div className="flex items-start gap-2 rounded-[12px] border border-warning bg-warning/10 px-3 py-2.5">
          <AlertTriangle size={15} className="mt-0.5 flex-none text-warning" />
          <p className="text-[12px] text-base-content">
            Scheduling needs a publicly reachable URL for the cron service to call. Set{" "}
            <code className="font-mono">RANGER_PUBLIC_URL</code> — on a bare localhost server the schedule would never
            fire.
          </p>
        </div>
      )}

      <section>
        <h4 className="text-[13px] font-bold text-base-content">Scheduled runs</h4>
        <p className="mb-2 mt-0.5 text-[11.5px] text-soft">
          The ranger runs on its own on this schedule, as if the message below had arrived from a person.
        </p>

        {loading ? (
          <div className="h-16 animate-pulse rounded-[12px] border border-line bg-base-200" />
        ) : schedules.length === 0 ? (
          <div className="rounded-[12px] border-2 border-dashed border-stroke p-5 text-center text-[12px] text-soft">
            Nothing scheduled yet.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {schedules.map((schedule) => {
              const failed = schedule.last_run && schedule.last_run.ok === false;
              return (
                <div
                  key={schedule._id}
                  data-testid={`ranger-schedule-row-${schedule._id}`}
                  aria-busy={busyId === schedule._id}
                  className={`rounded-[12px] border-2 bg-card px-3 py-2.5 transition-opacity ${
                    busyId === schedule._id ? "opacity-60" : ""
                  } ${failed ? "border-error" : schedule.enabled ? "border-stroke" : "border-line opacity-70"}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-base-200 text-soft">
                      <CalendarClock size={15} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-bold text-ink">{schedule.label}</div>
                      <div className="text-[11.5px] text-soft">
                        {schedule.description}
                        {!schedule.enabled && " · paused"}
                      </div>
                      <div className="mt-1 truncate text-[11.5px] text-base-content" title={schedule.message}>
                        “{schedule.message}”
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-soft">
                        <span>
                          Next: {schedule.enabled ? formatInZone(schedule.next_runs?.[0], schedule.timezone) : "—"}
                        </span>
                        <span>
                          Last:{" "}
                          {schedule.last_run
                            ? `${formatInZone(schedule.last_run.at, schedule.timezone)} · ${
                                schedule.last_run.ok ? "ok" : "failed"
                              }`
                            : "never run"}
                        </span>
                        {schedule.run_count > 0 && <span>{schedule.run_count} runs</span>}
                      </div>
                      {failed && (
                        <p className="mt-1 text-[11px] text-error">
                          {schedule.last_run.error}
                          {schedule.fail_streak > 1 && ` (${schedule.fail_streak} in a row)`}
                        </p>
                      )}
                      {schedule.warning && <p className="mt-1 text-[11px] text-warning">{schedule.warning}</p>}
                    </div>

                    {/* Three states: working, confirming a delete, or idle. Deleting a
                        schedule cannot be undone and there is no trash to recover it
                        from, so it asks first — inline, with the schedule still on
                        screen, rather than in a modal that hides what is being removed. */}
                    <div className="flex flex-none items-center gap-1">
                      {busyId === schedule._id ? (
                        <span className="flex items-center gap-1.5 px-1 text-[11px] text-soft">
                          <span className="loading loading-spinner loading-xs" />
                          {busyAction}…
                        </span>
                      ) : confirmingId === schedule._id ? (
                        <>
                          <span className="text-[11px] font-semibold text-error">Delete?</span>
                          <button
                            type="button"
                            data-testid={`ranger-schedule-delete-cancel-${schedule._id}`}
                            className="btn btn-ghost btn-xs"
                            onClick={() => setConfirmingId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            data-testid={`ranger-schedule-delete-confirm-${schedule._id}`}
                            className="btn btn-error btn-xs"
                            onClick={() => removeSchedule(schedule)}
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            data-testid={`ranger-schedule-toggle-${schedule._id}`}
                            title={schedule.enabled ? "Pause this schedule" : "Resume this schedule"}
                            className="btn btn-ghost btn-xs btn-square"
                            disabled={isReadOnly || Boolean(busyId)}
                            onClick={() => toggleEnabled(schedule)}
                          >
                            {schedule.enabled ? <Pause size={13} /> : <Play size={13} />}
                          </button>
                          <button
                            type="button"
                            data-testid={`ranger-schedule-delete-${schedule._id}`}
                            title="Delete this schedule"
                            className="btn btn-ghost btn-xs btn-square text-error"
                            disabled={isReadOnly || Boolean(busyId)}
                            onClick={() => setConfirmingId(schedule._id)}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-[12px] border-2 border-stroke bg-card p-3">
        <h4 className="text-[13px] font-bold text-base-content">Add a schedule</h4>

        <label className="mt-2 block text-[11.5px] font-semibold text-soft" htmlFor="schedule-message">
          What should the ranger do on each run?
        </label>
        <textarea
          id="schedule-message"
          data-testid="ranger-schedule-message"
          rows={2}
          disabled={isReadOnly}
          placeholder="Fetch today's tasks and email them to the team"
          className="mt-1 w-full rounded-[9px] border-2 border-stroke bg-base-100 px-2.5 py-2 text-[12.5px] text-base-content outline-none placeholder:text-soft"
          value={draft.message}
          onChange={(event) => setDraft((prev) => ({ ...prev, message: event.target.value }))}
        />

        {/* Describe the cadence instead of assembling it. The assistant only proposes —
            the expression it returns is validated server-side and shown with its real fire
            times, so nothing is saved on the strength of the model alone. */}
        <div className="mt-3 rounded-[10px] border border-dashed border-stroke p-2.5">
          <label className="flex items-center gap-1.5 text-[11.5px] font-semibold text-soft" htmlFor="schedule-ai">
            <Sparkles size={12} />
            Describe when it should run
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id="schedule-ai"
              type="text"
              autoComplete="off"
              data-testid="ranger-schedule-ai-input"
              disabled={isReadOnly || aiBusy}
              placeholder="every weekday at 9am, or the 1st of each month"
              className="min-w-0 flex-1 rounded-[9px] border-2 border-stroke bg-base-100 px-2.5 py-1.5 text-[12.5px] text-base-content outline-none placeholder:text-soft"
              value={aiText}
              onChange={(event) => setAiText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  generateCron();
                }
              }}
            />
            <button
              type="button"
              data-testid="ranger-schedule-ai-generate"
              className="btn btn-xs gap-1"
              disabled={isReadOnly || aiBusy || !aiText.trim()}
              onClick={generateCron}
            >
              {aiBusy ? <span className="loading loading-spinner loading-xs" /> : <Sparkles size={12} />}
              {aiBusy ? "Reading" : "Generate"}
            </button>
          </div>

          {aiResult && (
            <div
              data-testid="ranger-schedule-ai-result"
              className="mt-2 flex items-start gap-2 rounded-[9px] border-2 border-success bg-base-100 px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-bold text-ink">{aiPreview?.description}</div>
                <div className="mt-0.5 font-mono text-[11px] text-soft">{aiResult.cron_expression}</div>
                <div className="mt-1 text-[11px] text-soft">
                  Next: {(aiPreview?.nextRuns || []).map((run) => formatInZone(run, draft.timezone)).join(" · ") || "—"}
                </div>
                {aiResult.warning && (
                  <p data-testid="ranger-schedule-ai-warning" className="mt-1 text-[11px] text-warning">
                    {aiResult.warning}
                  </p>
                )}
              </div>
              <button
                type="button"
                title="Use the dropdowns instead"
                data-testid="ranger-schedule-ai-clear"
                className="btn btn-ghost btn-xs btn-square"
                onClick={clearAi}
              >
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        <div className={`mt-2 flex flex-wrap items-end gap-2 ${aiResult ? "hidden" : ""}`}>
          <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-soft">
            How often
            <select
              data-testid="ranger-schedule-frequency"
              disabled={isReadOnly}
              className="rounded-[9px] border-2 border-stroke bg-base-100 px-2 py-1.5 text-[12.5px] text-base-content"
              value={draft.frequency}
              onChange={(event) => setDraft((prev) => ({ ...prev, frequency: event.target.value }))}
            >
              {FREQUENCIES.map((frequency) => (
                <option key={frequency.key} value={frequency.key}>
                  {frequency.label}
                </option>
              ))}
            </select>
          </label>

          {draft.frequency === "weekly" && (
            <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-soft">
              On
              <select
                data-testid="ranger-schedule-weekday"
                disabled={isReadOnly}
                className="rounded-[9px] border-2 border-stroke bg-base-100 px-2 py-1.5 text-[12.5px] text-base-content"
                value={draft.weekday}
                onChange={(event) => setDraft((prev) => ({ ...prev, weekday: event.target.value }))}
              >
                {WEEKDAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {draft.frequency === "monthly" && (
            <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-soft">
              Day of month
              <input
                type="number"
                min={1}
                max={28}
                data-testid="ranger-schedule-day"
                disabled={isReadOnly}
                className="w-20 rounded-[9px] border-2 border-stroke bg-base-100 px-2 py-1.5 text-[12.5px] text-base-content"
                value={draft.day_of_month}
                onChange={(event) => setDraft((prev) => ({ ...prev, day_of_month: event.target.value }))}
              />
            </label>
          )}

          {draft.frequency === "hourly" ? (
            <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-soft">
              At minute
              <input
                type="number"
                min={0}
                max={59}
                data-testid="ranger-schedule-minute"
                disabled={isReadOnly}
                className="w-20 rounded-[9px] border-2 border-stroke bg-base-100 px-2 py-1.5 text-[12.5px] text-base-content"
                value={draft.minute}
                onChange={(event) => setDraft((prev) => ({ ...prev, minute: event.target.value }))}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-[11.5px] font-semibold text-soft">
              At
              <input
                type="time"
                data-testid="ranger-schedule-time"
                disabled={isReadOnly}
                className="rounded-[9px] border-2 border-stroke bg-base-100 px-2 py-1.5 text-[12.5px] text-base-content"
                value={draft.time}
                onChange={(event) => setDraft((prev) => ({ ...prev, time: event.target.value }))}
              />
            </label>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11.5px] font-semibold text-soft">
            Timezone
            <select
              data-testid="ranger-schedule-timezone"
              disabled={isReadOnly}
              className="w-full rounded-[9px] border-2 border-stroke bg-base-100 px-2 py-1.5 text-[12.5px] text-base-content"
              value={draft.timezone}
              onChange={(event) => setDraft((prev) => ({ ...prev, timezone: event.target.value }))}
            >
              {timezoneData.map((zone) => (
                <option key={zone.identifier} value={zone.identifier}>
                  {zone.identifier} ({zone.offSet})
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11.5px] font-semibold text-soft">
            Name (optional)
            <input
              type="text"
              data-testid="ranger-schedule-label"
              disabled={isReadOnly}
              placeholder="Daily tasks mail"
              className="w-full rounded-[9px] border-2 border-stroke bg-base-100 px-2 py-1.5 text-[12.5px] text-base-content"
              value={draft.label}
              onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
            />
          </label>
        </div>

        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            data-testid="ranger-schedule-save"
            className="btn btn-primary btn-sm"
            disabled={!canSave}
            onClick={createSchedule}
          >
            {saving ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Scheduling
              </>
            ) : (
              "Schedule it"
            )}
          </button>
        </div>
      </section>
    </div>
  );
};

export default SchedulerPanel;
