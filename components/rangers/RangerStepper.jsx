"use client";

import React from "react";
import { Check } from "lucide-react";

/**
 * Horizontal stepper. Built from tokens rather than daisyUI's `.steps` — that
 * component gets no styling from app/globals.css, so it renders off-system.
 */
const RangerStepper = ({ steps, activeIndex, onStepClick }) => (
  <div className="flex items-center gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Creation steps">
    {steps.map((step, index) => {
      const isActive = index === activeIndex;
      const isDone = index < activeIndex;
      return (
        <button
          key={step.key}
          type="button"
          role="tab"
          aria-selected={isActive}
          data-testid={`ranger-step-${step.key}`}
          disabled={index > activeIndex}
          onClick={() => index < activeIndex && onStepClick(index)}
          className={`flex shrink-0 items-center gap-2 rounded-[9px] px-3 py-[6px] text-[11.5px] font-semibold transition-colors ${
            isActive ? "bg-base-200 text-base-content" : isDone ? "text-soft hover:text-ink" : "text-soft/60"
          } ${index > activeIndex ? "cursor-not-allowed" : "cursor-pointer"}`}
        >
          <span
            className={`grid h-5 w-5 flex-none place-items-center rounded-full font-mono text-[10px] font-bold ${
              isActive
                ? "bg-acc text-acc-ink"
                : isDone
                  ? "bg-success/20 text-success ring-1 ring-inset ring-success/45"
                  : "bg-base-300 text-base-content/50"
            }`}
          >
            {isDone ? <Check size={11} /> : index + 1}
          </span>
          {step.label}
        </button>
      );
    })}
  </div>
);

export default RangerStepper;
