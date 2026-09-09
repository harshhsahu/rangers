"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Link2, Maximize2, Minimize2, Pencil, Plus } from "lucide-react";
import { useCustomSelector } from "@/customHooks/customSelector";
import { getAllFunctions } from "@/store/action/bridgeAction";
import useEmbedToolCreated from "@/customHooks/useEmbedToolCreated";
import { toast } from "@/utils/toast";
import useConnectorEmbed from "../useConnectorEmbed";

/** The box in this step that the builder is docked into. */
const EMBED_PARENT_ID = "ranger-connector-embed-parent";

// Fallback tile colours for tools with no service icon, keyed off the name so a
// given tool always gets the same swatch.
const MONOGRAM_COLORS = ["#ff7a59", "#2684ff", "#0f9d58", "#635bff", "#5e6ad2", "#06ac38", "#d6336c", "#f2540b"];
const monogramColor = (seed = "") =>
  MONOGRAM_COLORS[Math.abs([...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % MONOGRAM_COLORS.length];

const ConnectorsStep = ({ orgId, connectedTools = {}, onConnectTool, onDisconnectTool, canConnect }) => {
  const dispatch = useDispatch();
  // The tool whose connect/disconnect call is in flight, so only its own row shows a spinner.
  const [busyId, setBusyId] = useState(null);
  const [errors, setErrors] = useState({});
  // Bumping this tears the builder down and opens a fresh one in the box.
  const [reloadKey, setReloadKey] = useState(0);
  // script_id of the tool the builder is editing, or null while building a new one.
  const [editScriptId, setEditScriptId] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  // Set by the ref callback below, so the open effect runs only once the target
  // box is actually in the DOM (it is rendered conditionally).
  const [embedHost, setEmbedHost] = useState(null);

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

  // The builder opens with the step — no button.
  const { error: embedError, clearError: clearEmbedError } = useConnectorEmbed({
    embedToken,
    host: embedHost,
    reloadKey,
    scriptId: editScriptId,
    meta: { type: "tool", createFrom: "Ranger Connectors" },
  });

  // A connector built in the embed only shows up in the list after a refetch.
  const reloadBuilder = () => {
    clearEmbedError();
    dispatch(getAllFunctions());
    setEditScriptId(null);
    setReloadKey((key) => key + 1);
  };

  /** Reopens an existing tool in the same box. reloadKey forces the embed to remount. */
  const editTool = (scriptId) => {
    if (!scriptId) return;
    clearEmbedError();
    setEditScriptId(scriptId);
    setReloadKey((key) => key + 1);
  };

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

  /**
   * A tool built in the builder above is attached to this ranger straight away
   * — the user already said what they wanted by creating it here, so making
   * them press Connect on the row as well is a step for nothing. `connected`
   * means the org layout already attached it, so this would double up.
   */
  useEmbedToolCreated(async ({ functionId, title, connected }) => {
    if (!functionId || connected) return;
    // The new tool only shows up in the list below after a refetch.
    dispatch(getAllFunctions());

    const label = title || "Tool";
    if (connectedTools?.[functionId]) return;
    if (!onConnectTool || !canConnect) return;

    const result = await runToggle(functionId, true);
    if (result?.success) {
      toast.success(`${label} connected to this ranger`);
    } else {
      toast.error(`${label} was created but not connected — ${result?.message || "Failed to connect."}`);
    }
  });

  const handleToggle = (tool, connect) => {
    if (busyId) return;
    runToggle(tool.id, connect);
  };

  return (
    <div data-testid="ranger-step-connectors-pane">
      <h3 className="text-[15px] font-bold tracking-[-0.2px] text-base-content">
        Connectors <span className="text-[11px] font-semibold text-soft">— optional</span>
      </h3>
      <p className="mb-3 mt-1 text-[12.5px] text-soft">
        Build a new connector below, then attach any authenticated tool to this ranger.
      </p>

      {/* Expanding only resizes this box — the embed node stays put, so the
          builder keeps its state. */}
      <div
        className={`flex flex-col overflow-hidden rounded-[12px] border-2 border-stroke bg-card ${
          isExpanded ? "fixed inset-3 z-high shadow-2xl" : ""
        }`}
      >
        <div className="flex flex-none items-center justify-between gap-3 border-b-2 border-stroke px-3 py-2">
          <span className="text-[11.5px] text-soft">Connector builder</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="ranger-connector-add-new"
              className="btn btn-xs gap-1"
              disabled={!embedToken}
              onClick={reloadBuilder}
            >
              <Plus size={12} />
              Add New Connection
            </button>
            <button
              type="button"
              data-testid="ranger-connector-expand"
              title={isExpanded ? "Collapse builder" : "Expand builder"}
              className="btn btn-xs gap-1"
              onClick={() => setIsExpanded((expanded) => !expanded)}
            >
              {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
        </div>

        {embedToken ? (
          <div
            id={EMBED_PARENT_ID}
            ref={setEmbedHost}
            data-testid="ranger-connector-embed-parent"
            className={`relative w-full overflow-hidden bg-base-100 ${isExpanded ? "min-h-0 flex-1" : "h-[26rem]"}`}
          >
            {embedError ? (
              <div className="absolute inset-0 grid place-items-center gap-2 px-4 text-center">
                <p className="text-[12px] text-error">{embedError}</p>
                <button type="button" className="btn btn-xs" onClick={reloadBuilder}>
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className={`grid place-items-center px-4 text-center text-[12px] text-soft ${
              isExpanded ? "min-h-0 flex-1" : "h-[26rem]"
            }`}
          >
            The connector builder is still loading for this organization.
          </div>
        )}
      </div>

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

                  <button
                    type="button"
                    data-testid={`ranger-connector-edit-${tool.id}`}
                    title="Edit this connector"
                    className="btn btn-ghost btn-xs btn-square"
                    disabled={!embedToken || !tool.scriptId}
                    onClick={() => editTool(tool.scriptId)}
                  >
                    <Pencil size={12} />
                  </button>

                  {isConnected && !isBusy && (
                    <span className="flex-none text-[11px] font-semibold text-success">Connected</span>
                  )}

                  <button
                    type="button"
                    data-testid={`ranger-connector-${isConnected ? "disconnect" : "connect"}-${tool.id}`}
                    className={`btn btn-xs ${isConnected ? "btn-ghost text-error" : "btn-outline"}`}
                    disabled={isBusy || !canConnect || (isConnected && !onDisconnectTool)}
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
