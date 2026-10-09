/**
 * First-run onboarding — step list and per-step copy.
 *
 * Kept separate from GUIDED_STEPS (rangerConstants.js): the modal's six steps
 * are laid out for the modal, while onboarding is full-screen and only ever
 * connects one channel.
 */
export const ONBOARDING_STEPS = [
  { key: "identity", title: "Identity", hint: "Name, role, colour" },
  { key: "prompt", title: "Purpose & prompt", hint: "What it should do" },
  { key: "model", title: "Model", hint: "Provider and creativity" },
  { key: "connectors", title: "Connectors", hint: "Tools, MCP, knowledge" },
  { key: "channel", title: "Channel", hint: "Telegram or Discord" },
  { key: "review", title: "Review & deploy", hint: "Publish version 1" },
];

export const ONBOARDING_COPY = {
  identity: [
    "Let's build your first ranger",
    "A ranger is one agent: a prompt, a model, and the channels it answers on. This takes about two minutes.",
  ],
  prompt: [
    "What should it do?",
    "Describe the job in a sentence or two. We can turn that into a starting system prompt you can edit.",
  ],
  model: ["Pick the model", "Choose a provider and the model this ranger runs on."],
  connectors: [
    "Give it hands",
    "Optional. Build an authenticated tool, point at an MCP server, or attach a knowledge base — all of it can wait until later.",
  ],
  channel: [
    "Where should it answer?",
    "Telegram and Discord are live today. You can add more channels from the Command Center later.",
  ],
  review: ["Ready to deploy", "Check it over. Everything is editable afterwards from the ranger's configure page."],
};

/**
 * Providers whose model catalogue is fetched even without a key, so the model
 * step is never an empty list on a fresh org.
 */
export const MODEL_STEP_DEFAULT_SERVICES = ["openai", "anthropic", "gemini"];
