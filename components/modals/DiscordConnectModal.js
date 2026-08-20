"use client";

import React, { useCallback, useState } from "react";
import { MessageSquare, Eye, EyeOff, Loader2, Trash2 } from "lucide-react";
import Modal from "@/components/UI/Modal";
import { MODAL_TYPE } from "@/utils/enums";
import { closeModal, RequiredItem } from "@/utils/utility";
import { toast } from "react-toastify";

/**
 * Connect / manage Discord bot for an agent version (DMs only, v1).
 * Token is stored encrypted — never shown after save.
 */
const DiscordConnectModal = ({ versionId, agentId, orgId, channel, onSaved, onDeleted }) => {
  const isConnected = Boolean(channel?.discord?.botToken);
  const [botToken, setBotToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const busy = isSaving || isDeleting;

  const handleClose = useCallback(() => {
    if (busy) return;
    setBotToken("");
    setShowToken(false);
    closeModal(MODAL_TYPE.DISCORD_CONNECT_MODAL);
  }, [busy]);

  const handleSave = useCallback(async () => {
    const token = botToken.trim();
    if (!token) {
      toast.error("Please enter your Discord bot token");
      return;
    }
    if (token.length < 50) {
      toast.error("Invalid token. Paste the full bot token from the Discord Developer Portal");
      return;
    }
    if (!versionId) {
      toast.error("Missing agent version id");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/discord/setup", {
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
        throw new Error(data?.error || "Failed to save Discord bot");
      }

      toast.success("Discord bot connected");
      if (data?.gateway?.message && !data?.gateway?.connected) {
        toast.info(data.gateway.message, { autoClose: 6000 });
      }
      if (data?.commands?.message) {
        toast.info(data.commands.message, { autoClose: 6000 });
      }
      setBotToken("");
      closeModal(MODAL_TYPE.DISCORD_CONNECT_MODAL);
      onSaved?.(data?.data);
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to connect Discord");
    } finally {
      setIsSaving(false);
    }
  }, [botToken, versionId, agentId, orgId, onSaved]);

  const handleDelete = useCallback(async () => {
    if (!versionId) {
      toast.error("Missing agent version id");
      return;
    }
    if (!window.confirm("Disconnect this Discord bot from this agent version?")) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/discord/setup?version_id=${encodeURIComponent(versionId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Failed to disconnect Discord");
      }
      toast.success("Discord bot disconnected");
      setBotToken("");
      closeModal(MODAL_TYPE.DISCORD_CONNECT_MODAL);
      onDeleted?.();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to disconnect Discord");
    } finally {
      setIsDeleting(false);
    }
  }, [versionId, onDeleted]);

  return (
    <Modal
      MODAL_ID={MODAL_TYPE.DISCORD_CONNECT_MODAL}
      title={isConnected ? "Discord Bot" : "Connect Discord"}
      description={
        isConnected
          ? "Bot is linked to this agent version. The token is encrypted and cannot be viewed."
          : "Paste your Discord bot token. One bot is linked per agent version. DMs only for now."
      }
      icon={<MessageSquare size={16} className="text-[#5865F2]" />}
      widthClass="w-[min(520px,92vw)]"
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
                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  isConnected ? "text-green-700 bg-green-100" : "text-yellow-700 bg-yellow-100"
                }`}
              >
                {isConnected ? "Active" : "Saved"}
              </span>
            </div>
            <p className="text-xs text-base-content/60">
              Token is stored encrypted and is never shown again. Disconnect to remove it, then connect a new token if
              needed. Reply to DMs with the bot (share a server with it first).
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-lg border-2 border-stroke bg-base-200/40 p-3 text-xs text-base-content/70 leading-relaxed">
              <p className="font-medium text-base-content mb-2">How to get your Discord bot token</p>
              <ol className="list-decimal list-inside space-y-1.5">
                <li>
                  Open the{" "}
                  <a
                    href="https://discord.com/developers/applications"
                    target="_blank"
                    rel="noreferrer"
                    className="link link-primary"
                  >
                    Discord Developer Portal
                  </a>{" "}
                  and click <span className="font-medium text-base-content">New Application</span>.
                </li>
                <li>
                  Open <span className="font-medium text-base-content">Bot</span> →{" "}
                  <span className="font-medium text-base-content">Reset Token</span> /{" "}
                  <span className="font-medium text-base-content">Copy</span> the bot token.
                </li>
                <li>
                  Under Privileged Gateway Intents, enable{" "}
                  <span className="font-medium text-base-content">Message Content Intent</span>.
                </li>
                <li>
                  Open <span className="font-medium text-base-content">OAuth2 → URL Generator</span>, select scope{" "}
                  <span className="font-medium text-base-content">bot</span>, permissions{" "}
                  <span className="font-medium text-base-content">Send Messages</span>,{" "}
                  <span className="font-medium text-base-content">Read Message History</span>,{" "}
                  <span className="font-medium text-base-content">Attach Files</span>,{" "}
                  <span className="font-medium text-base-content">Embed Links</span>. Invite the bot to a server.
                </li>
                <li>DM the bot (you must share a server with it first), then paste the token below.</li>
              </ol>
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
                  placeholder="Paste Discord bot token"
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

export default DiscordConnectModal;
