"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pause, Play, Plus, Sparkles, Trash2, Wand2, X } from "lucide-react";
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
  sendToTelegram: false,
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

const actionBtnClass =
  "inline-flex items-center gap-1.5 rounded-[8px] border border-stroke bg-card px-2.5 py-1.5 text-[11.5px] font-semibold text-soft transition-colors hover:border-base-content/20 disabled:cursor-not-allowed disabled:opacity-50";

const SchedulerPanel = () => {
  const router = useRouter();
  const { params, searchParams, isPublished, isEditor } = useConfigurationContext();
  const agentId = params?.id;
  const versionId = searchParams?.version;
  const isReadOnly = isPublished || !isEditor;

  const orgTimezone = useCustomSelector(
    (state) => state?.userDetailsReducer?.organizations?.[params?.org_id]?.timezone || ""
  );
  const bridgeType = useCustomSelector(
    (state) =>
      state?.bridgeReducer?.allBridgesMap?.[params?.id]?.bridgeType ||
      state?.bridgeReducer?.allBridgesMap?.[params?.id]?.bridge_type ||
      "api"
  );
  const defaultTimezone = orgTimezone || getLocalTimezone();

  const [schedules, setSchedules] = useState([]);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [draft, setDraft] = useState(() => emptyDraft(defaultTimezone));
  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [telegramChat, setTelegramChat] = useState(null);
  const [formOpen, setFormOpen] = useState(true);
  const [editingId, setEditingId] = useState(null);
  // Per-schedule test-run banner: { [id]: "running" | "ok" | "failed" }
  const [testStatus, setTestStatus] = useState({});

  useEffect(() => {
    setDraft((prev) => (prev.timezone ? prev : { ...prev, timezone: defaultTimezone }));
  }, [defaultTimezone]);

  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;
    let timer = null;
    let attempts = 0;
    const POLL_MS = 4000;
    const MAX_ATTEMPTS = 90;

    const fetchChat = () =>
      fetch(`/api/channel-details?version_id=${encodeURIComponent(versionId)}`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((data) => {
          const chatUser = data?.data?.telegram?.chatUser || null;
          if (!cancelled) setTelegramChat(chatUser);
          return chatUser;
        })
        .catch(() => null);

    fetchChat().then((chatUser) => {
      if (cancelled || chatUser?.chat_id) return;
      timer = setInterval(async () => {
        attempts += 1;
        const polled = await fetchChat();
        if (cancelled) return;
        if (polled?.chat_id || attempts >= MAX_ATTEMPTS) {
          clearInterval(timer);
        }
      }, POLL_MS);
    });

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [versionId]);

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
      const next = data.schedules || [];
      setSchedules(next);
      setAvailable(data.scheduler_available !== false);
      if (next.length === 0) setFormOpen(true);
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

  useEffect(() => {
    window.addEventListener("gtwy:schedules-changed", load);
    return () => window.removeEventListener("gtwy:schedules-changed", load);
  }, [load]);

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

  const activeCount = useMemo(() => schedules.filter((row) => row.enabled).length, [schedules]);

  const previewLine = useMemo(() => {
    if (aiPreview?.description) return `Runs ${aiPreview.description}`;
    const freqLabel = FREQUENCIES.find((f) => f.key === draft.frequency)?.label || "Every day";
    if (draft.frequency === "hourly") {
      return `Runs ${freqLabel.toLowerCase()} at minute ${draft.minute} · ${draft.timezone}`;
    }
    return `Runs ${freqLabel.toLowerCase()} at ${draft.time} · ${draft.timezone}`;
  }, [aiPreview, draft.frequency, draft.minute, draft.time, draft.timezone]);

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

  const resetForm = () => {
    setDraft(emptyDraft(draft.timezone || defaultTimezone));
    clearAi();
    setEditingId(null);
  };

  const buildCadencePayload = () =>
    aiResult
      ? { cron_expression: aiResult.cron_expression }
      : {
          frequency: draft.frequency,
          time: draft.time,
          weekday: Number(draft.weekday),
          day_of_month: Number(draft.day_of_month),
          minute: Number(draft.minute),
        };

  const buildDeliveryPayload = () => {
    if (draft.sendToTelegram && telegramChat?.chat_id) {
      return { type: "telegram", chat_id: telegramChat.chat_id, username: telegramChat.username };
    }
    return null;
  };

  const startEdit = (schedule) => {
    setEditingId(schedule._id);
    setFormOpen(true);
    setConfirmingId(null);
    setDraft({
      ...emptyDraft(schedule.timezone || defaultTimezone),
      label: schedule.label || "",
      message: schedule.message || "",
      timezone: schedule.timezone || defaultTimezone,
      sendToTelegram: schedule.delivery?.type === "telegram",
    });
    setAiText("");
    setAiResult(
      schedule.cron_expression
        ? {
            success: true,
            cron_expression: schedule.cron_expression,
            description: schedule.description,
          }
        : null
    );
    // Scroll the form into view after paint.
    requestAnimationFrame(() => {
      document.getElementById("ranger-schedule-form")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const openRunHistory = (schedule) => {
    const threadId = schedule.last_run?.thread_id || schedule.thread_id;
    if (!threadId) {
      toast.error("No runs yet — use Test run once to create history");
      return;
    }
    const historyType = String(bridgeType).toLowerCase() === "chatbot" ? "chatbot" : "api";
    const encoded = encodeURIComponent(String(threadId).replace(/&/g, "%26"));
    router.push(
      `/agents/history/${agentId}?version=${encodeURIComponent(String(versionId || ""))}&thread_id=${encoded}&subThread_id=${encoded}&type=${historyType}`
    );
  };

  const saveSchedule = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const delivery = buildDeliveryPayload();
      if (editingId) {
        const res = await fetch(`/api/scheduler/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            label: draft.label.trim() || undefined,
            message: draft.message.trim(),
            timezone: draft.timezone,
            delivery,
            ...buildCadencePayload(),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || "Could not update the schedule");
        setSchedules((prev) => prev.map((row) => (row._id === editingId ? data.schedule : row)));
        resetForm();
        setFormOpen(false);
        toast.success(`Updated — ${data.schedule.description}`);
      } else {
        const res = await fetch("/api/scheduler", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            agent_id: agentId,
            version_id: versionId,
            label: draft.label.trim() || undefined,
            message: draft.message.trim(),
            timezone: draft.timezone,
            ...(delivery ? { delivery } : {}),
            ...buildCadencePayload(),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || "Could not create the schedule");
        setSchedules((prev) => [data.schedule, ...prev]);
        resetForm();
        setFormOpen(false);
        toast.success(`Scheduled — ${data.schedule.description}`);
      }
    } catch (err) {
      toast.error(err?.message || (editingId ? "Could not update the schedule" : "Could not create the schedule"));
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
      setSchedules((prev) => {
        const next = prev.filter((row) => row._id !== schedule._id);
        if (next.length === 0) setFormOpen(true);
        return next;
      });
      setTestStatus((prev) => {
        const next = { ...prev };
        delete next[schedule._id];
        return next;
      });
      toast.success("Schedule removed");
    } catch (err) {
      toast.error(err?.message || "Could not delete the schedule");
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  };

  const runNow = async (schedule) => {
    setBusyId(schedule._id);
    setBusyAction("Running");
    setTestStatus((prev) => ({ ...prev, [schedule._id]: "running" }));
    try {
      const res = await fetch(`/api/scheduler/${schedule._id}/run`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not start the run");
      toast.success("Run started — last run will update when it finishes");
      const delays = [2500, 6000, 12000];
      delays.forEach((ms, index) => {
        setTimeout(() => {
          load();
          if (index === delays.length - 1) {
            setTestStatus((prev) => ({ ...prev, [schedule._id]: "ok" }));
          }
        }, ms);
      });
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [schedule._id]: "failed" }));
      toast.error(err?.message || "Could not start the run");
    } finally {
      setBusyId(null);
      setBusyAction("");
    }
  };

  if (!versionId) {
    return <p className="text-[12.5px] text-soft">Open a ranger version to schedule runs.</p>;
  }

  return (
    <div data-testid="ranger-scheduler-panel" className="flex flex-col gap-3">
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

      <div className="flex flex-wrap items-center gap-2 pb-1">
        <span className="text-[13px] font-bold tracking-tight text-base-content">Active schedules</span>
        <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-success">
          {activeCount} running
        </span>
        <span className="min-w-[8px] flex-1" />
        <span className="text-[12px] text-soft">
          This ranger runs on its own, as if the message had arrived from a person.
        </span>
      </div>

      {loading ? (
        <div className="h-24 animate-pulse rounded-[13px] border border-line bg-base-200" />
      ) : schedules.length === 0 ? (
        <div className="rounded-[13px] border border-dashed border-stroke bg-base-200/40 px-4 py-8 text-center text-[12.5px] text-soft">
          Nothing scheduled yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {schedules.map((schedule) => {
            const failed = schedule.last_run && schedule.last_run.ok === false;
            const enabled = !!schedule.enabled;
            const testState = testStatus[schedule._id];
            const isBusy = busyId === schedule._id;

            return (
              <div
                key={schedule._id}
                data-testid={`ranger-schedule-row-${schedule._id}`}
                aria-busy={isBusy}
                className={`flex overflow-hidden rounded-[13px] border bg-card shadow-[0_1px_0_rgba(30,26,22,0.03)] transition-opacity ${
                  isBusy ? "opacity-70" : ""
                } ${failed ? "border-error/50" : enabled ? "border-success/30" : "border-stroke"}`}
              >
                <div className={`w-1 flex-none ${enabled ? "bg-success" : "bg-base-content/20"}`} />

                <div className="min-w-0 flex-1 px-3.5 py-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ${
                        enabled ? "bg-success/15" : "bg-base-200"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${enabled ? "bg-success" : "bg-soft"}`} />
                      <span
                        className={`text-[10.5px] font-bold tracking-wider ${enabled ? "text-success" : "text-soft"}`}
                      >
                        {enabled ? "ACTIVE" : "PAUSED"}
                      </span>
                    </span>

                    <span className="truncate text-[14.5px] font-bold tracking-tight text-ink">
                      {schedule.label || schedule.description}
                    </span>

                    <span className="min-w-[8px] flex-1" />

                    {isBusy ? (
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
                          className={actionBtnClass}
                          onClick={() => setConfirmingId(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          data-testid={`ranger-schedule-delete-confirm-${schedule._id}`}
                          className="inline-flex items-center rounded-[8px] border border-error/30 bg-error/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-error"
                          onClick={() => removeSchedule(schedule)}
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          data-testid={`ranger-schedule-run-${schedule._id}`}
                          title="Run once now, without waiting for the schedule"
                          className={actionBtnClass}
                          disabled={isReadOnly || Boolean(busyId)}
                          onClick={() => runNow(schedule)}
                        >
                          <Play size={12} className="opacity-60" />
                          Test run
                        </button>
                        <button
                          type="button"
                          data-testid={`ranger-schedule-toggle-${schedule._id}`}
                          title={enabled ? "Pause" : "Resume"}
                          className={actionBtnClass}
                          disabled={isReadOnly || Boolean(busyId)}
                          onClick={() => toggleEnabled(schedule)}
                        >
                          {enabled ? (
                            <Pause size={12} className="opacity-60" />
                          ) : (
                            <Play size={12} className="opacity-60" />
                          )}
                          {enabled ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          data-testid={`ranger-schedule-edit-${schedule._id}`}
                          title="Edit this schedule"
                          className={actionBtnClass}
                          disabled={isReadOnly || Boolean(busyId)}
                          onClick={() => startEdit(schedule)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          data-testid={`ranger-schedule-delete-${schedule._id}`}
                          title="Delete"
                          className="grid h-7 w-7 place-items-center rounded-[8px] border border-error/25 bg-error/10 text-error transition-colors hover:bg-error/15 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={isReadOnly || Boolean(busyId)}
                          onClick={() => setConfirmingId(schedule._id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-base-content">{schedule.description}</span>
                    {schedule.cron_expression && (
                      <span className="rounded-[6px] border border-stroke bg-base-200/70 px-1.5 py-0.5 font-mono text-[11px] text-soft">
                        {schedule.cron_expression}
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-soft">{schedule.timezone}</span>
                  </div>

                  <div className="mt-2.5 border-l-2 border-stroke py-0.5 pl-2.5 text-[12.5px] leading-relaxed text-base-content/80">
                    “{schedule.message}”
                  </div>

                  <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line pt-2.5">
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="text-[11px] text-soft">Next run</span>
                      <span className="font-mono text-[11.5px] font-semibold text-base-content">
                        {enabled ? formatInZone(schedule.next_runs?.[0], schedule.timezone) : "—"}
                      </span>
                    </span>
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="text-[11px] text-soft">Last run</span>
                      <span className="font-mono text-[11.5px] text-base-content">
                        {schedule.last_run
                          ? `${formatInZone(schedule.last_run.at, schedule.timezone)} · ${
                              schedule.last_run.ok ? "ok" : "failed"
                            }`
                          : "never"}
                      </span>
                    </span>
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="text-[11px] text-soft">Total</span>
                      <span className="font-mono text-[11.5px] text-base-content">
                        {schedule.run_count || 0} {(schedule.run_count || 0) === 1 ? "run" : "runs"}
                      </span>
                    </span>
                    <span className="min-w-[8px] flex-1" />
                    <button
                      type="button"
                      data-testid={`ranger-schedule-history-${schedule._id}`}
                      className="text-[11.5px] font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
                      disabled={!schedule.last_run?.thread_id && !schedule.thread_id}
                      title={
                        schedule.last_run?.thread_id || schedule.thread_id ? "Open this run in History" : "No runs yet"
                      }
                      onClick={() => openRunHistory(schedule)}
                    >
                      View run history
                    </button>
                  </div>

                  {failed && (
                    <p className="mt-2 text-[11px] text-error">
                      {schedule.last_run.error}
                      {schedule.fail_streak > 1 && ` (${schedule.fail_streak} in a row)`}
                    </p>
                  )}
                  {schedule.warning && <p className="mt-2 text-[11px] text-warning">{schedule.warning}</p>}

                  {testState && (
                    <div className="mt-2.5 flex items-center gap-2 rounded-[10px] border border-stroke bg-base-200/60 px-2.5 py-2">
                      <span
                        className={`h-1.5 w-1.5 flex-none rounded-full ${
                          testState === "running" ? "bg-warning" : testState === "failed" ? "bg-error" : "bg-success"
                        }`}
                      />
                      <span className="min-w-0 flex-1 text-[12px] text-base-content/80">
                        {testState === "running"
                          ? "Running once now with this schedule's message…"
                          : testState === "failed"
                            ? "Test run failed — check last run for details."
                            : "Test run finished — last run will refresh shortly."}
                      </span>
                      <button
                        type="button"
                        className="text-[11.5px] font-semibold text-soft hover:text-base-content"
                        onClick={() =>
                          setTestStatus((prev) => {
                            const next = { ...prev };
                            delete next[schedule._id];
                            return next;
                          })
                        }
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!formOpen && !isReadOnly && (
        <button
          type="button"
          data-testid="ranger-schedule-open-form"
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-stroke bg-base-200/50 px-3 py-3 text-[13px] font-semibold text-soft transition-colors hover:border-primary hover:text-primary"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          <Plus size={14} className="opacity-60" />
          Add another schedule
        </button>
      )}

      {formOpen && (
        <section id="ranger-schedule-form" className="mt-1 rounded-[14px] border border-stroke bg-base-200/50 p-4">
          <div className="mb-3.5 flex items-center gap-2">
            <span className="text-[13px] font-bold text-base-content">
              {editingId ? "Edit schedule" : "New schedule"}
            </span>
            <span className="flex-1" />
            {(schedules.length > 0 || editingId) && (
              <button
                type="button"
                className="text-[12px] font-semibold text-soft hover:text-base-content"
                onClick={() => {
                  resetForm();
                  setFormOpen(schedules.length === 0);
                }}
              >
                Cancel
              </button>
            )}
          </div>

          <label className="flex flex-col gap-1.5" htmlFor="schedule-message">
            <span className="text-[11.5px] font-semibold text-soft">What should the ranger do on each run?</span>
            <textarea
              id="schedule-message"
              data-testid="ranger-schedule-message"
              rows={3}
              disabled={isReadOnly}
              placeholder="Fetch today's tasks and email them to the team"
              className="w-full resize-y rounded-[10px] border border-stroke bg-card px-3 py-2.5 text-[13px] leading-relaxed text-base-content outline-none placeholder:text-soft focus:border-base-content/30"
              value={draft.message}
              onChange={(event) => setDraft((prev) => ({ ...prev, message: event.target.value }))}
            />
          </label>

          <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[11px] border border-stroke bg-card p-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5" htmlFor="schedule-ai">
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-soft">
                <Sparkles size={13} className="opacity-60" />
                Describe when it should run
              </span>
              <input
                id="schedule-ai"
                type="text"
                autoComplete="off"
                data-testid="ranger-schedule-ai-input"
                disabled={isReadOnly || aiBusy}
                placeholder="every weekday at 9am, or the 1st of each month"
                className="w-full rounded-[9px] border border-stroke bg-base-200/40 px-2.5 py-2 text-[13px] text-base-content outline-none placeholder:text-soft focus:border-base-content/30"
                value={aiText}
                onChange={(event) => setAiText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    generateCron();
                  }
                }}
              />
            </label>
            <button
              type="button"
              data-testid="ranger-schedule-ai-generate"
              className="inline-flex items-center gap-1.5 rounded-[9px] border border-stroke bg-base-200 px-3 py-2 text-[12.5px] font-semibold text-base-content disabled:opacity-50"
              disabled={isReadOnly || aiBusy || !aiText.trim()}
              onClick={generateCron}
            >
              {aiBusy ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <Wand2 size={13} className="opacity-60" />
              )}
              {aiBusy ? "Reading" : "Generate"}
            </button>
          </div>

          {aiResult && (
            <div
              data-testid="ranger-schedule-ai-result"
              className="mt-2 flex items-start gap-2 rounded-[9px] border border-success/40 bg-success/10 px-2.5 py-2"
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

          <div className={`mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3 ${aiResult ? "hidden" : ""}`}>
            <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-soft">
              How often
              <select
                data-testid="ranger-schedule-frequency"
                disabled={isReadOnly}
                className="rounded-[9px] border border-stroke bg-card px-2.5 py-2 text-[13px] font-normal text-base-content"
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
              <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-soft">
                On
                <select
                  data-testid="ranger-schedule-weekday"
                  disabled={isReadOnly}
                  className="rounded-[9px] border border-stroke bg-card px-2.5 py-2 text-[13px] font-normal text-base-content"
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
              <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-soft">
                Day of month
                <input
                  type="number"
                  min={1}
                  max={28}
                  data-testid="ranger-schedule-day"
                  disabled={isReadOnly}
                  className="rounded-[9px] border border-stroke bg-card px-2.5 py-2 text-[13px] font-normal text-base-content"
                  value={draft.day_of_month}
                  onChange={(event) => setDraft((prev) => ({ ...prev, day_of_month: event.target.value }))}
                />
              </label>
            )}

            {draft.frequency === "hourly" ? (
              <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-soft">
                At minute
                <input
                  type="number"
                  min={0}
                  max={59}
                  data-testid="ranger-schedule-minute"
                  disabled={isReadOnly}
                  className="rounded-[9px] border border-stroke bg-card px-2.5 py-2 font-mono text-[12.5px] font-normal text-base-content"
                  value={draft.minute}
                  onChange={(event) => setDraft((prev) => ({ ...prev, minute: event.target.value }))}
                />
              </label>
            ) : (
              <label className="flex flex-col gap-1.5 text-[11.5px] font-semibold text-soft">
                At
                <input
                  type="time"
                  data-testid="ranger-schedule-time"
                  disabled={isReadOnly}
                  className="rounded-[9px] border border-stroke bg-card px-2.5 py-2 font-mono text-[12.5px] font-normal text-base-content"
                  value={draft.time}
                  onChange={(event) => setDraft((prev) => ({ ...prev, time: event.target.value }))}
                />
              </label>
            )}

            <label className="flex min-w-0 flex-col gap-1.5 text-[11.5px] font-semibold text-soft sm:col-span-1">
              Timezone
              <select
                data-testid="ranger-schedule-timezone"
                disabled={isReadOnly}
                className="w-full rounded-[9px] border border-stroke bg-card px-2.5 py-2 text-[13px] font-normal text-base-content"
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

          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5 text-[11.5px] font-semibold text-soft">
              Send response to
              <select
                data-testid="ranger-schedule-delivery"
                disabled={isReadOnly || !telegramChat?.chat_id}
                className="w-full rounded-[9px] border border-stroke bg-card px-2.5 py-2 text-[13px] font-normal text-base-content"
                value={draft.sendToTelegram ? "telegram" : "none"}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, sendToTelegram: event.target.value === "telegram" }))
                }
              >
                <option value="none">Just save the result</option>
                {telegramChat?.chat_id && (
                  <option value="telegram">
                    Telegram —{" "}
                    {telegramChat.username
                      ? `@${telegramChat.username}`
                      : telegramChat.first_name || telegramChat.chat_id}
                  </option>
                )}
              </select>
            </label>

            <label className="flex min-w-0 flex-col gap-1.5 text-[11.5px] font-semibold text-soft">
              Name <span className="font-normal text-soft/80">(optional)</span>
              <input
                type="text"
                data-testid="ranger-schedule-label"
                disabled={isReadOnly}
                placeholder="Daily tasks mail"
                className="w-full rounded-[9px] border border-stroke bg-card px-2.5 py-2 text-[13px] font-normal text-base-content outline-none placeholder:text-soft"
                value={draft.label}
                onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
              />
            </label>
          </div>

          {!telegramChat?.chat_id && (
            <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-warning/40 bg-warning/10 px-3 py-2.5 text-[12px] text-warning">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 opacity-80" />
              <span>
                You won&apos;t get scheduled responses in Telegram until you message this bot at least once —
                that&apos;s how Telegram gives us a chat to reply to.
              </span>
            </div>
          )}

          <div className="mt-3.5 flex flex-wrap items-center gap-3 border-t border-stroke pt-3">
            <span className="min-w-0 flex-1 text-[12px] text-soft">{previewLine}</span>
            {(schedules.length > 0 || editingId) && (
              <button
                type="button"
                className="rounded-[9px] border border-stroke bg-card px-3.5 py-2 text-[12.5px] font-semibold text-soft"
                onClick={() => {
                  resetForm();
                  setFormOpen(schedules.length === 0);
                }}
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              data-testid="ranger-schedule-save"
              className="rounded-[9px] bg-primary px-4 py-2 text-[12.5px] font-bold text-primary-content disabled:opacity-50"
              disabled={!canSave}
              onClick={saveSchedule}
            >
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="loading loading-spinner loading-xs" />
                  {editingId ? "Saving" : "Scheduling"}
                </span>
              ) : editingId ? (
                "Save changes"
              ) : (
                "Schedule it"
              )}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default SchedulerPanel;
