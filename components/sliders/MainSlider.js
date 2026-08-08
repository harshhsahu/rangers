/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronDown, LogOut, ChevronRight, ChevronLeft, User, AlignJustify, ArrowLeft, Keyboard } from "lucide-react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { logoutUserFromMsg91 } from "@/config/index";
import { useCustomSelector } from "@/customHooks/customSelector";
import { truncate } from "@/components/historyPageComponents/AssistFile";
import { clearCookie, getFromCookies, openModal, closeModal, setInCookies } from "@/utils/utility";
import TutorialModal from "@/components/modals/TutorialModal";
import DemoModal from "../modals/DemoModal";
import { MODAL_TYPE } from "@/utils/enums";
import Protected from "../Protected";
import BridgeSlider from "./BridgeSlider";
import {
  BetaBadge,
  buildNavUrl,
  createGuardedNavigate,
  DISPLAY_NAMES,
  HRCollapsed,
  ITEM_ICONS,
  NAV_SECTIONS,
} from "@/utils/mainSliderHelper";
import { logoutUser } from "../../config/authApi";
import unsavedPromptGuard from "@/utils/unsavedPromptGuard";
import ConfirmationModal from "@/components/UI/ConfirmationModal";

/* -------------------------------------------------------------------------- */
/*                                  Component                                 */
/* -------------------------------------------------------------------------- */

