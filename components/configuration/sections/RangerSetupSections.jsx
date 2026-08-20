"use client";

import React, { useMemo } from "react";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { SparklesIcon, BotIcon, LinkIcon } from "@/components/Icons";
import Modal from "@/components/UI/Modal";
import { MODAL_TYPE } from "@/utils/enums";
import { openModal } from "@/utils/utility";
import { useConfigurationContext } from "../ConfigurationContext";
import PromptTab from "./PromptTab";
import ModelTab from "./ModelTab";
import ConnectorsTab from "./ConnectorsTab";
import ChannelsPanel from "./ChannelsPanel";

const MODAL_WIDTH = "w-[min(1040px,95vw)]";
/** These panels are tall, so the scrollbar has to be visible to hint at it. */
const MODAL_BODY = "scrollbar-visible";

const SetupRow = ({ icon: Icon, title, summary, modalId, testId }) => (
  <button
    type="button"
    data-testid={testId}
    onClick={() => openModal(modalId)}
    className="flex w-full items-center gap-3 rounded-xl border-2 border-stroke bg-card px-4 py-3 text-left transition-colors duration-200 hover:bg-paper"
  >
    <span className="grid h-9 w-9 flex-none place-items-center rounded-lg border-2 border-stroke bg-base-200">
      <Icon className="h-4 w-4 text-base-content" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold text-base-content">{title}</span>
      <span className="mt-0.5 block truncate text-xs text-soft">{summary}</span>
    </span>
    <ChevronRight size={16} className="flex-none text-soft" />
  </button>
);

/**
 * Ranger setup is one row per area; the options live in modals so the page stays
 * a short list instead of four stacked panels.
 */
const RangerSetupSections = () => {
  const { isPublished, isEmbedUser, service, modelName, bridge_functions } = useConfigurationContext();

  const modelSummary = useMemo(() => {
    const parts = [service, modelName].filter(Boolean);
    return parts.length ? parts.join(" · ") : "Pick a service provider and model.";
  }, [service, modelName]);

  const connectorSummary = useMemo(() => {
    const count = bridge_functions?.length || 0;
    if (!count) return "No tools attached yet.";
    return `${count} tool${count > 1 ? "s" : ""} attached`;
  }, [bridge_functions]);

  return (
    <div data-testid="ranger-setup-sections" className="flex flex-col gap-2">
      <SetupRow
        icon={SparklesIcon}
        title="Prompt"
        summary="Role, goal, and instructions for this ranger."
        modalId={MODAL_TYPE.RANGER_PROMPT_MODAL}
        testId="ranger-setup-row-prompt"
      />
      <SetupRow
        icon={BotIcon}
        title="LLM Configuration"
        summary={modelSummary}
        modalId={MODAL_TYPE.RANGER_MODEL_MODAL}
        testId="ranger-setup-row-model"
      />
      <SetupRow
        icon={LinkIcon}
        title="Connectors"
        summary={connectorSummary}
        modalId={MODAL_TYPE.RANGER_CONNECTORS_MODAL}
        testId="ranger-setup-row-connectors"
      />
      <SetupRow
        icon={MessagesSquare}
        title="Channels"
        summary="Telegram, Discord, and custom triggers."
        modalId={MODAL_TYPE.RANGER_CHANNELS_MODAL}
        testId="ranger-setup-row-channels"
      />

      <Modal
        MODAL_ID={MODAL_TYPE.RANGER_PROMPT_MODAL}
        title="Prompt"
        description="Define the agent's role, behavior, and instructions."
        icon={<SparklesIcon className="h-4 w-4 text-base-content" />}
        widthClass={MODAL_WIDTH}
        bodyClassName={MODAL_BODY}
      >
        <PromptTab isPublished={isPublished} isEmbedUser={isEmbedUser} />
      </Modal>

      <Modal
        MODAL_ID={MODAL_TYPE.RANGER_MODEL_MODAL}
        title="LLM Configuration"
        description="Service provider, model, and generation parameters."
        icon={<BotIcon className="h-4 w-4 text-base-content" />}
        widthClass={MODAL_WIDTH}
        bodyClassName={MODAL_BODY}
      >
        <ModelTab isPublished={isPublished} />
      </Modal>

      <Modal
        MODAL_ID={MODAL_TYPE.RANGER_CONNECTORS_MODAL}
        title="Connectors"
        description="Create tools and connect authenticated organization services."
        icon={<LinkIcon className="h-4 w-4 text-base-content" />}
        widthClass={MODAL_WIDTH}
        bodyClassName={MODAL_BODY}
      >
        <ConnectorsTab isPublished={isPublished} />
      </Modal>

      <Modal
        MODAL_ID={MODAL_TYPE.RANGER_CHANNELS_MODAL}
        title="Channels"
        description="Connect Telegram, Discord, or a custom trigger to this ranger."
        icon={<MessagesSquare size={16} className="text-base-content" />}
        widthClass={MODAL_WIDTH}
        bodyClassName={MODAL_BODY}
      >
        <ChannelsPanel />
      </Modal>
    </div>
  );
};

export default RangerSetupSections;
