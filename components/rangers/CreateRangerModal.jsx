"use client";

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, SlidersHorizontal, Zap } from "lucide-react";
import Modal from "@/components/UI/Modal";
import { MODAL_TYPE } from "@/utils/enums";
import { closeModal } from "@/utils/utility";
import { useCustomSelector } from "@/customHooks/customSelector";
import { FolderContext } from "@/components/folders/FolderContext";
import RangerStepper from "./RangerStepper";
import IdentityStep from "./steps/IdentityStep";
import ChannelsStep from "./steps/ChannelsStep";
import ModelStep from "./steps/ModelStep";
import PromptStep from "./steps/PromptStep";
import ConnectorsStep from "./steps/ConnectorsStep";
import ReviewStep from "./steps/ReviewStep";
import useCreateRanger from "./useCreateRanger";
import {
  AI_STEPS,
  CONNECTABLE_CHANNELS,
  DEFAULT_CREATIVITY,
  DEFAULT_RANGER_COLOR,
  DEPLOY_PHASES,
  GUIDED_STEPS,
  RANGER_CHANNELS,
} from "./rangerConstants";

const INVALID_FOLDER_IDS = new Set(["uncategorized", "trash", "null"]);

const buildInitialForm = () => ({
  mode: null, // "guided" | "ai"
  name: "",
  role: "",
  description: "",
  color: DEFAULT_RANGER_COLOR,
  channels: RANGER_CHANNELS.reduce((acc, channel) => {
    acc[channel.key] = { enabled: false, credentials: {} };
    return acc;
  }, {}),
  service: "openai",
  model: "gpt-4o",
  modelGroup: "chat",
  temperatureParam: null,
  creativity: DEFAULT_CREATIVITY,
  prompt: "",
  // Set once the create response returns a structured {role, goal, instruction} prompt.
  promptParts: null,
  tone: "",
});

const ModeCard = ({ icon, title, blurb, bullets, badge, onClick, testId }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={onClick}
    className="relative rounded-[14px] border-2 border-stroke bg-card p-5 text-left transition-colors hover:border-acc"
  >
    {badge && (
      <span className="absolute right-4 top-4 rounded-full border-2 border-stroke bg-acc px-2 py-[2px] font-mono text-[9px] font-bold uppercase tracking-[.08em] text-acc-ink">
        {badge}
      </span>
    )}
    <div className="mb-3 grid h-10 w-10 place-items-center rounded-[11px] border-2 border-stroke bg-cool text-ink">
      {icon}
    </div>
    <h3 className="text-[15px] font-bold text-ink">{title}</h3>
    <p className="mt-1 text-[12.5px] leading-relaxed text-soft">{blurb}</p>
    <ul className="mt-3 flex flex-col gap-1.5">
      {bullets.map((bullet) => (
        <li key={bullet} className="flex items-start gap-2 text-[11.5px] text-soft">
          <span className="mt-[6px] h-1 w-1 flex-none rounded-full bg-acc" />
          {bullet}
        </li>
      ))}
    </ul>
  </button>
);

