"use client";

import React from "react";

/**
 * The onboarding wizard's left rail: brand mark, progress line, and the step
 * list. Steps are clickable so a user can jump back to anything they have
 * already seen; once deployed every row locks and reads as done.
 */
const OnboardingRail = ({ steps, stepIndex, deployed, onStepClick, onExit }) => (
  <aside
    data-testid="onboarding-rail"
    id="onboarding-rail"
    className="flex w-[300px] flex-none flex-col border-r border-line bg-card px-6 py-[26px]"
  >
    <div className="flex items-center gap-[10px] pb-7">
      <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-acc font-mono text-[13px] font-bold text-acc-ink">
        R
      </span>
      <span className="text-[17px] font-bold tracking-[-0.025em] text-ink">rangers</span>
    </div>

    <div className="pb-[18px] text-[12px] text-soft">
      Step {stepIndex + 1} of {steps.length} · your first ranger
    </div>

    <div className="flex flex-col gap-[2px]">
      {steps.map((step, index) => {
        const isDone = deployed || index < stepIndex;
        const isActive = !deployed && index === stepIndex;
        return (
          <button
            key={step.key}
            type="button"
            data-testid={`onboarding-step-${step.key}`}
            id={`onboarding-step-${step.key}`}
            aria-current={isActive ? "step" : undefined}
            disabled={deployed}
            onClick={() => onStepClick(index)}
            className={`flex items-center gap-3 rounded-[10px] px-[10px] py-[9px] text-left ${
              isActive ? "bg-acc-tint" : "bg-transparent"
            } ${deployed ? "cursor-default" : "cursor-pointer"}`}
          >
            <span
              className={`grid h-[22px] w-[22px] flex-none place-items-center rounded-full text-[11px] font-bold ${
                isDone ? "font-sans" : "font-mono"
              } ${isActive ? "bg-acc text-acc-ink" : isDone ? "bg-cool text-ink" : "bg-paper text-soft"}`}
            >
              {isDone ? "✓" : index + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span
                className={`text-[13.5px] font-semibold ${
                  isActive ? "text-acc-deep" : isDone ? "text-ink" : "text-soft"
                }`}
              >
                {step.title}
              </span>
              <span className="text-[11.5px] text-soft opacity-80">{step.hint}</span>
            </span>
          </button>
        );
      })}
    </div>

    <span className="flex-1" />
    <p className="m-0 text-[11.5px] leading-[1.55] text-soft opacity-80">
      Everything here is editable later from the ranger&apos;s configure page.
    </p>
    {onExit && (
      <button
        type="button"
        data-testid="onboarding-exit-button"
        id="onboarding-exit-button"
        onClick={onExit}
        className="mt-3 self-start text-[12px] font-semibold text-soft"
      >
        ← Back to your squad
      </button>
    )}
  </aside>
);

export default OnboardingRail;
