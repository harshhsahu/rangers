"use client";

import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { RANGER_CHANNELS } from "../rangerConstants";

/**
 * Channel selection. Credentials are collected here but NOT submitted — the
 * telegram/discord setup routes both require a `version_id`, which does not
 * exist until the agent has been created. useCreateRanger posts them after
 * create and before publish.
 */
const ChannelsStep = ({ form, setChannel, revealed, toggleReveal, errors }) => (
  <div data-testid="ranger-step-channels-pane">
    <h3 className="text-[15px] font-bold tracking-[-0.2px] text-base-content">Channel Connection</h3>
    <p className="mb-4 mt-1 text-[12.5px] text-soft">
      Toggle on where this ranger should listen, then supply its credentials. You can add channels later too.
    </p>

    <div className="flex flex-col gap-2">
      {RANGER_CHANNELS.map((channel) => {
        const Icon = channel.icon;
        const state = form.channels?.[channel.key] || { enabled: false, credentials: {} };
        const isOn = channel.enabled && state.enabled;
        const error = errors?.[channel.key];

        return (
          <div
            key={channel.key}
            data-testid={`ranger-channel-row-${channel.key}`}
            className={`rounded-[12px] border-2 bg-card ${isOn ? "border-acc" : "border-stroke"} ${
              channel.enabled ? "" : "opacity-60"
            }`}
          >
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div
                className="grid h-8 w-8 flex-none place-items-center rounded-[9px] border-2 border-stroke"
                style={{ background: `${channel.brand}1F`, color: channel.brand }}
              >
                <Icon width={15} height={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-ink">{channel.label}</div>
                <div className="text-[11px] text-soft">{channel.blurb}</div>
              </div>

              {channel.enabled ? (
                <input
                  type="checkbox"
                  aria-label={`Enable ${channel.label}`}
                  data-testid={`ranger-channel-toggle-${channel.key}`}
                  id={`ranger-channel-toggle-${channel.key}`}
                  className="toggle toggle-sm"
                  checked={state.enabled}
                  onChange={(event) => setChannel(channel.key, { enabled: event.target.checked })}
                />
              ) : (
                <span className="shrink-0 rounded-full border-2 border-stroke bg-paper px-2 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[.08em] text-soft">
                  Coming soon
                </span>
              )}
            </div>

            {isOn && (
              <div className="border-t-2 border-line px-3 pb-3 pt-3">
                {channel.credentialFields.map((field) => {
                  const isRevealed = revealed[`${channel.key}:${field.key}`];
                  return (
                    <div key={field.key} className="form-control">
                      <label className="label" htmlFor={`cred-${channel.key}-${field.key}`}>
                        <span className="label-text">{field.label}</span>
                      </label>
                      <div className="relative">
                        <input
                          autoComplete="off"
                          id={`cred-${channel.key}-${field.key}`}
                          data-testid={`ranger-cred-${channel.key}-${field.key}`}
                          type={field.secret && !isRevealed ? "password" : "text"}
                          placeholder={field.placeholder}
                          className={`input input-bordered input-sm w-full ${field.secret ? "pr-9" : ""} ${
                            error ? "border-error" : ""
                          }`}
                          value={state.credentials?.[field.key] || ""}
                          onChange={(event) =>
                            setChannel(channel.key, {
                              credentials: { ...(state.credentials || {}), [field.key]: event.target.value },
                            })
                          }
                        />
                        {field.secret && (
                          <button
                            type="button"
                            aria-label={isRevealed ? "Hide token" : "Show token"}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-primary"
                            onClick={() => toggleReveal(`${channel.key}:${field.key}`)}
                          >
                            {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        )}
                      </div>
                      {field.hint && <p className="mt-1 text-[11px] leading-relaxed text-soft">{field.hint}</p>}
                    </div>
                  );
                })}
                {error && <p className="mt-2 text-[11px] text-error">{error}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>

    <p className="mt-3 text-[11px] leading-relaxed text-soft">
      Channels bind to the version you publish now. Creating a new version later does not carry the binding across.
    </p>
  </div>
);

export default ChannelsStep;
