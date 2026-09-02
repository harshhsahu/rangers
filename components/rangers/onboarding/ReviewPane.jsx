"use client";

import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { useCustomSelector } from "@/customHooks/customSelector";
import {
  CALLSIGN_BY_HEX,
  CONNECTABLE_CHANNELS,
  CREATIVITY_LEVELS,
  DEPLOY_PHASES,
  DEPLOY_PHASE_LABELS,
} from "../rangerConstants";

const tint = (hex, alpha) => {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return "transparent";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const ReviewPane = ({ form, orgId, mcpServers, toolCount, kbCount, phase, error, warnings = [] }) => {
  const apikeys = useCustomSelector((state) => state?.apiKeysReducer?.apikeys?.[orgId] || []);
  const services = useCustomSelector((state) => state?.serviceReducer?.services || []);

  const providerLabel = useMemo(() => {
    const service = services.find((item) => item?.value === form.service);
    return service?.displayName || service?.label || form.service;
  }, [form.service, services]);

  const hasKey = apikeys.some((apiKey) => apiKey?.service === form.service);
  const channel = CONNECTABLE_CHANNELS.find((item) => item.key === form.channel);
  const creativity = CREATIVITY_LEVELS.find((level) => level.key === form.creativity);
  const connectorSummary = useMemo(() => {
    const parts = [];
    if (toolCount) parts.push(`${toolCount} tool${toolCount === 1 ? "" : "s"}`);
    if (mcpServers.length) parts.push(`${mcpServers.length} MCP server${mcpServers.length === 1 ? "" : "s"}`);
    if (kbCount) parts.push(`${kbCount} knowledge base${kbCount === 1 ? "" : "s"}`);
    return parts.length ? parts.join(" · ") : "None yet";
  }, [kbCount, mcpServers.length, toolCount]);

  const rows = [
    { label: "Role", value: form.role || "—" },
    { label: "Model", value: `${form.model || "—"} · ${providerLabel || "—"}`, mono: true },
    { label: "Provider key", value: hasKey ? "Your key" : "Free tier" },
    { label: "Creativity", value: creativity?.label || "—" },
    { label: "Connectors", value: connectorSummary },
    { label: "Channel", value: channel ? `${channel.label}${form.token ? " · token added" : ""}` : "None yet" },
    { label: "Prompt", value: (form.prompt || "").split("\n").find(Boolean) || "—" },
  ];

  const isRunning = [
    DEPLOY_PHASES.CREATING,
    DEPLOY_PHASES.HYDRATING,
    DEPLOY_PHASES.CONFIGURING,
    DEPLOY_PHASES.CHANNELS,
    DEPLOY_PHASES.PUBLISHING,
  ].includes(phase);

  return (
    <div data-testid="onboarding-pane-review" id="onboarding-pane-review">
      <div className="overflow-hidden rounded-[16px] border border-line bg-card">
        <div className="flex items-center gap-3 px-[18px] pb-4 pt-[18px]">
          <span
            className="grid h-[42px] w-[42px] flex-none place-items-center rounded-[13px] text-[17px] font-bold"
            style={{ background: tint(form.color, 0.14), color: form.color }}
          >
            {(form.name || "R").trim().charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold text-ink">{form.name || "Untitled ranger"}</span>
            <span className="block pt-[2px] text-[12px] font-semibold tracking-[0.04em]" style={{ color: form.color }}>
              {CALLSIGN_BY_HEX[form.color] || "Ranger"}
              {form.role ? ` · ${form.role.toLowerCase()}` : ""}
            </span>
          </span>
        </div>

        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline gap-[14px] border-t border-card-line px-[18px] py-3">
            <span className="w-[120px] flex-none text-[12px] text-soft">{row.label}</span>
            <span
              className={`min-w-0 flex-1 truncate text-ink ${row.mono ? "font-mono text-[12.5px]" : "text-[13.5px]"}`}
              title={row.value}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <p className="m-0 pt-[14px] text-[12.5px] text-soft">
        Deploying publishes version 1 and drops you into your squad.
      </p>

      {isRunning && (
        <p className="m-0 flex items-center gap-2 pt-2 text-[12.5px] text-soft" data-testid="onboarding-deploy-phase">
          <span className="loading loading-spinner loading-xs" />
          {DEPLOY_PHASE_LABELS[phase]}…
        </p>
      )}
      {error && (
        <p className="m-0 pt-2 text-[12.5px] text-error" data-testid="onboarding-deploy-error">
          {error}
        </p>
      )}

      {/* The ranger is published by the time these appear — a channel that
          would not take its token, or a tool that would not attach, never
          blocks the deploy. They are shown here rather than only as a toast so
          the user can read them before leaving the wizard. */}
      {warnings.length > 0 && (
        <div
          data-testid="onboarding-deploy-warnings"
          className="mt-3 rounded-[12px] border border-acc-line bg-acc-soft px-4 py-3"
        >
          <div className="flex items-center gap-2 text-[13px] font-semibold text-acc-deep">
            <AlertTriangle size={14} />
            {form.name || "The ranger"} is live, with {warnings.length} thing{warnings.length === 1 ? "" : "s"} left to
            fix
          </div>
          <ul className="m-0 list-none p-0 pt-2">
            {warnings.map((warning, index) => (
              <li key={`${warning.channel || warning.tool}-${index}`} className="pt-1 text-[12.5px] text-ink">
                <span className="font-semibold">{warning.channel || "Tool"}:</span> {warning.message}
              </li>
            ))}
          </ul>
          <p className="m-0 pt-2 text-[11.5px] text-soft">
            Fix it from the ranger&apos;s configure page — the prompt, model and everything else is already published.
          </p>
        </div>
      )}
    </div>
  );
};

export default ReviewPane;
