import { useCustomSelector } from "@/customHooks/customSelector";
import { updateBridgeVersionAction } from "@/store/action/bridgeAction";
import { MODAL_TYPE, AUTO_MODEL_TRADEOFF_OPTIONS } from "@/utils/enums";
import { closeModal, getIconOfService, openModal } from "@/utils/utility";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { createPortal } from "react-dom";
import Dropdown from "@/components/UI/Dropdown";
import { CircleQuestionMark, Sparkles, CircleAlert, Plus } from "lucide-react";
import InfoTooltip from "@/components/InfoTooltip";
import AddNewModelModal from "@/components/modals/AddNewModal";
import ConfirmationModal from "@/components/UI/ConfirmationModal";

// Hover card for a model in the picker — name, costs, cutoff, usecase.
export const ModelPreview = memo(({ hoveredModel, modelSpecs, dropdownRef }) => {
  if (!hoveredModel || !dropdownRef?.current) return null;

  const specs = modelSpecs && typeof modelSpecs === "object" ? modelSpecs : {};
  const hasAnyDetail =
    specs.description ||
    specs.input_cost != null ||
    specs.output_cost != null ||
    specs.cached_cost != null ||
    specs.cached_text_input_cost != null ||
    specs.cache_read_cost != null ||
    specs.cost?.input_cost != null ||
    specs.cost?.output_cost != null ||
    specs.cost?.cached_cost != null ||
    specs.knowledge_cutoff ||
    (Array.isArray(specs.usecase) ? specs.usecase.length > 0 : specs.usecase);

  const dropdownRect = dropdownRef.current.getBoundingClientRect();
  const dropdownMenu = dropdownRef.current?.querySelector(".dropdown-content");
  const targetRect = dropdownMenu ? dropdownMenu.getBoundingClientRect() : dropdownRect;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  const shouldOpenUp =
    dropdownRef.current?.classList?.contains("dropdown-top") ||
    dropdownRef.current?.querySelector(".dropdown-top") !== null;

  const modalWidth = 320;
  let leftPosition;
  const rightPosition = targetRect?.right;
  if (rightPosition + modalWidth + 8 <= viewportWidth) {
    leftPosition = rightPosition + 8;
  } else {
    const leftSidePosition = targetRect?.left - modalWidth - 8;
    leftPosition = leftSidePosition >= 0 ? leftSidePosition : Math.max(10, (viewportWidth - modalWidth) / 2);
  }

  const previewStyle = {
    position: "fixed",
    top: shouldOpenUp ? Math.max(20, targetRect?.top) : Math.max(20, targetRect?.top),
    left: leftPosition,
    zIndex: 99999,
    maxHeight: `${Math.max(160, viewportHeight - 40)}px`,
    overflowY: "auto",
  };

  const formatCost = (value) => {
    if (value == null || value === "") return null;
    if (typeof value === "number") return String(value);
    return String(value);
  };

  const inputCost = formatCost(specs.input_cost ?? specs.cost?.input_cost);
  const outputCost = formatCost(specs.output_cost ?? specs.cost?.output_cost);
  const cachedCost = formatCost(
    specs.cached_cost ?? specs.cached_text_input_cost ?? specs.cache_read_cost ?? specs.cost?.cached_cost
  );
  const usecases = Array.isArray(specs.usecase)
    ? specs.usecase.filter(Boolean)
    : typeof specs.usecase === "string" && specs.usecase.trim()
      ? [specs.usecase.trim()]
      : [];

  return createPortal(
    <div
      data-testid="model-preview-container"
      id="model-preview-container"
      className="w-[320px] rounded-xl border-2 border-stroke bg-base-100 p-4 shadow-xl"
      style={previewStyle}
    >
      <div className="space-y-3">
        <div className="border-b-2 border-stroke pb-2">
          <h3 className="truncate text-base font-bold text-base-content">{hoveredModel}</h3>
          {specs.description ? (
            <p className="mt-1.5 text-[12px] leading-relaxed text-base-content/80">{specs.description}</p>
          ) : !hasAnyDetail ? (
            <p className="mt-1.5 text-[12px] text-soft">No specification available for this model.</p>
          ) : null}
        </div>

        {(inputCost != null || outputCost != null || cachedCost != null) && (
          <div className="space-y-1.5 text-[12.5px]">
            {inputCost != null && (
              <div>
                <span className="font-semibold text-base-content">Input Cost: </span>
                <span className="text-base-content/80">{inputCost}</span>
              </div>
            )}
            {outputCost != null && (
              <div>
                <span className="font-semibold text-base-content">Output Cost: </span>
                <span className="text-base-content/80">{outputCost}</span>
              </div>
            )}
            {cachedCost != null && (
              <div>
                <span className="font-semibold text-base-content">Cached Cost: </span>
                <span className="text-base-content/80">{cachedCost}</span>
              </div>
            )}
          </div>
        )}

        {specs.knowledge_cutoff && (
          <div className="text-[12.5px]">
            <span className="font-semibold text-base-content">Knowledge Cutoff: </span>
            <span className="text-base-content/80">{specs.knowledge_cutoff}</span>
          </div>
        )}

        {usecases.length > 0 && (
          <div>
            <div className="mb-1 text-[12.5px] font-semibold text-base-content">Usecase</div>
            <ul className="space-y-1 pl-1">
              {usecases.map((item, index) => (
                <li key={index} className="flex gap-1.5 text-[12px] leading-relaxed text-base-content/80">
                  <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-base-content/50" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>,
    // Native <dialog> uses the browser top layer — body portals always render
    // underneath it. Mount inside the open dialog when the picker lives there.
    dropdownRef.current.closest("dialog") || document.body
  );
});

ModelPreview.displayName = "ModelPreview";

const ModelDropdown = ({
  params,
  searchParams,
  isPublished,
  isEditor = true,
  isEmbedUser = false,
  showAdvancedConfigurations = false,
}) => {
  // Determine if content is read-only (either published or user is not an editor)
  const isReadOnly = isPublished || !isEditor;
  const dispatch = useDispatch();
  const dropdownRef = useRef(null);
  const {
    model,
    fineTuneModel,
    modelType,
    modelsList,
    bridgeType,
    service,
    modelsConfig,
    isAutoModelSupported,
    autoModelSelect,
    fallbackModel,
    configuration,
    serviceModels,
  } = useCustomSelector((state) => {
    const versionData = state?.bridgeReducer?.bridgeVersionMapping?.[params?.id]?.[searchParams?.version];
    const bridgeDataFromState = state?.bridgeReducer?.allBridgesMap?.[params?.id];
    const isPublished = searchParams?.isPublished === "true";

    // Use bridgeData when isPublished=true, otherwise use versionData
    const activeData = isPublished ? bridgeDataFromState : versionData;

    return {
      model: isPublished ? bridgeDataFromState?.configuration?.model : versionData?.configuration?.model,
      fineTuneModel: isPublished
        ? bridgeDataFromState?.configuration?.fine_tune_model?.current_model
        : versionData?.configuration?.fine_tune_model?.current_model,
      modelType: isPublished ? bridgeDataFromState?.configuration?.type : versionData?.configuration?.type,
      modelsList: state?.modelReducer?.serviceModels[activeData?.service],
      bridgeType: state?.bridgeReducer?.allBridgesMap?.[params?.id]?.bridgeType,
      service: activeData?.service,
      modelsConfig: state?.appInfoReducer?.embedUserDetails?.models || {},
      isAutoModelSupported: state?.serviceReducer?.default_model?.[activeData?.service]?.autoRouterSupport || false,
      autoModelSelect: isPublished
        ? (bridgeDataFromState?.auto_model_select ?? null)
        : (versionData?.auto_model_select ?? null),
      fallbackModel: activeData?.settings?.fall_back,
      configuration: activeData?.configuration,
      serviceModels: state?.modelReducer?.serviceModels,
    };
  });

  const isFallbackEnabled = !!fallbackModel?.is_enable;
  const fallbackServiceName = fallbackModel?.service || service || "Not set";
  const fallbackModelName = fallbackModel?.model || "Not set";

  const [hoveredModel, setHoveredModel] = useState(null);
  const [modelSpecs, setModelSpecs] = useState();
  const autoModelBasedOnOptions = useMemo(
    () =>
      AUTO_MODEL_TRADEOFF_OPTIONS.map((option) => {
        const Icon = option.icon;
        return {
          value: option.value,
          label: (
            <span className="flex items-center gap-2">
              <Icon size={14} />
              <span>{option.label}</span>
            </span>
          ),
        };
      }),
    []
  );
  const selectedAutoModelBasedOn = autoModelSelect?.tradeoff || "";
  const isAutoModelSelected = !!selectedAutoModelBasedOn;

  useEffect(() => {
    if (!isAutoModelSupported && isAutoModelSelected) {
      dispatch(
        updateBridgeVersionAction({
          bridgeId: params.id,
          versionId: searchParams?.version,
          dataToSend: { auto_model_select: null },
        })
      );
    }
  }, [dispatch, isAutoModelSupported, isAutoModelSelected, params.id, searchParams?.version]);

  const handleFinetuneModelChange = (e) => {
    const selectedFineTunedModel = e.target.value;
    dispatch(
      updateBridgeVersionAction({
        bridgeId: params.id,
        versionId: searchParams?.version,
        dataToSend: {
          configuration: {
            fine_tune_model: {
              current_model: selectedFineTunedModel,
            },
          },
        },
      })
    );
  };
  // Build flat options for global Dropdown while preserving group info and specs
  const modelOptions = useMemo(() => {
    const opts = [];
    Object.entries(modelsList || {}).forEach(([group, options]) => {
      const isInvalidGroup =
        group === "models" ||
        (bridgeType === "chatbot" && group === "embedding") ||
        (bridgeType === "batch" && (group === "image" || group === "embedding"));
      if (isInvalidGroup) return;

      Object.keys(options || {}).forEach((optionKey) => {
        const cfg = options?.[optionKey];
        const modelName = cfg?.configuration?.model?.default;
        if (!modelName) return;

        const serviceConfig = modelsConfig?.[service];
        const modelConfig = serviceConfig?.[modelName];
        if (modelConfig?.hide === true) return;

        const specs = cfg?.validationConfig?.specification;

        const displayName = modelConfig?.value || modelName;

        const displayLabel = (
          <div className="flex items-center gap-2">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center">
              {getIconOfService(service, 16, 16)}
            </span>
            <span>{displayName}</span>
            {modelName === "gpt-5-nano" && bridgeType === "chatbot" && (
              <span className="badge badge-success badge-sm text-xs">FREE</span>
            )}
          </div>
        );

        opts.push({
          value: modelName,
          label: displayLabel,
          // pass meta to use in onChange and onOptionHover
          meta: { group, modelName, specs },
        });
      });
    });
    return opts;
  }, [modelsList, bridgeType, modelsConfig, service]);
  const [pendingSelection, setPendingSelection] = useState(null);

  const confirmModelChange = useCallback(() => {
    if (!pendingSelection) return;
    const { val, opt } = pendingSelection;
    const selectedGroup = opt?.meta?.group;
    const modelName = opt?.meta?.modelName || val;
    const configUpdate = { model: modelName, type: selectedGroup };
    const dataToSend = { configuration: configUpdate };
    if (selectedGroup !== "chat" && isAutoModelSelected) {
      dataToSend.auto_model_select = null;
    }
    dispatch(
      updateBridgeVersionAction({
        bridgeId: params.id,
        versionId: searchParams?.version,
        dataToSend,
      })
    );
    setHoveredModel(null);
    setPendingSelection(null);
    closeModal(MODAL_TYPE.JSON_SCHEMA_MODEL_WARNING_MODAL);
  }, [dispatch, isAutoModelSelected, params.id, searchParams?.version, pendingSelection]);

  const handleSelect = useCallback(
    (val, opt) => {
      const selectedGroup = opt?.meta?.group || "chat";
      const modelName = opt?.meta?.modelName || val;

      const configUpdate = { model: modelName, type: selectedGroup };
      const dataToSend = { configuration: configUpdate };
      if (selectedGroup !== "chat" && isAutoModelSelected) {
        dataToSend.auto_model_select = null;
      }
      dispatch(
        updateBridgeVersionAction({
          bridgeId: params.id,
          versionId: searchParams?.version,
          dataToSend,
        })
      );
      setHoveredModel(null);
    },
    [dispatch, isAutoModelSelected, params.id, searchParams?.version, configuration, serviceModels, service]
  );

  const handleAutoSelectModelChange = useCallback(
    (basedOnValue) => {
      const autoModelSelectValue = basedOnValue ? { tradeoff: basedOnValue } : null;
      dispatch(
        updateBridgeVersionAction({
          bridgeId: params.id,
          versionId: searchParams?.version,
          dataToSend: { auto_model_select: autoModelSelectValue },
        })
      );
    },
    [dispatch, params.id, searchParams?.version]
  );

  const handleAutoSelectModelToggle = useCallback(
    (e) => {
      const isEnabled = e.target.checked;
      dispatch(
        updateBridgeVersionAction({
          bridgeId: params.id,
          versionId: searchParams?.version,
          dataToSend: { auto_model_select: isEnabled ? { tradeoff: "cost" } : null },
        })
      );
    },
    [dispatch, params.id, searchParams?.version]
  );

  const handleOptionHover = useCallback((opt) => {
    if (!opt) {
      setHoveredModel(null);
      setModelSpecs(null);
      return;
    }
    const name = opt?.meta?.modelName || (typeof opt?.label === "string" ? opt.label : opt?.value);
    setHoveredModel(name || null);
    setModelSpecs(opt?.meta?.specs || null);
  }, []);

  const handleAddModelClick = useCallback(() => {
    openModal(MODAL_TYPE.ADD_NEW_MODEL_MODAL);
  }, []);
  const showFallbackModelHint = ((isEmbedUser && showAdvancedConfigurations) || !isEmbedUser) && modelType !== "image";

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <label className="block text-base-content/70 text-sm font-medium">Model</label>
        {isAutoModelSupported && modelType === "chat" && (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs">
              <Sparkles size={10} />
              Auto Select Model
            </span>
            <InfoTooltip tooltipContent="Let Rangers' Smart Model Router select the model depending on User Query. Only works for chat type models.">
              <CircleQuestionMark
                size={14}
                className={isAutoModelSelected ? "text-warning cursor-help" : "text-soft hover:text-ink cursor-help"}
              />
            </InfoTooltip>
            <input
              autoComplete="off"
              data-testid="auto-select-model-toggle"
              id="auto-select-model-toggle"
              disabled={isReadOnly}
              type="checkbox"
              className="toggle toggle-xs"
              checked={isAutoModelSelected}
              onChange={handleAutoSelectModelToggle}
            />
          </div>
        )}
      </div>
      <div
        data-testid="model-dropdown-container"
        id="model-dropdown-container"
        className="flex flex-col items-start gap-4 relative"
      >
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1" ref={dropdownRef}>
            {isAutoModelSelected ? (
              <Dropdown
                testId="auto-select-model-based-on-dropdown"
                id="auto-select-model-based-on-dropdown"
                disabled={isReadOnly}
                options={autoModelBasedOnOptions}
                value={selectedAutoModelBasedOn}
                onChange={handleAutoSelectModelChange}
                className="flex w-full items-center justify-between gap-2 rounded-[9px] border-2 px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none -[3px] disabled:cursor-not-allowed disabled:opacity-50 border-stroke text-base-content h-8 min-w-[150px]"
                placeholder="Select basis"
                size="sm"
                key={selectedAutoModelBasedOn}
              />
            ) : (
              <Dropdown
                testId="model-dropdown"
                disabled={isReadOnly || autoModelSelect}
                options={modelOptions}
                key={modelOptions}
                value={model || ""}
                onChange={handleSelect}
                onOptionHover={handleOptionHover}
                showGroupHeaders
                isEmbedUser={isEmbedUser}
                bottomOption={{
                  label: "Add Model",
                  icon: Plus,
                  onClick: handleAddModelClick,
                  testId: "model-dropdown-add-model",
                }}
                placeholder="Select model"
                size="sm"
                className="flex w-full items-center justify-between gap-2 rounded-[9px] border-2 px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none -[3px] disabled:cursor-not-allowed disabled:opacity-50 border-stroke text-base-content h-8 min-w-[150px]"
                style={{ backgroundColor: "var(--card)" }}
                menuClassName="w-full sm:w-[260px] max-h-[500px] min-w-[200px]"
                maxLabelLength={20}
              />
            )}
          </div>
          {showFallbackModelHint && (
            <InfoTooltip
              tooltipContent={
                !isFallbackEnabled ? (
                  <span className="text-xs max-w-[220px] flex flex-col gap-1">
                    <span className="font-semibold text-warning">Fallback Model</span>
                    <span className="opacity-80">You can select a fallback model below.</span>
                  </span>
                ) : (
                  <span className="text-xs flex flex-col gap-1">
                    <span className="font-semibold text-warning">Fallback Model</span>
                    <span>
                      <span className="opacity-70">Service:</span>{" "}
                      <span className="font-medium capitalize">{fallbackServiceName}</span>
                    </span>
                    <span>
                      <span className="opacity-70">Model:</span>{" "}
                      <span className="font-medium">{fallbackModelName}</span>
                    </span>
                  </span>
                )
              }
            >
              <button
                type="button"
                className={`btn btn-sm btn-ghost border-2 rounded border-stroke px-2 ${isFallbackEnabled ? "" : "opacity-70"}`}
              >
                <CircleAlert size={16} className={isFallbackEnabled ? "text-warning" : "text-soft"} />
              </button>
            </InfoTooltip>
          )}
        </div>

        <ModelPreview hoveredModel={hoveredModel} modelSpecs={modelSpecs} dropdownRef={dropdownRef} />

        {/* If model is fine-tuned model */}
        {modelType === "fine-tune" && (
          <div id="fine-tune-model-section" className="w-full sm:max-w-xs">
            <div className="label">
              <span className="label-text text-base-content">Fine-Tune Model</span>
            </div>
            <input
              autoComplete="off"
              data-testid="fine-tune-model-input"
              id="fine-tune-model-input"
              type="text"
              name="name"
              key={fineTuneModel}
              defaultValue={fineTuneModel}
              onBlur={handleFinetuneModelChange}
              placeholder="Fine-tune model Name"
              disabled={isReadOnly}
              className="input input-bordered input-sm w-full bg-base-100 text-base-content focus:border-primary min-h-[2.5rem] sm:min-h-[2rem]"
            />
          </div>
        )}

        <AddNewModelModal disableServiceChange={true} />

        <ConfirmationModal
          modalType={MODAL_TYPE.JSON_SCHEMA_MODEL_WARNING_MODAL}
          title="Unsupported JSON Schema"
          message={
            <div className="space-y-4 py-2">
              <p className="text-sm text-base-content/80 leading-relaxed">
                The newly selected model does not support <strong>JSON Schema</strong> response format.
              </p>
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning flex items-start gap-2.5">
                <CircleAlert className="shrink-0 w-4 h-4 mt-0.5 text-warning" />
                <span className="leading-normal">
                  The JSON schema will be automatically removed from the configuration if you proceed.
                </span>
              </div>
              <p className="text-sm text-base-content/85">Are you sure you want to change the model?</p>
            </div>
          }
          icon={<CircleAlert size={20} />}
          iconClass="bg-warning/15 text-warning"
          confirmText="Yes, Change Model"
          cancelText="Cancel"
          confirmButtonClass="btn-warning hover:opacity-90 text-black font-semibold border-none"
          cancelButtonClass="btn-ghost"
          onConfirm={confirmModelChange}
          onCancel={() => {
            setPendingSelection(null);
            closeModal(MODAL_TYPE.JSON_SCHEMA_MODEL_WARNING_MODAL);
          }}
        />
      </div>
    </>
  );
};

export default ModelDropdown;
