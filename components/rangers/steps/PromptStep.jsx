"use client";

import React from "react";
import { PROMPT_TEMPLATES, TONES } from "../rangerConstants";
import ThemedSelect from "@/components/UI/ThemedSelect";

/** "None" first, then every tone — the wizard has no custom-tone option. */
const TONE_OPTIONS = [{ value: "", label: "None" }, ...TONES.map((tone) => ({ value: tone.value, label: tone.value }))];

const PromptStep = ({ form, update }) => {
  const applyTemplate = (key) => {
    const text = PROMPT_TEMPLATES[key].replace(/\{\{name\}\}/g, form.name?.trim() || "this agent");
    update({ prompt: text });
  };

  return (
    <div data-testid="ranger-step-prompt-pane">
      <h3 className="text-[15px] font-bold tracking-[-0.2px] text-base-content">System Prompt</h3>
      <p className="mb-3 mt-1 text-[12.5px] text-soft">
        The standing instructions. Start from a template or write your own.
      </p>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {Object.keys(PROMPT_TEMPLATES).map((key) => (
          <button
            key={key}
            type="button"
            data-testid={`ranger-template-${key.replace(/\s+/g, "-").toLowerCase()}`}
            onClick={() => applyTemplate(key)}
            className="rounded-full border-2 border-stroke px-3 py-[4px] text-[11px] font-semibold text-soft transition-colors hover:border-acc hover:text-acc"
          >
            {key}
          </button>
        ))}
      </div>

      <div className="form-control">
        <textarea
          id="ranger-prompt"
          data-testid="ranger-prompt-input"
          placeholder="You are ..."
          className="textarea textarea-bordered min-h-[190px] w-full font-mono text-[12.5px] leading-relaxed"
          value={form.prompt}
          onChange={(event) => update({ prompt: event.target.value })}
        />
        <span className="mt-1 text-right font-mono text-[10.5px] text-soft">{form.prompt.length} characters</span>
      </div>

      <div className="form-control mt-3 max-w-xs">
        <label className="label" htmlFor="ranger-tone">
          <span className="label-text">Tone</span>
        </label>
        <ThemedSelect
          id="ranger-tone"
          testId="ranger-tone"
          value={form.tone}
          onChange={(tone) => update({ tone })}
          options={TONE_OPTIONS}
          placeholder="Select a tone"
        />
        <p className="mt-1 text-[11px] leading-relaxed text-soft">
          Layers a tone instruction on top of the prompt. Change it any time from the ranger&apos;s settings.
        </p>
      </div>
    </div>
  );
};

export default PromptStep;
