"use client";

import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { RANGER_CHANNELS } from "../rangerConstants";

/**
 * Channel selection. After Identity creates the agent, each connectable channel
 * can be set up immediately with its own Continue button (telegram / discord).
 *
 * Also used by the configure page's Channels modal, which passes
 * `onDisconnectChannel` and its own copy for the heading and footnote.
 */
const ChannelsStep = ({
  form,
  setChannel,
  revealed,
  toggleReveal,
  errors,
  connectedChannels = {},
  onConnectChannel,
  onDisconnectChannel,
  title = "Channel Connection",
  subtitle = "Toggle on where this ranger should listen, enter its token, then continue setup for that channel.",
  footnote = "Channels bind to the version created on Identity. You can skip a channel and add it later.",
}) => {
  const [connectingKey, setConnectingKey] = useState(null);
  const [disconnectingKey, setDisconnectingKey] = useState(null);

  const handleConnect = async (channelKey, credentials) => {
    if (!onConnectChannel || connectingKey) return;
    setConnectingKey(channelKey);
    try {
      const result = await onConnectChannel(channelKey, credentials);
      if (!result?.success && result?.message) {
        // Parent also stores channelErrors when it wants; keep a local toast via parent.
      }
    } finally {
      setConnectingKey(null);
    }
  };

  const handleDisconnect = async (channelKey) => {
    if (!onDisconnectChannel || disconnectingKey) return;
    setDisconnectingKey(channelKey);
    try {
      await onDisconnectChannel(channelKey);
    } finally {
      setDisconnectingKey(null);
    }
  };

  return (
    <div data-testid="ranger-step-channels-pane">
      {title && <h3 className="text-[15px] font-bold tracking-[-0.2px] text-base-content">{title}</h3>}
      {subtitle && <p className="mb-4 mt-1 text-[12.5px] text-soft">{subtitle}</p>}

      <div className="flex flex-col gap-2">
        {RANGER_CHANNELS.map((channel) => {
          const Icon = channel.icon;
          const state = form.channels?.[channel.key] || { enabled: false, credentials: {} };
          const isOn = channel.enabled && state.enabled;
          const error = errors?.[channel.key];
          const isConnected = Boolean(connectedChannels?.[channel.key]);
          const hasToken = Boolean((state.credentials?.botToken || "").trim());
          const isConnecting = connectingKey === channel.key;

          return (
            <div
              key={channel.key}
              data-testid={`ranger-channel-row-${channel.key}`}
              className={`rounded-[12px] border-2 bg-card ${isOn ? "border-acc" : "border-stroke"} ${
                channel.enabled ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 px-3 py-2.5">
                <Icon size={30} className="flex-none" />
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

                  <div className="mt-3 flex items-center justify-end gap-2">
                    {isConnected && onDisconnectChannel && (
                      <button
                        type="button"
                        data-testid={`ranger-channel-disconnect-${channel.key}`}
                        className="btn btn-ghost btn-sm text-error"
                        disabled={disconnectingKey === channel.key}
                        onClick={() => handleDisconnect(channel.key)}
                      >
                        {disconnectingKey === channel.key ? (
                          <>
                            <span className="loading loading-spinner loading-xs" />
                            Disconnecting...
                          </>
                        ) : (
                          "Disconnect"
                        )}
                      </button>
                    )}
                    <button
                      type="button"
                      data-testid={`ranger-channel-continue-${channel.key}`}
                      className={`btn btn-sm ${isConnected ? "btn-ghost" : "btn-primary"}`}
                      disabled={!hasToken || isConnecting || isConnected || !onConnectChannel}
                      onClick={() => handleConnect(channel.key, state.credentials || {})}
                    >
                      {isConnecting ? (
                        <>
                          <span className="loading loading-spinner loading-xs" />
                          Connecting...
                        </>
                      ) : isConnected ? (
                        "Connected"
                      ) : (
                        `Continue ${channel.label} setup`
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {footnote && <p className="mt-3 text-[11px] leading-relaxed text-soft">{footnote}</p>}
    </div>
  );
};

export default ChannelsStep;
