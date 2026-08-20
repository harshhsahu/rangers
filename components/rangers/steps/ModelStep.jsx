"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
 * Model selection is intentionally two-stage: GET /api/service supplies the
 * service icon picker, then GET /api/service/:service supplies only the models
 * for the selected service.
 *
 * The list is inline rather than an absolutely positioned menu — an overlay gets
 * clipped by the modal's scroll container and spills past the footer. The
 * prototype's three big model cards and its reply-length cap are not ported.
 */
const ModelStep = ({ form, update, orgId }) => {
  const dispatch = useDispatch();
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const requestedServicesRef = useRef(new Set());
  const { services, serviceModels, modelsConfig, apikeys } = useCustomSelector((state) => ({
    services: state?.serviceReducer?.services || [],
    serviceModels: state?.modelReducer?.serviceModels || {},
    modelsConfig: state?.appInfoReducer?.embedUserDetails?.models || {},
    apikeys: state?.apiKeysReducer?.apikeys?.[orgId] || [],
  }));

  useEffect(() => {
    if (!Array.isArray(services) || services.length === 0) {
      dispatch(getServiceAction());
    }
  }, [dispatch, services]);

  // Fetch only the selected service's catalog. Presence of the service key
  // means even an empty response has completed and must not be retried.
  useEffect(() => {
    const service = form.service;
    if (!service) return;
    const hasResponse = Object.prototype.hasOwnProperty.call(serviceModels, service);
    if (hasResponse || requestedServicesRef.current.has(service)) return;

    requestedServicesRef.current.add(service);
    dispatch(getModelAction({ service }));
  }, [dispatch, form.service, serviceModels]);

  const selectedServiceLabel = useMemo(() => {
    const service = services.find((item) => item?.value === form.service);
    return service?.displayName || service?.label || form.service;
  }, [form.service, services]);

  /** Flatten only the selected service's active model groups. */
  const models = useMemo(() => {
    if (!form.service) return [];
    const result = [];
    Object.entries(serviceModels?.[form.service] || {}).forEach(([group, groupModels]) => {
      if (EXCLUDED_GROUPS.has(group)) return;

      Object.values(groupModels || {}).forEach((cfg) => {
        const modelName = cfg?.configuration?.model?.default;
        if (!modelName || modelsConfig?.[form.service]?.[modelName]?.hide === true) return;
        result.push({
          id: `${form.service}::${modelName}`,
          label: modelsConfig?.[form.service]?.[modelName]?.value || modelName,
          service: form.service,
          modelName,
          modelGroup: group,
          additionalParameters: cfg?.configuration?.additional_parameters,
        });
      });
    });
    return result;
  }, [form.service, serviceModels, modelsConfig]);

  const filteredModels = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter((model) => model.label.toLowerCase().includes(q));
  }, [models, query]);

  const selectedId = form.service && form.model ? `${form.service}::${form.model}` : null;
  const servicesLoading = !Array.isArray(services) || services.length === 0;
  const modelsLoading = Boolean(form.service) && !Object.prototype.hasOwnProperty.call(serviceModels, form.service);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    const hit = models.find((model) => model.id === selectedId);
    if (hit) return hit;
    // Model is set but its provider list has not loaded yet.
    return { id: selectedId, label: form.model, service: form.service };
  }, [selectedId, models, form.model, form.service]);

  const temperatureParam = form.temperatureParam;
  const supportsTemperature = Boolean(temperatureParam);

  /** Keys are per-service, so the check follows whichever provider is selected. */
  const serviceKeys = useMemo(
    () => apikeys.filter((apiKey) => apiKey?.service === form.service),
    [apikeys, form.service]
  );
  const hasServiceKey = serviceKeys.length > 0;

  const handleServiceSelect = (service) => {
    if (!service?.value || service.value === form.service) return;
    update({
      service: service.value,
      model: "",
      modelGroup: "",
      temperatureParam: null,
    });
    setQuery("");
    setIsOpen(true);
  };

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
          <span className="label-text">Service</span>
        </label>

        {servicesLoading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {[0, 1, 2, 3, 4].map((item) => (
              <div key={item} className="h-[58px] animate-pulse rounded-[10px] bg-base-300" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {services.map((service) => {
              const isActive = form.service === service?.value;
              const label = service?.displayName || service?.label || service?.value;
              return (
                <button
                  key={service.value}
                  type="button"
                  aria-pressed={isActive}
                  data-testid={`ranger-service-${service.value}`}
                  title={label}
                  onClick={() => handleServiceSelect(service)}
                  className={`relative flex min-w-0 flex-col items-center gap-1.5 rounded-[10px] border-2 px-2 py-2 transition-colors ${
                    isActive ? "border-acc bg-acc/10" : "border-stroke bg-card hover:border-soft"
                  }`}
                >
                  <span className="grid h-[18px] w-[18px] place-items-center">
                    {getIconOfService(service.value, 16, 16)}
                  </span>
                  <span className="w-full truncate text-center text-[10px] font-semibold text-base-content">
                    {label}
                  </span>
                  {isActive && (
                    <span className="absolute right-1 top-1 grid h-3.5 w-3.5 place-items-center rounded-full bg-acc text-acc-ink">
                      <Check size={9} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="form-control mt-4">
        <label className="label">
          <span className="label-text">Models{form.service ? ` · ${selectedServiceLabel}` : ""}</span>
        </label>

        {modelsLoading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((row) => (
              <div key={row} className="h-10 w-full animate-pulse rounded-[10px] bg-base-300" />
            ))}
          </div>
        ) : (
          <>
            <button
              type="button"
              data-testid="ranger-model-trigger"
              aria-expanded={isOpen}
              disabled={!form.service || models.length === 0}
              onClick={() => setIsOpen((open) => !open)}
              className={`flex w-full items-center gap-2 rounded-[12px] border-2 bg-base-100 px-3 py-2.5 text-left transition-colors ${
                isOpen ? "rounded-b-none border-b-0 border-acc" : "border-stroke hover:border-soft"
              } ${!form.service || models.length === 0 ? "cursor-not-allowed opacity-60" : ""}`}
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
                <span className="flex-1 text-[12.5px] text-soft">
                  {!form.service
                    ? "Select a service first"
                    : models.length === 0
                      ? `No models available for ${selectedServiceLabel}`
                      : "Select a model"}
                </span>
              )}
              <ChevronDown
                size={15}
                className={`flex-none text-soft transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="overflow-hidden rounded-[12px] rounded-t-none border-2 border-t-0 border-acc bg-base-100">
                <div className="relative border-b border-stroke">
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
                  {filteredModels.length === 0 && (
                    <p className="px-2 py-6 text-center text-[12px] text-soft">
                      {query ? `No models match “${query}”.` : `No models available for ${selectedServiceLabel}.`}
                    </p>
                  )}
                  {filteredModels.map((model) => {
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
                        <span className="grid h-4 w-4 place-items-center">
                          {getIconOfService(model.service, 14, 14)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-base-content">
                          {model.label}
                        </span>
                        {isActive && <Check size={13} className="flex-none text-acc" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* API key for the selected provider. Publishing succeeds without one,
            but the ranger then silently never answers — so surface it here. */}
        {form.service && !servicesLoading && (
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