function MainSlider({ isEmbedUser, openDetails, userdetailsfromOrg, orgIdFromHeader }) {
  /* --------------------------- Router & selectors ------------------------- */
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const pathParts = pathname.split("?")[0].split("/");
  const orgId = orgIdFromHeader || pathParts[2];

  const { userdetails, organizations, currrentOrgDetail, allBridges } = useCustomSelector((state) => ({
    userdetails: state.userDetailsReducer.userDetails,
    organizations: state.userDetailsReducer.organizations,
    currrentOrgDetail: state?.userDetailsReducer?.organizations?.[orgId],
    allBridges: state.bridgeReducer?.org?.[orgId]?.orgs || [],
  }));
  // When on org list page, orgId can be undefined; use first org for menu links
  const targetOrgId = orgId || (organizations && Object.keys(organizations)[0]);
  const getInitials = (name = "") => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0]?.toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Check if we're in side-by-side mode
  const isSideBySideMode = pathParts.length === 4;

  /* ------------------------------- UI state ------------------------------- */
  const [isOpen, setIsOpen] = useState(isSideBySideMode); // Default open for side-by-side
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [orgDropdownTimeout, setOrgDropdownTimeout] = useState(null);
  const [isOrgDropdownExpanded, setIsOrgDropdownExpanded] = useState(false);
  const [isMobileVisible, setIsMobileVisible] = useState(false); // New state for mobile visibility
  const [showContent, setShowContent] = useState(isSideBySideMode); // Control content visibility with delay
  const [isAdminMode, setIsAdminMode] = useState(false); // New state for admin settings mode
  const pendingNavRef = useRef(null);
  // Theme detection placeholder (not actively used)

  // Effect to detect mobile screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768); // Set mobile breakpoint at 768px
    };

    // Initialize on mount
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Clean up
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Effect to hide sidebar by default on mobile
  useEffect(() => {
    if (isMobile) {
      setIsOpen(false);
      setIsMobileVisible(false);
    }
  }, [isMobile]);

  // Pages at depth 4 that should collapse the sidebar (detail/full-screen pages)
  const COLLAPSE_AT_DEPTH_4 = ["chatbotConfig"];
  const shouldCollapse = pathParts.length > 4 || (pathParts.length === 4 && COLLAPSE_AT_DEPTH_4.includes(pathParts[3]));

  // Effect to handle sidebar state when path changes
  useEffect(() => {
    if (shouldCollapse) {
      setIsOpen(false); // Automatically close for detail pages
    } else if (isSideBySideMode) {
      setIsOpen(true); // Always open in side-by-side mode
    }

    // Hide on mobile by default when path changes
    if (isMobile) {
      setIsOpen(false);
      setIsMobileVisible(false);
    }
  }, [shouldCollapse, isSideBySideMode, isMobile]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (orgDropdownTimeout) {
        clearTimeout(orgDropdownTimeout);
      }
    };
  }, [orgDropdownTimeout]);

  /** Logout handler */
  const handleLogout = useCallback(async () => {
    try {
      try {
        const token = getFromCookies("local_token") || sessionStorage.getItem("local_token");
        if (token) await logoutUser(token);
      } catch (e) {
        // ACCESS_KEY JWT may not blacklist on GTWY — continue logout
        console.warn("GTWY logout skipped:", e?.message || e);
      }
      await logoutUserFromMsg91({
        headers: { proxy_auth_token: getFromCookies("proxy_token") ?? "" },
      });

      clearCookie();
      localStorage.clear();
      sessionStorage.clear();
      if (process.env.NEXT_PUBLIC_ENV === "PROD") {
        router.replace("https://gtwy.ai/");
      } else {
        router.replace("/");
      }
    } catch (e) {
      console.error(e);
    }
  }, [router]);

  /** Toggle handler - modified for side-by-side mode */
  const handleToggle = (e) => {
    // Clear any hover states immediately for smoother transition
    setHovered(null);

    // Use requestAnimationFrame for smoother state transitions
    requestAnimationFrame(() => {
      if (isSideBySideMode) {
        // In side-by-side mode, allow both opening and closing
        setIsOpen((prev) => !prev);
      } else {
        // Normal toggle behavior for other modes
        if (e.detail === 2 && !isMobile) {
          setIsOpen(true);
        } else {
          setIsOpen((prev) => !prev);
        }
      }
    });
  };

  // Close sidebar on outside click when in sub-routes
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pathParts.length > 4 && (isOpen || isMobileVisible)) {
        const sidebar = document.querySelector(".sidebar");
        if (sidebar && !sidebar.contains(e.target)) {
          // Add a small delay to ensure smooth transition
          requestAnimationFrame(() => {
            if (isMobile) {
              setIsMobileVisible(false);
            } else {
              setIsOpen(false);
            }
          });
        }
      }

      // Close account dropdown on outside click
      if (isOrgDropdownExpanded) {
        const accountDropdown = e.target.closest(".account-dropdown-container");
        if (!accountDropdown) {
          setIsOrgDropdownExpanded(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, isMobileVisible, pathParts.length, isMobile, isOrgDropdownExpanded]);

  /** Hover handlers – active only when collapsed (desktop) */
  const onItemEnter = (key, e) => {
    if ((isOpen && !isMobile) || (isMobile && !isMobileVisible)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
    setHovered(key);
  };

  const onItemLeave = () => {
    if ((!isOpen && !isMobile) || (isMobile && isMobileVisible)) {
      setHovered(null);
    }
  };

  // Hide tooltip the moment sidebar expands
  useEffect(() => {
    if (isOpen && !isMobile) setHovered(null);
  }, [isOpen, isMobile]);

  // Handle content visibility with delay for smooth transitions
  useEffect(() => {
    if (isMobile) {
      // For mobile, show content immediately when visible
      setShowContent(isMobileVisible);
    } else {
      if (isOpen) {
        // Show content immediately when opening
        setShowContent(true);
      } else {
        // Hide content after animation completes when closing
        const timer = setTimeout(() => {
          setShowContent(false);
        }, 300); // Match the CSS transition duration
        return () => clearTimeout(timer);
      }
    }

    // Handle side-by-side mode - always show content when in this mode
    if (isSideBySideMode && isOpen) {
      setShowContent(true);
    }
  }, [isOpen, isMobile, isMobileVisible, isSideBySideMode]);

  // Close on backdrop click (mobile)
  const handleBackdropClick = () => {
    if (isMobile && isMobileVisible) {
      setIsMobileVisible(false);
    }
  };

  // Org dropdown handlers
  const handleOrgClick = () => {
    if (showSidebarContent) {
      setIsOrgDropdownExpanded((prev) => !prev);
    }
  };

  const handleOrgHover = () => {
    if (!showSidebarContent) {
      // Clear any existing timeout
      if (orgDropdownTimeout) {
        clearTimeout(orgDropdownTimeout);
        setOrgDropdownTimeout(null);
      }

      // Show dropdown with slight delay
      const timeout = setTimeout(() => {
        setIsOrgDropdownOpen(true);
      }, 150);
      setOrgDropdownTimeout(timeout);
    }
  };

  const handleOrgLeave = () => {
    if (!showSidebarContent) {
      // Clear any existing timeout
      if (orgDropdownTimeout) {
        clearTimeout(orgDropdownTimeout);
        setOrgDropdownTimeout(null);
      }

      // Hide dropdown with delay
      const timeout = setTimeout(() => {
        setIsOrgDropdownOpen(false);
      }, 200);
      setOrgDropdownTimeout(timeout);
    }
  };

  // Admin settings toggle handler
  const handleAdminToggle = useCallback(() => {
    setIsAdminMode((prev) => !prev);
  }, []);

  const buildNavUrlForOrg = useCallback((key) => buildNavUrl(key, orgId), [orgId]);

  // Guard navigation when there are unsaved prompt changes
  const guardedNavigate = useCallback(
    createGuardedNavigate(router, pendingNavRef, openModal, MODAL_TYPE, unsavedPromptGuard),
    [router]
  );

  // Get settings menu items for sidebar
  const settingsMenuItems = useMemo(
    () => [
      {
        id: "workspace",
        label: "Workspace",
        icon: ITEM_ICONS.workspace,
        onClick: () => {
          setIsOrgDropdownExpanded(false);
          setIsOrgDropdownOpen(false);
          if (isMobile) setIsMobileVisible(false);
          guardedNavigate(`/org/${orgId}/workspaceSetting`);
        },
      },
      {
        id: "apikeys",
        label: "API Keys",
        icon: ITEM_ICONS.apikeys,
        onClick: () => {
          setIsOrgDropdownExpanded(false);
          setIsOrgDropdownOpen(false);
          if (isMobile) setIsMobileVisible(false);
          guardedNavigate(`/org/${orgId}/apikeys`);
        },
      },
    ],
    [guardedNavigate, orgId, isMobile]
  );

  // Mobile menu toggle handler
  const handleMobileMenuToggle = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setHovered(null);
    setIsMobileVisible((prev) => !prev);
  }, []);

  // Reusable function for rendering organization dropdown content
  const renderOrganizationDropdown = useCallback(() => {
    return (
      <>
        {/* User info */}
        <div className="flex items-start gap-3 p-3 border-b border-base-300 mb-3">
          {!openDetails ? (
            <User size={16} className="text-base-content/60 mt-3  flex-shrink-0" />
          ) : (
            <div className="shrink-0 w-9 h-9 bg-primary flex items-center justify-center cursor-pointer">
              <span className="text-primary-content font-semibold text-sm">
                {getInitials(userdetailsfromOrg?.name || userdetails?.name || "U")}
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm text-base-content truncate">{userdetails?.name}</div>
            <div className="text-xs text-base-content/60 truncate mt-0.5">{userdetails?.email ?? "user@email.com"}</div>
          </div>
        </div>

        <div className="space-y-1">
          {/* Logout button */}
          <button
            id="main-slider-logout-button"
            onClick={() => {
              setIsOrgDropdownOpen(false);
              setIsOrgDropdownExpanded(false);
              if (unsavedPromptGuard.hasUnsavedChanges) {
                pendingNavRef.current = handleLogout;
                openModal(MODAL_TYPE.UNSAVED_CHANGES_MODAL);
                return;
              }
              handleLogout();
            }}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-error/10 transition-colors text-left text-error"
          >
            <LogOut size={14} className="flex-shrink-0" />
            <div className="font-medium text-sm">Logout</div>
          </button>
        </div>
      </>
    );
  }, [userdetails, handleLogout, openDetails, userdetailsfromOrg]);

  /* ------------------------------------------------------------------------ */
  /*                                  Render                                  */
  /* ------------------------------------------------------------------------ */

  // Fixed sidebar width - always 64px collapsed, 256px expanded
  const spacerW = isMobile ? "50px" : isOpen ? "256px" : "50px";
  const sidebarAgentType = searchParams?.get("type")?.toLowerCase();
  const activeKey = useMemo(() => {
    if (pathParts[3] === "agents") {
      return "agents";
    }
    return pathParts[3];
  }, [pathParts, sidebarAgentType, allBridges]);
  // Determine positioning based on mode
  const sidebarPositioning = isSideBySideMode && !shouldCollapse ? "relative" : "fixed";
  const sidebarZIndex = isMobile || isMobileVisible ? "z-50" : "z-30";

  // Determine if sidebar should show content (expanded view) with delayed hiding
  const showSidebarContent = isMobile ? false : showContent;

  if (openDetails) {
    return (
      <div className="absolute top-23 right-2 mt-2 bg-base-100 border border-base-300 shadow-lg p-2 w-[320px] z-50 animate-in fade-in-0 zoom-in-95 duration-200 slide-in-from-top-2 z-[9999]">
        {renderOrganizationDropdown()}
      </div>
    );
  }
  return (
    <>
      {/* Custom Keyframes for Smooth Animations */}
      <style jsx>{`
        @keyframes slideInLeft {
          0% {
            transform: translateX(-100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes slideInRight {
          0% {
            transform: translateX(100%);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>

      {/* Mobile backdrop */}
      {isMobile && isMobileVisible && (
        <div
          id="main-slider-mobile-backdrop"
          className="fixed inset-0 bg-black/50 lg:none z-40 sidebar transition-opacity duration-300 ease-in-out"
          onClick={handleBackdropClick}
        />
      )}

      <div className="relative">
        {/* Mobile menu toggle button - shown only on mobile when sidebar is closed */}
        {isMobile && !isMobileVisible && (
          <button
            id="main-slider-mobile-menu-toggle"
            onClick={handleMobileMenuToggle}
            className="fixed top-3 left-2 w-8 h-8 bg-base-100 border border-base-300 flex items-center justify-center hover:bg-base-200 transition-colors z-50 shadow-md"
          >
            <AlignJustify size={12} />
          </button>
        )}

        {/* ------------------------------------------------------------------ */}
        {/*                              SIDE BAR                              */}
        {/* ------------------------------------------------------------------ */}
        <div
          data-testid="main-sidebar"
          className={`${sidebarPositioning} sidebar bg-base-100 border ${isMobile ? "overflow-hidden" : ""} border-base-200 left-0 top-0 h-[100dvh] bg-base-100 my-0 ${isMobile ? "mx-1" : isSideBySideMode ? "ml-3 mr-0" : "mx-3"} flex flex-col pb-2 ${sidebarZIndex}`}
          style={{
            width: isMobile ? (isMobileVisible ? "56px" : "0px") : isOpen ? "220px" : "50px",
            transform: isMobile ? (isMobileVisible ? "translateX(0)" : "translateX(-100%)") : "translateX(0)",
            opacity: isMobile ? (isMobileVisible ? "1" : "0") : "1",
            transition: "all 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            transitionProperty: "width, transform, opacity",
          }}
        >
          {/* Mobile close button - positioned at the top-right corner */}
          {isMobile && isMobileVisible && (
            <button
              id="main-slider-mobile-close-button"
              onClick={() => setIsMobileVisible(false)}
              className="absolute -right-3 top-3 w-7 h-7 bg-base-100 border border-base-300 flex items-center justify-center hover:bg-base-200 transition-colors z-10 shadow-sm"
            >
              <ChevronLeft size={14} />
            </button>
          )}

          {/* Toggle button - only show for desktop */}
          {!isMobile && (
            <button
              id="main-slider-toggle-button"
              onClick={handleToggle}
              className="absolute -right-3 top-[50px] w-7 h-7 bg-base-100 border border-base-300 flex items-center justify-center hover:bg-base-200 transition-colors z-10 shadow-sm"
            >
              {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          )}

          {/* -------------------------- NAVIGATION -------------------------- */}
          <div className="flex flex-col h-full">
            {/* Header section — account menu (no org switcher) */}
            <div className="p-2 border-b border-base-300 relative">
              {pathParts.length >= 4 && (
                <div
                  className="relative account-dropdown-container"
                  onMouseEnter={handleOrgHover}
                  onMouseLeave={handleOrgLeave}
                >
                  <button
                    id="main-slider-account-dropdown-button"
                    onClick={handleOrgClick}
                    className="w-full flex items-center gap-3 py-2 hover:bg-base-200 transition-colors"
                  >
                    <div className="shrink-0 w-8 h-8 bg-primary flex items-center justify-center">
                      <span className="text-primary-content font-semibold text-sm">
                        {getInitials(userdetailsfromOrg?.name || userdetails?.name || "U")}
                      </span>
                    </div>
                    {showSidebarContent && (
                      <>
                        <div className="flex-1 text-left overflow-hidden">
                          <div className="font-semibold text-sm truncate">
                            {truncate(userdetails?.name || userdetailsfromOrg?.name || "Account", 20)}
                          </div>
                          <div className="text-xs text-base-content/60 truncate">{userdetails?.email || "Account"}</div>
                        </div>
                        <ChevronDown
                          size={16}
                          className={`shrink-0 transition-transform ${isOrgDropdownExpanded ? "rotate-180" : ""}`}
                        />
                      </>
                    )}
                  </button>

                  {isOrgDropdownOpen && !showSidebarContent && (
                    <div
                      className="absolute left-full top-0 ml-2 bg-base-100 border border-base-300 shadow-lg p-2 w-[320px] z-50 animate-in fade-in-0 zoom-in-95 duration-200 slide-in-from-top-2"
                      onMouseEnter={() => {
                        if (orgDropdownTimeout) {
                          clearTimeout(orgDropdownTimeout);
                          setOrgDropdownTimeout(null);
                        }
                      }}
                      onMouseLeave={handleOrgLeave}
                    >
                      {renderOrganizationDropdown()}
                    </div>
                  )}

                  {isOrgDropdownExpanded && showSidebarContent && (
                    <div className="absolute top-0 left-0 mt-2 bg-base-100 border border-base-300 shadow-lg p-2 w-[320px] z-50 animate-in fade-in-0 zoom-in-95 duration-200 slide-in-from-top-2">
                      {renderOrganizationDropdown()}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Main navigation - scrollable */}
            <div className={`flex-1 scrollbar-hide overflow-x-hidden scroll-smooth p-1`}>
              <div className="">
                {/* Main Menu Button - Show only in Admin Mode */}
                {isAdminMode && (
                  <div className="mb-4">
                    <button
                      id="main-slider-back-to-main-menu-button"
                      onClick={handleAdminToggle}
                      onMouseEnter={(e) => onItemEnter("main-menu", e)}
                      onMouseLeave={onItemLeave}
                      className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg transition-all duration-200 hover:bg-base-200 text-base-content ${!showSidebarContent ? "justify-center" : ""}`}
                    >
                      <div className="shrink-0">
                        <ArrowLeft size={16} />
                      </div>
                      {showSidebarContent && <span className="text-sm truncate">Main Menu</span>}
                    </button>
                  </div>
                )}

                {!isAdminMode ? (
                  // Normal Navigation with slide from left animation
                  <div
                    key="main-nav"
                    style={{
                      animation: "slideInLeft 0.3s ease-out both",
                    }}
                  >
                    {NAV_SECTIONS.map(({ title, items }, idx) => (
                      <div key={idx} className="">
                        {showSidebarContent && title && (
                          <h3 className="my-1 text-[10px] text-base-content/50 uppercase tracking-wider px-2">
                            {title}
                          </h3>
                        )}
                        <div className="space-y-0.5">
                          {items.map((key) => (
                            <button
                              id={`main-slider-nav-${key}`}
                              key={key}
                              onClick={() => {
                                guardedNavigate(buildNavUrlForOrg(key));
                                if (isMobile) setIsMobileVisible(false);
                              }}
                              onMouseEnter={(e) => onItemEnter(key, e)}
                              onMouseLeave={onItemLeave}
                              className={`w-full flex items-center gap-3 py-2 px-3 transition-all duration-200 ${
                                activeKey === key
                                  ? "bg-primary text-primary-content shadow-sm"
                                  : "hover:bg-base-200 text-base-content"
                              } ${!showSidebarContent ? "justify-center" : ""}`}
                            >
                              <div className="shrink-0">{ITEM_ICONS[key]}</div>
                              {showSidebarContent && (
                                <div className="flex items-center gap-2 justify-center">
                                  <span className="text-sm capitalize truncate">{DISPLAY_NAMES(key)}</span>
                                  <span>{(key === "orchestratal_model" || key === "widgets") && <BetaBadge />}</span>
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                        {!showSidebarContent && idx !== NAV_SECTIONS.length - 1 && <HRCollapsed />}
                      </div>
                    ))}
                  </div>
                ) : (
                  // Admin Settings Navigation with slide from right animation
                  <div
                    key="admin-nav"
                    style={{
                      animation: "slideInRight 0.3s ease-out both",
                    }}
                  >
                    {showSidebarContent && (
                      <h3 className="my-2 text-xs text-base-content/50 uppercase tracking-wider px-2">
                        Admin Settings
                      </h3>
                    )}
                    <div className="space-y-1">
                      {settingsMenuItems.map((item) => (
                        <button
                          id={`main-slider-admin-${item.id}`}
                          key={item.id}
                          onClick={() => {
                            item.onClick();
                            if (isMobile) setIsMobileVisible(false);
                          }}
                          onMouseEnter={(e) => onItemEnter(item.id, e)}
                          onMouseLeave={onItemLeave}
                          className={`w-full flex items-center gap-3 py-2 px-3 transition-all duration-200 hover:bg-base-200 text-base-content ${!showSidebarContent ? "justify-center" : ""}`}
                        >
                          <div className="shrink-0">{item.icon}</div>
                          {showSidebarContent && <span className="text-sm truncate">{item.label}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions Section */}
            <div className="border-t border-base-content/20 p-1">
              <div className="space-y-1">
                {/* Primary action: Admin */}
                <button
                  id="main-slider-admin-settings-toggle"
                  onClick={handleAdminToggle}
                  onMouseEnter={(e) => onItemEnter("admin-toggle", e)}
                  onMouseLeave={onItemLeave}
                  className={`w-full flex items-center gap-3 rounded-lg p-2.5 transition-colors ${
                    isAdminMode ? "bg-primary text-primary-content shadow-sm" : "hover:bg-base-200 text-base-content"
                  } ${!showSidebarContent ? "justify-center" : ""}`}
                >
                  {ITEM_ICONS.adminSettings}
                  {showSidebarContent && (
                    <span className="text-xs truncate font-medium">
                      {isAdminMode ? "Back to Main" : "Admin Settings"}
                    </span>
                  )}
                </button>

                {/* Primary action: Lifetime access */}
                {!currrentOrgDetail?.meta?.unlimited_access && (
                  <div className="relative">
                    <button
                      id="main-slider-lifetime-access-button"
                      onClick={() => {
                        guardedNavigate(`/org/${orgId}/lifetime-access`);
                        if (isMobile) setIsMobileVisible(false);
                      }}
                      onMouseEnter={(e) => onItemEnter("lifetimeAccess", e)}
                      onMouseLeave={onItemLeave}
                      className={`w-full flex items-center gap-3 rounded-lg p-2.5 transition-all duration-300 border border-yellow-500/60 bg-yellow-500/5 hover:bg-yellow-500/10 ${!showSidebarContent ? "justify-center" : ""}`}
                    >
                      <div className="relative z-10 flex items-center gap-3 w-full">
                        <div className="relative">
                          {ITEM_ICONS.lifetimeAccess}
                          <div className="absolute -top-1 -right-1 w-1 h-1 bg-yellow-400 animate-ping opacity-40"></div>
                        </div>
                        {showSidebarContent && (
                          <span className="text-xs truncate font-semibold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">
                            Free Lifetime Access
                          </span>
                        )}
                      </div>
                    </button>

                    {showSidebarContent && (
                      <div className="absolute -top-0.5 -right-0.5 text-xs opacity-60 transform rotate-12">🎁</div>
                    )}
                  </div>
                )}

                {/* Secondary footer actions */}
                {showSidebarContent ? (
                  <div className="border-t border-base-content/15 pt-2">
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        id="main-slider-refer-earn-button"
                        onClick={() => {
                          if (targetOrgId) guardedNavigate(`/org/${targetOrgId}/referAndEarn`);
                          if (isMobile) setIsMobileVisible(false);
                        }}
                        onMouseEnter={(e) => onItemEnter("refer-earn", e)}
                        onMouseLeave={onItemLeave}
                        className="flex flex-col items-center justify-center gap-1 rounded-md p-1.5 hover:bg-base-200 transition-colors text-base-content/80"
                      >
                        <span className="text-sm">🎁</span>
                        <span className="text-[10px] leading-none">Refer</span>
                      </button>

                      <button
                        id="main-slider-keyboard-shortcuts-button"
                        onClick={() => {
                          openModal(MODAL_TYPE.KEYBOARD_SHORTCUTS_MODAL);
                          if (isMobile) setIsMobileVisible(false);
                        }}
                        onMouseEnter={(e) => onItemEnter("keyboard-shortcuts", e)}
                        onMouseLeave={onItemLeave}
                        className="flex flex-col items-center justify-center gap-1 rounded-md p-1.5 hover:bg-base-200 transition-colors text-base-content/80"
                      >
                        <Keyboard size={16} className="text-base-content/70" />
                        <span className="text-[10px] leading-none">Keys</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button
                      id="main-slider-refer-earn-button"
                      onClick={() => {
                        if (targetOrgId) guardedNavigate(`/org/${targetOrgId}/referAndEarn`);
                        if (isMobile) setIsMobileVisible(false);
                      }}
                      onMouseEnter={(e) => onItemEnter("refer-earn", e)}
                      onMouseLeave={onItemLeave}
                      className="w-full flex items-center justify-center p-2.5 rounded-lg hover:bg-base-200 transition-colors"
                    >
                      <span className="text-sm">🎁</span>
                    </button>

                    <button
                      id="main-slider-keyboard-shortcuts-button"
                      onClick={() => {
                        openModal(MODAL_TYPE.KEYBOARD_SHORTCUTS_MODAL);
                        if (isMobile) setIsMobileVisible(false);
                      }}
                      onMouseEnter={(e) => onItemEnter("keyboard-shortcuts", e)}
                      onMouseLeave={onItemLeave}
                      className="w-full flex items-center justify-center p-2.5 rounded-lg hover:bg-base-200 transition-colors"
                    >
                      <Keyboard size={18} className="text-base-content/70" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* GTWY Label Section */}
            <div className="border-t border-base-300 p-1">
              <div className="text-center">
                {showSidebarContent ? (
                  <span className="text-sm text-base-content/70">GTWY</span>
                ) : (
                  <span className="text-xs text-base-content/50">GTWY</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/*                         CONTENT SPACER                             */}
        {/* ------------------------------------------------------------------ */}
        {/* Only show spacer in side-by-side mode and desktop */}
        {isSideBySideMode && !isMobile && (
          <div
            className="hidden lg:block"
            style={{
              width: spacerW,
              transition: "width 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        )}

        {/* ------------------------------------------------------------------ */}
        {/*                              TOOL‑TIP                              */}
        {/* ------------------------------------------------------------------ */}
        {hovered && !showSidebarContent && (isMobileVisible || (!isMobile && !isOpen)) && (
          <div
            className="fixed capitalize bg-base-300 text-base-content py-2 px-3 rounded-lg shadow-lg whitespace-nowrap border border-base-300 pointer-events-none z-50"
            style={{ top: tooltipPos.top - 20, left: tooltipPos.left }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-base-300 border rotate-45 capitalize -left-1 border-r-0 border-b-0 border-base-300" />
            {DISPLAY_NAMES(hovered)}
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/*                               MODALS                               */}
        {/* ------------------------------------------------------------------ */}
        <BridgeSlider />
        <TutorialModal />
        <DemoModal speakToUs />

        {/* Unsaved prompt changes guard modal */}
        <ConfirmationModal
          modalType={MODAL_TYPE.UNSAVED_CHANGES_MODAL}
          title="Unsaved Prompt Changes"
          message="You have unsaved changes to your prompt. If you leave now, your changes will be lost."
          confirmText="Leave without saving"
          cancelText="Stay"
          confirmButtonClass="btn-error text-white"
          onConfirm={() => {
            closeModal(MODAL_TYPE.UNSAVED_CHANGES_MODAL);
            const pending = pendingNavRef.current;
            pendingNavRef.current = null;
            if (typeof pending === "function") {
              pending();
            } else if (pending) {
              router.push(pending);
            }
          }}
          onCancel={() => {
            closeModal(MODAL_TYPE.UNSAVED_CHANGES_MODAL);
            pendingNavRef.current = null;
          }}
          onClose={() => {
            closeModal(MODAL_TYPE.UNSAVED_CHANGES_MODAL);
            pendingNavRef.current = null;
          }}
        />
      </div>
    </>
  );
}

export default Protected(MainSlider);
