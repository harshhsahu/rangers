"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import {
  createBridgeAction,
  createBridgeWithAiAction,
  getAllBridgesAction,
  getBridgeVersionAction,
  updateBridgeAction,
  updateBridgeVersionAction,
  publishBridgeVersionAction,
} from "@/store/action/bridgeAction";
import { CONNECTABLE_CHANNELS, DEPLOY_PHASES, TONES, resolveTemperature } from "./rangerConstants";
import { buildRangerMeta, mergeRangerMeta } from "./rangerMeta";

/**
 * Orchestrates ranger creation end to end.
 *
 * Phase order matters:
 *   create → hydrate → configure → channels → publish → refresh
 *
 * The hydrate phase is NOT optional. `createBridgeAction` opens by dispatching
 * `clearPreviousBridgeDataReducer()`, which empties `bridgeVersionMapping`, and
 * both `updateBridgeVersionAction` (store/action/bridgeAction.js:554) and
 * `publishBrigeVersionReducer` (store/reducer/bridgeReducer.js:292) index two
 * levels into that map with no optional chaining. Without an explicit
 * `getBridgeVersionAction` in between, the next phase throws.
 */
const useCreateRanger = ({ orgId, folderId, onDeployed }) => {
  const dispatch = useDispatch();
  const [phase, setPhase] = useState(DEPLOY_PHASES.IDLE);
  const [error, setError] = useState("");
  const [channelWarnings, setChannelWarnings] = useState([]);
  const [created, setCreated] = useState(null);

  // Survives retries so a second Deploy click never creates a second agent.
  const createdRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSet = useCallback((setter, value) => {
    if (mountedRef.current) setter(value);
  }, []);

  const reset = useCallback(() => {
    createdRef.current = null;
    setCreated(null);
    setPhase(DEPLOY_PHASES.IDLE);
    setError("");
    setChannelWarnings([]);
  }, []);

  /** Phase 2 — create. Resolves via the action's onSuccess callback, not its return value. */
  const runCreate = useCallback(
    async (form) => {
      const ranger = buildRangerMeta(form);
      const base = {
        bridgeType: "api", // backend accepts api | chatbot only; "trigger" is UI-only
        name: form.name.trim(),
        meta: { ranger },
        ...(folderId ? { folder_id: folderId } : {}),
      };

      if (form.mode === "ai") {
        const response = await dispatch(
          createBridgeWithAiAction({ dataToSend: { ...base, purpose: form.purpose.trim() }, orgId })
        );
        return response?.data?.agent;
      }

      const response = await new Promise((resolve, reject) => {
        dispatch(
          createBridgeAction(
            {
              dataToSend: { ...base, service: form.service, model: form.model, type: form.modelGroup || "chat" },
              orgid: orgId,
            },
            resolve
          )
        ).catch(reject);
      });
      return response?.data?.agent;
    },
    [dispatch, folderId, orgId]
  );

  /** Phase 4 — one consolidated version update, never three concurrent ones. */
  const runConfigure = useCallback(
    async (form, { agentId, versionId, createdService }) => {
      const tone = form.tone ? TONES.find((item) => item.value === form.tone) : null;
      const temperature = resolveTemperature(form.creativity, form.temperatureParam);

      const dataToSend = {
        ...(form.service && form.service !== createdService ? { service: form.service } : {}),
        configuration: {
          prompt: form.prompt,
          model: form.model,
          ...(form.modelGroup ? { type: form.modelGroup } : {}),
          // Omitted entirely when the model does not expose temperature —
          // an unsupported parameter can fail the provider call.
          ...(temperature !== null ? { temperature } : {}),
        },
        ...(tone ? { settings: { tone: { value: tone.value, prompt: tone.prompt } } } : {}),
      };

      await dispatch(updateBridgeVersionAction({ bridgeId: agentId, versionId, dataToSend }));
    },
    [dispatch]
  );

  /**
   * Phase 5 — channel binding. Sequential, not parallel: both setup routes
   * upsert the SAME `channel_details` document keyed by version_id, so
   * concurrent upserts can race the insert (the route handles 11000, but the
   * loser's write is lost). Failures here are non-fatal.
   */
  const runChannels = useCallback(
    async (form, { agentId, versionId }) => {
      const warnings = [];
      for (const channel of CONNECTABLE_CHANNELS) {
        if (!form.channels?.[channel.key]?.enabled) continue;
        const creds = form.channels[channel.key].credentials || {};
        try {
          const res = await fetch(channel.setupEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              botToken: (creds.botToken || "").trim(),
              version_id: versionId,
              agent_id: agentId,
              org_id: orgId,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data?.success) {
            warnings.push({ channel: channel.label, message: data?.error || "Failed to connect." });
            continue;
          }
          // Soft warnings: the token saved but the runtime hookup did not complete.
          if (data?.webhook && !data.webhook.registered && data.webhook.message) {
            warnings.push({ channel: channel.label, message: data.webhook.message });
          }
          if (data?.gateway && data.gateway.message && data.gateway.connected === false) {
            warnings.push({ channel: channel.label, message: data.gateway.message });
          }
        } catch (err) {
          warnings.push({ channel: channel.label, message: err?.message || "Failed to connect." });
        }
      }
      return warnings;
    },
    [orgId]
  );

  const deploy = useCallback(
    async (form) => {
      safeSet(setError, "");
      safeSet(setChannelWarnings, []);

      let agentId = createdRef.current?.agentId;
      let versionId = createdRef.current?.versionId;
      let createdService = createdRef.current?.service;

      try {
        // ---- create (skipped on retry) ----
        if (!agentId) {
          safeSet(setPhase, DEPLOY_PHASES.CREATING);
          const agent = await runCreate(form);
          if (!agent?._id) throw new Error("Agent creation did not return an agent.");
          agentId = agent._id;
          versionId = agent.versions?.[0];
          createdService = agent.service;
          if (!versionId) throw new Error("Agent was created without a version.");
          createdRef.current = { agentId, versionId, service: createdService };
          safeSet(setCreated, { agentId, versionId, name: form.name.trim() });

          // Backend may drop `meta` on create; make sure the ranger data lands.
          if (!agent?.meta?.ranger) {
            try {
              await dispatch(
                updateBridgeAction({ bridgeId: agentId, dataToSend: { meta: mergeRangerMeta(agent?.meta, form) } })
              );
            } catch (metaError) {
              console.error("Failed to persist ranger meta", metaError);
            }
          }
        }

        // ---- hydrate (mandatory) ----
        // getBridgeVersionAction swallows its own errors and returns undefined,
        // so assert here rather than letting the next phase blow up two levels
        // deep inside a reducer.
        safeSet(setPhase, DEPLOY_PHASES.HYDRATING);
        const hydrated = await dispatch(getBridgeVersionAction({ versionId }));
        if (!hydrated?._id) {
          throw new Error("Could not load the new ranger's version. It was created but is not configured yet.");
        }

        // ---- configure (AI mode already wrote prompt + model) ----
        if (form.mode !== "ai") {
          safeSet(setPhase, DEPLOY_PHASES.CONFIGURING);
          await runConfigure(form, { agentId, versionId, createdService });
        }

        // ---- channels (non-fatal) ----
        safeSet(setPhase, DEPLOY_PHASES.CHANNELS);
        const warnings = await runChannels(form, { agentId, versionId });
        safeSet(setChannelWarnings, warnings);
        warnings.forEach((warning) => toast.warning(`${warning.channel}: ${warning.message}`));

        // ---- publish ----
        safeSet(setPhase, DEPLOY_PHASES.PUBLISHING);
        const result = await dispatch(
          publishBridgeVersionAction({ bridgeId: agentId, versionId, orgId, generate_summary: true })
        );
        // publishBridgeVersionApi swallows errors and returns the error object,
        // so a try/catch here proves nothing — check the flag.
        if (!result?.success) {
          throw new Error(result?.message || result?.response?.data?.message || "Publishing the ranger failed.");
        }

        await dispatch(getAllBridgesAction());
        safeSet(setPhase, DEPLOY_PHASES.DONE);
        toast.success(`${form.name.trim()} deployed and published.`);
        onDeployed?.({ agentId, versionId });
        return { success: true, agentId, versionId };
      } catch (err) {
        console.error("Ranger deploy failed", err);
        safeSet(setPhase, DEPLOY_PHASES.FAILED);
        safeSet(setError, err?.response?.data?.message || err?.message || "Something went wrong while deploying.");
        return { success: false };
      }
    },
    [dispatch, onDeployed, orgId, runChannels, runConfigure, runCreate, safeSet]
  );

  return { deploy, reset, phase, error, channelWarnings, created };
};

export default useCreateRanger;
