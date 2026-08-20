"use client";

import React, { memo, useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import TabsLayout from "./sections/TabsLayout";
import PromptTab from "./sections/PromptTab";
import ModelTab from "./sections/ModelTab";
import ConnectorsTab from "./sections/ConnectorsTab";
import MemoryTab from "./sections/MemoryTab";
import RangerSetupSections from "./sections/RangerSetupSections";
import { SparklesIcon, BotIcon, LinkIcon, BrainIcon } from "@/components/Icons";
import { useConfigurationContext } from "./ConfigurationContext";

const NonImageModelConfig = memo(() => {
  const { isPublished, uiState, currentView, isEmbedUser, isRanger, modelType } = useConfigurationContext();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || (modelType === "image" ? "model" : "prompt"));

  useEffect(() => {
    if (modelType === "image" && (!currentView || currentView === "config")) {
      setActiveTab("model");
    }
  }, [modelType, currentView]);

  useEffect(() => {
    if (currentView && currentView !== "config" && currentView !== "agent-flow" && currentView !== "chatbot-config") {
      if (!searchParams.get("tab")) {
        // Settings / integration tabs were removed — fall back to prompt
        if (currentView === "settings" || currentView === "integration") {
          setActiveTab("prompt");
          return;
        }
        setActiveTab(currentView);
      }
    }
  }, [currentView, searchParams]);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "settings" || tab === "integration") {
      setActiveTab(modelType === "image" ? "model" : "prompt");
    }
  }, [searchParams, modelType]);

  const tabs = useMemo(() => {
    return [
      {
        id: "prompt",
        label: "Prompt",
        icon: SparklesIcon,
        content: <PromptTab isPublished={isPublished} isEmbedUser={isEmbedUser} />,
      },
      { id: "model", label: "Model", icon: BotIcon, content: <ModelTab isPublished={isPublished} /> },
      { id: "connectors", label: "Connectors", icon: LinkIcon, content: <ConnectorsTab isPublished={isPublished} /> },
      { id: "memory", label: "Memory", icon: BrainIcon, content: <MemoryTab isPublished={isPublished} /> },
    ];
  }, [isPublished, isEmbedUser]);

  // Hide tabs when prompt helper is open
  const shouldHideTabs = uiState?.isPromptHelperOpen;

  if (isRanger) {
    return (
      <div data-testid="ranger-single-page-config" className="space-y-4 pb-8">
        <div className="sticky top-0 z-10 -mx-4 border-b-2 border-stroke bg-base-200/95 px-4 py-3 backdrop-blur">
          <h2 className="text-base font-semibold text-base-content">Agent setup</h2>
          <p className="mt-0.5 text-xs text-soft">Open a section to edit its options.</p>
        </div>

        <RangerSetupSections />
      </div>
    );
  }

  return <TabsLayout tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} hideTabs={shouldHideTabs} />;
});

NonImageModelConfig.displayName = "NonImageModelConfig";

export default NonImageModelConfig;
