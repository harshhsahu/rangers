"use client";

import React from "react";
import { RANGER_COLORS } from "../rangerConstants";

/**
 * Text inputs carry `!` modifiers on background, border and radius because
 * globals.css styles text inputs and textareas through an attribute selector,
 * whose specificity outranks a plain utility class. Every pane in this folder
 * does the same, for the same reason.
 */
const FIELD_CLASS =
  "w-full !rounded-[10px] !border !border-line !bg-card px-3 py-[10px] text-[14px] text-ink outline-none placeholder:text-soft";

/** Swatch wash behind a selected colour pill — the hex at 10% over paper. */
const tint = (hex, alpha) => {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return "transparent";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const IdentityPane = ({ form, update, nameError }) => (
  <div data-testid="onboarding-pane-identity" id="onboarding-pane-identity">
    <div className="grid grid-cols-1 gap-[14px] sm:grid-cols-2">
      <label className="flex flex-col gap-[6px]" htmlFor="onboarding-name">
        <span className="text-[12px] font-semibold text-soft">Ranger name</span>
        <input
          autoComplete="off"
          type="text"
          id="onboarding-name"
          data-testid="onboarding-name-input"
          placeholder="e.g. Vega"
          className={`${FIELD_CLASS} ${nameError ? "!border-error" : ""}`}
          value={form.name}
          onChange={(event) => update({ name: event.target.value })}
        />
        {nameError && <span className="text-[11.5px] text-error">{nameError}</span>}
      </label>

      <label className="flex flex-col gap-[6px]" htmlFor="onboarding-role">
        <span className="text-[12px] font-semibold text-soft">Role title</span>
        <input
          autoComplete="off"
          type="text"
          id="onboarding-role"
          data-testid="onboarding-role-input"
          placeholder="e.g. Support Lead"
          className={FIELD_CLASS}
          value={form.role}
          onChange={(event) => update({ role: event.target.value })}
        />
      </label>
    </div>

    <div className="pt-5">
      <div className="pb-[9px] text-[12px] font-semibold text-soft">Ranger colour · sets the callsign</div>
      <div className="flex flex-wrap gap-[10px]">
        {RANGER_COLORS.map((swatch) => {
          const isActive = form.color === swatch.hex;
          return (
            <button
              key={swatch.key}
              type="button"
              title={swatch.label}
              aria-pressed={isActive}
              data-testid={`onboarding-color-${swatch.key}`}
              onClick={() => update({ color: swatch.hex })}
              className={`inline-flex items-center gap-[7px] rounded-full border py-[6px] pl-[10px] pr-[13px] text-[12.5px] font-semibold ${
                isActive ? "" : "border-line bg-card text-soft"
              }`}
              style={
                isActive ? { borderColor: swatch.hex, background: tint(swatch.hex, 0.1), color: swatch.hex } : undefined
              }
            >
              <span aria-hidden className="block h-[10px] w-[10px] rounded-full" style={{ background: swatch.hex }} />
              {swatch.callsign}
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export default IdentityPane;
