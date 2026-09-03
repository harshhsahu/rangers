/**
 * Turns an `updateBridgeVersionAction` payload into something a toast can say.
 *
 * The action is called from ~120 places with wildly different payloads, so the
 * toast has to name the change itself — "Model updated" tells the user what
 * saved, "Version updated" does not.
 */

/** Top-level `dataToSend` keys → what the user calls them. */
const FIELD_LABELS = {
  agent_info: "Agent info",
  agents: "Connected agents",
  apikey_object_id: "API key",
  actionJson: "Actions",
  auto_model_select: "Automatic model selection",
  bridge_status: "Agent status",
  bridge_usage: "Usage limit",
  bridgeType: "Agent type",
  built_in_tools_data: "Built-in tools",
  cache_on: "Caching",
  doc_ids: "Knowledge base",
  embed_override: "Embed overrides",
  folder_id: "Folder",
  functionData: "Tools",
  gpt_memory: "Memory",
  gpt_memory_context: "Memory context",
  IsstarterQuestionEnable: "Starter questions",
  meta: "Agent details",
  name: "Name",
  post_tool: "Post-processing tool",
  pre_tools: "Pre-processing tool",
  settings: "Settings",
  slugName: "Slug",
  starterQuestion: "Starter questions",
  user_reference: "User reference",
  variables_path: "Variables",
  version_description: "Version description",
  web_search_filters: "Web search filters",
};

/** `configuration.*` keys, which are what most edits actually touch. */
const CONFIGURATION_LABELS = {
  fallback: "Fallback model",
  is_rich_text: "Rich text",
  mcp_config: "MCP servers",
  model: "Model",
  prompt: "Prompt",
  response_type: "Response format",
  service: "Provider",
  tools: "Tools",
  type: "Model type",
  vision: "Vision",
};

/** Config keys with no friendly name of their own are advanced parameters. */
const ADVANCED_PARAMETER_LABEL = "Advanced parameters";

/** Settings sub-keys worth naming instead of the generic "Settings". */
const SETTINGS_LABELS = {
  review_agent: "Review agent",
  tone: "Tone",
};

const joinLabels = (labels) => {
  const unique = [...new Set(labels.filter(Boolean))];
  if (!unique.length) return "";
  if (unique.length === 1) return unique[0];
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(", ")} and ${unique[unique.length - 1]}`;
};

const describeConfiguration = (configuration) => {
  const keys = Object.keys(configuration || {});
  if (!keys.length) return [];
  const labels = keys.map((key) => CONFIGURATION_LABELS[key] || ADVANCED_PARAMETER_LABEL);
  // Naming five advanced parameters individually is noise; one label covers them.
  return labels.length > 3 ? ["Configuration"] : labels;
};

const describeSettings = (settings) => {
  const keys = Object.keys(settings || {});
  const named = keys.map((key) => SETTINGS_LABELS[key]).filter(Boolean);
  return named.length === keys.length && named.length ? named : [FIELD_LABELS.settings];
};

/**
 * @param {object} dataToSend the payload handed to updateBridgeVersionAction
 * @returns {string} a subject for the toast, e.g. "Model", "Prompt and Tools"
 */
export const describeVersionUpdate = (dataToSend) => {
  const keys = Object.keys(dataToSend || {});
  if (!keys.length) return "Version";

  const labels = keys.flatMap((key) => {
    if (key === "configuration") return describeConfiguration(dataToSend.configuration);
    if (key === "settings") return describeSettings(dataToSend.settings);
    return FIELD_LABELS[key] || null;
  });

  // An unmapped key is better reported vaguely than wrongly.
  return joinLabels(labels) || "Version";
};

export default describeVersionUpdate;
