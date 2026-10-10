"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Link2, Trash2 } from "lucide-react";
import { useCustomSelector } from "@/customHooks/customSelector";
import { deleteFunctionAction, getAllFunctions } from "@/store/action/bridgeAction";
import { toast } from "@/utils/toast";
import ViaSocketCatalog, { forgetCatalogAdded } from "@/components/configuration/sections/ViaSocketCatalog";

// Fallback tile colours for tools with no service icon, keyed off the name so a
// given tool always gets the same swatch.
const MONOGRAM_COLORS = ["#ff7a59", "#2684ff", "#0f9d58", "#635bff", "#5e6ad2", "#06ac38", "#d6336c", "#f2540b"];
const monogramColor = (seed = "") =>
  MONOGRAM_COLORS[Math.abs([...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % MONOGRAM_COLORS.length];

const ConnectorsStep = ({
  orgId,
  agentId,
  versionId,
  connectedTools = {},
  onConnectTool,
  onDisconnectTool,
  canConnect,
}) => {
  const dispatch = useDispatch();
  const [busyId, setBusyId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [errors, setErrors] = useState({});

  const { embedToken, functionData, integrationData } = useCustomSelector((state) => {
    const orgData = state?.bridgeReducer?.org?.[orgId] || {};
    return {
      embedToken: orgData.embed_token,
      functionData: orgData.functionData || {},
      integrationData: orgData.integrationData || {},
    };
  });

  useEffect(() => {
    if (Object.keys(functionData).length === 0) dispatch(getAllFunctions());
  }, [dispatch, functionData]);

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
   * Attach or detach one tool, keeping the row's error line in step. Returns
   * the result so the auto-connect below can toast off the same call.
   */
  const runToggle = async (toolId, connect) => {
    const action = connect ? onConnectTool : onDisconnectTool;
    if (!action) return { success: false, message: "Unavailable." };

    setBusyId(toolId);
    try {
      const result = await action(toolId);
      setErrors((prev) => ({
        ...prev,
        [toolId]: result?.success ? "" : result?.message || (connect ? "Failed to connect." : "Failed to disconnect."),
      }));
      return result;
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = (tool, connect) => {
    if (busyId || deletingId) return;
    runToggle(tool.id, connect);
  };

  const handleDelete = async (tool) => {
    if (busyId || deletingId) return;
    if (!window.confirm(`Delete ${tool.name}? You can add it again from the catalog.`)) return;
    setDeletingId(tool.id);
    try {
      if (connectedTools?.[tool.id] && onDisconnectTool) await onDisconnectTool(tool.id);
      const result = await dispatch(
        deleteFunctionAction({ script_id: tool.scriptId || tool.id, functionId: tool.id, orgId })
      );
      if (result?.isAxiosError || result?.response?.status) {
        throw new Error(result?.response?.data?.error || result?.message || "Could not delete the tool");
      }
      forgetCatalogAdded(orgId);
      toast.success(`${tool.name} deleted`);
    } catch (error) {
      toast.error(error?.message || "Could not delete the tool");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div data-testid="ranger-step-connectors-pane">
      <h3 className="text-[15px] font-bold tracking-[-0.2px] text-base-content">
        Connectors <span className="text-[11px] font-semibold text-soft">— optional</span>
      </h3>
      <p className="mb-3 mt-1 text-[12.5px] text-soft">
        Search an app, connect it, and add an action as a tool for this ranger.
      </p>

      <ViaSocketCatalog
        orgId={orgId}
        agentId={agentId}
        versionId={versionId}
        embedToken={embedToken}
        disabled={!canConnect}
      />

      <div className="mb-2 mt-5">
        <h4 className="text-[13px] font-bold text-base-content">Organization tools</h4>
        <p className="mt-0.5 text-[11.5px] text-soft">Authenticated tools you can hand to this ranger.</p>
      </div>

      {tools.length === 0 ? (
        <div className="rounded-[12px] border-2 border-dashed border-stroke p-5 text-center text-[12px] text-soft">
          No authenticated tools yet. Create one above and it shows up here.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {tools.map((tool) => {
            const isConnected = Boolean(connectedTools?.[tool.id]);
            const isBusy = busyId === tool.id;
            const error = errors[tool.id];

            return (
              <div
                key={tool.id}
                data-testid={`ranger-connector-row-${tool.id}`}
                className={`rounded-[12px] border-2 bg-card px-3 py-2.5 ${
                  isConnected ? "border-success" : error ? "border-error" : "border-stroke"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-[9px] text-[13px] font-extrabold text-white"
                    style={tool.icon ? undefined : { background: monogramColor(tool.name) }}
                  >
                    {tool.icon ? (
                      <img src={tool.icon} alt="" className="h-5 w-5 object-contain" />
                    ) : (
                      tool.name.charAt(0).toUpperCase() || <Link2 size={15} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold text-ink">{tool.name}</div>
                    <div className="truncate text-[11px] text-soft">{tool.description}</div>
                  </div>

                  {isConnected && !isBusy && (
                    <span className="flex-none text-[11px] font-semibold text-success">Connected</span>
                  )}

                  <button
                    type="button"
                    data-testid={`ranger-connector-${isConnected ? "disconnect" : "connect"}-${tool.id}`}
                    className={`btn btn-xs ${isConnected ? "btn-ghost text-error" : "btn-outline"}`}
                    disabled={isBusy || deletingId === tool.id || !canConnect || (isConnected && !onDisconnectTool)}
                    onClick={() => handleToggle(tool, !isConnected)}
                  >
                    {isBusy ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        {isConnected ? "Disconnecting" : "Connecting"}
                      </>
                    ) : isConnected ? (
                      "Disconnect"
                    ) : (
                      "Connect"
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-error"
                    disabled={isBusy || deletingId === tool.id}
                    onClick={() => handleDelete(tool)}
                  >
                    <Trash2 size={12} />
                    {deletingId === tool.id ? "Deleting…" : "Delete"}
                  </button>
                </div>

                {error && <p className="mt-2 text-[11px] text-error">{error}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ConnectorsStep;
