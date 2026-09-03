"use client";

import React, { useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import { useCustomSelector } from "@/customHooks/customSelector";
import { deleteApikeyAction, saveApiKeysAction } from "@/store/action/apiKeyAction";
import { shortUniqueId } from "@/utils/utility";
import { getIconOfService } from "@/utils/utility";

/**
 * Provider keys, one row per service the workspace supports.
 *
 * Keys are org-level (the same records the API Keys page manages), so saving
 * one here is immediately usable by every agent — the ranger picks the key up
 * on deploy, where the version is bound to the key for its own service.
 *
 * The name is derived rather than asked for: it is the service name, so a key
 * saved here reads the same on the API Keys page, and because the delete action
 * matches on name (store/action/apiKeyAction.js) one deterministic name per
 * service keeps a save/remove round-trip unambiguous.
 */
/**
 * API key names have to be unique for the lifetime of the org — using the bare
 * service name meant every key for a provider collided with the last one.
 */
export const onboardingKeyName = (service) => `${service}_${shortUniqueId()}`;

const KeysPane = ({ orgId }) => {
  const dispatch = useDispatch();
  const [drafts, setDrafts] = useState({});
  const [busyService, setBusyService] = useState(null);

  const { services, apikeys } = useCustomSelector((state) => ({
    services: state?.serviceReducer?.services || [],
    apikeys: state?.apiKeysReducer?.apikeys?.[orgId] || [],
  }));

  const savedByService = useMemo(() => {
    const map = {};
    apikeys.forEach((apiKey) => {
      if (apiKey?.service && !map[apiKey.service]) map[apiKey.service] = apiKey;
    });
    return map;
  }, [apikeys]);

  const handleSave = async (service) => {
    const apikey = (drafts[service] || "").trim();
    if (!apikey || busyService) return;
    setBusyService(service);
    try {
      const saved = await dispatch(
        saveApiKeysAction({ name: onboardingKeyName(service), service, apikey, apikey_limit: 0 }, orgId)
      );
      if (!saved?._id) {
        toast.error("Could not save that key. Check it and try again.");
        return;
      }
      setDrafts((prev) => ({ ...prev, [service]: "" }));
    } finally {
      setBusyService(null);
    }
  };

  const handleRemove = async (service) => {
    const saved = savedByService[service];
    if (!saved?._id || busyService) return;
    setBusyService(service);
    try {
      await dispatch(deleteApikeyAction({ org_id: orgId, name: saved.name, id: saved._id, service }));
    } finally {
      setBusyService(null);
    }
  };

  if (services.length === 0) {
    return (
      <div className="flex flex-col gap-2" data-testid="onboarding-pane-keys-loading">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="h-[50px] animate-pulse rounded-[12px] bg-paper-sunken" />
        ))}
      </div>
    );
  }

  return (
    <div data-testid="onboarding-pane-keys" id="onboarding-pane-keys">
      <div className="overflow-hidden rounded-[14px] border border-line bg-card">
        {services.map((service, index) => {
          const value = service?.value;
          const label = service?.displayName || service?.label || value;
          const saved = savedByService[value];
          const isBusy = busyService === value;

          return (
            <div
              key={value}
              data-testid={`onboarding-key-row-${value}`}
              className={`flex items-center gap-3 px-[14px] py-[11px] ${index === 0 ? "" : "border-t border-card-line"} ${
                saved ? "bg-card-band" : ""
              }`}
            >
              <span className="grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-paper">
                {getIconOfService(value, 18, 18)}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">{label}</span>
                <span className="block font-mono text-[10.5px] text-soft opacity-80">{value}</span>
              </span>

              {saved ? (
                <span className="inline-flex items-center gap-[5px] rounded-full bg-cool px-[9px] py-[3px] text-[11px] font-semibold text-ink">
                  Key saved
                </span>
              ) : (
                <input
                  autoComplete="off"
                  type="password"
                  data-testid={`onboarding-key-input-${value}`}
                  placeholder="Paste API key"
                  className="w-[190px] !rounded-[8px] !border !border-line !bg-card-band px-[10px] py-[7px] font-mono text-[11.5px] text-ink outline-none placeholder:text-soft"
                  value={drafts[value] || ""}
                  onChange={(event) => setDrafts((prev) => ({ ...prev, [value]: event.target.value }))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSave(value);
                  }}
                />
              )}

              <button
                type="button"
                data-testid={`onboarding-key-action-${value}`}
                disabled={isBusy || (!saved && !(drafts[value] || "").trim())}
                onClick={() => (saved ? handleRemove(value) : handleSave(value))}
                className={`flex-none rounded-[8px] px-[11px] py-[6px] text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${
                  saved ? "border border-line bg-transparent text-soft" : "bg-acc text-acc-ink"
                }`}
              >
                {isBusy ? "…" : saved ? "Remove" : "Save"}
              </button>
            </div>
          );
        })}
      </div>

      <p className="m-0 pt-3 text-[12px] text-soft">
        Keys are per provider. Add one now or skip — we will nudge you before the first run.
      </p>
    </div>
  );
};

export default KeysPane;
