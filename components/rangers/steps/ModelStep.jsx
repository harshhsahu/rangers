"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { AlertTriangle, Check, ChevronDown, KeyRound, Plus, Search, ShieldCheck } from "lucide-react";
import { useCustomSelector } from "@/customHooks/customSelector";
import { getModelAction } from "@/store/action/modelAction";
import { getServiceAction } from "@/store/action/serviceAction";
import { getIconOfService, openModal } from "@/utils/utility";
import { MODAL_TYPE } from "@/utils/enums";
import ApiKeyModal from "@/components/modals/ApiKeyModal";
import { CREATIVITY_LEVELS, resolveTemperature } from "../rangerConstants";

const EXCLUDED_GROUPS = new Set(["models", "embedding", "image"]);

/**
 * Model selection: a collapsing, searchable list of every configured model
 * grouped by provider, each row carrying its provider icon; plus the creativity
 * control and an inline API-key affordance for the chosen provider.
 *
 * The list is inline rather than an absolutely positioned menu — an overlay gets
 * clipped by the modal's scroll container and spills past the footer. The
 * prototype's three big model cards and its reply-length cap are not ported.
 */
const ModelStep = ({ form, update, orgId }) => {
  const dispatch = useDispatch();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { services, serviceModels, modelsConfig, apikeys } = useCustomSelector((state) => ({
    services: state?.serviceReducer?.services || [],
    serviceModels: state?.modelReducer?.serviceModels || {},
    modelsConfig: state?.appInfoReducer?.embedUserDetails?.models || {},
    apikeys: state?.apiKeysReducer?.apikeys?.[orgId] || [],
  }));

  useEffect(() => {
    if (!Array.isArray(services) || services.length === 0) {
      dispatch(getServiceAction({ orgid: orgId }));
    }
  }, [dispatch, orgId, services]);

  // ServiceInitializer prefetches models behind a 1s timeout, so on a fast open
  // the map can still be empty. Pull anything missing ourselves.
  useEffect(() => {
    (services || []).forEach((service) => {
      const value = service?.value;
      if (!value) return;
      const loaded = serviceModels?.[value];
      if (!loaded || Object.keys(loaded).length === 0) {
        dispatch(getModelAction({ service: value }));
      }
    });
  }, [dispatch, services, serviceModels]);

  /** Models grouped by provider, so each row can carry its provider icon. */
  const groups = useMemo(() => {
    const result = [];
    (services || []).forEach((service) => {
      const serviceValue = service?.value;
      if (!serviceValue) return;

      const models = [];
      Object.entries(serviceModels?.[serviceValue] || {}).forEach(([group, groupModels]) => {
        if (EXCLUDED_GROUPS.has(group)) return;

        Object.values(groupModels || {}).forEach((cfg) => {
          const modelName = cfg?.configuration?.model?.default;
          if (!modelName) return;
          if (modelsConfig?.[serviceValue]?.[modelName]?.hide === true) return;

          models.push({
            id: `${serviceValue}::${modelName}`,
            label: modelsConfig?.[serviceValue]?.[modelName]?.value || modelName,
            service: serviceValue,
            modelName,
            modelGroup: group,
            additionalParameters: cfg?.configuration?.additional_parameters,
          });
        });
      });

      if (models.length) {
        result.push({ service: serviceValue, label: service?.displayName || service?.label || serviceValue, models });
      }
    });
    return result;
  }, [services, serviceModels, modelsConfig]);

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        models: group.models.filter(
          (model) => model.label.toLowerCase().includes(q) || group.label.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.models.length);
  }, [groups, query]);

  const selectedId = form.service && form.model ? `${form.service}::${form.model}` : null;
  const isLoading = groups.length === 0;

  const selected = useMemo(() => {
    if (!selectedId) return null;
    for (const group of groups) {
      const hit = group.models.find((model) => model.id === selectedId);
      if (hit) return { ...hit, providerLabel: group.label };
    }
    // Model is set but its provider list has not loaded yet.
    return { id: selectedId, label: form.model, service: form.service, providerLabel: form.service };
  }, [selectedId, groups, form.model, form.service]);

  const temperatureParam = form.temperatureParam;
  const supportsTemperature = Boolean(temperatureParam);

  /** Keys are per-service, so the check follows whichever provider is selected. */
  const serviceKeys = useMemo(
    () => apikeys.filter((apiKey) => apiKey?.service === form.service),
    [apikeys, form.service]
  );
  const hasServiceKey = serviceKeys.length > 0;

  const handleSelect = (model) => {
    update({
      service: model.service,
      model: model.modelName,
      modelGroup: model.modelGroup,
      temperatureParam: model.additionalParameters?.temperature || null,
    });
    // Collapse straight after picking — the open list is tall and there is
    // nothing left to choose.
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div data-testid="ranger-step-model-pane">
      <h3 className="text-[15px] font-bold tracking-[-0.2px] text-base-content">Model</h3>
      <p className="mb-4 mt-1 text-[12.5px] text-soft">
        Pick the model this ranger runs on. You can change it later without redeploying.
      </p>

      <div className="form-control">
        <label className="label">
          <span className="label-text">Model</span>
        </label>

        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-10 w-full animate-pulse rounded-[10px] bg-base-300" />
            ))}
          </div>
        ) : (
          <>
            {/* Collapsed trigger */}
            <button
              type="button"
              data-testid="ranger-model-trigger"
              aria-expanded={isOpen}
              onClick={() => setIsOpen((open) => !open)}
              className={`flex w-full items-center gap-2 rounded-[12px] border-2 bg-base-100 px-3 py-2.5 text-left transition-colors ${
                isOpen ? "border-acc" : "border-stroke hover:border-soft"
              }`}
            >
              {selected ? (
                <>
                  <span className="grid h-[18px] w-[18px] flex-none place-items-center">
                    {getIconOfService(selected.service, 15, 15)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-base-content">
                    {selected.label}
                  </span>
                </>
              ) : (
                <span className="flex-1 text-[12.5px] text-soft">Select a model</span>
              )}
              <ChevronDown
                size={15}
                className={`flex-none text-soft transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="mt-2 overflow-hidden rounded-[12px] border-2 border-stroke bg-base-100">
                <div className="relative border-b-2 border-stroke">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
                  <input
                    autoComplete="off"
                    autoFocus
                    type="text"
                    data-testid="ranger-model-search"
                    placeholder="Search models..."
                    className="w-full bg-transparent py-2.5 pl-9 pr-3 text-[12.5px] outline-none placeholder:text-soft"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>

                {/* Inline list, not an overlay dropdown — an absolutely positioned
                    menu gets clipped by the modal's scroll container. */}
                <div className="max-h-[260px] overflow-y-auto p-1.5">
                  {filteredGroups.length === 0 && (
                    <p className="px-2 py-6 text-center text-[12px] text-soft">No models match “{query}”.</p>
                  )}
                  {filteredGroups.map((group) => (
                    <div key={group.service} className="mb-1.5 last:mb-0">
                      <div className="flex items-center gap-1.5 px-2 py-1">
                        <span className="grid h-4 w-4 place-items-center">
                          {getIconOfService(group.service, 14, 14)}
                        </span>
                        <span className="text-[9.5px] font-bold uppercase tracking-[.09em] text-soft">
                          {group.label}
                        </span>
                      </div>

                      {group.models.map((model) => {
                        const isActive = selectedId === model.id;
                        return (
                          <button
                            key={model.id}
                            type="button"
                            aria-pressed={isActive}
                            data-testid={`ranger-model-option-${model.modelName}`}
                            onClick={() => handleSelect(model)}
                            className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-[7px] text-left transition-colors ${
                              isActive ? "bg-acc/15 ring-1 ring-inset ring-acc" : "hover:bg-base-200"
                            }`}
                          >
                            <span className="grid h-[18px] w-[18px] flex-none place-items-center">
                              {getIconOfService(model.service, 15, 15)}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-base-content">
                              {model.label}
                            </span>
                            {isActive && <Check size={13} className="flex-none text-acc" />}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* API key for the selected provider. Publishing succeeds without one,
            but the ranger then silently never answers — so surface it here. */}
        {form.service && !isLoading && (
          <div
            className={`mt-2.5 flex items-center gap-2 rounded-[10px] border-2 px-3 py-2 ${
              hasServiceKey ? "border-stroke bg-card" : "border-warning/40 bg-warning/10"
            }`}
          >
            {hasServiceKey ? (
              <ShieldCheck size={14} className="flex-none text-success" />
            ) : (
              <AlertTriangle size={14} className="flex-none text-warning" />
            )}
            <span className="min-w-0 flex-1 text-[11.5px] leading-snug text-base-content">
              {hasServiceKey ? (
                <>
                  <span className="font-semibold capitalize">{form.service}</span> key configured
                  {serviceKeys.length > 1 ? ` (${serviceKeys.length})` : ""}.
                </>
              ) : (
                <>
                  No <span className="font-semibold capitalize">{form.service}</span> API key in this workspace. The
                  ranger cannot answer without one.
                </>
              )}
            </span>
            <button
              type="button"
              data-testid="ranger-add-apikey-button"
              onClick={() => openModal(MODAL_TYPE.API_KEY_MODAL)}
              className="btn btn-xs flex-none gap-1"
            >
              {hasServiceKey ? <Plus size={11} /> : <KeyRound size={11} />}
              {hasServiceKey ? "Add another" : "Add API key"}
            </button>
          </div>
        )}
      </div>

      <div className="form-control mt-5">
        <label className="label">
          <span className="label-text">Creativity Level</span>
        </label>

        {supportsTemperature ? (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {CREATIVITY_LEVELS.map((level) => {
                const isActive = form.creativity === level.key;
                return (
                  <button
                    key={level.key}
                    type="button"
                    aria-pressed={isActive}
                    data-testid={`ranger-creativity-${level.key}`}
                    onClick={() => update({ creativity: level.key })}
                    className={`rounded-[12px] border-2 p-3 text-left transition-colors ${
                      isActive ? "border-acc bg-acc/10" : "border-stroke bg-card hover:border-soft"
                    }`}
                  >
                    <div className="text-[13px] font-bold text-ink">{level.label}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-soft">{level.description}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 font-mono text-[10.5px] text-soft">
              temperature = {resolveTemperature(form.creativity, temperatureParam)}
            </p>
          </>
        ) : (
          <p className="text-[11.5px] text-soft">
            {selectedId
              ? "This model doesn't expose creativity tuning, so the setting is skipped."
              : "Select a model to tune its creativity."}
          </p>
        )}
      </div>

      {/* `selectedService` locks the service field without triggering the
          modal's bridge-version update — there is no agent or version yet. */}
      <ApiKeyModal selectedService={form.service} apikeyData={apikeys} />
    </div>
  );
};

export default ModelStep;
