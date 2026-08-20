"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import ChannelsStep from "@/components/rangers/steps/ChannelsStep";
import { CONNECTABLE_CHANNELS } from "@/components/rangers/rangerConstants";
import { useConfigurationContext } from "../ConfigurationContext";

const emptyChannels = () =>
  CONNECTABLE_CHANNELS.reduce((acc, channel) => {
    acc[channel.key] = { enabled: false, credentials: {} };
    return acc;
  }, {});

/**
 * Channels for an existing ranger, using the wizard's channel step so both
 * surfaces look and behave the same. The tokens themselves are never returned
 * unmasked, so a connected channel is disconnected before it can be re-bound.
 */
const ChannelsPanel = () => {
  const { params, searchParams, isPublished, isEditor } = useConfigurationContext();
  const versionId = searchParams?.version;
  const isReadOnly = isPublished || !isEditor;

  const [channels, setChannels] = useState(emptyChannels);
  const [connectedChannels, setConnectedChannels] = useState({});
  const [revealed, setRevealed] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!versionId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/channel-details?version_id=${encodeURIComponent(versionId)}`);
        const data = await res.json();
        if (cancelled || !data?.success) return;

        const connected = CONNECTABLE_CHANNELS.reduce((acc, channel) => {
          if (data.data?.[channel.key]?.botToken) acc[channel.key] = true;
          return acc;
        }, {});
        setConnectedChannels(connected);
        // A bound channel opens expanded so its status and Disconnect are visible.
        setChannels((prev) => {
          const next = { ...prev };
          Object.keys(connected).forEach((key) => {
            next[key] = { ...next[key], enabled: true };
          });
          return next;
        });
      } catch (err) {
        console.error("Loading channel details failed", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [versionId]);

  const setChannel = useCallback((key, patch) => {
    setChannels((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }, []);

  const toggleReveal = useCallback((key) => {
    setRevealed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const connectChannel = useCallback(
    async (channelKey, credentials = {}) => {
      const channel = CONNECTABLE_CHANNELS.find((item) => item.key === channelKey);
      if (!channel) return { success: false, message: "Unknown channel." };
      if (!versionId) {
        const message = "This agent has no version to bind the channel to.";
        setErrors((prev) => ({ ...prev, [channelKey]: message }));
        return { success: false, message };
      }

      const invalid = channel.validate?.(credentials);
      if (invalid) {
        setErrors((prev) => ({ ...prev, [channelKey]: invalid }));
        return { success: false, message: invalid };
      }

      try {
        const res = await fetch(channel.setupEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            botToken: (credentials.botToken || "").trim(),
            version_id: versionId,
            agent_id: params?.id,
            org_id: params?.org_id,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          const message = data?.error || `Failed to connect ${channel.label}.`;
          setErrors((prev) => ({ ...prev, [channelKey]: message }));
          return { success: false, message };
        }

        // The token saved but the runtime hookup may still have failed.
        if (data?.webhook && !data.webhook.registered && data.webhook.message) {
          toast.warning(`${channel.label}: ${data.webhook.message}`);
        }
        if (data?.gateway && data.gateway.connected === false && data.gateway.message) {
          toast.warning(`${channel.label}: ${data.gateway.message}`);
        }

        setErrors((prev) => ({ ...prev, [channelKey]: "" }));
        setConnectedChannels((prev) => ({ ...prev, [channelKey]: true }));
        setChannel(channelKey, { credentials: {} });
        toast.success(`${channel.label} connected.`);
        return { success: true };
      } catch (err) {
        const message = err?.message || `Failed to connect ${channel.label}.`;
        setErrors((prev) => ({ ...prev, [channelKey]: message }));
        return { success: false, message };
      }
    },
    [params?.id, params?.org_id, setChannel, versionId]
  );

  const disconnectChannel = useCallback(
    async (channelKey) => {
      const channel = CONNECTABLE_CHANNELS.find((item) => item.key === channelKey);
      if (!channel || !versionId) return { success: false };

      try {
        const res = await fetch(`${channel.setupEndpoint}?version_id=${encodeURIComponent(versionId)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          const message = data?.error || `Failed to disconnect ${channel.label}.`;
          setErrors((prev) => ({ ...prev, [channelKey]: message }));
          return { success: false, message };
        }

        setConnectedChannels((prev) => {
          const next = { ...prev };
          delete next[channelKey];
          return next;
        });
        setChannel(channelKey, { credentials: {} });
        toast.success(`${channel.label} disconnected.`);
        return { success: true };
      } catch (err) {
        const message = err?.message || `Failed to disconnect ${channel.label}.`;
        setErrors((prev) => ({ ...prev, [channelKey]: message }));
        return { success: false, message };
      }
    },
    [setChannel, versionId]
  );

  return (
    <ChannelsStep
      form={{ channels }}
      setChannel={setChannel}
      revealed={revealed}
      toggleReveal={toggleReveal}
      errors={errors}
      connectedChannels={connectedChannels}
      onConnectChannel={isReadOnly ? undefined : connectChannel}
      onDisconnectChannel={isReadOnly ? undefined : disconnectChannel}
      title={null}
      subtitle="Toggle on where this ranger should listen, paste its token, then continue setup for that channel."
      footnote="Channels bind to the version you are editing. Disconnect a channel to swap its token."
    />
  );
};

export default ChannelsPanel;
