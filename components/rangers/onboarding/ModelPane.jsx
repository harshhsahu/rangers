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

  /**
   * Every provider the org can use, not a hardcoded shortlist — this used to be
   * openai/anthropic/gemini plus whatever was keyed, so the other ten providers
   * simply never appeared in onboarding.
   *
   * Ordered keyed-first, then the common three, then the rest of the catalogue,
   * so the provider you already have a key for is the one that opens.
   */
  const targetServices = useMemo(() => {
    const known = services.map((service) => service?.value).filter(Boolean);
    if (!known.length) {
      // GET /api/service has not landed yet; show the common three meanwhile.
      const fallback = [...keyedServices, ...MODEL_STEP_DEFAULT_SERVICES, form.service].filter(Boolean);
      return [...new Set(fallback)];
    }
    const rank = (service) => {
      if (keyedServices.has(service)) return 0;
      if (MODEL_STEP_DEFAULT_SERVICES.includes(service)) return 1;
      return 2;
    };
    return [...new Set(known)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  }, [form.service, keyedServices, services]);

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

  const selectedId = form.service && form.model ? `${form.service}::${form.model}` : null;
  const temperature = resolveTemperature(form.creativity, form.temperatureParam);

  /** One tab per provider, whether or not its catalogue has loaded yet. */
  const providerTabs = useMemo(
    () => targetServices.map((service) => ({ service, keyed: keyedServices.has(service) })),
    [keyedServices, targetServices]
  );

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

  /**
   * Only the provider on screen is fetched — asking for all thirteen up front
   * would be thirteen requests to render one list. Declared after
   * `effectiveService` so switching tabs actually triggers the fetch.
   */
  useEffect(() => {
    [effectiveService, form.service].filter(Boolean).forEach((service) => {
      const hasResponse = Object.prototype.hasOwnProperty.call(serviceModels, service);
      if (hasResponse || requestedRef.current.has(service)) return;
      requestedRef.current.add(service);
      dispatch(getModelAction({ service }));
    });
  }, [dispatch, effectiveService, form.service, serviceModels]);

  // Loading is per-provider: the rest of the catalogue is deliberately unfetched,
  // so "any service missing" would leave this stuck on true forever.
  const isLoading = Boolean(effectiveService) && !serviceModels?.[effectiveService];

  return (
    <div data-testid="onboarding-pane-model" id="onboarding-pane-model">
      {/* Discrete chips rather than a segmented track: with thirteen providers a
          shared sunken bar ran them together into one unreadable wall. Each chip
          carries its own border and gap, and a keyed provider gets a dot rather
          than a second word competing with the name. */}
      {providerTabs.length > 1 && keyedServices.size > 0 && (
        <div className="flex items-center gap-[7px] pb-2.5 text-[11.5px] text-soft">
          <span aria-hidden="true" className="h-1.5 w-1.5 flex-none rounded-full bg-acc" />
          <span>Your own key — these run on your quota and billing</span>
        </div>
      )}

      {providerTabs.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {providerTabs.map((tab) => {
            const isActive = tab.service === effectiveService;
            return (
              <button
                key={tab.service}
                type="button"
                data-testid={`onboarding-model-service-${tab.service}`}
                aria-pressed={isActive}
                title={tab.keyed ? "You have a key for this provider" : "Runs on the free tier"}
                onClick={() => setActiveService(tab.service)}
                className={`flex shrink-0 items-center gap-[7px] rounded-[9px] border px-[11px] py-[6px] text-[12.5px] font-semibold transition-colors ${
                  isActive
                    ? "border-acc-line bg-acc-soft text-acc-deep"
                    : "border-line bg-card text-soft hover:text-ink"
                }`}
              >
                {getIconOfService(tab.service, 14, 14)}
                <span>{serviceLabel[tab.service] || tab.service}</span>
                {tab.keyed && (
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 flex-none rounded-full ${isActive ? "bg-acc-deep" : "bg-acc"}`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex max-h-[340px] flex-col gap-2 overflow-y-auto">
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
