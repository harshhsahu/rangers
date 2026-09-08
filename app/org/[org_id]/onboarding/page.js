"use client";

import React, { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/utils/toast";
import Protected from "@/components/Protected";
import { useCustomSelector } from "@/customHooks/customSelector";
import useCreateRanger from "@/components/rangers/useCreateRanger";
import {
  CONNECTABLE_CHANNELS,
  DEFAULT_CREATIVITY,
  DEFAULT_RANGER_COLOR,
  DEPLOY_PHASES,
  RANGER_CHANNELS,
} from "@/components/rangers/rangerConstants";
import OnboardingRail from "@/components/rangers/onboarding/OnboardingRail";
import IdentityPane from "@/components/rangers/onboarding/IdentityPane";
import PromptPane from "@/components/rangers/onboarding/PromptPane";
import KeysPane from "@/components/rangers/onboarding/KeysPane";
import ModelPane from "@/components/rangers/onboarding/ModelPane";
import ConnectorsPane from "@/components/rangers/onboarding/ConnectorsPane";
import ChannelPane from "@/components/rangers/onboarding/ChannelPane";
import ReviewPane from "@/components/rangers/onboarding/ReviewPane";
import { ONBOARDING_COPY, ONBOARDING_STEPS } from "@/components/rangers/onboarding/onboardingConstants";

export const runtime = "edge";

const STEP_INDEX = ONBOARDING_STEPS.reduce((acc, step, index) => {
  acc[step.key] = index;
  return acc;
}, {});

const buildInitialForm = () => ({
  name: "",
  role: "",
  description: "",
  color: DEFAULT_RANGER_COLOR,
  prompt: "",
  // Set when the backend returns a structured {role, goal, instruction} prompt.
  promptParts: null,
  service: "openai",
  model: "gpt-4o",
  modelGroup: "chat",
  temperatureParam: null,
  creativity: DEFAULT_CREATIVITY,
  // Onboarding connects exactly one channel; the Command Center adds the rest.
  channel: "",
  token: "",
  tone: "",
});

/**
 * First-run onboarding — the full-screen version of the create-ranger wizard.
 *
 * It shares useCreateRanger with the modal, so the create → hydrate →
 * configure → channels → publish pipeline (and its retry behaviour) is the same
 * code path. What is different is the shape: a step rail instead of a stepper,
 * a provider-key step a fresh workspace needs, and one channel instead of many.
 *
 * The org layout hides its sidebar and navbar on this route (see
 * app/org/[org_id]/layout.js) but still runs every data fetch this page reads
 * from the store — services, models, API keys, tools, the embed token.
 */
function OnboardingPage({ params }) {
  const resolvedParams = use(params);
  const orgId = resolvedParams.org_id;
  const router = useRouter();

  const [form, setForm] = useState(buildInitialForm);
  const [stepIndex, setStepIndex] = useState(0);
  // Set only when a deploy succeeded but something non-fatal failed with it —
  // a bad channel token, a tool that would not attach. The ranger is live
  // either way, so this holds the user on the step to read it instead of
  // dropping the news into a toast on the way out.
  const [deployWarnings, setDeployWarnings] = useState([]);
  const [mcpServers, setMcpServers] = useState([]);
  const [selectedToolIds, setSelectedToolIds] = useState([]);
  const [selectedKbIds, setSelectedKbIds] = useState([]);
  const [isWriting, setIsWriting] = useState(false);
  const [promptStatus, setPromptStatus] = useState("");

  const { existingNames, agentCount, apikeys, knowledgeBases } = useCustomSelector((state) => ({
    existingNames: (state?.bridgeReducer?.org?.[orgId]?.orgs || []).map((bridge) =>
      (bridge?.name || "").trim().toLowerCase()
    ),
    agentCount: (state?.bridgeReducer?.org?.[orgId]?.orgs || []).length,
    apikeys: state?.apiKeysReducer?.apikeys?.[orgId] || [],
    knowledgeBases: state?.knowledgeBaseReducer?.knowledgeBaseData?.[orgId] || [],
  }));

  const { createFromIdentity, deploy, phase, error } = useCreateRanger({
    orgId,
    folderId: null,
  });

  /**
   * A refresh (or a stale/bookmarked link) can land here after the org
   * already has an agent — e.g. created from another tab, or Redux state
   * catching up after a slow first fetch. Onboarding only makes sense for a
   * genuinely empty org, so send an existing squad straight to its agents
   * page. Scoped to the first step so this never fires after this same
   * wizard's own deploy moves agentCount from 0 to 1 (handleNext already
   * navigates to the squad itself on a clean deploy).
   */
  useEffect(() => {
    if (stepIndex === 0 && agentCount > 0) {
      router.replace(`/org/${orgId}/agents`);
    }
  }, [agentCount, stepIndex, orgId, router]);

  const update = useCallback((patch) => setForm((prev) => ({ ...prev, ...patch })), []);

  const stepKey = ONBOARDING_STEPS[stepIndex].key;
  const [heading, subheading] = ONBOARDING_COPY[stepKey];

  const nameError = useMemo(() => {
    const trimmed = form.name.trim();
    if (!trimmed) return "";
    if (existingNames.includes(trimmed.toLowerCase())) return "An agent with this name already exists.";
    return "";
  }, [existingNames, form.name]);

  const channelError = useMemo(() => {
    if (!form.channel) return "";
    const channel = CONNECTABLE_CHANNELS.find((item) => item.key === form.channel);
    return channel?.validate?.({ botToken: form.token }) || "";
  }, [form.channel, form.token]);

  const isDeploying = [
    DEPLOY_PHASES.CREATING,
    DEPLOY_PHASES.HYDRATING,
    DEPLOY_PHASES.CONFIGURING,
    DEPLOY_PHASES.CHANNELS,
    DEPLOY_PHASES.PUBLISHING,
  ].includes(phase);

  const canContinue = useMemo(() => {
    switch (stepKey) {
      case "identity":
        return form.name.trim().length > 1 && !nameError;
      case "prompt":
        return form.prompt.trim().length > 0;
      case "model":
        return Boolean(form.service && form.model);
      case "channel":
        return !channelError;
      case "review":
        return form.name.trim().length > 1 && form.prompt.trim().length > 0 && !isDeploying;
      default:
        return true;
    }
  }, [channelError, form.model, form.name, form.prompt, form.service, isDeploying, nameError, stepKey]);

  /**
   * Skip leaves the step in a clean state, not just a step forward — a channel
   * half-selected with no token would otherwise be sent to the setup route on
   * deploy and come back as a warning the user never asked for.
   */
  const handleSkip = () => {
    if (stepKey === "channel") update({ channel: "", token: "" });
    go(stepIndex + 1);
  };

  const skipLabel =
    stepKey === "keys"
      ? "Skip for now"
      : stepKey === "connectors"
        ? "No connectors yet"
        : stepKey === "channel"
          ? "Connect later"
          : "";

  const go = useCallback((index) => setStepIndex(Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, index))), []);

  /**
   * "Write the prompt for me" is the real create call: the backend drafts a
   * system prompt from the agent's `purpose`, so the ranger is created here
   * with the description as its purpose and the returned prompt fills the
   * field. deploy() reuses that same agent, so nothing is created twice.
   */
  const handleWritePrompt = async () => {
    if (isWriting || !form.description.trim()) return;
    setIsWriting(true);
    setPromptStatus("Writing…");
    try {
      const result = await createFromIdentity(form);
      if (!result?.success) {
        setPromptStatus("");
        toast.error(result?.message || "Could not draft the prompt. Write one below instead.");
        return;
      }
      if (result.promptParts) {
        update({ prompt: result.prompt, promptParts: result.promptParts });
        setPromptStatus("Draft ready — edit below.");
      } else if (result.prompt) {
        update({ prompt: result.prompt, promptParts: null });
        setPromptStatus("Draft ready — edit below.");
      } else {
        setPromptStatus("No draft came back — write the prompt below.");
      }
    } finally {
      setIsWriting(false);
    }
  };

  /** Wizard state -> the shape useCreateRanger's deploy expects. */
  const buildDeployPayload = () => {
    const key = apikeys.find((apiKey) => apiKey?.service === form.service);
    return {
      ...form,
      channels: RANGER_CHANNELS.reduce((acc, channel) => {
        const isSelected = channel.enabled && form.channel === channel.key;
        acc[channel.key] = {
          enabled: isSelected,
          credentials: isSelected ? { botToken: form.token.trim() } : {},
        };
        return acc;
      }, {}),
      mcpServers,
      toolIds: selectedToolIds,
      // Same doc_ids shape KnowledgebaseList writes on the configure page.
      docIds: selectedKbIds
        .map((kbId) => knowledgeBases.find((kb) => kb._id === kbId))
        .filter(Boolean)
        .map((kb) => ({
          collection_id: kb.collectionId,
          resource_id: kb._id,
          description: kb.description,
          name: kb.title,
        })),
      ...(key?._id ? { apikeyObjectId: { [form.service]: key._id } } : {}),
    };
  };

  const goToSquad = () => router.push(`/org/${orgId}/agents`);

  const handleNext = async () => {
    if (!canContinue) return;
    if (stepKey === "review") {
      setDeployWarnings([]);
      const result = await deploy(buildDeployPayload());
      if (!result?.success) return;
      // Clean deploy — there is nothing left to read here, so go where the
      // ranger now lives. Anything that failed around it keeps the user here.
      if (!result.warnings?.length) {
        goToSquad();
        return;
      }
      // A channel whose setup call was rejected keeps nothing behind: the
      // selection and its token are dropped so a bad credential is not left
      // sitting in the field looking saved.
      if (result.warnings.some((warning) => warning.failed && warning.key === form.channel)) {
        update({ channel: "", token: "" });
      }
      setDeployWarnings(result.warnings);
      return;
    }
    go(stepIndex + 1);
  };

  const hasFailed = phase === DEPLOY_PHASES.FAILED;
  const isDeployed = phase === DEPLOY_PHASES.DONE;

  return (
    <div className="flex h-screen bg-paper-raised text-ink" data-testid="onboarding-page" id="onboarding-page">
      <OnboardingRail
        steps={ONBOARDING_STEPS}
        stepIndex={stepIndex}
        deployed={isDeployed}
        onStepClick={go}
        // Only offered once the squad is a real destination: with an empty org
        // the squad page sends the user straight back here, so an exit would
        // be a link to nowhere.
        onExit={agentCount > 0 ? goToSquad : null}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-auto px-12 pb-6 pt-[46px]">
          <div className="max-w-[620px]">
            <h1 className="m-0 text-[32px] font-bold leading-[1.1] tracking-[-0.035em] text-ink">{heading}</h1>
            <p className="m-0 pt-[10px] text-[14.5px] leading-[1.6] text-soft">{subheading}</p>

            <div className="pt-7">
              {stepKey === "identity" ? (
                <IdentityPane form={form} update={update} nameError={nameError} />
              ) : stepKey === "prompt" ? (
                <PromptPane
                  form={form}
                  update={update}
                  onWritePrompt={handleWritePrompt}
                  promptStatus={promptStatus}
                  isWriting={isWriting}
                />
              ) : stepKey === "keys" ? (
                <KeysPane orgId={orgId} />
              ) : stepKey === "model" ? (
                <ModelPane form={form} update={update} orgId={orgId} onAddKey={() => go(STEP_INDEX.keys)} />
              ) : stepKey === "connectors" ? (
                <ConnectorsPane
                  orgId={orgId}
                  mcpServers={mcpServers}
                  onMcpServersChange={setMcpServers}
                  selectedToolIds={selectedToolIds}
                  onSelectedToolIdsChange={setSelectedToolIds}
                  selectedKbIds={selectedKbIds}
                  onSelectedKbIdsChange={setSelectedKbIds}
                />
              ) : stepKey === "channel" ? (
                <ChannelPane form={form} update={update} />
              ) : (
                <ReviewPane
                  form={form}
                  orgId={orgId}
                  mcpServers={mcpServers}
                  toolCount={selectedToolIds.length}
                  kbCount={selectedKbIds.length}
                  phase={phase}
                  error={error}
                  warnings={deployWarnings}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line bg-card px-12 py-[14px]">
          {!isDeployed && (
            <button
              type="button"
              data-testid="onboarding-back-button"
              id="onboarding-back-button"
              disabled={stepIndex === 0 || isDeploying}
              onClick={() => go(stepIndex - 1)}
              className="rounded-[10px] border border-line px-[14px] py-[9px] text-[13px] font-semibold text-soft disabled:cursor-default disabled:opacity-50"
            >
              Back
            </button>
          )}

          <span className="flex-1" />

          {!isDeployed && skipLabel && (
            <button
              type="button"
              data-testid="onboarding-skip-button"
              onClick={handleSkip}
              className="px-[6px] py-[9px] text-[13px] font-semibold text-soft"
            >
              {skipLabel}
            </button>
          )}

          <button
            type="button"
            data-testid="onboarding-next-button"
            id="onboarding-next-button"
            disabled={!isDeployed && (!canContinue || isDeploying)}
            onClick={isDeployed ? goToSquad : handleNext}
            className="inline-flex items-center gap-[7px] rounded-[10px] bg-acc px-[18px] py-[10px] text-[13.5px] font-bold text-acc-ink shadow-[0_1px_2px_var(--shadow-tint)] disabled:cursor-default disabled:bg-paper-sunken disabled:text-soft disabled:shadow-none"
          >
            {isDeploying && <span className="loading loading-spinner loading-xs" />}
            {isDeployed
              ? "Go to your squad"
              : isDeploying
                ? "Deploying…"
                : stepKey === "review"
                  ? hasFailed
                    ? "Retry deploy"
                    : "Deploy ranger"
                  : "Continue"}
          </button>
        </div>
      </main>
    </div>
  );
}

export default Protected(OnboardingPage);
