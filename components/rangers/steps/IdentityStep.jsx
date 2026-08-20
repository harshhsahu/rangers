"use client";

import React from "react";
import { Check } from "lucide-react";
import { RANGER_COLORS } from "../rangerConstants";
import { readableInk } from "../rangerMeta";

const IdentityStep = ({ form, update, nameError, isAiMode }) => (
  <div data-testid="ranger-step-identity-pane">
    <h3 className="text-[15px] font-bold tracking-[-0.2px] text-base-content">Identity</h3>
    <p className="mb-4 mt-1 text-[12.5px] text-soft">
      Give the ranger a name and a colour. The colour tags it everywhere in the dashboard.
    </p>

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="form-control">
        <label className="label" htmlFor="ranger-name">
          <span className="label-text">Ranger Name</span>
        </label>
        <input
          autoComplete="off"
          id="ranger-name"
          data-testid="ranger-name-input"
          type="text"
          placeholder="e.g. Vega"
          className={`input input-bordered input-sm w-full ${nameError ? "border-error" : ""}`}
          value={form.name}
          onChange={(event) => update({ name: event.target.value })}
        />
        {nameError && <span className="mt-1 text-[11px] text-error">{nameError}</span>}
      </div>

      <div className="form-control">
        <label className="label" htmlFor="ranger-role">
          <span className="label-text">Role Title</span>
        </label>
        <input
          autoComplete="off"
          id="ranger-role"
          data-testid="ranger-role-input"
          type="text"
          placeholder="e.g. Support Lead"
          className="input input-bordered input-sm w-full"
          value={form.role}
          onChange={(event) => update({ role: event.target.value })}
        />
      </div>
    </div>

    <div className="form-control mt-3">
      <label className="label">
        <span className="label-text">Ranger Colour</span>
      </label>
      <div className="flex flex-wrap gap-2">
        {RANGER_COLORS.map((swatch) => {
          const isActive = form.color === swatch.hex;
          return (
            <button
              key={swatch.key}
              type="button"
              title={swatch.label}
              aria-label={swatch.label}
              aria-pressed={isActive}
              data-testid={`ranger-color-${swatch.key}`}
              onClick={() => update({ color: swatch.hex })}
              className={`grid h-9 w-9 place-items-center rounded-[10px] border-2 transition-transform hover:scale-105 ${
                isActive ? "border-ink" : "border-stroke"
              }`}
              style={{ background: swatch.hex }}
            >
              {isActive && <Check size={15} style={{ color: readableInk(swatch.hex) }} />}
            </button>
          );
        })}
      </div>
    </div>

    <div className="form-control mt-3">
      <label className="label" htmlFor="ranger-desc">
        <span className="label-text">Short Description</span>
      </label>
      {isAiMode ? (
        <>
          <textarea
            id="ranger-desc"
            data-testid="ranger-description-input"
            placeholder="What this ranger is responsible for"
            className="textarea textarea-bordered min-h-[110px] w-full text-[13px]"
            maxLength={300}
            value={form.description}
            onChange={(event) => update({ description: event.target.value })}
          />
          <span className="mt-1 text-right font-mono text-[10.5px] text-soft">{form.description.length}/300</span>
          <p className="text-[11px] leading-relaxed text-soft">
            Sent as the agent purpose. The returned prompt autofills the Prompt step so you can edit before publishing.
          </p>
        </>
      ) : (
        <input
          autoComplete="off"
          id="ranger-desc"
          data-testid="ranger-description-input"
          type="text"
          placeholder="What this ranger is responsible for"
          className="input input-bordered input-sm w-full"
          value={form.description}
          onChange={(event) => update({ description: event.target.value })}
        />
      )}
    </div>
  </div>
);

export default IdentityStep;
