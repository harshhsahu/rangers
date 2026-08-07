"use client";

import React, { useCallback, useState } from "react";
import { MessageCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import Modal from "@/components/UI/Modal";
import { MODAL_TYPE } from "@/utils/enums";
import { closeModal, RequiredItem } from "@/utils/utility";
import { toast } from "react-toastify";

/**
 * Collect Telegram bot token and save via /api/telegram/setup
 */
const TelegramConnectModal = ({ versionId, agentId, orgId, onSaved }) => {
  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleClose = useCallback(() => {
    if (isSaving) return;
    setBotToken("");
    closeModal(MODAL_TYPE.TELEGRAM_CONNECT_MODAL);
  }, [isSaving]);

  const handleSave = useCallback(async () => {
    const token = botToken.trim();
    if (!token) {
      toast.error("Please enter your Telegram bot token");
      return;
    }
    if (!token.includes(":")) {
      toast.error("Invalid token format. Paste the full token from @BotFather");
      return;
    }
    if (!versionId) {
      toast.error("Missing agent version id");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/telegram/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botToken: token,
          version_id: versionId,
          agent_id: agentId,
          org_id: orgId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to save Telegram bot");
      }

      toast.success("Telegram bot connected");
      if (data?.webhook?.message && !data?.webhook?.registered) {
        toast.info(data.webhook.message, { autoClose: 6000 });
      }
      setBotToken("");
      closeModal(MODAL_TYPE.TELEGRAM_CONNECT_MODAL);
      onSaved?.(data?.data);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to connect Telegram");
    } finally {
      setIsSaving(false);
    }
  }, [botToken, versionId, agentId, orgId, onSaved]);

  return (
    <Modal
      MODAL_ID={MODAL_TYPE.TELEGRAM_CONNECT_MODAL}
      title="Connect Telegram"
      description="Paste your bot token from @BotFather. One bot is linked per agent version."
      icon={<MessageCircle size={16} className="text-[#229ED9]" />}
      widthClass="w-[min(480px,92vw)]"
      onClose={handleClose}
      footer={
        <>
          <button type="button" className="btn btn-sm btn-outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="button" className="btn btn-sm btn-primary gap-2" onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            {isSaving ? "Saving..." : "Save & Connect"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-base-300 bg-base-200/40 p-3 text-xs text-base-content/70 leading-relaxed">
          Open Telegram → search <span className="font-medium text-base-content">@BotFather</span> →{" "}
          <span className="font-medium text-base-content">/newbot</span> or{" "}
          <span className="font-medium text-base-content">/token</span> → copy the token (looks like{" "}
          <code className="text-[10px]">123456:AA...</code>).
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-base-content/80">
            Bot Token <RequiredItem />
          </label>
          <div className="relative">
            <input
              autoComplete="off"
              type={showToken ? "text" : "password"}
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              placeholder="123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw"
              className="input input-bordered input-sm w-full pr-10 text-xs font-mono"
              disabled={isSaving}
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs"
              onClick={() => setShowToken((v) => !v)}
              tabIndex={-1}
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-[11px] text-base-content/50">Stored securely and mapped to this agent version only.</p>
        </div>
      </div>
    </Modal>
  );
};

export default TelegramConnectModal;
