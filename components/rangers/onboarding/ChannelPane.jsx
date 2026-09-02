"use client";

import React from "react";
import { CONNECTABLE_CHANNELS } from "../rangerConstants";

/**
 * One channel, not many: onboarding connects a single place for the ranger to
 * answer and leaves the rest to the Command Center. Selecting a card clears the
 * token so a half-typed credential never carries over to the other channel.
 */
const ChannelPane = ({ form, update }) => (
  <div className="flex flex-col gap-[10px]" data-testid="onboarding-pane-channel" id="onboarding-pane-channel">
    {CONNECTABLE_CHANNELS.map((channel) => {
      const Icon = channel.icon;
      const isSelected = form.channel === channel.key;
      const field = channel.credentialFields[0];
      // Only complain once something has been typed — an empty field on an
      // untouched card is the normal state, not an error.
      const validationError = isSelected && form.token.trim() ? channel.validate?.({ botToken: form.token }) : "";

      return (
        <div
          key={channel.key}
          data-testid={`onboarding-channel-card-${channel.key}`}
          className={`flex flex-col rounded-[14px] border px-4 py-[14px] ${
            isSelected ? "border-acc-line bg-acc-soft" : "border-line bg-card"
          }`}
        >
          <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            data-testid={`onboarding-channel-select-${channel.key}`}
            onClick={() => update({ channel: isSelected ? "" : channel.key, token: "" })}
            className="flex items-center gap-3 text-left"
          >
            <span
              aria-hidden
              className={`block h-[14px] w-[14px] flex-none rounded-full bg-card ${
                isSelected ? "border-[4px] border-acc" : "border-[1.5px] border-line"
              }`}
            />
            <Icon size={26} className="flex-none" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{channel.label}</span>
              <span className="block text-[12px] text-soft">{channel.blurb}</span>
            </span>
          </button>

          {isSelected && (
            <label className="flex flex-col gap-[6px] pt-3" htmlFor={`onboarding-token-${channel.key}`}>
              <span className="text-[12px] font-semibold text-soft">{field.label}</span>
              <input
                autoComplete="off"
                type="password"
                id={`onboarding-token-${channel.key}`}
                data-testid={`onboarding-channel-token-${channel.key}`}
                placeholder={field.placeholder}
                className={`!rounded-[10px] !border !bg-card-band px-3 py-[10px] font-mono text-[12px] text-ink outline-none placeholder:text-soft ${
                  validationError ? "!border-error" : "!border-line"
                }`}
                value={form.token}
                onChange={(event) => update({ token: event.target.value })}
              />
              <span className={`text-[11.5px] leading-[1.45] ${validationError ? "text-error" : "text-soft"}`}>
                {validationError || field.hint}
              </span>
            </label>
          )}
        </div>
      );
    })}
  </div>
);

export default ChannelPane;
