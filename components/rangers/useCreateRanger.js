"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import {
  createBridgeWithAiAction,
  getAllBridgesAction,
  getBridgeVersionAction,
  updateBridgeAction,
  updateBridgeVersionAction,
  publishBridgeVersionAction,
} from "@/store/action/bridgeAction";
import {
  CONNECTABLE_CHANNELS,
  DEPLOY_PHASES,
  TONES,
  combinePromptParts,
  parsePromptParts,
  resolveTemperature,
} from "./rangerConstants";
import { buildRangerMeta, mergeRangerMeta } from "./rangerMeta";

/** Falls back to a plain string when the response prompt is not the structured object. */
const resolvePromptText = (prompt) => {
  if (!prompt) return "";
  if (typeof prompt === "string") return prompt.trim();
  if (typeof prompt !== "object") return "";

  const candidate = prompt.prompt ?? prompt.system_prompt ?? prompt.content ?? prompt.text ?? "";
  return typeof candidate === "string" ? candidate.trim() : "";
};

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
  const [connectedChannels, setConnectedChannels] = useState({});
  const [connectedTools, setConnectedTools] = useState({});

  // Survives retries so a second Deploy click never creates a second agent.
  const createdRef = useRef(null);
  const connectedChannelsRef = useRef({});
  const connectedToolsRef = useRef({});
  const hydratedVersionRef = useRef(null);
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
    connectedChannelsRef.current = {};
    connectedToolsRef.current = {};
    hydratedVersionRef.current = null;
    setCreated(null);
    setConnectedChannels({});
    setConnectedTools({});
    setPhase(DEPLOY_PHASES.IDLE);
    setError("");
    setChannelWarnings([]);
  }, []);

  /** Phase 2 — create. Always sends flag:true; description becomes purpose when present. */
  const runCreate = useCallback(
    async (form) => {
      const ranger = buildRangerMeta(form);
      const description = form.description.trim();
      const dataToSend = {
        // Create must be "api" — the backend rejects "trigger" here. It is
        // promoted right after the agent exists (see promoteToTrigger).
        bridgeType: "api",
        name: form.name.trim(),
        flag: true,
        meta: { ranger },
        ...(folderId ? { folder_id: folderId } : {}),
        ...(description ? { purpose: description } : {}),
      };

      // Without purpose the backend still needs a concrete model to create against.
      if (!description) {
        dataToSend.service = form.service;
        dataToSend.model = form.model;
        dataToSend.type = form.modelGroup || "chat";
      }

      // flag:true → synchronous HTTP create (see createBridgeWithAiAction).
      const response = await dispatch(createBridgeWithAiAction({ dataToSend, orgId }));
      const agent = response?.data?.agent;
      const rawPrompt = response?.data?.prompt ?? agent?.configuration?.prompt;
      const promptParts = parsePromptParts(rawPrompt);

      return {
        agent,
        promptParts,
        prompt: promptParts ? combinePromptParts(promptParts) : resolvePromptText(rawPrompt),
      };
    },
    [dispatch, folderId, orgId]
  );

  /**
   * Rangers run as triggers, but creation only accepts "api" — so flip the type
   * once the agent exists. Non-fatal: the ranger still works as an API agent.
   */
  const promoteToTrigger = useCallback(
    async (agentId) => {
      try {
        await dispatch(updateBridgeAction({ bridgeId: agentId, dataToSend: { bridgeType: "trigger" } }));
      } catch (err) {
        console.error("Failed to switch the ranger to a trigger agent", err);
      }
    },
    [dispatch]
  );

  /**
   * Creates the agent as soon as Identity is submitted (any mode).
   * The created ref is shared with deploy(), so publishing later never creates
   * a second agent.
   */
  const createFromIdentity = useCallback(
    async (form) => {
      if (createdRef.current?.agentId) {
        return { success: true, ...createdRef.current };
      }

      safeSet(setError, "");
      safeSet(setPhase, DEPLOY_PHASES.CREATING);

      try {
        const { agent, prompt, promptParts } = await runCreate(form);
        if (!agent?._id) throw new Error("Agent creation did not return an agent.");

        const versionId = agent.versions?.[0];
        if (!versionId) throw new Error("Agent was created without a version.");

        const createdAgent = {
          agentId: agent._id,
          versionId,
          service: agent.service,
        };
        createdRef.current = createdAgent;
        safeSet(setCreated, { agentId: agent._id, versionId, name: form.name.trim() });

        // Backend may drop `meta` on create; make sure the ranger data lands.
        if (!agent?.meta?.ranger) {
          try {
            await dispatch(
              updateBridgeAction({
                bridgeId: agent._id,
                dataToSend: { meta: mergeRangerMeta(agent?.meta, form) },
              })
            );
          } catch (metaError) {
            console.error("Failed to persist ranger meta", metaError);
          }
        }

        await promoteToTrigger(agent._id);

        safeSet(setPhase, DEPLOY_PHASES.IDLE);
        return { success: true, ...createdAgent, prompt, promptParts };
      } catch (err) {
        console.error("Ranger identity creation failed", err);
        safeSet(setPhase, DEPLOY_PHASES.FAILED);
        safeSet(setError, err?.response?.data?.message || err?.message || "Something went wrong while creating.");
        return { success: false };
      }
    },
    [dispatch, promoteToTrigger, runCreate, safeSet]
  );

  /** Phase 4 — one consolidated version update, never three concurrent ones. */
  const runConfigure = useCallback(
    async (form, { agentId, versionId, createdService }) => {
      const tone = form.tone ? TONES.find((item) => item.value === form.tone) : null;
      const temperature = resolveTemperature(form.creativity, form.temperatureParam);

      const dataToSend = {
        ...(form.service && form.service !== createdService ? { service: form.service } : {}),
        configuration: {
          // Preserve the backend's structured shape when the prompt came back
          // as {role, goal, instruction}; templates fall back to a string.
          prompt: form.promptParts || form.prompt,
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
   * Channels already connected from the Channels step are skipped.
   */
  const runChannels = useCallback(
    async (form, { agentId, versionId }) => {
      const warnings = [];
      for (const channel of CONNECTABLE_CHANNELS) {
        if (!form.channels?.[channel.key]?.enabled) continue;
        if (connectedChannelsRef.current[channel.key]) continue;
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
          connectedChannelsRef.current[channel.key] = true;
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

  /**
   * Connect a single channel from the Channels step once Identity has created
   * the agent (version_id is required by telegram/discord setup routes).
   */
  const connectChannel = useCallback(
    async (channelKey, credentials = {}) => {
      const channel = CONNECTABLE_CHANNELS.find((item) => item.key === channelKey);
      if (!channel) return { success: false, message: "Unknown channel." };

      const agentId = createdRef.current?.agentId;
      const versionId = createdRef.current?.versionId;
      if (!agentId || !versionId) {
        return { success: false, message: "Create the ranger on Identity before connecting channels." };
      }

      const message = channel.validate?.(credentials);
      if (message) return { success: false, message };

      try {
        const res = await fetch(channel.setupEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            botToken: (credentials.botToken || "").trim(),
            version_id: versionId,
            agent_id: agentId,
            org_id: orgId,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          return { success: false, message: data?.error || `Failed to connect ${channel.label}.` };
        }

        connectedChannelsRef.current[channelKey] = true;
        safeSet(setConnectedChannels, { ...connectedChannelsRef.current });

        if (data?.webhook && !data.webhook.registered && data.webhook.message) {
          toast.warning(`${channel.label}: ${data.webhook.message}`);
        }
        if (data?.gateway && data.gateway.message && data.gateway.connected === false) {
          toast.warning(`${channel.label}: ${data.gateway.message}`);
        }

        toast.success(`${channel.label} connected.`);
        return { success: true };
      } catch (err) {
        return { success: false, message: err?.message || `Failed to connect ${channel.label}.` };
      }
    },
    [orgId, safeSet]
  );

  /**
   * `updateBridgeVersionAction` reads two levels into `bridgeVersionMapping`
   * with no optional chaining, so any mid-wizard version write has to hydrate
   * the version first.
   */
  const ensureHydratedVersion = useCallback(
    async (versionId) => {
      if (hydratedVersionRef.current === versionId) return;
      const hydrated = await dispatch(getBridgeVersionAction({ versionId }));
      if (!hydrated?._id) throw new Error("Could not load the ranger's version.");
      hydratedVersionRef.current = versionId;
    },
    [dispatch]
  );

  /** Attach an authenticated organization tool to the version created on Identity. */
  const connectTool = useCallback(
    async (functionId) => {
      if (!functionId) return { success: false, message: "Unknown tool." };
      if (connectedToolsRef.current[functionId]) return { success: true };

      const agentId = createdRef.current?.agentId;
      const versionId = createdRef.current?.versionId;
      if (!agentId || !versionId) {
        return { success: false, message: "Create the ranger on Identity before connecting tools." };
      }

      try {
        await ensureHydratedVersion(versionId);

        await dispatch(
          updateBridgeVersionAction({
            bridgeId: agentId,
            versionId,
            dataToSend: { functionData: { function_id: functionId, function_operation: "1" } },
          })
        );

        connectedToolsRef.current[functionId] = true;
        safeSet(setConnectedTools, { ...connectedToolsRef.current });
        return { success: true };
      } catch (err) {
        console.error("Connecting the tool failed", err);
        return { success: false, message: err?.response?.data?.message || err?.message || "Failed to connect." };
      }
    },
    [dispatch, ensureHydratedVersion, safeSet]
  );

  /**
   * Persist the tone the moment it is picked, in the same shape ToneDropdown
   * writes (`settings.tone`), so the wizard and the configure page agree.
   * Before the agent exists the form still carries it into the deploy update.
   */
  const saveTone = useCallback(
    async (toneValue) => {
      const agentId = createdRef.current?.agentId;
      const versionId = createdRef.current?.versionId;
      if (!agentId || !versionId) return { success: false, skipped: true };

      const tone = TONES.find((item) => item.value === toneValue);
      try {
        await ensureHydratedVersion(versionId);
        await dispatch(
          updateBridgeVersionAction({
            bridgeId: agentId,
            versionId,
            dataToSend: { settings: { tone: tone ? { value: tone.value, prompt: tone.prompt } : {} } },
          })
        );
        return { success: true };
      } catch (err) {
        console.error("Saving the tone failed", err);
        toast.error(err?.response?.data?.message || err?.message || "Could not save the tone.");
        return { success: false };
      }
    },
    [dispatch, ensureHydratedVersion]
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
          const { agent } = await runCreate(form);
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

          await promoteToTrigger(agentId);
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
        hydratedVersionRef.current = versionId;

        // ---- configure ----
        // Runs for AI mode too: the Prompt step is seeded with the AI draft but
        // stays editable, so the form — not the create response — is final.
        safeSet(setPhase, DEPLOY_PHASES.CONFIGURING);
        await runConfigure(form, { agentId, versionId, createdService });

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
    [dispatch, onDeployed, orgId, promoteToTrigger, runChannels, runConfigure, runCreate, safeSet]
  );

  return {
    createFromIdentity,
    connectChannel,
    connectTool,
    connectedTools,
    saveTone,
    deploy,
    reset,
    phase,
    error,
    channelWarnings,
    created,
    connectedChannels,
  };
};

export default useCreateRanger;
