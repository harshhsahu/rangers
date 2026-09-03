/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ChevronDown, LogOut, ChevronRight, ChevronLeft, User, AlignJustify, Plus, Users } from "lucide-react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { logoutUserFromMsg91 } from "@/config/index";
import { useCustomSelector } from "@/customHooks/customSelector";
import { clearCookie, getFromCookies, openModal, closeModal } from "@/utils/utility";
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
  COLLAPSED_TILE,
  HRCollapsed,
  ITEM_ICONS,
  NAV_SECTIONS,
} from "@/utils/mainSliderHelper";
import { logoutUser } from "../../config/authApi";
import unsavedPromptGuard from "@/utils/unsavedPromptGuard";
import ConfirmationModal from "@/components/UI/ConfirmationModal";
import ThemeToggle from "@/components/UI/ThemeUi";

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
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default
  const [hovered, setHovered] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [orgDropdownTimeout, setOrgDropdownTimeout] = useState(null);
  const [isOrgDropdownExpanded, setIsOrgDropdownExpanded] = useState(false);
  const [isMobileVisible, setIsMobileVisible] = useState(false); // New state for mobile visibility
  const [showContent, setShowContent] = useState(false); // Control content visibility with delay
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

  // Determine if sidebar should show content (expanded view) with delayed
  // hiding. Declared up here because the render helpers below close over it.
  const showSidebarContent = isMobile ? false : showContent;

  // The rail's target state, flipped the instant a toggle happens.
  // showSidebarContent lags it by 300ms on close (so content does not reflow
  // mid-animation); anything that should animate *with* the width uses this.
  const railExpanded = isMobile ? isMobileVisible : isOpen;

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

  /** Live agents in this org — the count badge on the Rangers nav row. */
  const agentCount = useMemo(
    () =>
      (allBridges || []).filter(
        (bridge) => !bridge?.deletedAt && (bridge?.status === 1 || bridge?.status === undefined)
      ).length,
    [allBridges]
  );

  const buildNavUrlForOrg = useCallback((key) => buildNavUrl(key, orgId), [orgId]);

  // Guard navigation when there are unsaved prompt changes
  const guardedNavigate = useCallback(
    createGuardedNavigate(router, pendingNavRef, openModal, MODAL_TYPE, unsavedPromptGuard),
    [router]
  );

  /** Create-ranger action. The Create Ranger modal is only mounted on the
   *  agents page, so open it directly when we are already there and otherwise
   *  navigate with ?create=1 for that page to pick up. */
  const handleCreateAgent = useCallback(() => {
    if (isMobile) setIsMobileVisible(false);
    if (pathname.endsWith("/agents")) {
      openModal(MODAL_TYPE.CREATE_RANGER_MODAL);
      return;
    }
    if (targetOrgId) guardedNavigate(`/org/${targetOrgId}/agents?create=1`);
  }, [isMobile, pathname, targetOrgId]);

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
        <div className="flex items-start gap-3 p-3 border-b border-line mb-3">
          {!openDetails ? (
            <User size={16} className="text-base-content/60 mt-3 flex-shrink-0" />
          ) : (
            <div className="shrink-0 w-9 h-9 rounded-full bg-paper-sunken grid place-items-center cursor-pointer">
              <span className="font-mono text-[11px] font-bold text-soft">
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
            className="w-full flex items-center gap-3 rounded-[9px] px-3 py-2 hover:bg-error/10 transition-colors text-left text-error"
          >
            <LogOut size={14} className="flex-shrink-0" />
            <div className="font-medium text-sm">Logout</div>
          </button>
        </div>
      </>
    );
  }, [userdetails, handleLogout, openDetails, userdetailsfromOrg]);

  /**
   * Account row — the canvas parks it at the foot of the rail: round initials
   * avatar, name over email, chevron. The dropdown opens upward from there
   * (expanded) or to the side (collapsed rail).
   */
  const renderAccountRow = useCallback(
    () => (
      <div className="relative account-dropdown-container" onMouseEnter={handleOrgHover} onMouseLeave={handleOrgLeave}>
        <button
          id="main-slider-account-dropdown-button"
          onClick={handleOrgClick}
          className={`w-full flex items-center gap-[9px] rounded-[10px] border border-line bg-card transition-colors hover:bg-paper ${
            showSidebarContent ? "px-2 py-[7px]" : "justify-center py-2"
          }`}
        >
          <div className="shrink-0 w-[30px] h-[30px] grid place-items-center rounded-full bg-paper-sunken">
            <span className="font-mono text-[11px] font-bold text-soft">
              {getInitials(userdetailsfromOrg?.name || userdetails?.name || "U")}
            </span>
          </div>
          {showSidebarContent && (
            <>
              <div className="flex min-w-0 flex-1 flex-col text-left">
                <span className="truncate text-[12.5px] font-semibold text-ink">
                  {userdetails?.name || userdetailsfromOrg?.name || "Account"}
                </span>
                <span className="truncate text-[10.5px] text-soft">{userdetails?.email || "Account"}</span>
              </div>
              <ChevronDown
                size={14}
                className={`shrink-0 opacity-45 transition-transform ${isOrgDropdownExpanded ? "rotate-180" : ""}`}
              />
            </>
          )}
        </button>

        {isOrgDropdownOpen && !showSidebarContent && (
          <div
            className="absolute left-full bottom-0 ml-2 bg-card border border-line rounded-[12px] shadow-lg p-2 w-[320px] z-50 animate-in fade-in-0 zoom-in-95 duration-200"
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
          <div className="absolute bottom-full left-0 mb-2 bg-card border border-line rounded-[12px] shadow-lg p-2 w-[280px] z-50 animate-in fade-in-0 zoom-in-95 duration-200">
            {renderOrganizationDropdown()}
          </div>
        )}
      </div>
    ),
    [
      showSidebarContent,
      userdetails,
      userdetailsfromOrg,
      isOrgDropdownExpanded,
      isOrgDropdownOpen,
      orgDropdownTimeout,
      renderOrganizationDropdown,
      handleOrgClick,
      handleOrgHover,
      handleOrgLeave,
    ]
  );

  /* ------------------------------------------------------------------------ */
  /*                                  Render                                  */
  /* ------------------------------------------------------------------------ */

  // Fixed sidebar width — 56px collapsed, 244px expanded (matches the canvas)
  const spacerW = isMobile ? "56px" : isOpen ? "244px" : "56px";
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

  if (openDetails) {
    return (
      <div className="absolute top-23 right-2 mt-2 bg-card border border-line rounded-[12px] shadow-lg p-2 w-[320px] z-50 animate-in fade-in-0 zoom-in-95 duration-200 slide-in-from-top-2 z-[9999]">
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
            className="fixed top-3 left-2 w-8 h-8 rounded-[9px] bg-card border border-line flex items-center justify-center hover:bg-paper transition-colors z-50 shadow-md"
          >
            <AlignJustify size={12} />
          </button>
        )}

        {/* ------------------------------------------------------------------ */}
        {/*                              SIDE BAR                              */}
        {/* ------------------------------------------------------------------ */}
        <div
          data-testid="main-sidebar"
          className={`${sidebarPositioning} sidebar bg-card border-r border-line ${isMobile ? "overflow-hidden" : ""} left-0 top-0 h-[100dvh] m-0 flex flex-col ${showSidebarContent ? "px-3" : "px-[11px]"} py-[14px] ${sidebarZIndex}`}
          style={{
            width: isMobile ? (isMobileVisible ? "56px" : "0px") : isOpen ? "244px" : "56px",
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
              className="absolute -right-3 top-3 w-7 h-7 rounded-full bg-card border border-line flex items-center justify-center hover:bg-paper transition-colors z-10 shadow-sm"
            >
              <ChevronLeft size={14} />
            </button>
          )}

          {/* Toggle button - only show for desktop */}
          {!isMobile && (
            <button
              id="main-slider-toggle-button"
              onClick={handleToggle}
              className="absolute -right-3 top-[50px] w-7 h-7 rounded-full bg-card border border-line flex items-center justify-center hover:bg-paper transition-colors z-10 shadow-sm"
            >
              {isOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
          )}

          {/* -------------------------- NAVIGATION -------------------------- */}
          <div className="flex flex-col h-full">
            {/* Brand lockup — the canvas puts the wordmark at the top and the
                account row at the bottom of the rail. */}
            <div
              className={`flex items-center gap-[10px] pb-4 ${showSidebarContent ? "px-1.5 pt-1" : "justify-center pt-1"}`}
            >
              <div className="grid h-7 w-7 flex-none place-items-center rounded-[8px] bg-acc font-mono text-[13px] font-bold text-acc-ink">
                R
              </div>
              {showSidebarContent && (
                <span className="text-[17px] font-bold tracking-[-0.025em] text-ink">rangers</span>
              )}
            </div>

            {/* Create new Ranger. One element across both rail states, so the label squeezes with the 300ms width animation instead of wrapping mid-collapse. */}
            {targetOrgId && (
              <div>
                <button
                  id="main-slider-create-agent-button"
                  data-testid="main-slider-create-agent-button"
                  onClick={handleCreateAgent}
                  onMouseEnter={(e) => onItemEnter("create-agent", e)}
                  onMouseLeave={onItemLeave}
                  aria-label="Create new Ranger"
                  className={`w-full flex flex-none items-center justify-center overflow-hidden whitespace-nowrap rounded-[10px] bg-acc text-[13.5px] font-bold text-acc-ink shadow-[0_1px_2px_var(--shadow-tint)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:opacity-90 ${
                    railExpanded ? "h-[38px] gap-[7px] px-3" : "h-[34px] gap-0 px-0"
                  }`}
                >
                  <Plus size={15} strokeWidth={2.5} className="flex-none" />
                  <span
                    className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
                      railExpanded ? "max-w-[170px] opacity-100" : "max-w-0 opacity-0"
                    }`}
                  >
                    Create new Ranger
                  </span>
                </button>
              </div>
            )}

            {/* Main navigation - scrollable */}
            <div className={`flex-1 scrollbar-hide overflow-x-hidden scroll-smooth pt-5`}>
              <div className="">
                {/* Normal navigation, sliding in from the left. */}
                <div
                  key="main-nav"
                  style={{
                    animation: "slideInLeft 0.3s ease-out both",
                  }}
                >
                  {NAV_SECTIONS.map(({ title, items }, idx) => (
                    <div key={idx} className="">
                      {showSidebarContent && title && (
                        <h3 className="px-2 pb-1.5 text-[10.5px] font-bold uppercase tracking-[.1em] text-soft">
                          {title}
                        </h3>
                      )}
                      <div className="flex flex-col gap-0.5">
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
                            className={
                              showSidebarContent
                                ? `w-full flex items-center gap-[10px] rounded-[9px] border px-[10px] py-2 text-[13.5px] font-semibold transition-colors ${activeKey === key ? "border-transparent bg-acc-tint text-acc-deep" : "border-line bg-card text-soft hover:bg-paper hover:text-ink"}`
                                : `${COLLAPSED_TILE} ${activeKey === key ? "border-transparent bg-acc-tint text-acc-deep" : "border-line bg-card text-soft hover:bg-paper hover:text-ink"}`
                            }
                          >
                            <div className="shrink-0 opacity-85">{ITEM_ICONS[key]}</div>
                            {showSidebarContent && (
                              <>
                                <span className="truncate capitalize">{DISPLAY_NAMES(key)}</span>
                                {(key === "orchestratal_model" || key === "widgets") && <BetaBadge />}
                                {key === "agents" && agentCount > 0 && (
                                  <span className="ml-auto rounded-[6px] bg-card px-1.5 py-px font-mono text-[10.5px]">
                                    {agentCount}
                                  </span>
                                )}
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                      {!showSidebarContent && idx !== NAV_SECTIONS.length - 1 && <HRCollapsed />}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Actions Section — canvas order: nav-ish rows, the
                lifetime chip, the theme switcher, then the account row. */}
            <div className="flex flex-col gap-0.5 border-t border-line pt-[10px]">
              {/* Refer & Earn */}
              <button
                id="main-slider-refer-earn-button"
                onClick={() => {
                  if (targetOrgId) guardedNavigate(`/org/${targetOrgId}/referAndEarn`);
                  if (isMobile) setIsMobileVisible(false);
                }}
                onMouseEnter={(e) => onItemEnter("refer-earn", e)}
                onMouseLeave={onItemLeave}
                aria-label="Refer and earn"
                className={
                  showSidebarContent
                    ? "w-full flex items-center gap-[10px] rounded-[9px] border border-line bg-card px-[10px] py-2 text-[13px] font-medium text-soft transition-colors hover:bg-paper hover:text-ink"
                    : `${COLLAPSED_TILE} border-line bg-card text-soft hover:bg-paper hover:text-ink`
                }
              >
                <Users size={16} className="shrink-0 opacity-60" />
                {showSidebarContent && <span className="truncate">Refer &amp; Earn</span>}
              </button>

              {/* Free lifetime access */}
              {!currrentOrgDetail?.meta?.unlimited_access && (
                <button
                  id="main-slider-lifetime-access-button"
                  onClick={() => {
                    guardedNavigate(`/org/${orgId}/lifetime-access`);
                    if (isMobile) setIsMobileVisible(false);
                  }}
                  onMouseEnter={(e) => onItemEnter("lifetimeAccess", e)}
                  onMouseLeave={onItemLeave}
                  aria-label="Free Lifetime Access"
                  className={
                    showSidebarContent
                      ? "my-2 w-full flex items-center gap-[9px] rounded-[9px] border border-acc-line bg-acc-soft px-[10px] py-2 text-[12.5px] font-semibold text-acc-deep transition-colors hover:bg-acc-tint"
                      : `${COLLAPSED_TILE} my-2 border-acc-line bg-acc-soft text-acc-deep hover:bg-acc-tint`
                  }
                >
                  <span className="shrink-0 opacity-80">{ITEM_ICONS.lifetimeAccess}</span>
                  {showSidebarContent && <span className="truncate">Free Lifetime Access</span>}
                </button>
              )}

              {/* Theme switcher — segmented when expanded, cycling icon when collapsed */}
              <div className="mb-[10px]">
                <ThemeToggle compact={!showSidebarContent} />
              </div>

              {/* Account row */}
              {pathParts.length >= 4 && renderAccountRow()}
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
            className="fixed capitalize bg-card text-ink py-2 px-3 rounded-[9px] shadow-lg whitespace-nowrap border border-line pointer-events-none z-50"
            style={{ top: tooltipPos.top - 20, left: tooltipPos.left }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-card border rotate-45 capitalize -left-1 border-r-0 border-b-0 border-line" />
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
