"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Link2, Trash2 } from "lucide-react";
import { useDispatch } from "react-redux";
import KnowledgebaseList from "../configurationComponent/KnowledgebaseList";
import McpServerList from "../configurationComponent/McpServerList";
import { useConfigurationContext } from "../ConfigurationContext";
import UnsupportedFeatureOverlay from "../UnsupportedFeatureOverlay";
import ViaSocketCatalog, { forgetCatalogAdded } from "./ViaSocketCatalog";
import { useCustomSelector } from "@/customHooks/customSelector";
import { deleteFunctionAction, getAllFunctions, updateBridgeVersionAction } from "@/store/action/bridgeAction";
import { toast } from "@/utils/toast";

const ConnectorsTab = ({ isPublished }) => {
  const dispatch = useDispatch();
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

  const [deletingId, setDeletingId] = useState(null);
  const deleteTool = async (tool) => {
    if (!tool?._id || isPublished || !isEditor || deletingId) return;
    if (!window.confirm(`Delete ${tool.displayName}? You can add it again from the catalog.`)) return;
    setDeletingId(tool._id);
    try {
      if (connectedFunctionIds.includes(tool._id)) disconnectTool(tool);
      const scriptId = tool.script_id || tool._id;
      const result = await dispatch(
        deleteFunctionAction({ script_id: scriptId, functionId: tool._id, orgId: params?.org_id })
      );
      if (result?.isAxiosError || result?.response?.status) {
        throw new Error(result?.response?.data?.error || result?.message || "Could not delete the tool");
      }
      forgetCatalogAdded(params?.org_id);
      toast.success(`${tool.displayName} deleted`);
    } catch (error) {
      toast.error(error?.message || "Could not delete the tool");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      data-testid="connectors-tab-container"
      id="connectors-tab-container"
      className={`w-full relative ${shouldToolsShow ? "" : "overflow-hidden max-h-[46rem]"}`}
    >
      {!shouldToolsShow && <UnsupportedFeatureOverlay featureName="Connectors" />}

      <div className="mt-4 space-y-5 px-2">
        <ViaSocketCatalog
          orgId={params?.org_id}
          agentId={params?.id}
          versionId={searchParams?.version}
          embedToken={embedToken}
          disabled={!shouldToolsShow || isPublished || !isEditor}
        />

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
              Connect a tool to this agent, or delete it to add it again from the catalog.
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
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        data-testid={`org-connector-toggle-${tool._id}`}
                        className={`btn btn-xs ${isConnected ? "btn-ghost text-error" : "btn-outline"}`}
                        disabled={isPublished || !isEditor}
                        onClick={() => (isConnected ? disconnectTool(tool) : connectTool(tool._id))}
                      >
                        {isConnected ? "Disconnect" : "Connect"}
                      </button>
                      <button
                        type="button"
                        data-testid={`org-connector-delete-${tool._id}`}
                        className="btn btn-ghost btn-xs text-error"
                        disabled={isPublished || !isEditor || deletingId === tool._id}
                        onClick={() => deleteTool(tool)}
                      >
                        <Trash2 size={12} />
                        {deletingId === tool._id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
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
