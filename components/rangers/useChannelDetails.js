"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RANGER_CHANNELS } from "./rangerConstants";

/**
 * Loads /api/channel-details once and derives the two shapes the Rangers page
 * needs from it: a per-channel connected count (Command Center) and a
 * per-agent list of channel keys (the squad cards).
 *
 * The endpoint is not org-scoped, so rows are narrowed to agents belonging to
 * the org being viewed.
 */
const useChannelDetails = ({ orgId, agents = [] }) => {
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

  const agentNameById = useMemo(() => {
    const map = new Map();
    (agents || []).forEach((agent) => {
      if (agent?._id) map.set(String(agent._id), agent.name || "Untitled");
    });
    return map;
  }, [agents]);

  const orgChannelDocs = useMemo(
    () =>
      (channelDocs || []).filter((doc) => {
        const belongsToOrg = doc?.org_id
          ? String(doc.org_id) === String(orgId)
          : agentNameById.has(String(doc?.agent_id));
        return belongsToOrg && agentNameById.has(String(doc?.agent_id));
      }),
    [channelDocs, orgId, agentNameById]
  );

  const usageByChannel = useMemo(() => {
    const result = {};
    RANGER_CHANNELS.forEach((channel) => {
      result[channel.key] = { count: 0, names: [] };
    });
    orgChannelDocs.forEach((doc) => {
      const name = agentNameById.get(String(doc?.agent_id));
      RANGER_CHANNELS.forEach((channel) => {
        if (!channel.enabled) return;
        if (doc?.[channel.key]?.botToken) {
          result[channel.key].count += 1;
          if (!result[channel.key].names.includes(name)) result[channel.key].names.push(name);
        }
      });
    });
    return result;
  }, [orgChannelDocs, agentNameById]);

  /** agentId -> ["telegram", "discord", ...] in RANGER_CHANNELS order. */
  const channelsByAgentId = useMemo(() => {
    const map = new Map();
    orgChannelDocs.forEach((doc) => {
      const keys = RANGER_CHANNELS.filter((channel) => channel.enabled && doc?.[channel.key]?.botToken).map(
        (channel) => channel.key
      );
      if (!keys.length) return;
      const agentId = String(doc.agent_id);
      const existing = map.get(agentId) || [];
      map.set(agentId, Array.from(new Set([...existing, ...keys])));
    });
    return map;
  }, [orgChannelDocs]);

  return { isLoading, usageByChannel, channelsByAgentId };
};

export default useChannelDetails;
