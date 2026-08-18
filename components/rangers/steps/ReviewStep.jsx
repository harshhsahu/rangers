"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Check, CircleAlert } from "lucide-react";
import { useCustomSelector } from "@/customHooks/customSelector";
import {
  CONNECTABLE_CHANNELS,
  CREATIVITY_LEVELS,
  DEPLOY_PHASES,
  DEPLOY_PHASE_LABELS,
  resolveTemperature,
} from "../rangerConstants";
import { readableInk } from "../rangerMeta";

const PHASE_ORDER = [
  DEPLOY_PHASES.CREATING,
  DEPLOY_PHASES.HYDRATING,
  DEPLOY_PHASES.CONFIGURING,
  DEPLOY_PHASES.CHANNELS,
  DEPLOY_PHASES.PUBLISHING,
];

const Row = ({ label, children }) => (
  <div className="flex gap-3 border-b-2 border-line px-4 py-2.5 last:border-b-0">
    <span className="w-[112px] flex-none pt-[2px] text-[10.5px] font-bold uppercase tracking-[.08em] text-soft">
      {label}
    </span>
    <div className="min-w-0 flex-1 text-[12.5px] text-base-content">{children}</div>
  </div>
);

const ReviewStep = ({ form, orgId, phase, error, channelWarnings, created, isAiMode }) => {
  const apikeys = useCustomSelector((state) => state?.apiKeysReducer?.apikeys?.[orgId] || []);

  const hasApiKeyForService = useMemo(
    () => apikeys.some((apiKey) => apiKey?.service === form.service),
    [apikeys, form.service]
  );

  const enabledChannels = CONNECTABLE_CHANNELS.filter((channel) => form.channels?.[channel.key]?.enabled);
  const creativity = CREATIVITY_LEVELS.find((level) => level.key === form.creativity);
  const temperature = resolveTemperature(form.creativity, form.temperatureParam);
  const isRunning = PHASE_ORDER.includes(phase);
  const activeIndex = PHASE_ORDER.indexOf(phase);
  const isDone = phase === DEPLOY_PHASES.DONE;

  return (
    <div data-testid="ranger-step-review-pane">
      <h3 className="text-[15px] font-bold tracking-[-0.2px] text-base-content">Review &amp; Publish</h3>
      <p className="mb-4 mt-1 text-[12.5px] text-soft">Last look before this ranger goes live.</p>

      <div className="overflow-hidden rounded-[14px] border-2 border-stroke bg-card">
        <div className="flex items-center gap-3 border-b-2 border-stroke px-4 py-3">
          <div
            className="grid h-10 w-10 flex-none place-items-center rounded-[11px] border-2 border-stroke font-mono text-[15px] font-bold"
            style={{ background: form.color, color: readableInk(form.color) }}
          >
            {(form.name || "R").trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold text-ink">{form.name?.trim() || "Unnamed"}</div>
            <div className="text-[11px] font-bold uppercase tracking-[.09em]" style={{ color: form.color }}>
              {form.role?.trim() || "Agent"}
            </div>
          </div>
        </div>

        <Row label="Purpose">
          {form.description?.trim() || form.purpose?.trim() || <em className="text-soft">Not set</em>}
        </Row>

        <Row label="Channels">
          {enabledChannels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {enabledChannels.map((channel) => {
                const Icon = channel.icon;
                return (
                  <span
                    key={channel.key}
                    className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-line py-[3px] pl-[3px] pr-2.5 font-mono text-[10px] text-ink"
                  >
                    <Icon size={16} />
                    {channel.label}
                  </span>
                );
              })}
            </div>
          ) : (
            <em className="text-soft">None — it will run without a channel until you add one.</em>
          )}
        </Row>

        {isAiMode ? (
          <Row label="Model &amp; Prompt">
            <span className="text-soft">Drafted by AI from your description.</span>
          </Row>
        ) : (
          <>
            <Row label="Model">
              <span className="font-mono text-[12px]">{form.model || "—"}</span>
              {creativity && (
                <span className="text-soft">
                  {" · "}
                  {creativity.label}
                  {temperature !== null ? ` (temp ${temperature})` : ""}
                </span>
              )}
            </Row>
            <Row label="Tone">
              {form.tone ? <span className="capitalize">{form.tone}</span> : <em className="text-soft">None</em>}
            </Row>
            <Row label="System Prompt">
              <pre className="max-h-[130px] overflow-auto whitespace-pre-wrap rounded-[9px] bg-base-200 p-2.5 font-mono text-[11.5px] leading-relaxed text-soft">
                {form.prompt?.trim() || "(empty)"}
              </pre>
            </Row>
          </>
        )}
      </div>

      {!isAiMode && form.service && !hasApiKeyForService && (
        <div className="mt-3 flex items-start gap-2 rounded-[12px] border-2 border-warning/40 bg-warning/10 p-3">
          <AlertTriangle size={15} className="mt-[2px] shrink-0 text-warning" />
          <div className="text-[11.5px] leading-relaxed text-base-content">
            No <span className="font-semibold">{form.service}</span> API key exists in this workspace. The ranger will
            publish, but it cannot answer until a key is added.{" "}
            <Link href={`/org/${orgId}/apikeys`} className="font-semibold text-primary underline">
              Add one
            </Link>
            .
          </div>
        </div>
      )}

      {(isRunning || isDone || phase === DEPLOY_PHASES.FAILED) && (
        <ul className="mt-4 flex flex-col gap-1.5" aria-live="polite">
          {PHASE_ORDER.map((phaseKey, index) => {
            const done = isDone || (activeIndex >= 0 && index < activeIndex);
            const active = phaseKey === phase;
            return (
              <li
                key={phaseKey}
                className={`flex items-center gap-2.5 rounded-[10px] border-2 px-3 py-2 text-[12px] ${
                  active ? "border-primary/25 bg-primary/10" : "border-stroke bg-base-100"
                }`}
              >
                <span
                  className={`grid h-5 w-5 flex-none place-items-center rounded-full text-[10px] font-bold ${
                    done
                      ? "bg-success text-success-content"
                      : active
                        ? "bg-primary text-primary-content"
                        : "bg-base-300 text-base-content/50"
                  }`}
                >
                  {done ? (
                    <Check size={11} />
                  ) : active ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className={done ? "text-success" : active ? "font-semibold text-base-content" : "text-soft"}>
                  {DEPLOY_PHASE_LABELS[phaseKey]}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {channelWarnings?.length > 0 && (
        <div className="mt-3 rounded-[12px] border-2 border-warning/40 bg-warning/10 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold text-base-content">
            <CircleAlert size={14} className="text-warning" /> Channel warnings
          </p>
          <ul className="list-inside list-disc text-[11.5px] leading-relaxed text-soft">
            {channelWarnings.map((warning, index) => (
              <li key={`${warning.channel}-${index}`}>
                <span className="font-semibold text-base-content">{warning.channel}:</span> {warning.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-[12px] border-2 border-error/40 bg-error/10 p-3">
          <p className="text-[12px] font-semibold text-error">{error}</p>
          {created?.agentId && (
            <p className="mt-1 text-[11.5px] leading-relaxed text-base-content">
              <span className="font-semibold">{created.name}</span> was created but is not fully set up. Retry below, or{" "}
              <Link
                href={`/org/${orgId}/agents/configure/${created.agentId}?version=${created.versionId}`}
                className="font-semibold text-primary underline"
              >
                finish it manually
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewStep;
