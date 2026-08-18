import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { updateBridgeVersionAction } from "@/store/action/bridgeAction";
import { useCustomSelector } from "@/customHooks/customSelector";
import InfoTooltip from "@/components/InfoTooltip";
import CustomPromptModal from "./CustomPromptModal";
import { MODAL_TYPE } from "@/utils/enums";
import { openModal, closeModal } from "@/utils/utility";
import { CircleQuestionMark, Pencil } from "lucide-react";
import { TONES } from "@/components/rangers/rangerConstants";
import ThemedSelect from "@/components/UI/ThemedSelect";

/** "{}" is the stored shape for "no tone"; "custom" opens the free-text modal. */
const TONE_OPTIONS = [
  { value: "{}", label: "None" },
  ...TONES.map((tone) => ({ value: tone.value, label: tone.value })),
  { value: "custom", label: "Custom" },
];

const ToneDropdown = ({ params, searchParams, isPublished, isEditor = true }) => {
  const isReadOnly = isPublished || !isEditor;
  const { reduxTone } = useCustomSelector((state) => ({
    reduxTone:
      state?.bridgeReducer?.bridgeVersionMapping?.[params?.id]?.[searchParams?.version]?.settings?.tone || null,
  }));
  const dispatch = useDispatch();

  const [selectedTone, setSelectedTone] = useState(reduxTone?.value || "");

  useEffect(() => {
    setSelectedTone(reduxTone?.value || "");
  }, [reduxTone]);

  const openCustomModal = () => {
    openModal(MODAL_TYPE.CUSTOM_TONE_MODAL);
  };

  const closeCustomModal = () => {
    closeModal(MODAL_TYPE.CUSTOM_TONE_MODAL);
    if (reduxTone?.value !== "custom") setSelectedTone(reduxTone?.value || "");
  };

  const saveToRedux = (value, prompt) => {
    dispatch(
      updateBridgeVersionAction({
        versionId: searchParams?.version,
        dataToSend: { settings: { tone: value === "" ? "" : { value, prompt } } },
      })
    );
  };

  const handleToneChange = (toneValue) => {
    if (toneValue === "custom") {
      openCustomModal();
      return;
    }
    if (toneValue !== reduxTone?.value) {
      setSelectedTone(toneValue);
      if (toneValue === "" || toneValue === "{}") {
        saveToRedux({}, "");
      } else {
        const tone = TONES.find((t) => t.value === toneValue);
        if (tone) saveToRedux(tone.value, tone.prompt);
      }
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-1">
        <span className="label-text font-medium">Tone</span>
        <InfoTooltip tooltipContent="Select the tone of voice for your AI agent's responses. This affects how the agent communicates with users.">
          <CircleQuestionMark size={14} className="text-soft hover:text-ink cursor-help" />
        </InfoTooltip>
      </div>

      <div className="relative">
        <ThemedSelect
          id="tone-select"
          testId="tone-select"
          value={selectedTone}
          onChange={handleToneChange}
          options={TONE_OPTIONS}
          placeholder="Select a tone"
          disabled={isReadOnly}
          className={selectedTone === "custom" && !isReadOnly ? "[&>button]:pr-9" : ""}
        />
        {selectedTone === "custom" && !isReadOnly && (
          <button
            type="button"
            className="absolute right-9 top-[13px] text-base-content/40 hover:text-primary transition-colors"
            title="Edit custom tone"
            onClick={openCustomModal}
          >
            <Pencil size={13} />
          </button>
        )}
      </div>

      <CustomPromptModal
        modalId={MODAL_TYPE.CUSTOM_TONE_MODAL}
        title="Custom Tone"
        description="Describe exactly how you want the AI to sound"
        placeholder="e.g. Respond in a warm yet professional tone — approachable but never overly casual. Use clear, simple language."
        prompt={reduxTone?.value === "custom" ? reduxTone?.prompt || "" : ""}
        onSave={(value) => {
          setSelectedTone("custom");
          saveToRedux("custom", value);
        }}
        onClose={closeCustomModal}
      />
    </div>
  );
};

export default ToneDropdown;
