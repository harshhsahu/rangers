import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfigurationState } from "@/customHooks/useConfigurationState";
import { ConfigurationProvider } from "./ConfigurationContext";
import SetupView from "./SetupView";
import Protected from "../Protected";
import { Lock } from "lucide-react";
import unsavedPromptGuard from "@/utils/unsavedPromptGuard";
import useRtLayerEventHandler from "@/customHooks/useRtLayerEventHandler";

const ConfigurationPage = ({
  params,
  isEmbedUser,
  apiKeySectionRef,
  promptTextAreaRef,
  searchParams,
  uiState,
  updateUiState,
  promptState,
  setPromptState,
  handleCloseTextAreaFocus,
  savePrompt,
  isMobileView,
  closeHelperButtonLocation,
  onViewChange,
  viewOverride,
  apiKeyError,
  setApiKeyError,
}) => {
  const router = useRouter();
  const view = searchParams?.view || "config";
  const [currentView, setCurrentView] = useState(viewOverride || view);
  const [promptResetKey, setPromptResetKey] = useState(0);

  const channelId = params?.org_id && params?.id ? `${params.org_id}_${params.id}`.replace(/ /g, "_") : "";
  useRtLayerEventHandler(channelId);

  const discardPromptDraft = useCallback(() => {
    setPromptState((prev) => ({
      ...prev,
      newContent: "",
    }));
    unsavedPromptGuard.hasUnsavedChanges = false;
    setPromptResetKey((k) => k + 1);
  }, [setPromptState]);

  const configState = useConfigurationState(params, searchParams);

  // Any logged-in org user can edit — no role / members gate
  const isEditor = true;
  const handleNavigation = useCallback(
    (target) => {
      // Update URL with view parameter while preserving existing query params
      const current = new URLSearchParams(window.location.search);
      // Remove tab parameter when switching to integration view to avoid conflicts
      if (target === "integration") {
        current.delete("tab");
      }
      current.set("tab", target);

      const search = current.toString();
      const query = search ? `?${search}` : "";
      router.push(`${window.location.pathname}${query}`, { scroll: false });

      setCurrentView(target);
      onViewChange?.(target === "agent-flow");
    },
    [onViewChange, params.org_id, params.id, searchParams?.version, router]
  );

  useEffect(() => {
    if (viewOverride && viewOverride !== currentView) {
      setCurrentView(viewOverride);
    }
  }, [currentView, viewOverride]);

  const renderHelpSection = useMemo(
    () => () => {
      return (
        <div className="mt-4 mb-4 border-t-2 border-stroke border-b-0 ">
          <div className="flex flex-row gap-6 mt-4 items-center">
            {/* Speak to us */}
            {!isEmbedUser && (
              <>
                <button
                  data-testid="speak-to-us-button"
                  data-cal-namespace="30min"
                  data-cal-link="human-gtwy-ai/book-a-demo-with-gtwy"
                  data-cal-origin="https://cal.id"
                  data-cal-config='{"layout":"month_view"}'
                  className="flex items-center text-sm text-base-content/50 hover:text-base-content font-bold transition-colors cursor-pointer"
                >
                  <span>Speak to us</span>
                </button>

                <span className="text-sm text-base-content/30 select-none">|</span>

                {/* Help Docs */}

                <a
                  data-testid="help-docs-link"
                  id="help-docs-link"
                  href="https://gtwy.ai/resources"
                  className="flex items-center text-sm text-base-content/50 hover:text-base-content font-bold transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span>Help Docs</span>
                </a>
              </>
            )}
          </div>
        </div>
      );
    },
    [isEmbedUser]
  );

  // Detect if viewing published content (read-only mode)
  const isPublished = useMemo(() => {
    if (searchParams?.get) {
      return searchParams.get("isPublished") === "true";
    } else {
      return searchParams?.isPublished === "true";
    }
  }, [searchParams]);
  // Create context value with consolidated state - significantly reduced dependencies
  const contextValue = useMemo(
    () => ({
      ...configState,
      params,
      searchParams,
      isEmbedUser,
      apiKeySectionRef,
      promptTextAreaRef,
      uiState,
      updateUiState,
      promptState,
      setPromptState,
      handleCloseTextAreaFocus,
      savePrompt,
      isMobileView,
      closeHelperButtonLocation,
      currentView,
      switchView: handleNavigation,
      isPublished,
      isEditor,
      apiKeyError,
      setApiKeyError,
      promptResetKey,
      discardPromptDraft,
    }),
    [
      configState,
      params,
      searchParams,
      isEmbedUser,
      apiKeySectionRef,
      promptTextAreaRef,
      uiState,
      updateUiState,
      promptState,
      setPromptState,
      handleCloseTextAreaFocus,
      savePrompt,
      isMobileView,
      closeHelperButtonLocation,
      isPublished,
      isEditor,
      currentView,
      handleNavigation,
      apiKeyError,
      promptResetKey,
      discardPromptDraft,
    ]
  );

  // Check if viewing published data
  const [bannerState, setBannerState] = useState({
    showPublished: isPublished,
    showNonEditor: false,
    animatingPublished: false,
    animatingNonEditor: false,
  });
  const prevIsPublished = useRef(isPublished);
  const prevIsEditor = useRef(true);

  // Handle banner animation when isPublished changes
  useEffect(() => {
    if (prevIsPublished.current !== isPublished) {
      if (isPublished) {
        // Switching to published - show with slide-in animation
        setBannerState((prev) => ({ ...prev, showPublished: true, animatingPublished: false }));
      } else {
        // Switching from published - start slide-out animation
        setBannerState((prev) => ({ ...prev, showPublished: true, animatingPublished: true }));
        // Hide banner after animation completes
        setTimeout(() => {
          setBannerState((prev) => ({ ...prev, showPublished: false, animatingPublished: false }));
        }, 300); // Match animation duration
      }
      prevIsPublished.current = isPublished;
    }
  }, [isPublished]);

  // Handle banner animation when isEditor changes
  useEffect(() => {
    if (prevIsEditor.current !== isEditor) {
      if (!isEditor) {
        // Switching to non-editor - show with slide-in animation
        setBannerState((prev) => ({ ...prev, showNonEditor: true, animatingNonEditor: false }));
      } else {
        // Switching to editor - start slide-out animation
        setBannerState((prev) => ({ ...prev, showNonEditor: true, animatingNonEditor: true }));
        // Hide banner after animation completes
        setTimeout(() => {
          setBannerState((prev) => ({ ...prev, showNonEditor: false, animatingNonEditor: false }));
        }, 300); // Match animation duration
      }
      prevIsEditor.current = isEditor;
    }
  }, [isEditor]);

  return (
    <ConfigurationProvider value={contextValue}>
      <div className="flex flex-col gap-2 relative min-h-full">
        {/* Published Data Banner - Sticky and close to navbar */}
        {bannerState.showPublished && (
          <div
            data-testid="published-data-banner"
            id="published-banner"
            className={`sticky top-0 z-40 bg-primary/20 backdrop-blur-lg border-b border-primary/20 py-2 ${bannerState.animatingPublished ? "animate-slide-out-to-navbar" : "animate-slide-in-from-navbar"}`}
          >
            <div className="flex items-center justify-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-info" />
              <span className="text-base-content/80">
                This is a <span className="text-base-content font-medium">read-only</span> published data.
              </span>
            </div>
          </div>
        )}

        {/* Non-Editor Banner removed — all org users can edit */}
        <div className="flex-1">
          <SetupView />
        </div>
        <div className="mt-auto">{renderHelpSection()}</div>
      </div>
    </ConfigurationProvider>
  );
};

export default Protected(React.memo(ConfigurationPage));
