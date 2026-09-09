"use client";

/**
 * Cross-component signal for "a tool was just built in the ViaSocket embed".
 *
 * The embed's postMessage is handled in exactly one place — the org layout —
 * because that is where the tool is persisted (`createApiAction`) and where its
 * function id first exists. Screens that hold their own idea of which tools
 * belong to an agent (the ranger create modal, the onboarding wizard) need that
 * id the moment it appears, so the layout re-broadcasts it as a DOM event
 * rather than every screen re-parsing the embed message and racing the create.
 *
 * `connected: true` means the layout already attached the tool to the agent in
 * the URL, so listeners must not attach it a second time.
 */
export const EMBED_TOOL_CREATED_EVENT = "gtwy:embed-tool-created";

export const emitEmbedToolCreated = (detail) => {
  if (typeof window === "undefined" || !detail?.functionId) return;
  window.dispatchEvent(new CustomEvent(EMBED_TOOL_CREATED_EVENT, { detail }));
};