const CreateRangerModal = ({ orgId, onDeployed }) => {
  const [form, setForm] = useState(buildInitialForm);
  const [stepIndex, setStepIndex] = useState(0);
  const [revealed, setRevealed] = useState({});
  const [channelErrors, setChannelErrors] = useState({});

  const folderContext = useContext(FolderContext);
  const activeFolderId = folderContext?.activeFolderId;
  const folderId = activeFolderId && !INVALID_FOLDER_IDS.has(activeFolderId) ? activeFolderId : null;

  const existingNames = useCustomSelector((state) =>
    (state?.bridgeReducer?.org?.[orgId]?.orgs || []).map((bridge) => (bridge?.name || "").trim().toLowerCase())
  );

  const {
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
  } = useCreateRanger({
    orgId,
    folderId,
    onDeployed,
  });

  const isAiMode = form.mode === "ai";
  const steps = isAiMode ? AI_STEPS : GUIDED_STEPS;
  const currentStep = steps[stepIndex];
  const isDeploying = [
    DEPLOY_PHASES.CREATING,
    DEPLOY_PHASES.HYDRATING,
    DEPLOY_PHASES.CONFIGURING,
    DEPLOY_PHASES.CHANNELS,
    DEPLOY_PHASES.PUBLISHING,
  ].includes(phase);

  const update = useCallback((patch) => setForm((prev) => ({ ...prev, ...patch })), []);

  const setChannel = useCallback((key, patch) => {
    setForm((prev) => ({
      ...prev,
      channels: { ...prev.channels, [key]: { ...prev.channels[key], ...patch } },
    }));
    setChannelErrors((prev) => ({ ...prev, [key]: "" }));
  }, []);

  const toggleReveal = useCallback((key) => setRevealed((prev) => ({ ...prev, [key]: !prev[key] })), []);

  const resetAll = useCallback(() => {
    setForm(buildInitialForm());
    setStepIndex(0);
    setRevealed({});
    setChannelErrors({});
    reset();
  }, [reset]);

  const handleClose = useCallback(() => {
    if (isDeploying) return; // never abandon a half-finished deploy
    closeModal(MODAL_TYPE.CREATE_RANGER_MODAL);
    resetAll();
  }, [isDeploying, resetAll]);

  /**
   * The native ESC path on a <dialog> fires `cancel` then `close`; Modal's
   * `onClose` runs too late to stop it, so intercept `cancel` directly.
   * The handler reads a ref rather than closing over `isDeploying`, so the
   * listener can be attached once and still see the current phase.
   */
  const isDeployingRef = useRef(isDeploying);
  isDeployingRef.current = isDeploying;
  useEffect(() => {
    const dialog = document.getElementById(MODAL_TYPE.CREATE_RANGER_MODAL);
    if (!dialog) return undefined;
    const onCancel = (event) => {
      if (isDeployingRef.current) event.preventDefault();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);

  const nameError = useMemo(() => {
    const trimmed = form.name.trim();
    if (!trimmed) return "";
    if (existingNames.includes(trimmed.toLowerCase())) return "An agent with this name already exists.";
    return "";
  }, [form.name, existingNames]);

  const validateChannels = useCallback(() => {
    const errors = {};
    CONNECTABLE_CHANNELS.forEach((channel) => {
      const state = form.channels?.[channel.key];
      if (!state?.enabled) return;
      const message = channel.validate?.(state.credentials);
      if (message) errors[channel.key] = message;
    });
    setChannelErrors(errors);
    return Object.keys(errors).length === 0;
  }, [form.channels]);

  const canContinue = useMemo(() => {
    switch (currentStep?.key) {
      case "identity":
        return form.name.trim().length > 1 && !nameError && (!isAiMode || form.description.trim().length > 5);
      case "channels":
        return true;
      case "model":
        return Boolean(form.service && form.model);
      case "prompt":
        return form.prompt.trim().length > 10;
      case "connectors":
        return true;
      case "review":
        return true;
      default:
        return false;
    }
  }, [currentStep?.key, form, isAiMode, nameError]);

  const hint = useMemo(() => {
    switch (currentStep?.key) {
      case "identity":
        if (error) return error;
        if (phase === DEPLOY_PHASES.CREATING) return "Creating the ranger...";
        return canContinue ? "" : isAiMode ? "Name and a description are required." : "Give the ranger a name.";
      case "channels": {
        const count = CONNECTABLE_CHANNELS.filter((channel) => form.channels?.[channel.key]?.enabled).length;
        return count ? `${count} channel${count > 1 ? "s" : ""} selected.` : "No channels. You can add them later.";
      }
      case "model":
        return "You can change the model later without redeploying.";
      case "prompt":
        return canContinue ? `${form.prompt.trim().split(/\s+/).length} words` : "Write a system prompt to continue.";
      case "connectors": {
        const count = Object.keys(connectedTools).length;
        return count ? `${count} connector${count > 1 ? "s" : ""} attached.` : "No connectors. That is fine.";
      }
      case "review":
        return isDeploying ? "Deploying — don't close this window." : "Publishing adds this ranger to the roster.";
      default:
        return "";
    }
  }, [canContinue, connectedTools, currentStep?.key, error, form.channels, form.prompt, isAiMode, isDeploying, phase]);

  const goNext = async () => {
    if (currentStep?.key === "identity") {
      const result = await createFromIdentity(form);
      if (!result?.success) return;
      // Autofill Prompt from the create response's prompt object when present.
      if (result.promptParts) update({ prompt: result.prompt, promptParts: result.promptParts });
      else if (result.prompt) update({ prompt: result.prompt });
    }
    if (currentStep?.key === "channels" && !validateChannels()) return;
    if (currentStep?.key === "review") {
      await deploy(form);
      return;
    }
    setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
  };

  // Tone is saved as soon as it is picked, not held back until publish.
  const handleToneChange = async (tone) => {
    update({ tone });
    await saveTone(tone);
  };

  const handleConnectChannel = async (channelKey, credentials) => {
    const result = await connectChannel(channelKey, credentials);
    if (!result?.success) {
      setChannelErrors((prev) => ({
        ...prev,
        [channelKey]: result?.message || "Failed to connect.",
      }));
    } else {
      setChannelErrors((prev) => ({ ...prev, [channelKey]: "" }));
      setChannel(channelKey, { enabled: true, credentials });
    }
    return result;
  };

  const goBack = () => {
    if (stepIndex === 0) {
      update({ mode: null });
      return;
    }
    setStepIndex((prev) => prev - 1);
  };

  const isDone = phase === DEPLOY_PHASES.DONE;
  const hasFailed = phase === DEPLOY_PHASES.FAILED;

  const footer = form.mode ? (
    <>
      <span className="mr-auto text-[11.5px] text-soft">{hint}</span>
      {isDone ? (
        <button type="button" className="btn btn-primary btn-sm" onClick={handleClose} data-testid="ranger-done-button">
          Done
        </button>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={goBack}
            disabled={isDeploying}
            data-testid="ranger-back-button"
          >
            {stepIndex === 0 ? "Change method" : "Back"}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm min-w-[9rem]"
            onClick={goNext}
            disabled={!canContinue || isDeploying}
            data-testid="ranger-next-button"
          >
            {isDeploying ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                {phase === DEPLOY_PHASES.CREATING ? "Creating..." : "Deploying..."}
              </>
            ) : currentStep?.key === "review" ? (
              <>
                <Zap size={14} />
                {hasFailed ? "Retry" : "Publish Ranger"}
              </>
            ) : (
              "Continue"
            )}
          </button>
        </>
      )}
    </>
  ) : null;

  return (
    <Modal
      MODAL_ID={MODAL_TYPE.CREATE_RANGER_MODAL}
      onClose={handleClose}
      title={form.mode ? (isAiMode ? "Build with AI" : "Guided Setup") : "Create a New Ranger"}
      description={
        form.mode
          ? isAiMode
            ? "Describe it and the AI assembles the rest"
            : "Six steps to a live ranger"
          : "Pick how you want to build it"
      }
      icon={<Sparkles size={16} className="text-trace-gold" />}
      widthClass="w-[min(860px,94vw)]"
      footer={footer}
    >
      {!form.mode ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ModeCard
            testId="ranger-mode-guided"
            icon={<SlidersHorizontal size={19} />}
            title="Guided Setup"
            blurb="Step through it yourself. Full control over every field."
            bullets={[
              "Connect the channel with your own credentials",
              "Choose the model and its creativity level",
              "Write the system prompt and pick a tone",
              "Review everything, then publish",
            ]}
            onClick={() => {
              update({ mode: "guided" });
              setStepIndex(0);
            }}
          />
          <ModeCard
            testId="ranger-mode-ai"
            icon={<Sparkles size={19} />}
            title="Build with AI"
            badge="Beta"
            blurb="Describe what you need and the AI drafts the prompt, model and settings."
            bullets={[
              "One short description in plain language",
              "Prompt and model chosen for you",
              "Still pick the channels yourself",
              "Review before it publishes",
            ]}
            onClick={() => {
              update({ mode: "ai" });
              setStepIndex(0);
            }}
          />
        </div>
      ) : (
        <>
          <div className="mb-4 border-b-2 border-stroke pb-3">
            <RangerStepper steps={steps} activeIndex={stepIndex} onStepClick={setStepIndex} />
          </div>

          {currentStep?.key === "identity" && (
            <IdentityStep form={form} update={update} nameError={nameError} isAiMode={isAiMode} />
          )}
          {currentStep?.key === "channels" && (
            <ChannelsStep
              form={form}
              setChannel={setChannel}
              revealed={revealed}
              toggleReveal={toggleReveal}
              errors={channelErrors}
              connectedChannels={connectedChannels}
              onConnectChannel={handleConnectChannel}
            />
          )}
          {currentStep?.key === "model" && <ModelStep form={form} update={update} orgId={orgId} />}
          {currentStep?.key === "prompt" && (
            <PromptStep form={form} update={update} isAiMode={isAiMode} onToneChange={handleToneChange} />
          )}
          {currentStep?.key === "connectors" && (
            <ConnectorsStep
              orgId={orgId}
              connectedTools={connectedTools}
              onConnectTool={connectTool}
              canConnect={Boolean(created?.agentId)}
            />
          )}
          {currentStep?.key === "review" && (
            <ReviewStep
              form={form}
              orgId={orgId}
              phase={phase}
              error={error}
              channelWarnings={channelWarnings}
              created={created}
              connectedTools={connectedTools}
              isAiMode={isAiMode}
            />
          )}
        </>
      )}
    </Modal>
  );
};

export default CreateRangerModal;
