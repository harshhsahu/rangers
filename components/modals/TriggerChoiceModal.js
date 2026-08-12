"use client";

import React from "react";
import { MessageCircle, MessageSquare, Zap } from "lucide-react";
import Modal from "@/components/UI/Modal";
import { MODAL_TYPE } from "@/utils/enums";
import { closeModal, openModal } from "@/utils/utility";

/**
 * Choose trigger type: Telegram, Discord, or Custom (ViaSocket).
 */
const TriggerChoiceModal = ({ onSelectCustom }) => {
  const handleClose = () => closeModal(MODAL_TYPE.TRIGGER_CHOICE_MODAL);

  const handleTelegram = () => {
    closeModal(MODAL_TYPE.TRIGGER_CHOICE_MODAL);
    openModal(MODAL_TYPE.TELEGRAM_CONNECT_MODAL);
  };

  const handleDiscord = () => {
    closeModal(MODAL_TYPE.TRIGGER_CHOICE_MODAL);
    openModal(MODAL_TYPE.DISCORD_CONNECT_MODAL);
  };

  const handleCustom = () => {
    closeModal(MODAL_TYPE.TRIGGER_CHOICE_MODAL);
    onSelectCustom?.();
  };

  return (
    <Modal
      MODAL_ID={MODAL_TYPE.TRIGGER_CHOICE_MODAL}
      title="Add Trigger"
      description="Choose how this agent should be triggered"
      icon={<Zap size={16} className="text-primary" />}
      widthClass="w-[min(440px,92vw)]"
      onClose={handleClose}
    >
      <div className="flex flex-col gap-3 py-1">
        <button
          type="button"
          data-testid="trigger-choice-telegram"
          onClick={handleTelegram}
          className="w-full text-left border-2 border-stroke hover:border-primary/50 hover:bg-primary/5 transition-colors p-4 rounded-lg flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-[#229ED9]/10 flex items-center justify-center shrink-0">
            <MessageCircle size={20} className="text-[#229ED9]" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-base-content">Connect Telegram</p>
            <p className="text-xs text-base-content/60 mt-0.5">
              Link a Telegram bot so messages trigger this agent version.
            </p>
          </div>
        </button>

        <button
          type="button"
          data-testid="trigger-choice-discord"
          onClick={handleDiscord}
          className="w-full text-left border-2 border-stroke hover:border-primary/50 hover:bg-primary/5 transition-colors p-4 rounded-lg flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-[#5865F2]/10 flex items-center justify-center shrink-0">
            <MessageSquare size={20} className="text-[#5865F2]" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-base-content">Connect Discord</p>
            <p className="text-xs text-base-content/60 mt-0.5">Link a Discord bot so DMs trigger this agent version.</p>
          </div>
        </button>

        <button
          type="button"
          data-testid="trigger-choice-custom"
          onClick={handleCustom}
          className="w-full text-left border-2 border-stroke hover:border-primary/50 hover:bg-primary/5 transition-colors p-4 rounded-lg flex items-start gap-3"
        >
          <div className="w-10 h-10 rounded-lg bg-base-200 flex items-center justify-center shrink-0">
            <Zap size={20} className="text-base-content/70" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm text-base-content">Custom Trigger</p>
            <p className="text-xs text-base-content/60 mt-0.5">
              Open ViaSocket embed to build a custom automation trigger.
            </p>
          </div>
        </button>
      </div>
    </Modal>
  );
};

export default TriggerChoiceModal;
