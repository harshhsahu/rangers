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

/**
 * Helmet art per swatch. Only five helmets exist, so purple borrows blue and pink borrows
 * red — the image sits at 13% opacity behind a radial mask, where hue matters more than
 * the exact colour.
 */
const HELMET_BY_HEX = {
  "#E03131": "red",
  "#1C7ED6": "blue",
  "#2F9E44": "green",
  "#7048E8": "blue",
  "#D6336C": "red",
  "#F2540B": "yellow",
  "#495057": "black",
};

const formatNumber = (value, digits = 0) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(numeric);
};

/** The ranger's accent at a given alpha, for tints the theme tokens cannot express. */
const tint = (hex, alpha) => {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
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
  const [hot, setHot] = useState(false);
  const isPaused = row?.bridge_status === 0;
  const accent = ranger?.color;
  const callsign = CALLSIGN_BY_HEX[accent] || "Ranger";
  const subtitle = ranger?.role ? `${callsign} · ${ranger.role.toLowerCase()}` : callsign;
  const helmet = HELMET_BY_HEX[accent] || "red";

  // "On duty" means the ranger has actually run. Usage is the only signal here that
  // distinguishes a configured ranger from a working one.
  const live = Boolean(row.lastRunLabel && row.lastRunLabel !== "—");

  /** Power bar under each usage figure. Fills once on mount, and only when there is usage. */
  const bar = (fraction) => ({
    display: "block",
    marginTop: "6px",
    height: "3px",
    borderRadius: "999px",
    width: `${(fraction || 0.18) * 100}%`,
    background: live ? accent : "var(--line)",
    opacity: live ? 1 : 0.6,
    animation: live ? "rgPower .9s cubic-bezier(.2,.8,.3,1) both" : "none",
  });

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
      onMouseEnter={() => {
        setHot(true);
        onHover?.(row);
      }}
      onMouseLeave={() => {
        setHot(false);
        setChannelsOpen(false);
      }}
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[16px] bg-card"
      style={{
        border: `1px solid ${hot ? tint(accent, 0.55) : "var(--line)"}`,
        boxShadow: hot
          ? `0 18px 34px -18px ${tint(accent, 0.55)}, 0 2px 0 ${tint(accent, 0.35)}`
          : "0 1px 2px var(--shadow-tint)",
        transform: hot ? "translateY(-4px) rotate(-.4deg)" : "none",
        transition: "transform .28s cubic-bezier(.2,.8,.3,1), box-shadow .28s ease, border-color .28s ease",
      }}
    >
      {/* Helmet art, masked to a soft ellipse on the right. It turns towards the viewer on
          hover — the whole card is the light source, so the art follows rather than moves. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 top-0 z-0 block"
        style={{
          right: "-90px",
          backgroundImage: `url(/icons/helmets/${helmet}.jpg)`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "auto 360px",
          backgroundPosition: "calc(100% - 50px) -28px",
          transform: hot ? "perspective(700px) rotateY(8deg) scale(1.04)" : "perspective(700px) rotateY(18deg)",
          transformOrigin: "84% 50%",
          opacity: hot ? 0.22 : 0.13,
          WebkitMaskImage: "radial-gradient(ellipse 36% 70% at 84% 42%, #000 30%, transparent 96%)",
          maskImage: "radial-gradient(ellipse 36% 70% at 84% 42%, #000 30%, transparent 96%)",
          transition: "transform .5s cubic-bezier(.2,.8,.3,1), opacity .3s ease",
        }}
      />

      {/* Single sheen sweep on hover. Keyed on `hot` so it replays each time rather than
          running once and never again. */}
      {hot && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 top-0 z-[1] block w-2/5"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,.6) 50%, rgba(255,255,255,0) 100%)",
            animation: "rgSheen 1.1s ease-out both",
          }}
        />
      )}

      <div className="relative z-[2] flex items-start gap-[11px] p-4 pb-0">
        <span className="relative h-9 w-9 flex-none">
          {live && (
            <span
              aria-hidden
              className="absolute inset-0 block rounded-[11px]"
              style={{ border: `2px solid ${tint(accent, 0.7)}`, animation: "rgPulse 2.2s ease-out infinite" }}
            />
          )}
          <span className="relative grid h-9 w-9 place-items-center rounded-[11px] border border-line bg-card text-ink">
            {isLoading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <OpenAiIcon width={17} height={17} />
            )}
          </span>
        </span>

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
        <p className="relative z-[2] mx-4 mt-[10px] line-clamp-2 text-[12.5px] leading-[1.55] text-soft">
          {ranger.description}
        </p>
      )}

      <div className="relative z-[2] mt-auto flex items-center gap-[7px] p-4 py-[14px]">
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

        <span className="flex-1" />

        <span
          className="flex-none whitespace-nowrap rounded-full px-[9px] py-[3px] text-[10px] font-bold uppercase tracking-[.08em]"
          style={{
            background: live ? tint(accent, 0.14) : "var(--paper)",
            color: live ? accent : "var(--soft)",
          }}
        >
          {live ? "on duty" : "standby"}
        </span>
      </div>

      {/* Usage — mirrors the table's cost/token/last-run columns so the usage filter stays meaningful */}
      <div className="relative z-[2] grid grid-cols-3 border-t border-card-line bg-card-band">
        <div className="px-[10px] py-[10px]">
          <div className="truncate font-mono text-[12.5px] font-bold text-ink">
            {metrics ? `$${Number(metrics.total_cost ?? 0).toFixed(4)}` : "—"}
          </div>
          <div className="pt-px text-[10px] text-soft">Cost</div>
          <span aria-hidden style={bar(0.35)} />
        </div>
        <div className="px-[10px] py-[10px]">
          <div className="truncate font-mono text-[12.5px] font-bold text-ink">
            {metrics ? formatNumber(metrics.total_tokens) : "—"}
          </div>
          <div className="pt-px text-[10px] text-soft">Tokens</div>
          <span aria-hidden style={bar(0.62)} />
        </div>
        <div className="px-[10px] py-[10px]">
          <div className="truncate font-mono text-[12.5px] font-bold text-ink">{row.lastRunLabel || "—"}</div>
          <div className="pt-px text-[10px] text-soft">Last run</div>
          <span aria-hidden style={bar(0.9)} />
        </div>
      </div>
    </article>
  );
};

export default RangerCard;
