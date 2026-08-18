"use client";

import React from "react";
import { PROMPT_TEMPLATES, getPromptTemplate, TONES } from "../rangerConstants";

const PromptStep = ({ form, update }) => {
  const applyTemplate = (key) => {
    const template = getPromptTemplate(key);
    if (!template) return;
    const text = template.prompt.replace(/\{\{name\}\}/g, form.name?.trim() || "this agent");
    update({ prompt: text });
  };

  return (
    <div data-testid="ranger-step-prompt-pane">
      <h3 className="text-[15px] font-bold tracking-[-0.2px] text-base-content">System Prompt</h3>
      <p className="mb-3 mt-1 text-[12.5px] text-soft">
        The standing instructions. Start from a posting template or write your own.
      </p>

      <div className="mb-2 flex flex-wrap gap-1.5">
        {PROMPT_TEMPLATES.map((template) => (
          <button
            key={template.key}
            type="button"
            title={template.blurb}
            data-testid={`ranger-template-${template.key.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
            onClick={() => applyTemplate(template.key)}
            className="rounded-full border-2 border-stroke px-3 py-[4px] text-[11px] font-semibold text-soft transition-colors hover:border-acc hover:text-acc"
          >
            {template.key}
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
        <select
          id="ranger-tone"
          data-testid="ranger-tone-select"
          className="select select-sm select-bordered w-full capitalize"
          value={form.tone}
          onChange={(event) => update({ tone: event.target.value })}
        >
          <option value="">None</option>
          {TONES.map((tone) => (
            <option key={tone.value} value={tone.value}>
              {tone.value}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] leading-relaxed text-soft">
          Layers a tone instruction on top of the prompt. Change it any time from the ranger&apos;s settings.
        </p>
      </div>
    </div>
  );
};

export default PromptStep;
