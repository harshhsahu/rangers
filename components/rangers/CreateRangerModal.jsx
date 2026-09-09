"use client";

import React, { useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, Sparkles, SlidersHorizontal, Zap } from "lucide-react";
import { toast } from "@/utils/toast";
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
import AiBuildChatPanel from "./AiBuildChatPanel";
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
import {
  buildInitialDraftConfig,
  draftFieldDisplay,
  isDraftReadyToDeploy,
  mapDraftConfigToForm,
} from "./aiChatConstants";

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
  // Free-text ask from chat — display-only, see aiChatConstants.js.
  connectorNotes: "",
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
  // One thread per modal session, created up front: the chat route requires a
  // thread_id on every message, and it must stay stable so the agent keeps
  // conversation context across turns.
  const [aiThreadId] = useState(() => `ranger-build-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
  const [aiDraftConfig, setAiDraftConfig] = useState(buildInitialDraftConfig);

  const folderContext = useContext(FolderContext);
  const activeFolderId = folderContext?.activeFolderId;
  const folderId = activeFolderId && !INVALID_FOLDER_IDS.has(activeFolderId) ? activeFolderId : null;

  const existingNames = useCustomSelector((state) =>
    (state?.bridgeReducer?.org?.[orgId]?.orgs || []).map((bridge) => (bridge?.name || "").trim().toLowerCase())
  );

  const {
    createFromIdentity,
    connectTool,
    disconnectTool,
    connectedTools,
    saveTone,
    deploy,
    reset,
    phase,
    error,
    channelWarnings,
    created,
    identityPhase,
    identityError,
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
  // Kept separate from isDeploying so it only guards modal-close, never Back/Continue.
  const isCreatingIdentity = identityPhase === DEPLOY_PHASES.CREATING;

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
    setAiThreadId(null);
    setAiDraftConfig(buildInitialDraftConfig());
    reset();
  }, [reset]);

  /**
   * Always resets. Modal watches the dialog's `open` attribute and fires this
   * whenever it closes, so bailing out early here did not keep the wizard open
   * — it just left the created agent in state. Reopening then reused it, and
   * the next deploy published the agent from the abandoned run instead of
   * creating a new one. Guarding the close button is the footer's job.
   */
  const handleClose = useCallback(() => {
    closeModal(MODAL_TYPE.CREATE_RANGER_MODAL);
    resetAll();
  }, [resetAll]);

  /**
   * Done is only rendered once the deploy reached DONE, so there is nothing
   * left to protect — it closes unconditionally rather than going through
   * handleClose — it is the same path, kept separate for readability.
   */
  const handleDone = useCallback(() => {
    closeModal(MODAL_TYPE.CREATE_RANGER_MODAL);
    resetAll();
  }, [resetAll]);

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
      case "chat":
        return isDraftReadyToDeploy(aiDraftConfig);
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
  }, [aiDraftConfig, currentStep?.key, form, isAiMode, nameError]);

  const hint = useMemo(() => {
    switch (currentStep?.key) {
      case "identity":
        if (identityError) return identityError;
        if (isCreatingIdentity) return "Creating the ranger...";
        return canContinue ? "" : isAiMode ? "Name and a description are required." : "Give the ranger a name.";
      case "chat":
        if (!canContinue) return "Name and purpose are required before you can deploy.";
        return draftFieldDisplay(aiDraftConfig, "prompt")
          ? "I will draft the model and config from your answers."
          : "No prompt yet — one will be generated automatically from the purpose when you deploy.";
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
  }, [
    aiDraftConfig,
    canContinue,
    connectedTools,
    currentStep?.key,
    identityError,
    isCreatingIdentity,
    form.channels,
    form.prompt,
    isAiMode,
    isDeploying,
  ]);

  const goNext = async () => {
    if (currentStep?.key === "identity") {
      // Fire the create in the background and move on immediately — the corner badge tracks it, deploy() waits for it later.
      createFromIdentity(form).then((result) => {
        if (!result?.success) {
          toast.error(result?.message || "Failed to create the ranger. It will retry when you publish.");
          return;
        }
        // Autofill Prompt from the create response's prompt object when present.
        // This lands after the user has already moved on, so it must never
        // overwrite something they typed in the meantime — the check has to run
        // against the latest state, not the value captured at click time.
        setForm((prev) => {
          if (prev.prompt?.trim()) return prev;
          if (result.promptParts) return { ...prev, prompt: result.prompt, promptParts: result.promptParts };
          if (result.prompt) return { ...prev, prompt: result.prompt };
          return prev;
        });
      });
      setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
      return;
    }
    if (currentStep?.key === "chat") {
      // Morph & Deploy: hand chat's fields to the same form Guided Setup uses.
      update(mapDraftConfigToForm(aiDraftConfig, form));
    }
    if (currentStep?.key === "channels" && !validateChannels()) return;
    if (currentStep?.key === "review") {
      const result = await deploy(form);
      // Any channel whose setup call was rejected gives up its stored token —
      // a credential the setup route refused is not worth keeping around.
      (result?.warnings || []).forEach((warning) => {
        if (warning.failed && warning.key) {
          setChannel(warning.key, { credentials: {} });
          setChannelErrors((prev) => ({ ...prev, [warning.key]: warning.message }));
        }
      });
      return;
    }
    setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
  };

  // Tone is saved as soon as it is picked, not held back until publish.
  const handleToneChange = async (tone) => {
    update({ tone });
    await saveTone(tone);
  };

  const goBack = () => {
    if (stepIndex === 0) {
      // Switching method starts the build over — the agent the previous method
      // already created is abandoned, not carried across.
      reset();
      setAiThreadId(null);
      setAiDraftConfig(buildInitialDraftConfig());
      setChannelErrors({});
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
        <button type="button" className="btn btn-primary btn-sm" onClick={handleDone} data-testid="ranger-done-button">
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
            ) : currentStep?.key === "chat" ? (
              <>
                <Sparkles size={14} />
                Morph &amp; Deploy
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
      // The wizard holds several steps of input — only the close button may
      // dismiss it, so Escape or a stray backdrop click cannot discard it.
      dismissible={false}
      title={form.mode ? (isAiMode ? "Build with AI" : "Guided Setup") : "Create a New Ranger"}
      description={
        form.mode
          ? isAiMode
            ? currentStep?.key === "chat"
              ? "Answer a few questions and I will assemble the ranger"
              : "Review what the chat assembled, then publish"
            : "Six steps to a live ranger"
          : "Pick how you want to build it"
      }
      icon={<Sparkles size={16} className="text-trace-gold" />}
      headerRight={
        // Shown on every step so the badge tracks Identity's create wherever the user has navigated to.
        isCreatingIdentity ? (
          <span
            className="flex items-center gap-1.5 rounded-full border-2 border-stroke bg-cool px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-soft"
            data-testid="ranger-identity-creating-badge"
          >
            <span className="loading loading-spinner loading-xs" />
            Creating agent...
          </span>
        ) : identityPhase === DEPLOY_PHASES.FAILED ? (
          <span
            className="flex items-center gap-1.5 rounded-full border-2 border-error/40 bg-error/10 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-error"
            data-testid="ranger-identity-failed-badge"
            title={identityError}
          >
            <AlertTriangle size={12} />
            Retry on publish
          </span>
        ) : null
      }
      widthClass={isAiMode && currentStep?.key === "chat" ? "w-[min(960px,94vw)]" : "w-[min(860px,94vw)]"}
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
              setAiThreadId(crypto.randomUUID());
              setAiDraftConfig(buildInitialDraftConfig());
            }}
          />
        </div>
      ) : (
        <>
          {!isAiMode && (
            <div className="mb-4 border-b-2 border-stroke pb-3">
              <RangerStepper steps={steps} activeIndex={stepIndex} onStepClick={setStepIndex} />
            </div>
          )}

          {/* Hidden, not unmounted, so Back preserves the chat history. */}
          {isAiMode && (
            <div className={currentStep?.key === "chat" ? "" : "hidden"}>
              <AiBuildChatPanel
                threadId={aiThreadId}
                draftConfig={aiDraftConfig}
                onDraftConfigChange={setAiDraftConfig}
              />
            </div>
          )}

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
              deferred
              footnote="Channels are validated now and connected automatically when you publish."
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
              onDisconnectTool={disconnectTool}
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
