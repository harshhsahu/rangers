"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Database, FilePlus, Link2, Pencil, Plus, Server } from "lucide-react";
import { useCustomSelector } from "@/customHooks/customSelector";
import { getAllFunctions } from "@/store/action/bridgeAction";
import KnowledgeBaseModal from "@/components/modals/KnowledgeBaseModal";
import { MODAL_TYPE } from "@/utils/enums";
import { openModal } from "@/utils/utility";
import { toast } from "@/utils/toast";
import useEmbedToolCreated from "@/customHooks/useEmbedToolCreated";
import useConnectorEmbed from "../useConnectorEmbed";

/** The box the builder is docked into on this step. */
const EMBED_PARENT_ID = "onboarding-connector-embed-parent";

// Fallback tile colours for tools with no service icon, keyed off the name so a
// given tool always gets the same swatch.
const MONOGRAM_COLORS = ["#ff7a59", "#2684ff", "#0f9d58", "#635bff", "#5e6ad2", "#06ac38", "#d6336c", "#f2540b"];
const monogramColor = (seed = "") =>
  MONOGRAM_COLORS[Math.abs([...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % MONOGRAM_COLORS.length];

const DASHED_CTA =
  "inline-flex items-center gap-[7px] rounded-[12px] border border-dashed border-line-strong px-[18px] py-[11px] text-[12.5px] text-soft";

/**
 * Connectors: the ViaSocket tool builder, MCP servers, the org's authenticated
 * tools, and a knowledge-base hand-off. Every part of this step is optional.
 *
 * Whether a tool can be attached right now depends on how the wizard got here.
 * "Write the prompt for me" creates the agent on the Prompt step, so from then
 * on (`hasAgent`) a tool is attached to its version the moment it is picked or
 * built. Written by hand, no agent exists yet — creating one just to hold a
 * tool would leave a stray agent behind for anyone who walks out — so the pick
 * stays in wizard state and deploy attaches it. Either way the id is kept in
 * `selectedToolIds`, and deploy skips whatever is already attached.
 *
 * MCP servers are always deploy-time, written as
 * `configuration.mcp_config.servers` (the shape McpServerList saves).
 */
const ConnectorsPane = ({
  orgId,
  mcpServers,
  onMcpServersChange,
  selectedToolIds,
  onSelectedToolIdsChange,
  selectedKbIds,
  onSelectedKbIdsChange,
  hasAgent = false,
  onConnectTool,
  onDisconnectTool,
}) => {
  const dispatch = useDispatch();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // script_id of the tool the builder is editing, or null while building a new one.
  const [editScriptId, setEditScriptId] = useState(null);
  const [embedHost, setEmbedHost] = useState(null);
  const [mcpFormOpen, setMcpFormOpen] = useState(false);
  const [mcpName, setMcpName] = useState("");
  const [mcpUrl, setMcpUrl] = useState("");
  // The tool whose attach/detach call is in flight, so only its row shows it.
  const [busyToolId, setBusyToolId] = useState(null);

  const { embedToken, functionData, integrationData, knowledgeBases } = useCustomSelector((state) => {
    const orgData = state?.bridgeReducer?.org?.[orgId] || {};
    return {
      embedToken: orgData.embed_token,
      functionData: orgData.functionData || {},
      integrationData: orgData.integrationData || {},
      knowledgeBases: state?.knowledgeBaseReducer?.knowledgeBaseData?.[orgId] || [],
    };
  });

  useEffect(() => {
    if (Object.keys(functionData).length === 0) dispatch(getAllFunctions());
  }, [dispatch, functionData]);

  const { error: embedError, clearError: clearEmbedError } = useConnectorEmbed({
    embedToken,
    host: embedHost,
    reloadKey,
    scriptId: editScriptId,
    enabled: builderOpen,
    meta: { type: "tool", createFrom: "Ranger Onboarding" },
  });

  const tools = useMemo(
    () =>
      Object.values(functionData)
        .filter(Boolean)
        .map((tool) => {
          const integration = integrationData?.[tool?.script_id] || {};
          return {
            id: tool._id,
            scriptId: tool.script_id,
            name: tool.title || integration.title || tool.script_id || "Untitled tool",
            description: tool.description || integration.description || tool.script_id || "",
            icon: integration.serviceIcons?.[0] || null,
          };
        }),
    [functionData, integrationData]
  );

  /**
   * Pick or drop one tool. The selection moves first so the row answers the
   * click either way; when the agent already exists the version is updated too,
   * and a rejected detach puts the tool back rather than showing it as gone
   * while it is still attached.
   */
  const applyTool = async (toolId, connect, label = "Tool") => {
    if (busyToolId) return { success: false };
    onSelectedToolIdsChange(
      connect
        ? selectedToolIds.includes(toolId)
          ? selectedToolIds
          : [...selectedToolIds, toolId]
        : selectedToolIds.filter((id) => id !== toolId)
    );

    const action = connect ? onConnectTool : onDisconnectTool;
    if (!hasAgent || !action) return { success: true, deferred: true };

    setBusyToolId(toolId);
    try {
      const result = await action(toolId);
      if (result?.success) return result;
      if (connect) {
        // Left selected on purpose: deploy retries whatever is not attached yet.
        toast.error(`${label} could not be attached now — it will be connected on deploy.`);
      } else {
        onSelectedToolIdsChange(selectedToolIds.includes(toolId) ? selectedToolIds : [...selectedToolIds, toolId]);
        toast.error(`${label} could not be disconnected — ${result?.message || "try again."}`);
      }
      return result;
    } finally {
      setBusyToolId(null);
    }
  };

  /**
   * A tool built in the builder above is connected to this ranger straight away
   * — the user already said what they wanted by creating it here, so making
   * them press Connect on the row as well is a step for nothing.
   */
  useEmbedToolCreated(async ({ functionId, title, connected }) => {
    if (!functionId || connected) return;
    // The new tool only shows up in the list below after a refetch.
    dispatch(getAllFunctions());
    if (selectedToolIds.includes(functionId)) return;

    const label = title || "Tool";
    const result = await applyTool(functionId, true, label);
    if (result?.success) toast.success(`${label} connected to this ranger`);
  });

  /** `scriptId` reopens an existing tool; omitted, the builder starts blank. */
  const openBuilder = (scriptId = null) => {
    clearEmbedError();
    // A tool built in the embed only shows up in the list after a refetch.
    dispatch(getAllFunctions());
    setEditScriptId(scriptId);
    setReloadKey((key) => key + 1);
    setBuilderOpen(true);
  };

  const saveMcp = () => {
    const name = mcpName.trim();
    const url = mcpUrl.trim();
    if (!name || !url) return;
    onMcpServersChange([...mcpServers, { name, url }]);
    setMcpName("");
    setMcpUrl("");
    setMcpFormOpen(false);
  };

  const toggleKb = (kbId) =>
    onSelectedKbIdsChange(
      selectedKbIds.includes(kbId) ? selectedKbIds.filter((id) => id !== kbId) : [...selectedKbIds, kbId]
    );

  const toggleTool = (tool) => applyTool(tool.id, !selectedToolIds.includes(tool.id), tool.name);

  const canSaveMcp = Boolean(mcpName.trim() && mcpUrl.trim());

  return (
    <div data-testid="onboarding-pane-connectors" id="onboarding-pane-connectors">
      <div className="flex items-center gap-[14px] rounded-[14px] border border-line bg-card px-4 py-[15px]">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-ink">Connector builder</div>
          <div className="pt-[2px] text-[12px] text-soft">
            Create and authenticate a ViaSocket tool for this organization.
          </div>
        </div>
        <button
          type="button"
          data-testid="onboarding-new-connector-button"
          id="onboarding-new-connector-button"
          disabled={!embedToken}
          onClick={() => openBuilder()}
          className="inline-flex flex-none items-center gap-[6px] rounded-[10px] bg-acc px-[14px] py-[9px] text-[12.5px] font-bold text-acc-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={14} />
          New connector
        </button>
      </div>

      {builderOpen && (
        <div className="mt-[10px] overflow-hidden rounded-[14px] border border-line bg-card">
          <div className="flex items-center justify-between gap-[10px] border-b border-card-line px-[14px] py-[10px]">
            <span className="text-[12px] text-soft">Add apps to power smarter workflows</span>
            <button
              type="button"
              data-testid="onboarding-close-builder-button"
              onClick={() => setBuilderOpen(false)}
              className="text-[12px] font-semibold text-soft"
            >
              Close
            </button>
          </div>
          {embedToken ? (
            <div
              id={EMBED_PARENT_ID}
              ref={setEmbedHost}
              data-testid="onboarding-connector-embed-parent"
              className="relative h-[26rem] w-full overflow-hidden bg-paper"
            >
              {embedError && (
                <div className="absolute inset-0 grid place-items-center gap-2 px-4 text-center">
                  <p className="text-[12px] text-error">{embedError}</p>
                  <button type="button" className="btn btn-xs" onClick={() => openBuilder()}>
                    Retry
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid h-[26rem] place-items-center px-5 text-center text-[12.5px] text-soft">
              The connector builder is still loading for this organization.
            </div>
          )}
        </div>
      )}

      <div className="pt-[22px]">
        <div className="pb-2 text-[13px] font-semibold text-ink">MCP servers</div>

        {mcpServers.map((server, index) => (
          <div
            key={`${server.name}-${index}`}
            data-testid={`onboarding-mcp-row-${index}`}
            className="mb-2 flex items-center gap-[11px] rounded-[12px] border border-line bg-card px-[14px] py-[11px]"
          >
            <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-paper text-soft">
              <Server size={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink">{server.name}</span>
              <span className="block truncate font-mono text-[10.5px] text-soft opacity-80">{server.url}</span>
            </span>
            <button
              type="button"
              data-testid={`onboarding-mcp-remove-${index}`}
              onClick={() => onMcpServersChange(mcpServers.filter((_, i) => i !== index))}
              className="text-[12px] font-semibold text-soft"
            >
              Remove
            </button>
          </div>
        ))}

        {mcpFormOpen ? (
          <div className="flex items-center gap-2 rounded-[12px] border border-line bg-card px-3 py-[10px]">
            <input
              autoComplete="off"
              type="text"
              data-testid="onboarding-mcp-name-input"
              placeholder="Server name"
              className="w-[150px] !rounded-[8px] !border !border-line !bg-card-band px-[10px] py-2 text-[12.5px] text-ink outline-none placeholder:text-soft"
              value={mcpName}
              onChange={(event) => setMcpName(event.target.value)}
            />
            <input
              autoComplete="off"
              type="text"
              data-testid="onboarding-mcp-url-input"
              placeholder="https://mcp.example.com/sse"
              className="min-w-0 flex-1 !rounded-[8px] !border !border-line !bg-card-band px-[10px] py-2 font-mono text-[11.5px] text-ink outline-none placeholder:text-soft"
              value={mcpUrl}
              onChange={(event) => setMcpUrl(event.target.value)}
            />
            <button
              type="button"
              data-testid="onboarding-mcp-save-button"
              disabled={!canSaveMcp}
              onClick={saveMcp}
              className={`flex-none rounded-[8px] px-[14px] py-2 text-[12.5px] font-bold ${
                canSaveMcp ? "bg-acc text-acc-ink" : "cursor-not-allowed bg-paper-sunken text-soft"
              }`}
            >
              Add
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid="onboarding-mcp-open-form-button"
            onClick={() => setMcpFormOpen(true)}
            className={DASHED_CTA}
          >
            <Plus size={13} className="opacity-45" />
            Add MCP configuration
          </button>
        )}
      </div>

      <div className="pt-[22px]">
        <div className="text-[13px] font-semibold text-ink">Organization tools</div>
        <div className="pb-2 pt-[2px] text-[12px] text-soft">
          Authenticated tools you can hand to this ranger. They are connected when you deploy.
        </div>

        {tools.length === 0 ? (
          <div className="rounded-[12px] border border-dashed border-line-strong p-5 text-center text-[12.5px] text-soft">
            No authenticated tools yet. Create one above and it shows up here.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tools.map((tool) => {
              const isPicked = selectedToolIds.includes(tool.id);
              return (
                <div
                  key={tool.id}
                  data-testid={`onboarding-tool-row-${tool.id}`}
                  className={`rounded-[12px] border bg-card px-[14px] py-[11px] ${
                    isPicked ? "border-acc-line bg-acc-soft" : "border-line"
                  }`}
                >
                  <div className="flex items-center gap-[11px]">
                    <span
                      className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-[9px] text-[12px] font-bold text-white"
                      style={tool.icon ? undefined : { background: monogramColor(tool.name) }}
                    >
                      {tool.icon ? (
                        <img src={tool.icon} alt="" className="h-[18px] w-[18px] object-contain" />
                      ) : (
                        tool.name.charAt(0).toUpperCase() || <Link2 size={14} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-ink">{tool.name}</span>
                      <span className="block truncate text-[11px] text-soft">{tool.description}</span>
                    </span>
                    <button
                      type="button"
                      title="Edit this connector"
                      data-testid={`onboarding-tool-edit-${tool.id}`}
                      disabled={!embedToken || !tool.scriptId}
                      onClick={() => openBuilder(tool.scriptId)}
                      className="grid h-[26px] w-[26px] flex-none place-items-center rounded-[8px] border border-line text-soft transition-colors hover:text-ink disabled:opacity-40"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      aria-pressed={isPicked}
                      data-testid={`onboarding-tool-toggle-${tool.id}`}
                      disabled={Boolean(busyToolId)}
                      onClick={() => toggleTool(tool)}
                      className={`flex-none rounded-[8px] px-[11px] py-[6px] text-[12px] font-semibold disabled:opacity-60 ${
                        isPicked ? "border border-acc-line text-acc-deep" : "bg-acc text-acc-ink"
                      }`}
                    >
                      {busyToolId === tool.id ? "Saving…" : isPicked ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-[22px]">
        <div className="text-[13px] font-semibold text-ink">Knowledge base</div>
        <div className="pb-2 pt-[2px] text-[12px] text-soft">
          Sources this ranger can answer from. Connected when you deploy.
        </div>

        {knowledgeBases.length > 0 && (
          <div className="flex flex-col gap-2 pb-2">
            {knowledgeBases.map((kb) => {
              const isPicked = selectedKbIds.includes(kb._id);
              return (
                <div
                  key={kb._id}
                  data-testid={`onboarding-kb-row-${kb._id}`}
                  className={`flex items-center gap-[11px] rounded-[12px] border px-[14px] py-[11px] ${
                    isPicked ? "border-acc-line bg-acc-soft" : "border-line bg-card"
                  }`}
                >
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-paper text-soft">
                    <Database size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{kb.title}</span>
                    <span className="block truncate text-[11px] text-soft">{kb.description || kb.url || ""}</span>
                  </span>
                  <button
                    type="button"
                    aria-pressed={isPicked}
                    data-testid={`onboarding-kb-toggle-${kb._id}`}
                    onClick={() => toggleKb(kb._id)}
                    className={`flex-none rounded-[8px] px-[11px] py-[6px] text-[12px] font-semibold ${
                      isPicked ? "border border-acc-line text-acc-deep" : "bg-acc text-acc-ink"
                    }`}
                  >
                    {isPicked ? "Connected" : "Connect"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Opens the same dialog the Knowledge Base page and the configure page
            use, in place — creating a source never navigates away from the
            wizard, and the new row lands in the list above. */}
        <button
          type="button"
          data-testid="onboarding-kb-create-button"
          id="onboarding-kb-create-button"
          onClick={() => openModal(MODAL_TYPE.KNOWLEDGE_BASE_MODAL)}
          className={DASHED_CTA}
        >
          <FilePlus size={13} className="opacity-45" />
          Add a knowledge base
        </button>
      </div>

      <KnowledgeBaseModal params={{ org_id: orgId }} />
    </div>
  );
};

export default ConnectorsPane;
