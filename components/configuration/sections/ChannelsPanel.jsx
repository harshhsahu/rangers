"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "@/utils/toast";
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

  /**
   * Reads the channel document back and mirrors it into local state. Extracted from the
   * mount effect so the "Update the ranger" chat can trigger it after its agent connects
   * or disconnects a channel — otherwise this panel would keep showing the state it
   * loaded with until the page was reloaded.
   */
  const loadChannels = useCallback(async () => {
    if (!versionId) return;
    try {
      const res = await fetch(`/api/channel-details?version_id=${encodeURIComponent(versionId)}`);
      const data = await res.json();
      if (!data?.success) return;

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
  }, [versionId]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Raised by the update chat, which is not an ancestor of this panel.
  useEffect(() => {
    window.addEventListener("gtwy:channels-changed", loadChannels);
    return () => window.removeEventListener("gtwy:channels-changed", loadChannels);
  }, [loadChannels]);

  const setChannel = useCallback((key, patch) => {
    setChannels((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }, []);

  /**
   * Drops everything we were holding for a channel: the typed token and any
   * connected flag. Used on both sides of a setup call — a rejected token is
   * not worth keeping in the field, and a failed setup never leaves the
   * channel looking connected.
   */
  const clearChannelState = useCallback((key) => {
    setChannels((prev) => ({ ...prev, [key]: { ...prev[key], credentials: {} } }));
    setConnectedChannels((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
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
          clearChannelState(channelKey);
          setErrors((prev) => ({ ...prev, [channelKey]: message }));
          toast.error(message);
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
        clearChannelState(channelKey);
        setErrors((prev) => ({ ...prev, [channelKey]: message }));
        toast.error(message);
        return { success: false, message };
      }
    },
    [clearChannelState, params?.id, params?.org_id, setChannel, versionId]
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
