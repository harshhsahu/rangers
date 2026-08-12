"use client";
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  MessageCircleMore,
  ClipboardX,
  CloudCheck,
  Clock,
  Home,
  HistoryIcon,
  Edit2,
  BotIcon,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { useCustomSelector } from "@/customHooks/customSelector";
import { updateBridgeAction, deleteBridgeAction } from "@/store/action/bridgeAction";
import { MODAL_TYPE } from "@/utils/enums";
import { openModal, closeModal, toggleSidebar, sendDataToParent } from "@/utils/utility";
import { toast } from "react-toastify";
const ChatBotSlider = dynamic(() => import("./sliders/ChatBotSlider"), { ssr: false });
const ConfigHistorySlider = dynamic(() => import("./sliders/ConfigHistorySlider"), { ssr: false });
import Protected from "./Protected";
const DeleteModal = dynamic(() => import("./UI/DeleteModal"), { ssr: false });
import useDeleteOperation from "@/customHooks/useDeleteOperation";
const VariableCollectionSlider = dynamic(() => import("./sliders/VariableCollectionSlider"), { ssr: false });
import AgentUsageLimitModal from "./modals/AgentUsageLimitModal";
import AgentActionMenu from "@/components/agents/AgentActionMenu";
import usePortalDropdown from "@/customHooks/usePortalDropdown";
import unsavedPromptGuard from "@/utils/unsavedPromptGuard";
import ConfirmationModal from "./UI/ConfirmationModal";

const BRIDGE_STATUS = {
  ACTIVE: 1,
  PAUSED: 0,
};

