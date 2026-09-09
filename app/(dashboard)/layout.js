"use client";
import dynamic from "next/dynamic";
import LoadingSpinner from "@/components/LoadingSpinner";
import Protected from "@/components/Protected";
import { getSingleMessage } from "@/config/index";
import { useCustomSelector } from "@/customHooks/customSelector";
import { ThemeManager, useThemeManager } from "@/customHooks/useThemeManager";
import { getAllApikeyAction } from "@/store/action/apiKeyAction";
import {
  createApiAction,
  deleteFunctionAction,
  getAllBridgesAction,
  getAllFunctions,
  getPrebuiltToolsAction,
  integrationAction,
  updateApiAction,
  updateBridgeVersionAction,
} from "@/store/action/bridgeAction";
import { getAllKnowBaseDataAction } from "@/store/action/knowledgeBaseAction";
import { updateUserMetaOnboarding, updateOrgMetaAction } from "@/store/action/orgAction";
import { getServiceAction } from "@/store/action/serviceAction";
import { getFromCookies, removeCookie } from "@/utils/utility";
import { createAndStoreInternalJwt, getStoredGtwyOrgId } from "@/utils/internalAuth";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, use } from "react";
import { useDispatch } from "react-redux";
import useRtLayerEventHandler from "@/customHooks/useRtLayerEventHandler";
import {
  getApiKeyGuideAction,
  getTutorialDataAction,
  getDescriptionsAction,
  getFinishReasonsAction,
  getLinksAction,
} from "@/store/action/flowDataAction";
import { cleanVariablesPathByFields } from "@/utils/variableValidation";
import { userDetails } from "@/store/action/userDetailsAction";
import { storeMarketingRefUserAction } from "@/store/action/marketingRefAction";
import { useEmbedScriptLoader } from "@/customHooks/embedScriptLoader";
import ServiceInitializer from "@/components/organization/ServiceInitializer";
import { emitEmbedToolCreated } from "@/utils/toolEvents";
import { ORG_ID } from "@/utils/enums";

const Navbar = dynamic(() => import("@/components/Navbar"), { loading: () => <LoadingSpinner /> });
const MainSlider = dynamic(() => import("@/components/sliders/MainSlider"), { loading: () => <LoadingSpinner /> });
const ChatDetails = dynamic(() => import("@/components/historyPageComponents/ChatDetails"), {
  loading: () => <LoadingSpinner />,
});
const KeyboardShortcutsModal = dynamic(() => import("@/components/modals/KeyboardShortcutsModal"), {
  loading: () => <LoadingSpinner />,
});

