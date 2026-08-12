"use client";

import React, { useCallback, useState } from "react";
import { MessageCircle, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import Modal from "@/components/UI/Modal";
import { MODAL_TYPE } from "@/utils/enums";
import { closeModal, RequiredItem } from "@/utils/utility";
import { toast } from "react-toastify";

/**
 * Connect / manage Telegram bot for an agent version.
 * Token is stored encrypted — never shown after save.
 */
const TelegramConnectModal = ({ versionId, agentId, orgId, channel, onSaved, onDeleted }) => {
  const isConnected = Boolean(channel?.telegram?.botToken);
  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const busy = isSaving || isDeleting;

  const handleClose = useCallback(() => {
    if (busy) return;
    setBotToken("");
    setShowToken(false);
    closeModal(MODAL_TYPE.TELEGRAM_CONNECT_MODAL);
  }, [busy]);

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

  const handleDelete = useCallback(async () => {
    if (!versionId) {
      toast.error("Missing agent version id");
      return;
    }
    if (!window.confirm("Disconnect this Telegram bot from this agent version?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/telegram/setup?version_id=${encodeURIComponent(versionId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to disconnect Telegram");
      }
      toast.success("Telegram bot disconnected");
      setBotToken("");
      closeModal(MODAL_TYPE.TELEGRAM_CONNECT_MODAL);
      onDeleted?.();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to disconnect Telegram");
    } finally {
      setIsDeleting(false);
    }
  }, [versionId, onDeleted]);

  return (
    <Modal
      MODAL_ID={MODAL_TYPE.TELEGRAM_CONNECT_MODAL}
      title={isConnected ? "Telegram Bot" : "Connect Telegram"}
      description={
        isConnected
          ? "Bot is linked to this agent version. The token is encrypted and cannot be viewed."
          : "Paste your bot token from @BotFather. One bot is linked per agent version."
      }
      icon={<MessageCircle size={16} className="text-[#229ED9]" />}
      widthClass="w-[min(480px,92vw)]"
      onClose={handleClose}
      footer={
        isConnected ? (
          <>
            <button
              type="button"
              className="btn btn-sm btn-error btn-outline gap-2"
              onClick={handleDelete}
              disabled={busy}
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              {isDeleting ? "Removing..." : "Disconnect"}
            </button>
            <button type="button" className="btn btn-sm btn-outline" onClick={handleClose} disabled={busy}>
              Close
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-sm btn-outline" onClick={handleClose} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-sm btn-primary gap-2" onClick={handleSave} disabled={busy}>
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              {isSaving ? "Saving..." : "Save & Connect"}
            </button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {isConnected ? (
          <div className="rounded-lg border-2 border-stroke bg-base-200/40 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">Connection</span>
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${channel?.telegram?.webhookSet ? "text-green-700 bg-green-100" : "text-yellow-700 bg-yellow-100"}`}
              >
                {channel?.telegram?.webhookSet ? "Active" : "Saved"}
              </span>
            </div>
            <p className="text-xs text-base-content/60">
              Token is stored encrypted and is never shown again. Disconnect to remove it, then connect a new token if
              needed.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border-2 border-stroke bg-base-200/40 p-3 text-xs text-base-content/70 leading-relaxed">
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
                  disabled={busy}
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
              <p className="text-[11px] text-base-content/50">
                Stored encrypted and mapped to this agent version only. It won’t be shown again after saving.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default TelegramConnectModal;
