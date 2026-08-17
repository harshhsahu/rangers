"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { RANGER_CHANNELS } from "./rangerConstants";
import ChannelCard from "./ChannelCard";

/**
 * Command Center — channels only.
 *
 * The prototype also carried a "Megazord" aggregate block and a live unified
 * feed; both were fabricated data with no backend behind them, so they are not
 * ported.
 */
const CommandCenterTab = ({ orgId, agents = [] }) => {
  const [channelDocs, setChannelDocs] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/channel-details");
        const data = await res.json();
        if (!cancelled && mountedRef.current) {
          setChannelDocs(Array.isArray(data?.data) ? data.data : []);
        }
      } catch (error) {
        console.error("Failed to load channel details", error);
        if (!cancelled && mountedRef.current) setChannelDocs([]);
      } finally {
        if (!cancelled && mountedRef.current) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  // The list endpoint is not org-scoped, so narrow to this org's agents.
  const agentNameById = useMemo(() => {
    const map = new Map();
    (agents || []).forEach((agent) => {
      if (agent?._id) map.set(String(agent._id), agent.name || "Untitled");
    });
    return map;
  }, [agents]);

  const usageByChannel = useMemo(() => {
    const result = {};
    RANGER_CHANNELS.forEach((channel) => {
      result[channel.key] = { count: 0, names: [] };
    });
    (channelDocs || []).forEach((doc) => {
      const belongsToOrg = doc?.org_id
        ? String(doc.org_id) === String(orgId)
        : agentNameById.has(String(doc?.agent_id));
      if (!belongsToOrg) return;
      const name = agentNameById.get(String(doc?.agent_id));
      if (!name) return;
      RANGER_CHANNELS.forEach((channel) => {
        if (!channel.enabled) return;
        if (doc?.[channel.key]?.botToken) {
          result[channel.key].count += 1;
          if (!result[channel.key].names.includes(name)) result[channel.key].names.push(name);
        }
      });
    });
    return result;
  }, [channelDocs, orgId, agentNameById]);

  return (
    <section data-testid="command-center-tab" className="pb-6">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[11px] font-bold uppercase tracking-[.12em] text-soft">Channels</h2>
        <span className="font-mono text-[11.5px] text-soft">
          {RANGER_CHANNELS.filter((channel) => channel.enabled).length} of {RANGER_CHANNELS.length} available
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
