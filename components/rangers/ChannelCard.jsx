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
      className={`flex flex-col rounded-[16px] border border-line bg-card shadow-[0_1px_2px_rgba(20,17,13,.06)] ${
        channel.enabled ? "" : "opacity-[.62]"
      }`}
    >
      <div className="flex items-start gap-3 p-4 pb-[14px]">
        <span className="grid h-8 w-8 flex-none place-items-center">
          <Icon size={30} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-semibold text-ink">{channel.label}</div>
          <div className="mt-[3px] text-[12px] leading-[1.45] text-soft">{channel.blurb}</div>
        </div>
        <span
          className={`flex-none rounded-full px-[9px] py-[3px] text-[9.5px] font-bold uppercase tracking-[.08em] ${
            !channel.enabled ? "bg-paper text-soft" : isLive ? "bg-acc-tint text-acc-deep" : "bg-cool text-ink"
          }`}
        >
          {!channel.enabled ? "Coming soon" : isLive ? "Live" : "Standby"}
        </span>
      </div>

      <div className="mt-auto border-t border-card-line bg-card-band px-4 py-3">
        {!channel.enabled ? (
          <p className="text-[12px] text-soft">Not available yet.</p>
        ) : isLoading ? (
          <div className="h-4 w-24 animate-pulse rounded bg-base-300" />
        ) : (
          <>
            <div className="flex items-baseline gap-[7px]">
              <span className="font-mono text-[18px] font-semibold leading-none text-ink">{connectedCount}</span>
              <span className="text-[10.5px] font-semibold uppercase tracking-[.05em] text-soft">
                {connectedCount === 1 ? "ranger connected" : "rangers connected"}
              </span>
            </div>
            {agentNames.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {agentNames.slice(0, 4).map((name) => (
                  <span
                    key={name}
                    className="rounded-[6px] bg-card px-[7px] py-[3px] font-mono text-[9.5px] text-soft"
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
