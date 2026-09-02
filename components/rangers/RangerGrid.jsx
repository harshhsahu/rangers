"use client";

import React from "react";
import { Plus } from "lucide-react";
import RangerCard from "./RangerCard";
import { readRangerMeta } from "./rangerMeta";

/**
 * Card view of the squad. Reads the same row objects the table consumes, plus
 * the raw bridge (for `meta.ranger`) looked up by id and the channel keys the
 * agent has credentials for.
 */
const RangerGrid = ({
  rows = [],
  rawById,
  channelsByAgentId,
  loadingAgentId,
  onOpen,
  onHover,
  onMenuClick,
  onCreate,
  isReadOnly,
}) => (
  <div
    data-testid="ranger-grid"
    className="grid grid-cols-1 items-stretch gap-[14px] pb-10 pt-[14px] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
  >
    {rows.map((row) => {
      const raw = rawById?.get(String(row._id));
      return (
        <RangerCard
          key={row._id}
          row={row}
          ranger={readRangerMeta(raw)}
          channels={channelsByAgentId?.get(String(row._id)) || []}
          metrics={raw?.metrics}
          isLoading={loadingAgentId === row._id}
          onOpen={onOpen}
          onHover={onHover}
          onMenuClick={onMenuClick}
        />
      );
    })}

    {!isReadOnly && (
      <button
        type="button"
        data-testid="create-ranger-card"
        id="create-ranger-card"
        onClick={onCreate}
        className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-line-strong p-5 text-center text-soft transition-colors hover:border-acc hover:text-acc"
      >
        <span className="grid h-[38px] w-[38px] place-items-center rounded-[11px] bg-paper">
          <Plus size={17} />
        </span>
        <span className="text-[14.5px] font-semibold text-ink">Create Ranger</span>
        <span className="max-w-[230px] text-[12px] leading-[1.55] text-soft">
          Connect a channel, pick a model and write the prompt — or let the AI do it.
        </span>
      </button>
    )}
  </div>
);

export default RangerGrid;
