"use client";

import React from "react";
import { ClockIcon, EllipsisIcon } from "@/components/Icons";
import { getIconOfService } from "@/utils/utility";
import { readableInk } from "./rangerMeta";

const formatNumber = (value, digits = 0) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(numeric);
};

/**
 * A single ranger in the squad grid.
 *
 * `row` is the same shape the table consumes (built in the agents page), plus
 * `ranger` for the colour/role read out of `meta.ranger`.
 */
const RangerCard = ({ row, ranger, service, metrics, isLoading, onOpen, onHover, onMenuClick }) => {
  const isPaused = row?.bridge_status === 0;
  const accent = ranger?.color;

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
      className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[14px] border-2 border-stroke bg-card p-4 transition-colors hover:bg-paper"
    >
      {/* Ranger colour stripe */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[4px]" style={{ background: accent }} />

      <div className="flex items-start gap-3 pl-1.5">
        <div
          className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border-2 border-stroke"
          style={{ background: accent }}
        >
          {isLoading ? (
            <span className="loading loading-spinner loading-xs" style={{ color: readableInk(accent) }} />
          ) : (
            getIconOfService(service, 16, 16)
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-[13px] font-bold text-ink" title={row.actualName}>
              {row.actualName || "Untitled"}
            </span>
            {isPaused && (
              <span className="badge badge-warning badge-sm gap-1">
                <ClockIcon size={10} />
                <span className="hidden sm:inline">Paused</span>
              </span>
            )}
          </div>
          {ranger?.role ? (
            <div
              className="mt-[2px] truncate text-[10.5px] font-bold uppercase tracking-[.09em]"
              style={{ color: accent }}
              title={ranger.role}
            >
              {ranger.role}
            </div>
          ) : (
            <div className="mt-[2px] text-[10.5px] font-bold uppercase tracking-[.09em] text-soft">Agent</div>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          data-testid={`ranger-card-menu-${row._id}`}
          aria-label="Ranger actions"
          className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded-lg p-2 opacity-0 transition-opacity hover:bg-base-200 focus:opacity-100 group-hover:opacity-100"
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
          <EllipsisIcon className="rotate-90" size={16} />
        </div>
      </div>

      {ranger?.description && (
        <p className="mt-2.5 line-clamp-2 pl-1.5 text-[11.5px] leading-relaxed text-soft">{ranger.description}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-1.5">
        {row.model && (
          <span
            className="inline-flex max-w-[190px] items-center rounded-[5px] border-[1.5px] border-line px-1.5 py-[2px] font-mono text-[9.5px] text-soft"
            title={row.model}
          >
            <span className="truncate">{row.model}</span>
          </span>
        )}
      </div>

      {/* Usage — mirrors the table's cost/token columns so the usage filter stays meaningful */}
      <div className="mt-3 grid grid-cols-2 gap-2 border-t-2 border-line pt-3 pl-1.5">
        <div>
          <div className="font-mono text-[13px] font-semibold text-ink">
            {metrics ? `$${Number(metrics.total_cost ?? 0).toFixed(4)}` : "—"}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-[.07em] text-soft">Cost</div>
        </div>
        <div>
          <div className="font-mono text-[13px] font-semibold text-ink">
            {metrics ? formatNumber(metrics.total_tokens) : "—"}
          </div>
          <div className="text-[9px] font-semibold uppercase tracking-[.07em] text-soft">Tokens</div>
        </div>
      </div>
    </article>
  );
};

export default RangerCard;
