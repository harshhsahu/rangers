"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useCustomSelector } from "@/customHooks/customSelector";
import { getModelAction } from "@/store/action/modelAction";
import { getIconOfService } from "@/utils/utility";
import { CREATIVITY_LEVELS, resolveTemperature } from "../rangerConstants";
import { MODEL_STEP_DEFAULT_SERVICES } from "./onboardingConstants";

/** Same exclusions the wizard's model step uses — chat models only. */
const EXCLUDED_GROUPS = new Set(["models", "embedding", "image"]);

/**
 * One flat model list across providers, keyed providers first.
 *
 * Catalogues are per service (GET /api/service/:service), so only the services
 * worth showing are fetched: the ones this org has a key for, plus a small
 * default set so a brand new org never sees an empty list.
 */
const ModelPane = ({ form, update, orgId, onAddKey }) => {
  const dispatch = useDispatch();
  const requestedRef = useRef(new Set());

  const { services, serviceModels, modelsConfig, apikeys } = useCustomSelector((state) => ({
    services: state?.serviceReducer?.services || [],
    serviceModels: state?.modelReducer?.serviceModels || {},
    modelsConfig: state?.appInfoReducer?.embedUserDetails?.models || {},
    apikeys: state?.apiKeysReducer?.apikeys?.[orgId] || [],
  }));

  const keyedServices = useMemo(() => {
    const set = new Set();
    apikeys.forEach((apiKey) => apiKey?.service && set.add(apiKey.service));
    return set;
  }, [apikeys]);

  const targetServices = useMemo(() => {
    const known = new Set(services.map((service) => service?.value).filter(Boolean));
    const wanted = [...keyedServices, ...MODEL_STEP_DEFAULT_SERVICES, form.service].filter(Boolean);
    // `known` is empty until GET /api/service lands; fall through then rather
    // than dropping every service and rendering an empty list.
    return [...new Set(wanted)].filter((service) => known.size === 0 || known.has(service));
  }, [form.service, keyedServices, services]);

  useEffect(() => {
    targetServices.forEach((service) => {
      const hasResponse = Object.prototype.hasOwnProperty.call(serviceModels, service);
      if (hasResponse || requestedRef.current.has(service)) return;
      requestedRef.current.add(service);
      dispatch(getModelAction({ service }));
    });
  }, [dispatch, serviceModels, targetServices]);

  const serviceLabel = useMemo(() => {
    const map = {};
    services.forEach((service) => {
      if (service?.value) map[service.value] = service.displayName || service.label || service.value;
    });
    return map;
  }, [services]);

  const models = useMemo(() => {
    const rows = [];
    targetServices.forEach((service) => {
      Object.entries(serviceModels?.[service] || {}).forEach(([group, groupModels]) => {
        if (EXCLUDED_GROUPS.has(group)) return;
        Object.values(groupModels || {}).forEach((cfg) => {
          const modelName = cfg?.configuration?.model?.default;
          if (!modelName || modelsConfig?.[service]?.[modelName]?.hide === true) return;
          rows.push({
            id: `${service}::${modelName}`,
            label: modelsConfig?.[service]?.[modelName]?.value || modelName,
            service,
            modelName,
            modelGroup: group,
            keyed: keyedServices.has(service),
            temperature: cfg?.configuration?.additional_parameters?.temperature || null,
          });
        });
      });
    });
    // Keyed providers first; everything else keeps catalogue order.
    return rows.sort((a, b) => Number(b.keyed) - Number(a.keyed));
  }, [keyedServices, modelsConfig, serviceModels, targetServices]);

  const isLoading = models.length === 0 && targetServices.some((service) => !serviceModels?.[service]);
  const selectedId = form.service && form.model ? `${form.service}::${form.model}` : null;
  const temperature = resolveTemperature(form.creativity, form.temperatureParam);

  /** Providers that actually have models to show, keyed ones first. */
  const providerTabs = useMemo(() => {
    const seen = new Map();
    models.forEach((model) => {
      if (!seen.has(model.service)) {
        seen.set(model.service, { service: model.service, keyed: model.keyed, count: 0 });
      }
      seen.get(model.service).count += 1;
    });
    return [...seen.values()];
  }, [models]);

  const [activeService, setActiveService] = useState(null);
  // Follows the catalogue until the user picks a tab: whichever provider the
  // selected model belongs to, else the first one available.
  const effectiveService = useMemo(() => {
    if (activeService && providerTabs.some((tab) => tab.service === activeService)) return activeService;
    if (form.service && providerTabs.some((tab) => tab.service === form.service)) return form.service;
    return providerTabs[0]?.service ?? null;
  }, [activeService, form.service, providerTabs]);

  const visibleModels = useMemo(
    () => (effectiveService ? models.filter((model) => model.service === effectiveService) : models),
    [effectiveService, models]
  );

  return (
    <div data-testid="onboarding-pane-model" id="onboarding-pane-model">
      {providerTabs.length > 1 && (
        <div className="flex flex-wrap items-center gap-[3px] rounded-[10px] bg-paper-sunken p-[3px]">
          {providerTabs.map((tab) => {
            const isActive = tab.service === effectiveService;
            return (
              <button
                key={tab.service}
                type="button"
                data-testid={`onboarding-model-service-${tab.service}`}
                aria-pressed={isActive}
                onClick={() => setActiveService(tab.service)}
                className={`flex items-center gap-1.5 rounded-lg px-[11px] py-[6px] text-[12.5px] font-semibold transition-colors ${
                  isActive ? "bg-card text-ink shadow-sm" : "text-soft hover:text-ink"
                }`}
              >
                {getIconOfService(tab.service, 14, 14)}
                <span>{serviceLabel[tab.service] || tab.service}</span>
                {tab.keyed && (
                  <span className="rounded bg-acc-soft px-1 text-[9px] font-bold uppercase text-acc-deep">keyed</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex max-h-[340px] flex-col gap-2 overflow-y-auto">
        {isLoading &&
          [0, 1, 2].map((row) => <div key={row} className="h-[58px] animate-pulse rounded-[12px] bg-paper-sunken" />)}

        {!isLoading && visibleModels.length === 0 && (
          <p className="rounded-[12px] border border-dashed border-line-strong p-5 text-center text-[12.5px] text-soft">
            No models available yet. Add a provider key and they will show up here.
          </p>
        )}

        {visibleModels.map((model) => {
          const isActive = selectedId === model.id;
          return (
            <button
              key={model.id}
              type="button"
              aria-pressed={isActive}
              data-testid={`onboarding-model-${model.modelName}`}
              onClick={() =>
                update({
                  service: model.service,
                  model: model.modelName,
                  modelGroup: model.modelGroup,
                  temperatureParam: model.temperature,
                })
              }
              className={`flex items-center gap-3 rounded-[12px] border px-[14px] py-3 text-left ${
                isActive ? "border-acc-line bg-acc-soft" : "border-line bg-card"
              }`}
            >
              <span
                aria-hidden
                className={`block h-[14px] w-[14px] flex-none rounded-full bg-card ${
                  isActive ? "border-[4px] border-acc" : "border-[1.5px] border-line"
                }`}
              />
              <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-paper">
                {getIconOfService(model.service, 18, 18)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[13px] font-semibold text-ink">{model.label}</span>
                <span className="block text-[11.5px] text-soft">{serviceLabel[model.service] || model.service}</span>
              </span>
              {model.keyed ? (
                <span className="flex-none rounded-full bg-cool px-2 py-[3px] text-[10.5px] font-semibold text-ink">
                  keyed
                </span>
              ) : (
                <span
                  role="button"
                  tabIndex={0}
                  data-testid={`onboarding-model-add-key-${model.service}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onAddKey();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      onAddKey();
                    }
                  }}
                  className="flex-none text-[11.5px] font-semibold text-acc-deep"
                >
                  add key
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="pt-5">
        <div className="pb-[9px] text-[12px] font-semibold text-soft">Creativity</div>
        <div className="flex flex-wrap gap-2">
          {CREATIVITY_LEVELS.map((level) => {
            const isActive = form.creativity === level.key;
            return (
              <button
                key={level.key}
                type="button"
                aria-pressed={isActive}
                data-testid={`onboarding-creativity-${level.key}`}
                onClick={() => update({ creativity: level.key })}
                className={`flex-[1_1_170px] rounded-[12px] border px-[14px] py-3 text-left ${
                  isActive ? "border-acc-line bg-acc-soft text-acc-deep" : "border-line bg-card text-ink"
                }`}
              >
                <span className="block text-[13px] font-semibold">{level.label}</span>
                <span className="block pt-[2px] text-[11.5px] leading-[1.45] text-soft">{level.description}</span>
              </button>
            );
          })}
        </div>
        <p className="m-0 pt-2 font-mono text-[10.5px] text-soft">
          {/* Omitted from the payload entirely when the model has no temperature
              parameter — an unsupported parameter can fail the provider call. */}
          {temperature !== null
            ? `temperature = ${temperature}`
            : selectedId
              ? "this model does not expose creativity tuning"
              : "select a model to tune its creativity"}
        </p>
      </div>
    </div>
  );
};

export default ModelPane;
