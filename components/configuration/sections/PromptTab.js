"use client";

import React, { useMemo } from "react";
import InputSection from "../InputSection";
import { useConfigurationContext } from "../ConfigurationContext";
import AdvancedParameters from "../configurationComponent/AdvancedParamenter";
import TriggersList from "../configurationComponent/TriggersList";
import BridgeTypeToggle from "../configurationComponent/BridgeTypeToggle";
import { useCustomSelector } from "@/customHooks/customSelector";
import Protected from "@/components/Protected";
import UnsupportedFeatureOverlay from "../UnsupportedFeatureOverlay";

const PromptTab = ({ isPublished, isEmbedUser }) => {
  const { params, searchParams, isEditor, validationConfig, bridgeType, modelType, showConfigType } =
    useConfigurationContext();
  const { showAdvancedParameters } = useCustomSelector((state) => ({
    showAdvancedParameters: state.appInfoReducer.embedUserDetails.showAdvancedParameters,
  }));

  // Check if system_prompt is supported by the current model
  const isPromptSupported = validationConfig?.system_prompt !== false;
  const shouldShowTriggers = useMemo(() => bridgeType === "trigger" && !isEmbedUser, [bridgeType, isEmbedUser]);
  const shouldShowAgentType = useMemo(
    () =>
      ((isEmbedUser && showConfigType) || !isEmbedUser) &&
      bridgeType?.toString()?.toLowerCase() !== "chatbot" &&
      modelType !== "image",
    [isEmbedUser, showConfigType, bridgeType, modelType]
  );
  const isReadOnly = isPublished || !isEditor;

  return (
    <div data-testid="prompt-tab-container" id="prompt-tab-container" className="flex flex-col w-full relative">
      {!isPromptSupported && <UnsupportedFeatureOverlay featureName="System Prompt" />}

      {shouldShowAgentType && (
        <div className="w-full mt-4 mb-2">
          <BridgeTypeToggle
            params={params}
            searchParams={searchParams}
            isEmbedUser={isEmbedUser}
            isPublished={isPublished}
            isEditor={isEditor}
          />
        </div>
      )}

      {shouldShowTriggers && (
        <div className="rounded-xl w-full mb-4">
          <TriggersList params={params} searchParams={searchParams} isEmbedUser={isEmbedUser} isReadOnly={isReadOnly} />
        </div>
      )}

      <InputSection />

      <div
        data-testid="prompt-tab-advanced-params-wrapper"
        id="prompt-tab-advanced-params-wrapper"
        className="w-full max-w-2xl"
      >
        <AdvancedParameters
          params={params}
          searchParams={searchParams}
          isEmbedUser={isEmbedUser}
          showAdvancedParameters={showAdvancedParameters}
          level={2}
          className="w-full"
          isPublished={isPublished}
          isEditor={isEditor}
        />
      </div>
    </div>
  );
};

export default Protected(PromptTab);
