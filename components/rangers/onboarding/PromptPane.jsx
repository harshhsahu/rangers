"use client";

import React from "react";
import { Sparkles } from "lucide-react";

const PromptPane = ({ form, update, onWritePrompt, promptStatus, isWriting }) => (
  <div data-testid="onboarding-pane-prompt" id="onboarding-pane-prompt">
    <label className="flex flex-col gap-[6px]" htmlFor="onboarding-description">
      <span className="text-[12px] font-semibold text-soft">What is this ranger responsible for?</span>
      <textarea
        id="onboarding-description"
        data-testid="onboarding-description-input"
        placeholder="Answers billing questions from the shared inbox, escalates refunds over $200 to a human."
        className="min-h-[96px] w-full resize-y !rounded-[10px] !border !border-line !bg-card px-3 py-[11px] text-[14px] leading-[1.5] text-ink outline-none placeholder:text-soft"
        value={form.description}
        onChange={(event) => update({ description: event.target.value })}
      />
    </label>

    <div className="flex items-center gap-[10px] pt-3">
      <button
        type="button"
        data-testid="onboarding-write-prompt-button"
        id="onboarding-write-prompt-button"
        disabled={isWriting || !form.description.trim()}
        onClick={onWritePrompt}
        className="inline-flex items-center gap-[7px] rounded-[10px] border border-acc-line bg-acc-soft px-[14px] py-[9px] text-[13px] font-semibold text-acc-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isWriting ? <span className="loading loading-spinner loading-xs" /> : <Sparkles size={14} />}
        Write the prompt for me
      </button>
      <span className="text-[12px] text-soft opacity-80">{promptStatus}</span>
    </div>

    <label className="flex flex-col gap-[6px] pt-[18px]" htmlFor="onboarding-prompt">
      <span className="text-[12px] font-semibold text-soft">System prompt</span>
      <textarea
        id="onboarding-prompt"
        data-testid="onboarding-prompt-input"
        placeholder="Write it yourself, or generate it above and edit."
        className="min-h-[190px] w-full resize-y !rounded-[10px] !border !border-line !bg-card p-3 font-mono text-[12.5px] leading-[1.65] text-ink outline-none placeholder:text-soft"
        value={form.prompt}
        // Editing by hand breaks the backend's role/goal/instruction split, so
        // the structured copy is dropped and a plain string is saved instead.
        onChange={(event) => update({ prompt: event.target.value, promptParts: null })}
      />
    </label>
  </div>
);

export default PromptPane;
