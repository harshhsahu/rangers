import { CONNECTABLE_CHANNELS, TONES } from "./rangerConstants";

/**
 * Shape returned by the "Build with AI" chat agent on every turn (see
 * app/api/ranger-ai/chat/route.js) — each field carries its own fill status
 * so the sidebar and the "ready to deploy" gate don't have to guess.
 */
const emptyField = () => ({ status: "pending", value: "" });

export const buildInitialDraftConfig = () => ({
  name: emptyField(),
  purpose: emptyField(),
  channels: { channel_name: emptyField(), bot_token: emptyField(), skipped_by_user: false },
  tone: { ...emptyField(), skipped_by_user: false },
  model: { ...emptyField(), skipped_by_user: false },
  connectors: { ...emptyField(), skipped_by_user: false },
  prompt: { ...emptyField(), skipped_by_user: false },
});

/** Opening message + quick-reply chips shown before the user's first turn. */
export const AI_CHAT_GREETING = "Let's build a ranger. In a sentence — what should it do?";

export const AI_CHAT_SUGGESTIONS = [
  "Handle customer support",
  "Qualify inbound sales leads",
  "Moderate our community",
  "Answer internal data questions",
];

/** Order and labels for the "Draft Config" sidebar. */
export const DRAFT_CONFIG_SIDEBAR_FIELDS = [
  { key: "name", label: "Name" },
  { key: "purpose", label: "Purpose" },
  { key: "channels", label: "Channels" },
  { key: "tone", label: "Tone" },
  { key: "model", label: "Model" },
  { key: "connectors", label: "Connectors" },
  { key: "prompt", label: "Prompt" },
];

const isFilled = (field) => field?.status === "filled" && String(field?.value || "").trim().length > 0;

/** Single display value per sidebar row — channels nests two sub-fields into one line. */
export const draftFieldDisplay = (draftConfig, key) => {
  const field = draftConfig?.[key];
  if (key === "channels") {
    const name = field?.channel_name?.value?.trim();
    return isFilled(field?.channel_name) && name ? name : null;
  }
  return isFilled(field) ? field.value.trim() : null;
};

/**
 * Name and purpose are the only hard requirements. A skipped prompt is not a
 * blocker — deploy() (useCreateRanger.js) asks the create-agent API to write
 * one from `purpose` when the form still has none, the same generation the
 * old one-shot "Build with AI" flow relied on.
 */
export const isDraftReadyToDeploy = (draftConfig) =>
  Boolean(draftConfig) && isFilled(draftConfig.name) && isFilled(draftConfig.purpose);

/** Finds the RANGER_CHANNELS key a free-text channel name most likely refers to. */
const matchChannelKey = (name) => {
  const normalized = String(name || "")
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return CONNECTABLE_CHANNELS.find((channel) => normalized.includes(channel.key))?.key || null;
};

const matchTone = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return TONES.find((tone) => tone.value === normalized)?.value || "";
};

/**
 * Maps the chat agent's draft_config onto the wizard's form shape so
 * "Morph & Deploy" can hand off into the same Review/Publish flow the guided
 * setup uses (useCreateRanger.deploy). Only fields we can map with
 * confidence are carried over — an unrecognised channel or tone is left
 * blank rather than guessed, since a wrong guess (e.g. an invalid model id)
 * can fail the provider call downstream.
 */
export const mapDraftConfigToForm = (draftConfig, baseForm) => {
  const patch = {
    name: draftConfig?.name?.value?.trim() || baseForm.name,
    description: draftConfig?.purpose?.value?.trim() || baseForm.description,
    prompt: draftConfig?.prompt?.value?.trim() || baseForm.prompt,
    promptParts: null,
  };

  const tone = matchTone(draftConfig?.tone?.value);
  if (tone) patch.tone = tone;

  const channelKey = matchChannelKey(draftConfig?.channels?.channel_name?.value);
  const botToken = draftConfig?.channels?.bot_token?.value?.trim();
  if (channelKey && botToken) {
    patch.channels = {
      ...baseForm.channels,
      [channelKey]: { enabled: true, credentials: { botToken } },
    };
  }

  // Free-text connector ask from the chat — not a real function_id, so Review
  // surfaces it as a note rather than wiring it into connectedTools.
  const connectorNote = draftFieldDisplay(draftConfig, "connectors");
  if (connectorNote) patch.connectorNotes = connectorNote;

  return patch;
};
