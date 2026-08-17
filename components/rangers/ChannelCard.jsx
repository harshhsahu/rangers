"use client";

import React from "react";

/**
 * One channel tile in the Command Center.
 *
 * `enabled: false` channels are not implemented anywhere in the app yet — they
 * render as a visibly inert "Coming soon" tile rather than being hidden, so the
 * roadmap is legible.
 */
const ChannelCard = ({ channel, connectedCount = 0, agentNames = [], isLoading = false }) => {
  const Icon = channel.icon;
  const isLive = channel.enabled && connectedCount > 0;

  return (
    <article
      data-testid={`channel-card-${channel.key}`}
      id={`channel-card-${channel.key}`}
      className={`flex flex-col gap-3 rounded-[14px] border-2 border-stroke bg-card p-4 ${
        channel.enabled ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-9 w-9 flex-none place-items-center rounded-[10px] border-2 border-stroke"
          style={{ background: `${channel.brand}1F`, color: channel.brand }}
        >
          <Icon width={17} height={17} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold text-ink">{channel.label}</div>
          <div className="mt-[2px] text-[11.5px] leading-snug text-soft">{channel.blurb}</div>
        </div>
        <span
          className={`shrink-0 rounded-full border-2 border-stroke px-2 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[.08em] ${
            !channel.enabled ? "bg-paper text-soft" : isLive ? "bg-acc text-acc-ink" : "bg-cool text-ink"
          }`}
        >
          {!channel.enabled ? "Coming soon" : isLive ? "Live" : "Standby"}
        </span>
      </div>

      <div className="border-t-2 border-line pt-3">
        {!channel.enabled ? (
          <p className="text-[11.5px] text-soft">Not available yet.</p>
        ) : isLoading ? (
          <div className="h-4 w-24 animate-pulse rounded bg-base-300" />
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-[19px] font-semibold leading-none text-ink">{connectedCount}</span>
              <span className="text-[10px] font-semibold uppercase tracking-[.07em] text-soft">
                {connectedCount === 1 ? "ranger connected" : "rangers connected"}
              </span>
            </div>
            {agentNames.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {agentNames.slice(0, 4).map((name) => (
                  <span
                    key={name}
                    className="rounded-[5px] border-[1.5px] border-line px-1.5 py-[2px] font-mono text-[9.5px] text-soft"
                    title={name}
                  >
                    {name}
                  </span>
                ))}
                {agentNames.length > 4 && (
                  <span className="font-mono text-[9.5px] text-soft">+{agentNames.length - 4} more</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
};

export default ChannelCard;
