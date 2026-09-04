import { getBridgeVersionAction } from "@/store/action/bridgeAction";
import { getSingleBridge } from "@/config/bridgeApi";
import { fetchSingleBridgeReducer } from "@/store/reducer/bridgeReducer";

/**
 * What the "Update the ranger" agent says it changed, and how the screen catches up.
 *
 * The agent writes through the same APIs the left pane reads from, so without this the
 * user would sit on stale config until a reload. Rather than refetching everything on
 * every turn, the agent names a target and only that slice is re-fetched.
 *
 * Targets are a closed set: the proxy drops anything it does not recognise, so a new
 * target added agent-side is ignored here instead of throwing.
 */
export const UPDATE_TARGET = {
  PROMPT: "PROMPT",
  MODEL_CONFIG: "MODEL_CONFIG",
  AGENT: "AGENT",
  CHANNEL: "CHANNEL",
  MCP: "MCP",
  KNOWLEDGE_BASE: "KNOWLEDGE_BASE",
};

/**
 * Which slice of the screen each of the agent's tools invalidates.
 *
 * Read from the stream's tool_result events rather than from anything the agent says
 * about itself: a tool that ran is a fact, a tool the agent claims to have run is not.
 * Names must match the tool names configured on the agent.
 */
const TARGET_BY_TOOL = {
  update_agent_info: UPDATE_TARGET.AGENT,
  update_version_info: UPDATE_TARGET.MODEL_CONFIG,
  managerangerchannel: UPDATE_TARGET.CHANNEL,
  // One tool covers both MCP servers and knowledge bases. Either way the change lands on
  // the version document, and MCP and KNOWLEDGE_BASE share its refetch — so this mapping
  // only has to pick a target that refreshes the version. The agent's own `changes`
  // entry is what distinguishes the two for labels and toasts.
  managerangerresources: UPDATE_TARGET.MCP,
};

/**
 * Matched case-insensitively: the tool's configured name is free text, and a casing
 * difference between here and the agent would silently cost the user their refresh.
 */
export const targetForTool = (toolName) => TARGET_BY_TOOL[String(toolName || "").toLowerCase()] || null;

/** Human labels for the "what changed" strip under an assistant reply. */
export const TARGET_LABEL = {
  [UPDATE_TARGET.PROMPT]: "Prompt",
  [UPDATE_TARGET.MODEL_CONFIG]: "Model",
  [UPDATE_TARGET.AGENT]: "Agent",
  [UPDATE_TARGET.CHANNEL]: "Channel",
  [UPDATE_TARGET.MCP]: "MCP servers",
  [UPDATE_TARGET.KNOWLEDGE_BASE]: "Knowledge base",
};

/**
 * One refetch per target. PROMPT and MODEL_CONFIG both live on the version document,
 * so they share a fetch — de-duping by target means a turn that rewrote the prompt and
 * switched the model still hits the API once.
 */
const REFRESH_BY_TARGET = {
  [UPDATE_TARGET.PROMPT]: ({ dispatch, versionId }) => dispatch(getBridgeVersionAction({ versionId })),
  [UPDATE_TARGET.MODEL_CONFIG]: ({ dispatch, versionId }) => dispatch(getBridgeVersionAction({ versionId })),
  // mcp_config and doc_ids both live on the version document, so they share its fetch.
  [UPDATE_TARGET.MCP]: ({ dispatch, versionId }) => dispatch(getBridgeVersionAction({ versionId })),
  [UPDATE_TARGET.KNOWLEDGE_BASE]: ({ dispatch, versionId }) => dispatch(getBridgeVersionAction({ versionId })),
  /**
   * Name and description live on the agent, not the version, so only the agent document
   * is re-read and merged into allBridgesMap.
   *
   * Deliberately NOT getSingleBridgesAction: that opens with clearPreviousBridgeDataReducer(),
   * which with no arguments empties allBridgesMap and bridgeVersionMapping outright — the
   * whole config screen unmounts and reloads to pick up a changed name.
   */
  [UPDATE_TARGET.AGENT]: async ({ dispatch, bridgeId }) => {
    const response = await getSingleBridge(bridgeId);
    const agent = response?.data?.agent;
    if (agent?._id) dispatch(fetchSingleBridgeReducer({ bridge: agent }));
  },
  /**
   * Channel documents are Mongo-backed and outside redux, so there is no store slice to
   * invalidate. ChannelsPanel owns its own fetch and listens for this event; a caller
   * that renders channels differently can pass onChannelsChanged instead.
   */
  [UPDATE_TARGET.CHANNEL]: ({ onChannelsChanged }) => {
    if (onChannelsChanged) return onChannelsChanged();
    return window.dispatchEvent(new CustomEvent("gtwy:channels-changed"));
  },
};

/**
 * Runs the refetches for one turn's changes.
 *
 * `blockedTargets` opts a target out — the prompt editor holds unsaved local text often
 * enough that silently overwriting it with a refetch would lose the user's work, so the
 * caller can withhold PROMPT and warn instead.
 *
 * Returns the targets that were actually refreshed, so the caller can tell the user what
 * it skipped.
 */
export const applyRangerUpdates = (
  changes = [],
  { dispatch, bridgeId, versionId, onChannelsChanged, blockedTargets = [] } = {}
) => {
  const blocked = new Set(blockedTargets);
  const targets = new Set(
    changes.filter((change) => change?.status === "success" && REFRESH_BY_TARGET[change.target]).map((c) => c.target)
  );

  const refreshed = [];
  targets.forEach((target) => {
    if (blocked.has(target)) return;
    try {
      REFRESH_BY_TARGET[target]({ dispatch, bridgeId, versionId, onChannelsChanged });
      refreshed.push(target);
    } catch (error) {
      console.error(`Refreshing ${target} after a ranger update failed`, error);
    }
  });

  /**
   * Announces what was refreshed so the setup rows can show which one moved. Without it
   * a value simply changes underneath the user, who was looking at the chat and has no
   * idea which of the four rows to check.
   */
  if (refreshed.length) {
    window.dispatchEvent(new CustomEvent("gtwy:ranger-refreshed", { detail: { targets: refreshed } }));
  }

  return refreshed;
};