const Navbar = ({ isEmbedUser, params }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");
  const { isDeleting: isDiscardingWithHook, executeDelete } = useDeleteOperation();
  const ellipsisMenuRef = useRef(null);
  const [selectedAgentForAccess, setSelectedAgentForAccess] = useState(null);
  const pendingNavRef = useRef(null);

  const router = useRouter();
  const pathname = usePathname();
  const pathParts = pathname.split("?")[0].split("/");
  const orgId = params?.org_id || pathParts[2];
  const bridgeId = params?.id || pathParts[5];
  const dispatch = useDispatch();
  const searchParams = useSearchParams();
  const versionId = useMemo(() => searchParams?.get("version"), [searchParams]);
  const parentAgentId = useMemo(() => searchParams?.get("parentAgentId"), [searchParams]);
  const parentVersionId = useMemo(() => searchParams?.get("parentVersionId"), [searchParams]);
  // Use portal dropdown hook (same as agents page)
  const { handlePortalOpen, handlePortalCloseImmediate, PortalDropdown, PortalStyles } = usePortalDropdown({
    offsetX: -100,
    offsetY: 5,
  });
  const {
    bridgeData,
    bridge,
    bridgeStatus,
    bridgeType,
    activeTab,
    isArchived,
    showHomeButton,
    showHistory,
    bridgeName,
    savingStatus,
    showAgentName,
    isUpdatingBridge,
  } = useCustomSelector((state) => {
    const bridgeData =
      state?.bridgeReducer?.org?.[orgId]?.orgs?.find((bridge) => bridge._id === bridgeId) ||
      state.bridgeReducer.allBridgesMap[bridgeId] ||
      {};
    return {
      bridgeData,
      bridge: state.bridgeReducer.allBridgesMap[bridgeId] || {},
      bridgeStatus: state.bridgeReducer.allBridgesMap?.[bridgeId]?.bridge_status ?? BRIDGE_STATUS.ACTIVE,
      bridgeType: state?.bridgeReducer?.allBridgesMap?.[bridgeId]?.bridgeType,
      isArchived: state.bridgeReducer.allBridgesMap?.[bridgeId]?.status ?? false,
      isUpdatingBridge: state.bridgeReducer.isUpdatingBridge ?? false,
      activeTab: pathname.includes("configure")
        ? "configure"
        : pathname.includes("history")
          ? "history"
          : pathname.includes("analytics")
            ? "analytics"
            : "configure",
      showHomeButton: state.appInfoReducer?.embedUserDetails?.showHomeButton ?? true,
      showHistory: state.appInfoReducer?.embedUserDetails?.showHistory,
      bridgeName: state?.bridgeReducer?.allBridgesMap?.[bridgeId]?.name || "",
      savingStatus: state?.bridgeReducer?.savingStatus || { status: null, timestamp: null },
      showAgentName: state?.appInfoReducer?.embedUserDetails?.showAgentName,
      currentUser: state?.userDetailsReducer?.userDetails || {},
    };
  });
  // Define tabs based on user type
  const TABS = useMemo(() => {
    const baseTabs = [
      {
        id: "configure",
        label: "Agent Config",
        icon: BotIcon,
        shortLabel: "Agent Config",
        shortcut: "G C",
      },
    ];
    if (!isEmbedUser || (isEmbedUser && showHistory)) {
      baseTabs.push({
        id: "history",
        label: "History",
        icon: MessageCircleMore,
        shortLabel: "History",
        shortcut: "G H",
      });
      baseTabs.push({
        id: "analytics",
        label: "Analytics",
        icon: BarChart3,
        shortLabel: "Analytics",
        shortcut: "G A",
      });
    }
    return baseTabs;
  }, [isEmbedUser, bridgeType, showHistory]);
  const agentName = useMemo(() => bridgeName || bridgeData?.name || "Agent not Found", [bridgeName, bridgeData?.name]);

  const [showSavedText, setShowSavedText] = useState(false);
  useEffect(() => {
    if (savingStatus.status === "saved") {
      setShowSavedText(true);
      const timer = setTimeout(() => setShowSavedText(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [savingStatus.status, savingStatus.timestamp]);

  useEffect(() => {
    setIsEditingName(false);
    setEditedName(agentName);

    return () => setIsEditingName(false);
  }, [bridgeId, agentName]);

  // Calculate active tab index for tab switcher animation
  const activeTabIndex = useMemo(() => {
    return TABS.findIndex((tab) => tab.id === activeTab);
  }, [TABS, activeTab]);

  const TAB_WIDTH = useMemo(() => {
    return isMobile ? 90 : 120; // px
  }, [isMobile]);

  const shouldShowNavbar = useCallback(() => {
    const depth = pathParts.length;
    if (depth === 3) return false;
    return ["configure", "history", "testcase", "analytics"].some((seg) => pathname.includes(seg));
  }, [pathParts.length, pathname]);

  // Scroll detection
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setIsScrolled(window.scrollY > 10);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Agent name editing functions
  const handleNameEdit = useCallback(() => {
    setIsEditingName(true);
    setEditedName(agentName);
  }, [agentName]);

  const handleNameSave = useCallback(() => {
    const trimmed = editedName.trim();
    if (trimmed === "") {
      toast.error("Agent name cannot be empty");
      setEditedName(agentName);
      return;
    }

    // Check for special characters (allow only letters, numbers, spaces, hyphens, and underscores)
    const specialCharRegex = /[^a-zA-Z0-9\s\-_]/;
    if (specialCharRegex.test(trimmed)) {
      toast.error("Agent name can only contain letters, numbers, spaces, hyphens, and underscores");
      setEditedName(agentName);
      return;
    }

    if (trimmed !== agentName) {
      dispatch(
        updateBridgeAction({
          bridgeId: bridgeId,
          dataToSend: { name: trimmed },
        })
      );
      isEmbedUser &&
        sendDataToParent(
          "updated",
          {
            name: trimmed,
            agent_id: bridgeId,
          },
          "Agent Name Updated"
        );
    }
    setIsEditingName(false);
  }, [editedName, agentName, dispatch, bridgeId, isEmbedUser]);

  const handleNameCancel = useCallback(() => {
    setIsEditingName(false);
    setEditedName(agentName);
  }, [agentName]);

  const handleNameKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleNameSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleNameCancel();
      }
    },
    [handleNameSave, handleNameCancel]
  );

  const handleTabChange = useCallback(
    (tabId) => {
      const navigate = () => {
        const base = `/org/${orgId}/agents/${tabId}/${bridgeId}`;

        // Get bridge type from Redux and determine correct type parameter
        let typeValue;
        if (bridgeType && bridgeType.toLowerCase() === "chatbot") {
          typeValue = "chatbot";
        } else {
          // For 'api', 'batch', or any other type, default to 'api'
          typeValue = "api";
        }
        const typeQueryPart = `&type=${typeValue}`;
        // Preserve reviewer-agent linkage params across tab navigation so "Back to Main" persists
        const parentQueryPart = parentAgentId
          ? `&parentAgentId=${parentAgentId}${parentVersionId ? `&parentVersionId=${parentVersionId}` : ""}`
          : "";

        if (tabId === "analytics") {
          router.push(base + `?type=${typeValue}${parentQueryPart}`);
        } else {
          router.push(
            base +
              (versionId
                ? `?version=${versionId}${typeQueryPart}${parentQueryPart}`
                : `?type=${typeValue}${parentQueryPart}`)
          );
        }
      };

      if (unsavedPromptGuard.hasUnsavedChanges) {
        pendingNavRef.current = navigate;
        openModal(MODAL_TYPE.UNSAVED_CHANGES_NAV_MODAL);
        return;
      }

      navigate();
    },
    [router, orgId, bridgeId, versionId, bridgeType, parentAgentId, parentVersionId]
  );

  const toggleConfigHistorySidebar = useCallback(() => toggleSidebar("default-config-history-slider", "right"), []);
  const handleHomeClick = useCallback(() => {
    if (unsavedPromptGuard.hasUnsavedChanges) {
      pendingNavRef.current = () => router.push(`/org/${orgId}/agents`);
      openModal(MODAL_TYPE.UNSAVED_CHANGES_NAV_MODAL);
      return;
    }
    router.push(`/org/${orgId}/agents`);
  }, [router, orgId]);

  const handleBackToMainClick = useCallback(() => {
    if (unsavedPromptGuard.hasUnsavedChanges) {
      pendingNavRef.current = () =>
        router.push(
          `/org/${orgId}/agents/configure/${parentAgentId}?version=${parentVersionId}${isEmbedUser ? "&isEmbedUser=true" : ""}`
        );
      openModal(MODAL_TYPE.UNSAVED_CHANGES_NAV_MODAL);
      return;
    }
    router.push(
      `/org/${orgId}/agents/configure/${parentAgentId}?version=${parentVersionId}${isEmbedUser ? "&isEmbedUser=true" : ""}`
    );
  }, [router, orgId, parentAgentId, parentVersionId, isEmbedUser]);

  // Keyboard shortcuts for navigation - only enabled on testcases, configuration, or history pages
  useEffect(() => {
    // Only enable shortcuts on allowed pages (testcases, configuration, or history)
    const isAllowedPage = ["configure", "history", "testcase"].some((seg) => pathname.includes(seg));
    if (!isAllowedPage) return;

    let gPressed = false;
    let timeoutId = null;

    const handleKeyDown = (e) => {
      const target = e.target;
      const isInputField = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (isInputField) return;

      if (e.key === "g" || e.key === "G") {
        gPressed = true;
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          gPressed = false;
        }, 1000);
      } else if (gPressed) {
        if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          handleTabChange("configure");
          gPressed = false;
          if (timeoutId) clearTimeout(timeoutId);
        } else if (e.key === "h" || e.key === "H") {
          e.preventDefault();
          handleTabChange("history");
          gPressed = false;
          if (timeoutId) clearTimeout(timeoutId);
        } else if (e.key === "a" || e.key === "A") {
          e.preventDefault();
          handleTabChange("analytics");
          gPressed = false;
          if (timeoutId) clearTimeout(timeoutId);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [handleTabChange, isEmbedUser, pathname]);

  const StatusIndicator = ({ status }) =>
    status === BRIDGE_STATUS.ACTIVE ? null : (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-sm font-medium bg-warning/10 text-warning border border-warning/20">
        <Clock size={12} />
        <span className="hidden sm:inline">Paused</span>
      </div>
    );

  const handleDeleteAgentConfirm = useCallback(async () => {
    await executeDelete(async () => {
      const response = await dispatch(deleteBridgeAction({ bridgeId, org_id: orgId }));
      toast.success(response?.data?.message || "Agent deleted successfully");
      router.push(`/org/${orgId}/agents`);
    });
  }, [executeDelete, dispatch, bridgeId, orgId, router]);

  const EllipsisMenu = () => (
    <AgentActionMenu
      menuRef={ellipsisMenuRef}
      bridge={bridge}
      bridgeData={bridgeData}
      bridgeStatus={bridgeStatus}
      isArchived={isArchived === 0}
      isUpdatingBridge={isUpdatingBridge}
      isEmbedUser={isEmbedUser}
      orgId={orgId}
      bridgeId={bridgeId}
      onSetSelectedAgent={setSelectedAgentForAccess}
      handlePortalOpen={handlePortalOpen}
      handlePortalCloseImmediate={handlePortalCloseImmediate}
      bridgeType={bridgeType}
    />
  );
  if (!shouldShowNavbar()) return null;

  return (
    <div data-testid="navbar" className="bg-base-100 z-medium">
      {/* Main navigation header */}
      <div
        className={`sticky top-0 z-high transition-all duration-300 ${isScrolled ? "bg-base-100/95 backdrop-blur-sm shadow-md border-b-2 border-stroke" : "bg-base-100 border-b-2 border-stroke "}`}
      >
        {/* Top bar with breadcrumb/home and actions */}
        <div className="flex w-full items-center justify-between px-2 sm:px-4 lg:px-6 h-10 min-w-0">
          {/* Left: Agent Name and Versions */}
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-5 min-w-0 flex-1">
            {isEmbedUser && showHomeButton && (
              <button
                onClick={handleHomeClick}
                className="btn btn-xs sm:btn-sm gap-1 sm:gap-2 hover:bg-base-200 px-2 sm:px-3"
                title="Go to Home"
              >
                <Home data-testid="navbar-home-button" id="navbar-home-button" size={14} className="sm:w-4 sm:h-4" />
                <span className="hidden sm:inline text-sm sm:text-sm">Home</span>
              </button>
            )}

            {parentAgentId && (
              <button
                onClick={handleBackToMainClick}
                className="btn btn-xs sm:btn-sm gap-1 sm:gap-2 hover:bg-base-200 px-2 sm:px-3"
                title="Back to Main Agent"
              >
                <ArrowLeft
                  data-testid="navbar-back-button"
                  id="navbar-back-button"
                  size={14}
                  className="sm:w-4 sm:h-4"
                />
                <span className="hidden sm:inline text-sm sm:text-sm">Back to Main</span>
              </button>
            )}

            {/* Simple Agent Name Display */}
            <div className="hidden sm:flex items-center ml-1 sm:ml-2 lg:ml-0 min-w-0 flex-1">
              {((showAgentName && isEmbedUser) || !isEmbedUser) && (
                <div className="flex items-center px-1 sm:px-2 py-1 sm:py-2 rounded-lg min-w-0 max-w-[120px] sm:max-w-fit cursor-pointer group hover:bg-base-200/50 transition-colors">
                  {!isEditingName ? (
                    <div className="flex items-center gap-1.5" onClick={handleNameEdit}>
                      <span
                        data-testid="navbar-agent-name-display"
                        id="navbar-agent-name-display"
                        className="font-mono text-[15px] font-bold text-ink truncate flex-shrink"
                        title={`${agentName} - Click to edit`}
                      >
                        {agentName}
                      </span>
                      <Edit2
                        size={12}
                        className="text-base-content/40 group-hover:text-base-content/60 transition-colors flex-shrink-0"
                      />
                    </div>
                  ) : (
                    <input
                      autoComplete="off"
                      data-testid="navbar-agent-name-input"
                      id="navbar-agent-name-input"
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      onBlur={handleNameSave}
                      onKeyDown={handleNameKeyDown}
                      className="input input-xs text-sm text-base-content"
                      autoFocus
                      maxLength={50}
                    />
                  )}
                </div>
              )}
              {/* Divider */}
              <div className="mx-1 sm:mx-2 h-4 w-px bg-base-300 flex-shrink-0"></div>

              {/* Saving Status Indicator */}
              {activeTab === "configure" && (
                <div className="flex-shrink-0 ml-2 mr-2" data-testid="navbar-saving-status-container">
                  <div
                    className="px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 text-base-content"
                    data-testid="navbar-saving-status"
                  >
                    {savingStatus.status === "saving" && (
                      <span data-testid="navbar-saving-status-saving" className="flex items-center gap-1">
                        <div className="loading loading-spinner loading-xs"></div>
                        <span>Saving</span>
                      </span>
                    )}
                    {savingStatus.status === "saved" && (
                      <>
                        <CloudCheck size={16} />
                        {showSavedText && <span>Saved</span>}
                      </>
                    )}
                    {savingStatus.status === "failed" && (
                      <span data-testid="navbar-saving-status-failed" className="flex items-center gap-1">
                        <ClipboardX size={14} />
                        <span>Failed</span>
                      </span>
                    )}
                    {savingStatus.status === "warning" && (
                      <>
                        <Clock size={14} />
                        <span>Warning</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Bridge Status Indicator */}
              {bridgeStatus !== BRIDGE_STATUS.ACTIVE && (
                <div className="flex-shrink-0">
                  <StatusIndicator status={bridgeStatus} />
                </div>
              )}
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2 sm:gap-4 lg:gap-6 flex-shrink-0">
            {/* Navigation Tabs - Fixed Position with Sliding Animation */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {TABS.length > 1 ? (
                <div className="relative flex items-center" style={{ width: `${TAB_WIDTH * TABS.length}px` }}>
                  {/* Sliding background indicator */}
                  <span
                    className="absolute top-0 left-0 h-full rounded-lg bg-primary shadow-sm transition-transform duration-300 ease-in-out"
                    style={{
                      width: `${TAB_WIDTH}px`,
                      transform: `translateX(${activeTabIndex * TAB_WIDTH}px)`,
                    }}
                  />
                  {TABS.map((tab) => {
                    const isActive = activeTab === tab.id;
                    const formattedShortcut = tab.shortcut.replace(/\s+/g, " + ");
                    const tabShortcutTooltip = `${formattedShortcut}`;
                    return (
                      <div key={tab.id} className="tooltip tooltip-bottom" data-tip={tabShortcutTooltip}>
                        <button
                          data-testid={`navbar-tab-${tab.id}`}
                          id={`navbar-tab-${tab.id}`}
                          onClick={() => handleTabChange(tab.id)}
                          className={`relative z-10 h-8 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${isActive ? "text-primary-content" : "text-base-content/70 hover:text-base-content"}`}
                          style={{ width: `${TAB_WIDTH}px` }} // 🔒 lock tab width
                        >
                          <tab.icon
                            size={14}
                            className={`w-3.5 h-3.5 transition-opacity ${isActive ? "opacity-100" : "opacity-60"}`}
                          />
                          <span className="truncate text-xs">{isMobile ? tab.shortLabel : tab.label}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Invisible placeholder to maintain spacing when tabs are hidden
                <div className="w-32 h-8"></div>
              )}
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-base-300 flex-shrink-0"></div>

            {/* Desktop view - show buttons for both users with fixed positioning */}
            <div className="hidden md:flex items-center gap-1 lg:gap-2 flex-shrink-0">
              {/* Updates History button */}
              <div className="flex items-center">
                {!isEmbedUser && (
                  <div className="tooltip tooltip-bottom" data-tip="Updates History">
                    <button
                      data-testid="navbar-history-button"
                      id="navbar-history-button"
                      className="p-1 bg-base-300 rounded-md hover:bg-base-200 transition-colors"
                      onClick={toggleConfigHistorySidebar}
                    >
                      <HistoryIcon size={16} />
                    </button>
                  </div>
                )}
              </div>
              {/* Ellipsis menu - Fixed Position */}
              <div className="flex items-center">{!isEmbedUser && <EllipsisMenu />}</div>
            </div>

            {/* Mobile view - compact buttons removed from header for embed users */}
            <div className="md:hidden flex items-center gap-1 flex-shrink-0">
              {/* Hidden on mobile - moved to bottom navbar */}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile agent name bar */}
      <div id="navbar-mobile-agent-name-display" className="sm:hidden bg-base-100 border-b-2 border-stroke px-2 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Agent Name - Editable */}
          <div className="flex items-center min-w-0 flex-1">
            <div className="flex items-center px-1 py-1 rounded-lg min-w-0 max-w-[120px] cursor-pointer group hover:bg-base-200/50 transition-colors">
              {!isEditingName ? (
                <div
                  data-testid="navbar-mobile-agent-name-display-inner"
                  id="navbar-mobile-agent-name-display-inner"
                  className="flex items-center gap-1.5"
                  onClick={handleNameEdit}
                >
                  <span
                    className="font-semibold text-sm text-base-content truncate flex-shrink"
                    title={`${agentName} - Click to edit`}
                  >
                    {agentName}
                  </span>
                  <Edit2
                    size={10}
                    className="text-base-content/40 group-hover:text-base-content/60 transition-colors flex-shrink-0"
                  />
                </div>
              ) : (
                <input
                  autoComplete="off"
                  data-testid="navbar-mobile-agent-name-input"
                  id="navbar-mobile-agent-name-input"
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onBlur={handleNameSave}
                  onKeyDown={handleNameKeyDown}
                  className="input input-xs text-sm text-base-content w-full"
                  autoFocus
                  maxLength={50}
                />
              )}
            </div>
          </div>

          {/* Ellipsis Menu */}
          {!isEmbedUser && <EllipsisMenu />}
        </div>
      </div>

      {/* Mobile action buttons - Updates History only */}
      {isMobile && activeTab === "configure" && !isEmbedUser && (
        <div className="p-2">
          <div className="flex gap-1 sm:gap-2">
            <button
              id="navbar-mobile-history-button"
              className="tooltip tooltip-left px-2"
              data-tip="Updates History"
              onClick={toggleConfigHistorySidebar}
            >
              <HistoryIcon size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Sliders - only for non-embed users */}
      {!isEmbedUser && (
        <>
          <ChatBotSlider />
          <ConfigHistorySlider versionId={versionId} />
        </>
      )}

      <VariableCollectionSlider
        params={{ org_id: orgId, id: bridgeId }}
        versionId={versionId}
        isEmbedUser={isEmbedUser}
      />

      {/* Modals */}
      <DeleteModal
        modalType={MODAL_TYPE.DELETE_AGENT_MODAL}
        onConfirm={handleDeleteAgentConfirm}
        title="Delete Agent"
        description="Are you sure you want to delete this agent? It will be moved to deleted items and permanently removed after 30 days."
        buttonTitle="Delete"
        loading={isDiscardingWithHook}
        isAsync={true}
      />

      <AgentUsageLimitModal agent={selectedAgentForAccess} isEmbedUser={isEmbedUser} />

      {/* Portal components from hook */}
      <PortalStyles />
      <PortalDropdown />

      {/* Unsaved prompt changes guard modal */}
      <ConfirmationModal
        modalType={MODAL_TYPE.UNSAVED_CHANGES_NAV_MODAL}
        title="Unsaved Prompt Changes"
        message="You have unsaved changes to your prompt. If you leave now, your changes will be lost."
        confirmText="Leave without saving"
        cancelText="Stay"
        confirmButtonClass="btn-error text-white"
        onConfirm={() => {
          closeModal(MODAL_TYPE.UNSAVED_CHANGES_NAV_MODAL);
          if (pendingNavRef.current) {
            pendingNavRef.current();
            pendingNavRef.current = null;
          }
        }}
        onCancel={() => {
          closeModal(MODAL_TYPE.UNSAVED_CHANGES_NAV_MODAL);
          pendingNavRef.current = null;
        }}
        onClose={() => {
          closeModal(MODAL_TYPE.UNSAVED_CHANGES_NAV_MODAL);
          pendingNavRef.current = null;
        }}
      />
    </div>
  );
};

const MemoNavbar = React.memo(Navbar);

export default Protected(MemoNavbar);