function layoutOrgPage({ children, params, searchParams, isEmbedUser, isFocus }) {
  const dispatch = useDispatch();
  const pathName = usePathname();
  const urlParams = useParams();
  const path = pathName.split("?")[0].split("/");
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSliderOpen, setIsSliderOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const resolvedParams = { ...use(params), org_id: ORG_ID };
  const resolvedSearchParams = useSearchParams();

  const {
    embedToken,
    alertingEmbedToken,
    versionData,
    variablesPath,
    preTools,
    SERVICES,
    currentUser,
    doctstar_embed_token,
    currrentOrgDetail,
    themeMode,
    functionData,
    tools,
    historyEmbed,
  } = useCustomSelector((state) => ({
    embedToken: state?.bridgeReducer?.org?.[ORG_ID]?.embed_token,
    alertingEmbedToken: state?.bridgeReducer?.org?.[ORG_ID]?.alerting_embed_token,
    variablesPath:
      state?.bridgeReducer?.bridgeVersionMapping?.[path[3]]?.[resolvedSearchParams?.get("version")]?.variables_path ||
      {},
    organizations: state.userDetailsReducer.organizations,
    preTools:
      state?.bridgeReducer?.bridgeVersionMapping?.[path[3]]?.[resolvedSearchParams?.get("version")]?.pre_tools || [],
    SERVICES: state?.serviceReducer?.services,
    tools:
      state?.bridgeReducer?.bridgeVersionMapping?.[path[3]]?.[resolvedSearchParams?.get("version")]?.function_ids || [],
    currentUser: state.userDetailsReducer.userDetails,
    doctstar_embed_token: state?.bridgeReducer?.org?.[ORG_ID]?.doctstar_embed_token || "",
    currrentOrgDetail: state?.userDetailsReducer?.organizations?.[ORG_ID],
    themeMode: state.appInfoReducer?.embedUserDetails?.themeMode || "system",
    functionData: state?.bridgeReducer?.org?.[ORG_ID]?.functionData || {},
    historyEmbed: state?.appInfoReducer?.embedUserDetails?.historyEmbed || false,
  }));
  useEffect(() => {
    if (!isEmbedUser) {
      dispatch(getTutorialDataAction());
    }
    if (pathName.endsWith("agents")) {
      dispatch(getFinishReasonsAction());
    }
    if (pathName.endsWith("agents") && !isEmbedUser) {
      dispatch(userDetails());
    }
    dispatch(getDescriptionsAction());
    dispatch(getLinksAction());

    if (pathName.endsWith("apikeys") && !isEmbedUser) {
      dispatch(getApiKeyGuideAction());
    }
  }, [pathName, ORG_ID, isEmbedUser]);

  const { changeTheme } = useThemeManager();

  useEffect(() => {
    if (isEmbedUser && themeMode) {
      changeTheme(themeMode);
    }
  }, [isEmbedUser, themeMode]);

  useEffect(() => {
    const updateUserMeta = async () => {
      // Skip user meta updates for embed users
      if (isEmbedUser) return;

      const unlimited_access = getFromCookies("unlimited_access");
      const utmSource = getFromCookies("utm_source");
      const utmMedium = getFromCookies("utm_medium");
      const utmCampaign = getFromCookies("utm_campaign");
      const utmTerm = getFromCookies("utm_term");
      const utmContent = getFromCookies("utm_content");
      let currentUserMeta = currentUser?.meta;

      // Build UTM object with only present values from URL that are NOT already in user meta
      const utmParams = {};
      const paramsUpdate = {};
      if (utmSource && !currentUser?.meta?.utm_source) utmParams.utm_source = utmSource;
      if (utmMedium && !currentUser?.meta?.utm_medium) utmParams.utm_medium = utmMedium;
      if (utmCampaign && !currentUser?.meta?.utm_campaign) utmParams.utm_campaign = utmCampaign;
      if (utmTerm && !currentUser?.meta?.utm_term) utmParams.utm_term = utmTerm;
      if (utmContent && !currentUser?.meta?.utm_content) utmParams.utm_content = utmContent;
      if (unlimited_access && !currrentOrgDetail?.meta?.unlimited_access)
        paramsUpdate.unlimited_access = unlimited_access;

      // Check if we need to update user meta (either null meta or new UTM params
      try {
        // If UTM params exist, store marketing ref first
        if (!currentUser?.meta) {
          await dispatch(
            storeMarketingRefUserAction({
              ...utmParams,
              client_id: currentUser.id,
              client_email: currentUser.email,
              client_name: currentUser.name,
              created_at: currentUser.created_at,
            })
          );
        }

        // Single call to update user meta with all data (no onboarding init)
        const updatedUser = {
          ...currentUser,
          meta: {
            ...(currentUserMeta || {}),
            // Add UTM params if they exist
            ...utmParams,
            ...paramsUpdate,
          },
        };
        if (paramsUpdate?.unlimited_access && !currrentOrgDetail?.meta?.unlimited_access) {
          const updatedOrgDetails = {
            ...currrentOrgDetail,
            meta: {
              ...currrentOrgDetail?.meta,
              unlimited_access: true,
            },
          };
          dispatch(updateOrgMetaAction(ORG_ID, updatedOrgDetails));
          removeCookie("unlimited_access");
        }

        const data =
          Object.keys(utmParams).length > 0 || Object.keys(paramsUpdate).length > 0
            ? await dispatch(updateUserMetaOnboarding(currentUser.id, updatedUser))
            : null;
        if (data?.data?.status) {
          currentUserMeta = data?.data?.data?.user?.meta;
        }
      } catch (err) {
        console.error("Error updating user meta:", err);
      }
    };

    updateUserMeta();
  }, []);

  // The tool builder (window.openViasocket) is reachable from anywhere in the
  // org — agents, tools, and the Ranger modal — so the script loads on every
  // org route rather than an allow-list of paths. /alerts is the one page that
  // swaps in the alerting token instead.
  useEmbedScriptLoader(
    pathName.includes("alerts") && !isEmbedUser ? alertingEmbedToken : embedToken,
    isEmbedUser,
    false
  );

  useRtLayerEventHandler();

  useEffect(() => {
    if (!SERVICES || Object?.entries(SERVICES)?.length === 0) {
      dispatch(getServiceAction());
    }
  }, [SERVICES]);

  useEffect(() => {
    dispatch(
      getAllBridgesAction(() => {
        setLoading(false);
      })
    );
    dispatch(getAllFunctions());
  }, []);

  useEffect(() => {
    if (ORG_ID) {
      dispatch(getAllApikeyAction(ORG_ID));
      dispatch(getAllKnowBaseDataAction(ORG_ID));
      dispatch(getPrebuiltToolsAction());
    }
  }, [dispatch, ORG_ID]);

  useEffect(() => {
    const onFocus = async () => {
      if (ORG_ID) {
        const tokenOrgId = getStoredGtwyOrgId();
        if (String(tokenOrgId || "") !== String(ORG_ID)) {
          await createAndStoreInternalJwt(ORG_ID);
        }
      }
    };
    if (!isEmbedUser) {
      window.addEventListener("focus", onFocus);
    }
    return () => {
      if (!isEmbedUser) {
        window.removeEventListener("focus", onFocus);
      }
    };
  }, [resolvedParams, isEmbedUser]);
  const docstarScriptId = "docstar-main-script";
  const docstarScriptSrc = "https://techdoc.walkover.in/scriptProd.js";
  useEffect(() => {
    const existingScript = document.getElementById(docstarScriptId);
    if (existingScript) {
      document.head.removeChild(existingScript);
    }
    if (doctstar_embed_token && !isEmbedUser) {
      const script = document.createElement("script");
      script.setAttribute("embedToken", doctstar_embed_token);
      script.id = docstarScriptId;
      script.src = docstarScriptSrc;
      document.head.appendChild(script);
    }
  }, [doctstar_embed_token, isEmbedUser]);

  useEffect(() => {
    if (ORG_ID) {
      window.addEventListener("message", handleMessage);
      return () => {
        window.removeEventListener("message", handleMessage);
      };
    }
  }, [
    resolvedParams.id,
    versionData,
    resolvedSearchParams.get("version"),
    path,
    variablesPath,
    functionData,
    pathName,
  ]);
  async function handleMessage(e) {
    if (e.data?.metadata?.type !== "tool") return;
    // todo: need to make api call to update the name & description
    if (e?.data?.webhookurl) {
      const dataToSend = {
        ...e.data,
        status: e?.data?.action,
      };
      dispatch(integrationAction(dataToSend, ORG_ID));
      if (e?.data?.action === "deleted" && (pathName.includes("agents") || pathName.includes("tools"))) {
        // Tools page has no bridge/version context; look up function id directly
        // from the org's functionData by script_id and remove it.
        if (pathName.includes("tools") && !pathName.includes("agents")) {
          const fn = Object.values(functionData || {}).find((f) => f?.script_id === e?.data?.id);
          if (fn?._id) {
            dispatch(deleteFunctionAction({ script_id: e?.data?.id, orgId: ORG_ID, functionId: fn._id }));
          }
          return;
        }
        // Get function details from functionData using script_id
        const fnFromData = Object.values(functionData || {}).find((f) => f?.script_id === e?.data?.id);
        if (fnFromData?._id) {
          // Check if this function_id exists in tools array (connected to version)
          const functionInVersion = Array.isArray(tools) && tools.includes(fnFromData._id);
          if (functionInVersion) {
            // Function is in version, update to remove it
            await dispatch(
              updateBridgeVersionAction({
                bridgeId: path[3],
                versionId: resolvedSearchParams?.get("version"),
                dataToSend: {
                  functionData: {
                    function_id: fnFromData._id,
                    script_id: fnFromData.script_id,
                  },
                },
              })
            );
            const isInPreTools =
              Array.isArray(preTools) && preTools.some((tool) => tool?.config?.function_id === fnFromData._id);
            if (isInPreTools) {
              dispatch(
                updateApiAction(path[3], {
                  pre_tools: preTools[0],
                  status: "0",
                  version_id: resolvedSearchParams?.get("version"),
                })
              );
            }
          } else {
            dispatch(
              updateApiAction(path[3], {
                pre_tools: preTools[0],
                status: "0",
                version_id: resolvedSearchParams?.get("version"),
              })
            );
          }
          dispatch(deleteFunctionAction({ script_id: e?.data?.id, orgId: ORG_ID, functionId: fnFromData._id }));
        }
      }

      if (e?.data?.action === "published" || e?.data?.action === "updated") {
        // For "updated" events, ensure the tool still exists in this org's
        // functionData (it may have been deleted just before the embed fired
        // a stale update). If it doesn't exist, skip to avoid re-creating it.
        if (e?.data?.action === "updated") {
          const toolExists = Object.values(functionData || {}).some((f) => f?.script_id === e?.data?.id);
          if (!toolExists) return;
        }
        const dataFromEmbed = {
          url: e?.data?.webhookurl,
          desc: e?.data?.description || e?.data?.title,
          id: e?.data?.id,
          status: e?.data?.action,
          title: e?.data?.title,
          openaiToolJson: e?.data?.openaiToolJson,
          folder_id: e?.data?.metadata?.folder_id || null,
        };
        dispatch(createApiAction(ORG_ID, dataFromEmbed)).then((data) => {
          // Whether this layout attached the tool to an agent itself. When it
          // did not — the ranger modal and the onboarding wizard have no agent
          // in the URL — the event at the end lets those screens attach it.
          let connectedHere = false;
          // Handle reviewer tools - works regardless of page context
          if (e?.data?.metadata?.createFrom === "reviewer" && path[3] && resolvedSearchParams?.get("version")) {
            // Add as reviewer tool - preserve existing review_agent settings
            const currentReviewAgent = versionData?.settings?.review_agent || {};
            dispatch(
              updateBridgeVersionAction({
                bridgeId: path[3],
                versionId: resolvedSearchParams?.get("version"),
                dataToSend: {
                  settings: {
                    review_agent: {
                      ...currentReviewAgent,
                      reviewer_tools: [data?._id],
                    },
                  },
                },
              })
            );
            connectedHere = true;
          } else if (pathName.includes("agents") && path[3] && resolvedSearchParams?.get("version")) {
            if (e?.data?.metadata?.createFrom === "preFunction") {
              // Only add as pre-tool if not already present (preTools is an array of objects)
              const alreadyPreTool =
                Array.isArray(preTools) && preTools.some((pt) => pt?.config?.function_id === data?._id);
              if (!alreadyPreTool) {
                dispatch(
                  updateApiAction(path[3], {
                    pre_tools: {
                      type: "custom_function",
                      config: {
                        function_id: data?._id,
                        script_id: data?.script_id,
                        required: data?.required || [],
                      },
                    },
                    status: "1",
                    version_id: resolvedSearchParams?.get("version"),
                  })
                );
              }
              connectedHere = true;
            } else if (e?.data?.metadata?.createFrom === "postFunction") {
              // Add as post tool
              dispatch(
                updateBridgeVersionAction({
                  bridgeId: path[3],
                  versionId: resolvedSearchParams?.get("version"),
                  dataToSend: {
                    post_tool: {
                      id: data?._id,
                      script_id: data?.script_id,
                      args: {},
                    },
                  },
                })
              );
              connectedHere = true;
            } else {
              // Only add as regular tool if not already in versionData
              if (!tools?.includes(data?._id)) {
                dispatch(
                  updateBridgeVersionAction({
                    bridgeId: path[3],
                    versionId: resolvedSearchParams?.get("version"),
                    dataToSend: {
                      functionData: {
                        function_id: data?._id,
                        function_operation: "1",
                      },
                    },
                  })
                );
              }
              connectedHere = true;
            }
          }

          // Screens that own an agent the URL knows nothing about (the ranger
          // create modal, the onboarding wizard) attach the tool themselves off
          // this event — only for a fresh build, never an edit of an existing one.
          if (e?.data?.action === "published") {
            emitEmbedToolCreated({
              functionId: data?._id,
              scriptId: data?.script_id,
              title: data?.title || e?.data?.title || "Tool",
              connected: connectedHere,
            });
          }
          if (
            (e?.data?.action === "updated" || e?.data?.action === "published") &&
            data?.script_id &&
            path[3] &&
            resolvedSearchParams?.get("version")
          ) {
            const currentToolVariablesPath = variablesPath?.[data.script_id] || {};
            const cleanedToolVariablesPath = cleanVariablesPathByFields(currentToolVariablesPath, data?.fields || {});
            if (Object.keys(cleanedToolVariablesPath).length !== Object.keys(currentToolVariablesPath).length) {
              dispatch(
                updateBridgeVersionAction({
                  bridgeId: path[3],
                  versionId: resolvedSearchParams?.get("version"),
                  dataToSend: { variables_path: { [data.script_id]: cleanedToolVariablesPath } },
                })
              );
            }
          }
        });
      }
    }
    if (e.data?.type === "MESSAGE_CLICK") {
      try {
        const systemPromptResponse = await getSingleMessage({
          bridge_id: urlParams?.id,
          message_id: e?.data?.data?.createdAt,
        });
        setSelectedItem({ "System Prompt": systemPromptResponse, ...e?.data?.data });
        setIsSliderOpen(true);
      } catch (error) {
        console.error("Failed to fetch single message:", error);
      }
    }
  }

  const themeUserType = isEmbedUser ? "embed" : "default";
  if (path[1] === "onboarding") {
    return (
      <>
        <ThemeManager userType={themeUserType} />
        <ServiceInitializer />
        {children}
      </>
    );
  }

  if (!isEmbedUser) {
    const hasFolders = ["agents", "apikeys", "tools", "knowledge_base"].includes(path[1]);
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-base-200">
        <ThemeManager userType={themeUserType} />
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="flex flex-col h-full z-high">
            <MainSlider resolvedParams={resolvedParams} />
          </div>

          {/* Main Content Area */}
          <div
            className={`flex-1 ${path.length === 2 ? "ml-0 md:ml-12 lg:ml-12" : ""} flex flex-col overflow-hidden z-medium`}
          >
            <div className={`sticky top-0 z-medium bg-base-200 ${hasFolders ? "ml-0" : "ml-2"}`}>
              <Navbar params={resolvedParams} searchParams={resolvedSearchParams} />
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <main
                className={`${hasFolders ? (pathName.includes("analytics") ? "pl-0" : "pr-2 pl-0") : "px-2"} h-full ${path.length > 1 && !isFocus && !pathName.includes("orchestratal_model") ? "max-h-[calc(100vh-2rem)]" : ""} ${!pathName.includes("history") ? "overflow-y-auto" : "overflow-y-hidden"}`}
              >
                {children}
              </main>
            </div>
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner />
          </div>
        ) : null}

        {/* Chat Details Sidebar */}
        <ChatDetails selectedItem={selectedItem} setIsSliderOpen={setIsSliderOpen} isSliderOpen={isSliderOpen} />
        <ServiceInitializer />
        <KeyboardShortcutsModal />
      </div>
    );
  } else {
    return (
      <div className="h-screen flex flex-col overflow-hidden bg-base-200">
        <ThemeManager userType={themeUserType} />
        <ServiceInitializer />
        {/* Main Content Area for Embed Users */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sticky Navbar - hidden in historyEmbed mode */}
          {(!isEmbedUser || (isEmbedUser && !historyEmbed)) && (
            <div className="sticky top-0 z-medium bg-base-200 border-b border-line ml-2">
              <Navbar params={resolvedParams} searchParams={resolvedSearchParams} />
            </div>
          )}

          {/* Scrollable Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner />
              </div>
            ) : (
              <main
                className={`px-2 h-full ${path.length > 1 && !isFocus && !pathName.includes("orchestratal_model") ? "max-h-[calc(100vh-2rem)]" : ""} ${!pathName.includes("history") ? "overflow-y-auto" : "overflow-y-hidden"}`}
              >
                {children}
              </main>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default Protected(layoutOrgPage);
