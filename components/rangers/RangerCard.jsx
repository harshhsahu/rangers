"use client";

import React, { useState } from "react";
import { EllipsisVertical } from "lucide-react";
import { ClockIcon } from "@/components/Icons";
import OpenAiIcon from "@/icons/OpenAiIcon";
import { RANGER_CHANNELS, CALLSIGN_BY_HEX } from "./rangerConstants";

const CHANNEL_BY_KEY = RANGER_CHANNELS.reduce((acc, channel) => {
  acc[channel.key] = channel;
  return acc;
}, {});

const formatNumber = (value, digits = 0) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(numeric);
};

/**
 * A single ranger in the squad grid.
 *
 * `row` is the same shape the table consumes (built in the agents page), plus
 * `ranger` for the colour/role read out of `meta.ranger`, and `channels` (keys
 * of the messaging channels this agent has credentials for).
 *
 * The subtitle reads "<callsign> · <role>": the callsign comes from the swatch
 * so every ranger has one even before a role is written.
 */
const RangerCard = ({ row, ranger, channels = [], metrics, isLoading, onOpen, onHover, onMenuClick }) => {
  const [channelsOpen, setChannelsOpen] = useState(false);
  const isPaused = row?.bridge_status === 0;
  const accent = ranger?.color;
  const callsign = CALLSIGN_BY_HEX[accent] || "Ranger";
  const subtitle = ranger?.role ? `${callsign} · ${ranger.role.toLowerCase()}` : callsign;

  return (
    <article
      data-testid={`ranger-card-${row._id}`}
      id={`ranger-card-${row._id}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(row)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(row);
        }
      }}
      onMouseEnter={() => onHover?.(row)}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-[16px] border border-line bg-card shadow-[0_1px_2px_rgba(20,17,13,.06)] transition-colors hover:border-acc-line"
    >
      <div className="flex items-start gap-[11px] p-4 pb-0">
        <div className="grid h-9 w-9 flex-none place-items-center rounded-[11px] bg-paper text-ink">
          {isLoading ? <span className="loading loading-spinner loading-xs" /> : <OpenAiIcon width={17} height={17} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-[7px]">
            <span aria-hidden className="block h-[7px] w-[7px] flex-none rounded-full" style={{ background: accent }} />
            <span className="truncate text-[15.5px] font-semibold tracking-[-0.015em] text-ink" title={row.actualName}>
              {row.actualName || "Untitled"}
            </span>
            {isPaused && (
              <span className="flex-none rounded-full bg-paper px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-[.06em] text-soft">
                <ClockIcon size={9} className="mr-1 inline align-[-1px]" />
                Paused
              </span>
            )}
          </div>
          <div
            className="mt-[3px] truncate pl-[14px] text-[11px] font-semibold tracking-[.04em]"
            style={{ color: accent }}
            title={subtitle}
          >
            {subtitle}
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          data-testid={`ranger-card-menu-${row._id}`}
          aria-label="Ranger actions"
          className="-mr-1 mt-[3px] shrink-0 cursor-pointer rounded-lg p-1 text-soft opacity-40 transition-opacity hover:bg-paper hover:opacity-100 focus:opacity-100 group-hover:opacity-100"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onMenuClick(event, row);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onMenuClick(event, row);
            }
          }}
        >
          <EllipsisVertical size={16} />
        </div>
      </div>

      {ranger?.description && (
        <p className="mx-4 mt-[10px] line-clamp-2 text-[12.5px] leading-[1.55] text-soft">{ranger.description}</p>
      )}

      <div className="mt-auto flex items-center gap-[7px] p-4 py-[14px]">
        {row.model && (
          <span
            className="min-w-0 flex-shrink truncate rounded-[6px] bg-paper px-[7px] py-[3px] font-mono text-[10.5px] text-soft"
            title={row.model}
          >
            {row.model}
          </span>
        )}

        {channels.length > 0 && (
          <span
            className="inline-flex items-center pl-[2px]"
            onMouseEnter={() => setChannelsOpen(true)}
            onMouseLeave={() => setChannelsOpen(false)}
          >
            {channels.map((key, index) => {
              const channel = CHANNEL_BY_KEY[key];
              if (!channel) return null;
              const Icon = channel.icon;
              return (
                <span
                  key={key}
                  title={channel.label}
                  className="grid h-6 w-6 flex-none place-items-center rounded-full bg-card shadow-[0_0_0_2px_var(--card)] transition-[margin] duration-200 ease-out"
                  style={{
                    marginLeft: index === 0 ? 0 : channelsOpen ? "5px" : "-9px",
                    zIndex: 10 - index,
                  }}
                >
                  <Icon size={20} />
                </span>
              );
            })}
          </span>
        )}
      </div>

      {/* Usage — mirrors the table's cost/token/last-run columns so the usage filter stays meaningful */}
      <div className="grid grid-cols-3 border-t border-card-line bg-card-band">
        <div className="px-[10px] py-[10px]">
          <div className="truncate font-mono text-[12.5px] font-bold text-ink">
            {metrics ? `$${Number(metrics.total_cost ?? 0).toFixed(4)}` : "—"}
          </div>
          <div className="pt-px text-[10px] text-soft">Cost</div>
        </div>
        <div className="px-[10px] py-[10px]">
          <div className="truncate font-mono text-[12.5px] font-bold text-ink">
            {metrics ? formatNumber(metrics.total_tokens) : "—"}
          </div>
          <div className="pt-px text-[10px] text-soft">Tokens</div>
        </div>
        <div className="px-[10px] py-[10px]">
          <div className="truncate font-mono text-[12.5px] font-bold text-ink">{row.lastRunLabel || "—"}</div>
          <div className="pt-px text-[10px] text-soft">Last run</div>
        </div>
      </div>
    </article>
  );
};

export default RangerCard;
