import { TelegramIcon, DiscordIcon, WhatsappIcon, SlackIcon, SmsIcon, VoiceIcon } from "./ChannelIcons";

/**
 * Ranger swatches.
 *
 * Stored as hex and applied via inline `style` on purpose: Tailwind's purge only
 * safelists the `bg-(red|green|yellow|orange|gray)-500` and `trace-*` patterns
 * (see tailwind.config.js), so dynamically-built colour classes would be stripped
 * from the production build.
 */
export const RANGER_COLORS = [
  { key: "red", label: "Red", hex: "#E03131" },
  { key: "blue", label: "Blue", hex: "#1C7ED6" },
  { key: "green", label: "Green", hex: "#2F9E44" },
  { key: "purple", label: "Purple", hex: "#7048E8" },
  { key: "pink", label: "Pink", hex: "#D6336C" },
  { key: "yellow", label: "Yellow", hex: "#F2540B" },
  { key: "black", label: "Slate", hex: "#495057" },
];

export const DEFAULT_RANGER_COLOR = RANGER_COLORS[5].hex;

/**
 * Channels shown in the Command Center and the wizard's channel step.
 *
 * Only telegram and discord are actually implemented (app/api/telegram/setup,
 * app/api/discord/setup). The rest are rendered as "Coming soon" and cannot be
 * toggled on.
 */
export const RANGER_CHANNELS = [
  {
    key: "telegram",
    label: "Telegram",
    icon: TelegramIcon,
    brand: "#229ED9",
    enabled: true,
    setupEndpoint: "/api/telegram/setup",
    blurb: "Bot chats and group replies via @BotFather.",
    credentialFields: [
      {
        key: "botToken",
        label: "Bot Token",
        placeholder: "123456:ABC-DEF...",
        secret: true,
        hint: "Create a bot with @BotFather and paste the full token here.",
      },
    ],
    // Mirrors the check in components/modals/TelegramConnectModal.js
    validate: (creds) => {
      const token = (creds?.botToken || "").trim();
      if (!token) return "Bot token is required.";
      if (!token.includes(":")) return "Invalid token format. Paste the full token from @BotFather.";
      return "";
    },
  },
  {
    key: "discord",
    label: "Discord",
    icon: DiscordIcon,
    brand: "#5865F2",
    enabled: true,
    setupEndpoint: "/api/discord/setup",
    blurb: "Direct messages and server commands.",
    credentialFields: [
      {
        key: "botToken",
        label: "Bot Token",
        placeholder: "MTIzNDU2...",
        secret: true,
        hint: "From the Discord Developer Portal → your app → Bot → Reset Token.",
      },
    ],
    // Mirrors the check in components/modals/DiscordConnectModal.js
    validate: (creds) => {
      const token = (creds?.botToken || "").trim();
      if (!token) return "Bot token is required.";
      if (token.length < 50) return "Invalid token. Paste the full bot token from the Developer Portal.";
      return "";
    },
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    icon: WhatsappIcon,
    brand: "#25D366",
    enabled: false,
    blurb: "Business messaging.",
  },
  { key: "slack", label: "Slack", icon: SlackIcon, brand: "#E01E5A", enabled: false, blurb: "Channel and DM replies." },
  { key: "sms", label: "SMS", icon: SmsIcon, brand: "#7C3AED", enabled: false, blurb: "Text messaging." },
  { key: "voice", label: "Voice", icon: VoiceIcon, brand: "#F2540B", enabled: false, blurb: "Inbound call handling." },
];

export const CONNECTABLE_CHANNELS = RANGER_CHANNELS.filter((channel) => channel.enabled);

/**
 * Creativity presets. The concrete number is derived at render time from the
 * selected model's `additional_parameters.temperature` {min, max, default},
 * because the usable range differs per model (0–1 vs 0–2).
 */
export const CREATIVITY_LEVELS = [
  {
    key: "precise",
    label: "Precise",
    description: "Consistent and factual. Best for support and policy answers.",
    t: 0,
  },
  { key: "balanced", label: "Balanced", description: "A sensible middle ground for most conversations.", t: 0.5 },
  { key: "creative", label: "Creative", description: "More varied phrasing. Good for copy and ideation.", t: 0.7 },
];

export const DEFAULT_CREATIVITY = "balanced";

/**
 * Resolves a creativity preset to a concrete temperature for the given model
 * parameter spec. Returns null when the model does not expose temperature — in
 * that case the key must be omitted from the payload entirely, since an
 * unsupported parameter can fail the provider call.
 */
