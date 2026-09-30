"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Maximize2, Minimize2, Pencil, Plus, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { toast } from "@/utils/toast";
import KnowledgebaseList from "../configurationComponent/KnowledgebaseList";
import McpServerList from "../configurationComponent/McpServerList";
import { useConfigurationContext } from "../ConfigurationContext";
import UnsupportedFeatureOverlay from "../UnsupportedFeatureOverlay";
import useConnectorEmbed from "@/components/rangers/useConnectorEmbed";
import { useCustomSelector } from "@/customHooks/customSelector";
import { getAllFunctions, updateBridgeVersionAction } from "@/store/action/bridgeAction";

/** Stable, so the builder is not torn down and reopened on every render. */
const EMBED_META = { type: "tool", createFrom: "Agent Connectors" };

const ConnectorsTab = ({ isPublished }) => {
  const dispatch = useDispatch();
  const [showBuilder, setShowBuilder] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  /**
   * script_id of the tool being edited, or null to build a new one. The embed takes it
   * as openViasocket's first argument — passing undefined there is what makes the
   * builder open blank, which is why an existing tool could not be reopened before.
   */
  const [editScriptId, setEditScriptId] = useState(null);
  const rootRef = useRef(null);
  /** The box the builder fills; state so the embed mounts once it is on screen. */
  const [embedHost, setEmbedHost] = useState(null);
  const { shouldToolsShow, params, searchParams, isEditor, isEmbedUser, showMcp } = useConfigurationContext();
  const { embedToken, functionData, integrationData, connectedFunctionIds } = useCustomSelector((state) => {
    const orgData = state?.bridgeReducer?.org?.[params?.org_id] || {};
    const versionData = state?.bridgeReducer?.bridgeVersionMapping?.[params?.id]?.[searchParams?.version];
    const publishedData = state?.bridgeReducer?.allBridgesMap?.[params?.id];

    return {
      embedToken: orgData.embed_token,
      functionData: orgData.functionData || {},
      integrationData: orgData.integrationData || {},
      connectedFunctionIds: isPublished ? publishedData?.function_ids || [] : versionData?.function_ids || [],
    };
  });

  useEffect(() => {
    if (Object.keys(functionData).length === 0) {
      dispatch(getAllFunctions());
    }
  }, [dispatch, functionData]);

  const orgTools = useMemo(
    () =>
      Object.values(functionData)
        .filter(Boolean)
        .map((tool) => {
          const integration = integrationData?.[tool?.script_id] || {};
          return {
            ...tool,
            displayName: tool?.title || integration?.title || tool?.script_id || "Untitled tool",
            serviceIcons: integration?.serviceIcons || [],
          };
        }),
    [functionData, integrationData]
  );

  const { error: embedError } = useConnectorEmbed({
    embedToken,
    host: embedHost,
    enabled: showBuilder,
    meta: EMBED_META,
    scriptId: editScriptId,
  });

  /**
   * Expanding grows the box in place. The embed fills its box, so it follows
   * the new size without remounting and keeps whatever the user had built.
   *
   * Inside the setup modal the box can only grow as far as the dialog allows,
   * so the surrounding modal is stretched to the viewport for as long as the
   * builder is expanded.
   */
  useEffect(() => {
    if (!isExpanded) return undefined;

    const container = rootRef.current?.closest("[data-modal-container]");
    if (!container) return undefined;

    const previousStyle = container.style.cssText;
    container.style.setProperty("width", "100vw", "important");
    container.style.setProperty("height", "100vh", "important");
    container.style.setProperty("max-height", "100vh", "important");
    container.style.setProperty("border-radius", "0", "important");

    return () => {
      container.style.cssText = previousStyle;
    };
  }, [isExpanded]);

  /** `scriptId` reopens an existing tool; omitted, the builder starts blank. */
  const openBuilder = (scriptId = null) => {
    if (!embedToken) {
      toast.error("Connector builder is still loading. Please try again in a moment.");
      return;
    }
    setEditScriptId(scriptId);
    setShowBuilder(true);
  };

  // Tearing the builder down is the hook's cleanup, so closing is just state.
  const closeBuilder = () => {
    setShowBuilder(false);
    setIsExpanded(false);
    setEditScriptId(null);
  };

  const connectTool = (functionId) => {
    if (!functionId || isPublished || !isEditor) return;
    dispatch(
      updateBridgeVersionAction({
        bridgeId: params.id,
        versionId: searchParams?.version,
        dataToSend: {
          functionData: {
            function_id: functionId,
            function_operation: "1",
          },
        },
      })
    );
  };

  /** Detach mirrors EmbedList: operation "0" and the tool's script_id. */
  const disconnectTool = (tool) => {
    if (!tool?._id || isPublished || !isEditor) return;
    dispatch(
      updateBridgeVersionAction({
        bridgeId: params.id,
        versionId: searchParams?.version,
        dataToSend: {
          functionData: {
            function_id: tool._id,
            function_operation: "0",
            script_id: tool.script_id,
          },
        },
      })
    );
  };

  return (
    <div
      ref={rootRef}
      data-testid="connectors-tab-container"
      id="connectors-tab-container"
      className={`w-full relative ${shouldToolsShow ? "" : "overflow-hidden max-h-[46rem]"}`}
    >
      {!shouldToolsShow && <UnsupportedFeatureOverlay featureName="Connectors" />}

      <div className="mt-4 space-y-5 px-2">
        <div className="flex flex-col rounded-xl border-2 border-stroke bg-card">
          <div className="flex flex-none items-center justify-between gap-3 border-b-2 border-stroke p-4">
            <div>
              <h3 className="text-sm font-semibold text-base-content">
                {editScriptId ? "Edit connector" : "Connector builder"}
              </h3>
              <p className="mt-1 text-xs text-soft">
                {editScriptId
                  ? `Editing ${editScriptId}. Changes apply everywhere this tool is used.`
                  : "Create and authenticate a ViaSocket tool for this organization."}
              </p>
            </div>
            {showBuilder ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-1"
                  title={isExpanded ? "Collapse builder" : "Expand builder"}
                  onClick={() => setIsExpanded((expanded) => !expanded)}
                  data-testid="connectors-expand-builder"
                >
                  {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  {isExpanded ? "Collapse" : "Expand"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-1"
                  onClick={closeBuilder}
                  data-testid="connectors-close-builder"
                >
                  <X size={14} />
                  Close
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm gap-1"
                onClick={() => openBuilder()}
                disabled={!shouldToolsShow || isPublished || !isEditor}
                data-testid="connectors-open-builder"
              >
                <Plus size={14} />
                New connector
              </button>
            )}
          </div>

          {showBuilder && (
            <div className="p-3">
              <div
                ref={setEmbedHost}
                data-testid="connectors-viasocket-parent"
                className={`relative w-full overflow-hidden rounded-lg bg-base-100 ${
                  isExpanded ? "h-[calc(100vh-13rem)]" : "h-[32rem]"
                }`}
              >
                {embedError && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-base-100 p-4">
                    <p className="text-center text-xs text-error">{embedError}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MCP servers and the knowledge base are peers — two columns on a wide
            screen, stacked below it. The tool list stays full width underneath. */}
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {(!isEmbedUser || showMcp) && (
            <McpServerList params={params} searchParams={searchParams} isPublished={isPublished} isEditor={isEditor} />
          )}
          <KnowledgebaseList
            params={params}
            searchParams={searchParams}
            isPublished={isPublished}
            isEditor={isEditor}
          />
        </div>

        <section>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-base-content">Organization tools</h3>
            <p className="mt-1 text-xs text-soft">
              Connect or disconnect an authenticated organization tool for this agent.
            </p>
          </div>

          {orgTools.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-stroke p-5 text-center text-sm text-soft">
              No authenticated tools yet. Create one above to get started.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {orgTools.map((tool) => {
                const isConnected = connectedFunctionIds.includes(tool._id);
                return (
                  <div
                    key={tool._id}
                    className={`flex min-w-0 items-center gap-3 rounded-lg border-2 bg-base-100 p-3 ${
                      isConnected ? "border-success" : "border-stroke"
                    }`}
                    data-testid={`org-connector-${tool._id}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-base-200">
                      {tool.serviceIcons?.[0] ? (
                        <img src={tool.serviceIcons[0]} alt="" className="h-5 w-5 object-contain" />
                      ) : (
                        <Link2 size={16} className="text-soft" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-base-content">{tool.displayName}</p>
                      <p className="truncate text-xs text-soft">{tool.script_id}</p>
                    </div>
                    <button
                      type="button"
                      data-testid={`org-connector-edit-${tool._id}`}
                      title="Edit this connector"
                      className="btn btn-ghost btn-xs btn-square"
                      disabled={!embedToken || !tool.script_id}
                      onClick={() => openBuilder(tool.script_id)}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      data-testid={`org-connector-toggle-${tool._id}`}
                      className={`btn btn-xs ${isConnected ? "btn-ghost text-error" : "btn-outline"}`}
                      disabled={isPublished || !isEditor}
                      onClick={() => (isConnected ? disconnectTool(tool) : connectTool(tool._id))}
                    >
                      {isConnected ? "Disconnect" : "Connect"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ConnectorsTab;
