"use client";

import React from "react";
import { Plus } from "lucide-react";
import RangerCard from "./RangerCard";
import { readRangerMeta } from "./rangerMeta";

/**
 * Card view of the squad. Reads the same row objects the table consumes, plus
 * the raw bridge (for `meta.ranger` and `service`) looked up by id.
 */
const RangerGrid = ({ rows = [], rawById, loadingAgentId, onOpen, onHover, onMenuClick, onCreate, isReadOnly }) => (
  <div
    data-testid="ranger-grid"
    className="grid grid-cols-1 gap-4 px-2 pb-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
  >
    {rows.map((row) => {
      const raw = rawById?.get(String(row._id));
      return (
        <RangerCard
          key={row._id}
          row={row}
          ranger={readRangerMeta(raw)}
          service={raw?.service}
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
        className="flex min-h-[168px] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-stroke p-5 text-center text-soft transition-colors hover:border-acc hover:text-acc"
      >
        <span className="grid h-10 w-10 place-items-center rounded-[12px] border-2 border-current">
          <Plus size={18} />
        </span>
        <span className="text-[14px] font-bold text-inherit">Create Ranger</span>
        <span className="max-w-[220px] text-[11.5px] leading-relaxed text-soft">
          Connect a channel, pick a model and write the prompt — or let the AI do it.
        </span>
      </button>
    )}
  </div>
);

export default RangerGrid;