export const resolveTemperature = (levelKey, tempParam) => {
  if (!tempParam) return null;
  const min = Number(tempParam.min ?? 0);
  const max = Number(tempParam.max ?? 1);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;

  const level = CREATIVITY_LEVELS.find((item) => item.key === levelKey) || CREATIVITY_LEVELS[1];
  if (level.key === "precise") return min;
  if (level.key === "balanced") {
    const fallback = min + 0.5 * (max - min);
    const declared = Number(tempParam.default);
    return Number.isFinite(declared) ? declared : Number(fallback.toFixed(2));
  }
  return Number((min + 0.7 * (max - min)).toFixed(2));
};

/**
 * Tone presets. Single source of truth — also consumed by
 * components/configuration/configurationComponent/ToneDropdown.js.
 */
export const TONES = [
  { value: "authoritative", prompt: "Generate a strong, commanding response with authoritative guidance." },
  { value: "casual", prompt: "Generate a response in a relaxed, easygoing, and informal tone." },
  { value: "confident", prompt: "Generate a direct and assertive response with a confident tone." },
  { value: "concise", prompt: "Generate a brief, straight-to-the-point response." },
  { value: "curious", prompt: "Generate an inquisitive response showing curiosity." },
  { value: "empathetic", prompt: "Generate a response showing understanding, concern, and support." },
  { value: "friendly", prompt: "Generate a warm and welcoming response with a friendly tone." },
  {
    value: "formal",
    prompt: "Generate a response in a professional, respectful, and clear tone suitable for official communication.",
  },
  { value: "humorous", prompt: "Generate a playful and light-hearted response with humor." },
  {
    value: "inspiring",
    prompt: "Generate a response that uplifts and inspires the reader toward a higher purpose or goal.",
  },
  { value: "motivational", prompt: "Generate an encouraging and uplifting response." },
  { value: "neutral", prompt: "Generate an objective and balanced response without emotional engagement." },
  { value: "polite", prompt: "Generate a respectful and courteous response." },
  { value: "sarcastic", prompt: "Generate a witty and ironic response with a touch of sarcasm." },
];

export const PROMPT_TEMPLATES = {
  "Customer Support": `You are {{name}}, a customer support agent.

Your job:
- Answer product questions accurately using the knowledge base
- Resolve billing, account and order issues end to end where you can
- Never invent policy, prices or dates you cannot verify

Rules:
- Confirm the customer's identity before touching account data
- If you are unsure or the customer asks twice, hand off to a human
- Match the customer's language automatically`,
  "Sales Qualification": `You are {{name}}, an inbound sales agent.

Your job:
- Qualify leads on budget, authority, need and timeline
- Book a demo when the lead is a fit
- Log every qualified lead with a short summary

Rules:
- Never quote custom pricing; route pricing questions to an account executive
- Be brief. Two questions per message at most
- If the lead shows buying intent, escalate to a human immediately`,
  "Community Moderation": `You are {{name}}, a community moderator.

Your job:
- Enforce the community rules consistently and without drama
- Remove spam, scams and targeted harassment
- Warn first, then time out on repeat offences

Rules:
- Never argue publicly with a member; state the rule and move on
- Escalate doxxing, threats or illegal content to a human moderator at once
- Log every action with the rule number that justified it`,
  "Internal Ops": `You are {{name}}, an internal operations assistant.

Your job:
- Answer questions about internal data, metrics and process
- Run standing reports on request and post the digest
- Point people to the right owner when a request is not yours

Rules:
- Only surface data the asker is cleared to see
- Show the query or source behind any number you report
- Say "I don't have that" rather than estimating`,
  Blank: `You are {{name}}.

Your job:
-

Rules:
- `,
};

export const GUIDED_STEPS = [
  { key: "identity", label: "Identity" },
  { key: "channels", label: "Channels" },
  { key: "model", label: "Model" },
  { key: "prompt", label: "Prompt" },
  { key: "review", label: "Review" },
];

/** AI mode skips Model and Prompt — the AI writes both. */
export const AI_STEPS = [
  { key: "identity", label: "Identity" },
  { key: "channels", label: "Channels" },
  { key: "review", label: "Review" },
];

export const DEPLOY_PHASES = {
  IDLE: "idle",
  CREATING: "creating",
  HYDRATING: "hydrating",
  CONFIGURING: "configuring",
  CHANNELS: "channels",
  PUBLISHING: "publishing",
  DONE: "done",
  FAILED: "failed",
};

export const DEPLOY_PHASE_LABELS = {
  [DEPLOY_PHASES.CREATING]: "Creating the ranger",
  [DEPLOY_PHASES.HYDRATING]: "Loading its version",
  [DEPLOY_PHASES.CONFIGURING]: "Applying prompt, model and tone",
  [DEPLOY_PHASES.CHANNELS]: "Binding channels",
  [DEPLOY_PHASES.PUBLISHING]: "Publishing",
};
