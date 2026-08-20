"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link2, Maximize2, Minimize2, Plus, X } from "lucide-react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import ToolsSection from "../ToolsSection";
import McpServerList from "../configurationComponent/McpServerList";
import { useConfigurationContext } from "../ConfigurationContext";
import UnsupportedFeatureOverlay from "../UnsupportedFeatureOverlay";
import { useCustomSelector } from "@/customHooks/customSelector";
import { getAllFunctions, updateBridgeVersionAction } from "@/store/action/bridgeAction";

/** The box the builder is docked into; also the script's configured parentId. */
const EMBED_PARENT_ID = "alert-embed-parent";
/** Wrapper the embed injects — this is the node that gets moved into the box. */
const EMBED_WRAPPER_ID = "iframe-viasocket-embed-parent-container";

/** The embed hides itself on close; this is the only way to dismiss it. */
const closeEmbed = () => {
  try {
    if (typeof window.handleclose === "function") window.handleclose();
  } catch (err) {
    console.warn("Closing the connector builder failed", err);
  }
};

/**
 * The builder mounts itself fixed-position on the body, which leaves it behind
 * any dialog, so docking it into the box means overriding that positioning
 * before re-parenting the node.
 */
const dockWrapper = (wrapper, target) => {
  wrapper.style.setProperty("position", "relative", "important");
  wrapper.style.setProperty("top", "auto", "important");
  wrapper.style.setProperty("left", "auto", "important");
  wrapper.style.setProperty("z-index", "auto", "important");
  wrapper.style.setProperty("width", "100%", "important");
  wrapper.style.setProperty("height", "100%", "important");
  target.appendChild(wrapper);
};

const ConnectorsTab = ({ isPublished }) => {
  const dispatch = useDispatch();
  const [showBuilder, setShowBuilder] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  /** The embed's own inline styles, restored when the builder is closed. */
  const wrapperStyleRef = useRef(null);
  const wrapperRef = useRef(null);
  const rootRef = useRef(null);
  /** Pending close retries, dropped when the builder is reopened. */
  const closeRetriesRef = useRef([]);
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

  // Opening is driven by the box being on screen: the embed renders wherever it
  // wants first, then gets moved in once its wrapper exists.
  useEffect(() => {
    if (!showBuilder || !embedToken) return undefined;

    closeRetriesRef.current.forEach(window.clearTimeout);
    closeRetriesRef.current = [];

    const target = document.getElementById(EMBED_PARENT_ID);
    if (!target) return undefined;

    if (typeof window.openViasocket !== "function") {
      toast.error("Connector builder is still loading. Please try again in a moment.");
      setShowBuilder(false);
      return undefined;
    }

    window.openViasocket(undefined, {
      embedToken,
      meta: { type: "tool", createFrom: "Agent Connectors" },
    });

    let attempts = 0;
    const dockTimer = window.setInterval(() => {
      attempts += 1;
      const wrapper = document.getElementById(EMBED_WRAPPER_ID);
      if (wrapper) {
        if (wrapperStyleRef.current === null) wrapperStyleRef.current = wrapper.style.cssText;
        wrapperRef.current = wrapper;
        dockWrapper(wrapper, target);
        window.clearInterval(dockTimer);
      } else if (attempts > 20) {
        window.clearInterval(dockTimer);
      }
    }, 150);

    return () => {
      window.clearInterval(dockTimer);

      // Park the builder back on the body with its own styles so the next page
      // that opens it is unaffected. This has to happen before handleclose:
      // the embed hides itself on close, and restoring the docked-time styles
      // afterwards would put it back on screen.
      const wrapper = wrapperRef.current || document.getElementById(EMBED_WRAPPER_ID);
      if (wrapper) {
        wrapper.style.cssText = wrapperStyleRef.current ?? "";
        document.body.appendChild(wrapper);
      }
      wrapperStyleRef.current = null;
      wrapperRef.current = null;

      closeEmbed();
      // Closing while the builder is still mounting leaves it to appear a beat
      // later, so keep asking it to close until it has settled.
      closeRetriesRef.current = [400, 1000, 2000].map((delay) => window.setTimeout(closeEmbed, delay));
    };
  }, [showBuilder, embedToken]);

  /**
   * Expanding grows the box in place. The embed node is never re-parented and
   * `openViasocket` is never called again: moving an iframe reloads it, which
   * would throw away whatever the user had built.
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

  const openBuilder = () => {
    if (!embedToken) {
      toast.error("Connector builder is still loading. Please try again in a moment.");
      return;
    }
    setShowBuilder(true);
  };

  // Tearing the builder down is the effect's cleanup, so closing is just state.
  const closeBuilder = () => {
    setShowBuilder(false);
    setIsExpanded(false);
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
              <h3 className="text-sm font-semibold text-base-content">Connector builder</h3>
              <p className="mt-1 text-xs text-soft">Create and authenticate a ViaSocket tool for this organization.</p>
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
                onClick={openBuilder}
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
                id={EMBED_PARENT_ID}
                data-testid="connectors-viasocket-parent"
                className={`w-full overflow-hidden rounded-lg bg-base-100 ${
                  isExpanded ? "h-[calc(100vh-13rem)]" : "h-[32rem]"
                }`}
              />
            </div>
          )}
        </div>

        {(!isEmbedUser || showMcp) && (
          <McpServerList params={params} searchParams={searchParams} isPublished={isPublished} isEditor={isEditor} />
        )}

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

      <ToolsSection isPublished={isPublished} />
    </div>
  );
};

export default ConnectorsTab;
