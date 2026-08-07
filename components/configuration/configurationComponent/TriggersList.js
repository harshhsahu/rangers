import { getOrCreateNotificationAuthKey } from "@/config/index";
import { useCustomSelector } from "@/customHooks/customSelector";
import { updateTriggerDataReducer } from "@/store/reducer/bridgeReducer";
import { AddIcon } from "@/components/Icons";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import InfoTooltip from "@/components/InfoTooltip";
import { CircleQuestionMark, MessageCircle, Zap } from "lucide-react";
import { MODAL_TYPE } from "@/utils/enums";
import { openModal } from "@/utils/utility";
import TriggerChoiceModal from "@/components/modals/TriggerChoiceModal";
import TelegramConnectModal from "@/components/modals/TelegramConnectModal";

function getStatusClass(status) {
  switch (status?.toString().trim().toLowerCase()) {
    case "drafted":
      return " text-yellow-700 bg-yellow-100";
    case "paused":
    case "deleted":
      return "text-red-700 bg-red-100";
    case "active":
    case "published":
      return "text-green-700 bg-green-100";
    case "rejected":
      return "text-gray-700 bg-gray-100";
    default:
      return "bg-gray-100";
  }
}

export default function TriggersList({ params, searchParams, isEmbedUser, isReadOnly }) {
  const dispatch = useDispatch();
  const versionId = searchParams?.version || searchParams?.get?.("version");
  const { triggerEmbedToken, triggerData, bridgeType } = useCustomSelector((state) => ({
    triggerEmbedToken: state?.bridgeReducer?.org?.[params?.org_id]?.triggerEmbedToken,
    triggerData: state?.bridgeReducer?.org?.[params?.org_id]?.triggerData,
    bridgeType: state?.bridgeReducer?.allBridgesMap?.[params?.id]?.bridgeType,
  }));
  const [triggers, setTriggers] = useState([]);
  const [authkey, setAuthkey] = useState("");
  const [telegramChannel, setTelegramChannel] = useState(null);

  async function getAndSetAuthKey() {
    const keytoset = await getOrCreateNotificationAuthKey("gtwy_bridge_trigger");
    if (keytoset) setAuthkey(keytoset?.authkey);
  }

  useEffect(() => {
    if (triggerData) {
      const filteredTriggers = triggerData.filter((flow) => flow?.metadata?.bridge_id === params?.id) || [];
      setTriggers(filteredTriggers);
      return;
    }
    setTriggers([]);
  }, [triggerData, params?.id]);

  useEffect(() => {
    if (!isEmbedUser) getAndSetAuthKey();
  }, [isEmbedUser]);

  // Load existing telegram channel for this version
  useEffect(() => {
    if (!versionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/channel-details?version_id=${encodeURIComponent(versionId)}`);
        const data = await res.json();
        if (!cancelled && data?.success) setTelegramChannel(data.data || null);
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isReadOnly || isEmbedUser) return;
    if (!window?.openViasocket || !authkey || !triggerEmbedToken) return;

    const isTriggerType = bridgeType?.toString()?.toLowerCase() === "trigger";
    if (!isTriggerType) return;

    const autoOpenKey = `auto_open_trigger_embed_${params?.id}`;
    if (sessionStorage.getItem(autoOpenKey) !== "1") return;

    sessionStorage.removeItem(autoOpenKey);
    openModal(MODAL_TYPE.TRIGGER_CHOICE_MODAL);
  }, [bridgeType, authkey, triggerEmbedToken, params?.id, isReadOnly, isEmbedUser]);

  function openTrigger(triggerId) {
    if (typeof window === "undefined" || !window.openViasocket) return;
    openViasocket(triggerId, {
      embedToken: triggerEmbedToken,
      meta: {
        type: "trigger",
        bridge_id: params?.id,
      },
      configurationJson: {
        row4qwo5ot1l: {
          key: "Talk_to_Bridge",
          inputValues: {
            bridge: params?.id,
            _bridge: params?.id,
            message: `\${JSON.stringify(context.req.body)}`,
            _message: `\${JSON.stringify(context.req.body)}`,
          },
          authValues: {
            pauth_key: authkey,
          },
        },
      },
      hiddenSteps: {
        row4qwo5ot1l: true,
      },
    });
  }

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [params?.id]);

  async function handleMessage(e) {
    const newTrigger = e?.data;
    if (e.data?.metadata?.type !== "trigger") return;

    setTriggers((prevTriggers) => {
      const existingIndex = prevTriggers.findIndex((trigger) => trigger.id === newTrigger.id);

      if (existingIndex !== -1) {
        const updatedTriggers = [...prevTriggers];
        updatedTriggers[existingIndex] = { ...prevTriggers[existingIndex], ...newTrigger };
        return updatedTriggers;
      } else {
        dispatch(updateTriggerDataReducer({ dataToSend: newTrigger, orgId: params?.org_id }));
        return [newTrigger, ...prevTriggers];
      }
    });
  }

  const activeTriggers = triggers?.filter((trigger) => trigger?.status !== "deleted") || [];
  const hasTelegram = Boolean(telegramChannel?.telegram?.botToken);
  const hasTriggers = activeTriggers.length > 0 || hasTelegram;

  const openAddMenu = () => {
    if (isReadOnly) return;
    openModal(MODAL_TYPE.TRIGGER_CHOICE_MODAL);
  };

  return (
    <div>
      <div className="w-full gap-2 flex flex-col px-2 py-2 cursor-default">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center gap-2">
            <p className="text-sm whitespace-nowrap">Triggers</p>
            <InfoTooltip tooltipContent="A trigger is an event or condition that initiates an automated process or workflow.">
              <CircleQuestionMark size={14} className="text-gray-500 hover:text-gray-700 cursor-help" />
            </InfoTooltip>
          </div>
          {hasTriggers && (
            <button
              data-testid="triggers-add-button"
              id="triggers-add-button"
              onClick={openAddMenu}
              className="btn btn-outline hover:bg-base-200 hover:text-base-content btn-xs gap-1"
              disabled={isReadOnly}
            >
              <AddIcon className="w-3 h-3" />
              ADD
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2 w-full">
        {!hasTriggers ? (
          <div className="w-full max-w-md">
            <div className="border-2 border-dashed border-base-200 p-4 text-center">
              <p className="text-sm text-base-content/70">No triggers found.</p>
              <button
                data-testid="triggers-add-first-button"
                id="triggers-add-first-button"
                onClick={openAddMenu}
                className="flex items-center justify-center gap-1 mt-3 text-base-content hover:text-base-content/80 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full"
                disabled={isReadOnly}
              >
                <AddIcon className="w-3 h-3" />
                Add
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md">
            <div className="flex flex-col gap-2">
              {hasTelegram && (
                <div
                  data-testid="trigger-card-telegram"
                  className="group flex items-center border border-base-200 cursor-pointer bg-base-100 relative min-h-[44px] w-full transition-colors duration-200"
                  onClick={() => !isReadOnly && openModal(MODAL_TYPE.TELEGRAM_CONNECT_MODAL)}
                >
                  <div className="p-2 flex-1 flex items-center">
                    <div className="flex items-center gap-2 w-full">
                      <MessageCircle size={16} className="shrink-0 text-[#229ED9]" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-normal block truncate">Telegram Bot</span>
                        <span className="text-[10px] text-base-content/50">Connected</span>
                      </div>
                      <span
                        className={`shrink-0 inline-block rounded-full capitalize px-2 py-0.5 text-[10px] font-medium ${
                          telegramChannel.telegram.webhookSet
                            ? "text-green-700 bg-green-100"
                            : "text-yellow-700 bg-yellow-100"
                        }`}
                      >
                        {telegramChannel.telegram.webhookSet ? "Active" : "Saved"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTriggers.map((trigger) => (
                <div
                  data-testid={`trigger-card-${trigger?.id}`}
                  id={`trigger-card-${trigger?.id}`}
                  key={trigger?.id}
                  onClick={() => openTrigger(trigger?.id)}
                  className="group flex items-center border border-base-200 cursor-pointer bg-base-100 relative min-h-[44px] w-full transition-colors duration-200"
                >
                  <div className="p-2 flex-1 flex items-center">
                    <div className="flex items-center gap-2 w-full">
                      <Zap size={16} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-normal block truncate">{trigger?.title}</span>
                      </div>
                      <span
                        className={`shrink-0 inline-block rounded-full capitalize px-2 py-0.5 text-[10px] font-medium ${getStatusClass(trigger?.status)}`}
                      >
                        {trigger?.status || "Draft"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <TriggerChoiceModal onSelectCustom={() => openTrigger()} />
      <TelegramConnectModal
        versionId={versionId}
        agentId={params?.id}
        orgId={params?.org_id}
        onSaved={(doc) => setTelegramChannel(doc)}
      />
    </div>
  );
}
