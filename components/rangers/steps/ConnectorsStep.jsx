"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { Link2, Maximize2, Minimize2, Pencil, Plus } from "lucide-react";
import { useCustomSelector } from "@/customHooks/customSelector";
import { getAllFunctions } from "@/store/action/bridgeAction";
import useConnectorEmbed from "../useConnectorEmbed";

/** The box in this step that the builder is docked into. */
const EMBED_PARENT_ID = "ranger-connector-embed-parent";

// Fallback tile colours for tools with no service icon, keyed off the name so a
// given tool always gets the same swatch.
const MONOGRAM_COLORS = ["#ff7a59", "#2684ff", "#0f9d58", "#635bff", "#5e6ad2", "#06ac38", "#d6336c", "#f2540b"];
const monogramColor = (seed = "") =>
  MONOGRAM_COLORS[Math.abs([...seed].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % MONOGRAM_COLORS.length];

const ConnectorsStep = ({ orgId, connectedTools = {}, onConnectTool, canConnect }) => {
  const dispatch = useDispatch();
  const [connectingId, setConnectingId] = useState(null);
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

  const handleConnect = async (tool) => {
    if (!onConnectTool || connectingId) return;
    setConnectingId(tool.id);
    try {
      const result = await onConnectTool(tool.id);
      setErrors((prev) => ({ ...prev, [tool.id]: result?.success ? "" : result?.message || "Failed to connect." }));
    } finally {
      setConnectingId(null);
    }
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
            const isConnecting = connectingId === tool.id;
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

                  <button
                    type="button"
                    data-testid={`ranger-connector-connect-${tool.id}`}
                    className={`btn btn-xs ${isConnected ? "btn-ghost" : "btn-outline"}`}
                    disabled={isConnected || isConnecting || !canConnect}
                    onClick={() => handleConnect(tool)}
                  >
                    {isConnecting ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        Connecting
                      </>
                    ) : isConnected ? (
                      "Connected"
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
