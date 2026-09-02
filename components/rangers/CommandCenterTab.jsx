"use client";

import React from "react";
import { RANGER_CHANNELS } from "./rangerConstants";
import ChannelCard from "./ChannelCard";
import useChannelDetails from "./useChannelDetails";

/**
 * Command Center — channels only.
 *
 * The prototype also carried a "Megazord" aggregate block and a live unified
 * feed; both were fabricated data with no backend behind them, so they are not
 * ported.
 */
const CommandCenterTab = ({ orgId, agents = [] }) => {
  const { isLoading, usageByChannel } = useChannelDetails({ orgId, agents });

  return (
    <section data-testid="command-center-tab" className="pb-10 pt-[18px]">
      <div className="flex items-baseline gap-2 pb-3">
        <h2 className="text-[11px] font-bold uppercase tracking-[.12em] text-soft">Channels</h2>
        <span className="font-mono text-[11.5px] text-soft">
          {RANGER_CHANNELS.filter((channel) => channel.enabled).length} of {RANGER_CHANNELS.length} available
        </span>
      </div>
      <div className="grid grid-cols-1 items-stretch gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
        {RANGER_CHANNELS.map((channel) => (
          <ChannelCard
            key={channel.key}
            channel={channel}
            connectedCount={usageByChannel[channel.key]?.count || 0}
            agentNames={usageByChannel[channel.key]?.names || []}
            isLoading={isLoading}
          />
        ))}
      </div>
    </section>
  );
};

export default CommandCenterTab;
