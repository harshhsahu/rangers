"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link2, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "@/utils/toast";
import { authHeaders, getStoredGtwyUserId } from "@/utils/internalAuth";

const CONNECT_SCRIPT = "https://embed.viasocket.com/prod-connectcomponent.js";
const EMBED_PAGE = "https://embedfrontend.viasocket.com/embed";

const loadConnectScript = () =>
  new Promise((resolve, reject) => {
    if (typeof window.openViasocketConnection === "function") {
      resolve();
      return;
    }
    const existing = document.getElementById("viasocket-connect-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Connect script failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "viasocket-connect-script";
    script.src = CONNECT_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Connect script failed"));
    document.body.appendChild(script);
  });

const authKey = (orgId, serviceId) => `viasocket-auth:${orgId}:${serviceId}`;
const addedKey = (orgId) => `viasocket-added:${orgId || "org"}`;

export const forgetCatalogAdded = (orgId) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(addedKey(orgId));
};

const authIdFromPayload = (payload) => {
  if (!payload || typeof payload !== "object") return "";
  const nested = payload.data && typeof payload.data === "object" ? payload.data : null;
  const id =
    payload.id ||
    nested?.id ||
    nested?.data?.id ||
    payload.auth_id ||
    nested?.auth_id ||
    payload.authId ||
    nested?.authId;
  return id ? String(id) : "";
};

/**
 * Apps API catalog. Each app becomes one tool on the agent: connecting it enables the app once
 * (one script id for all its actions) and every action is offered to the model through that tool.
 */
const ViaSocketCatalog = ({ orgId, agentId, versionId, embedToken, disabled = false }) => {
  const [appTools, setAppTools] = useState([]);
  const [removingId, setRemovingId] = useState(null);
  const [query, setQuery] = useState("");
  const [apps, setApps] = useState([]);
  const [allApps, setAllApps] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [actions, setActions] = useState([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [authId, setAuthId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const searchTimer = useRef(null);
  const linkedThisSession = useRef(new Set());
  const embedDetailsRef = useRef(null);

  useEffect(() => {
    if (!embedToken) {
      embedDetailsRef.current = null;
      return undefined;
    }
    let cancelled = false;
    fetch("/api/viasocket/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ embed_token: embedToken }),
    })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled || !json?.data) return;
        const details = { ...json.data };
        delete details.config;
        embedDetailsRef.current = details;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [embedToken]);

  const loadAppTools = useCallback(async () => {
    if (!agentId) {
      setAppTools([]);
      return;
    }
    const params = new URLSearchParams({ agent_id: agentId, ...(versionId ? { version_id: versionId } : {}) });
    const res = await fetch(`/api/viasocket/app-tools?${params}`, { headers: authHeaders() });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success) setAppTools(data.tools || []);
  }, [agentId, versionId]);

  useEffect(() => {
    loadAppTools().catch(() => {});
  }, [loadAppTools]);

  useEffect(() => {
    if (!selected?.service_id || !orgId) {
      setAuthId("");
      return;
    }
    setAuthId(window.localStorage.getItem(authKey(orgId, selected.service_id)) || "");
  }, [orgId, selected]);

  useEffect(() => {
    let cancelled = false;
    setSearching(true);
    fetch("/api/viasocket/apps", { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.success) throw new Error(data?.error || "Could not list apps");
        setAllApps(data.apps || []);
        setApps(data.apps || []);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error?.message || "Could not list apps");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    loadConnectScript().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.clearTimeout(searchTimer.current);
    const text = query.trim();
    if (text.length < 2) {
      setApps(allApps);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/viasocket/apps?key=${encodeURIComponent(text)}`, { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok || !data?.success) throw new Error(data?.error || "Search failed");
        setApps(data.apps || []);
      } catch (error) {
        toast.error(error?.message || "Could not search apps");
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(searchTimer.current);
  }, [query, allApps]);

  const openApp = async (app) => {
    setSelected(app);
    setActions([]);
    setLoadingActions(true);
    try {
      const res = await fetch(`/api/viasocket/apps/${encodeURIComponent(app.service_id)}/versions`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not load actions");
      setActions(data.actions || []);
      const stored = window.localStorage.getItem(authKey(orgId, app.service_id));
      if (stored && linkedThisSession.current.has(app.service_id)) {
        setAuthId(stored);
      } else {
        setAuthId("");
      }
    } catch (error) {
      toast.error(error?.message || "Could not load actions");
    } finally {
      setLoadingActions(false);
    }
  };

  const rememberAuth = (id) => {
    if (!id || !selected?.service_id) return id;
    window.localStorage.setItem(authKey(orgId, selected.service_id), id);
    setAuthId(id);
    return id;
  };

  const lookupAuthIds = async () => {
    const res = await fetch("/api/viasocket/authentications", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        embed_token: embedToken,
        service_id: selected?.service_id,
        service_name: selected?.name,
      }),
    });
    const data = await res.json().catch(() => ({}));
    const ids = Array.isArray(data?.auth_ids) ? data.auth_ids.map(String) : [];
    if (data?.auth_id && !ids.includes(String(data.auth_id))) ids.push(String(data.auth_id));
    return ids;
  };

  const waitForAuthRecord = async (captured, previousIds) => {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      if (captured.current) return captured.current;
      const ids = await lookupAuthIds();
      const fresh = ids.find((item) => !previousIds.has(item));
      if (fresh) return fresh;
      if (attempt >= 4 && ids.length) return ids[ids.length - 1];
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
    }
    return captured.current || "";
  };

  const connectUrl = (serviceId, serviceName) => {
    const embedDetails = embedDetailsRef.current;
    if (!embedDetails || !serviceId) return "";
    const params = new URLSearchParams({
      viasocketEmbedDetails: JSON.stringify(embedDetails),
      connectServiceId: serviceId,
      openerURL: window.location.origin,
      mode: "embed",
      skipactionselection: "true",
    });
    if (serviceName) params.set("serviceName", serviceName);
    return `${EMBED_PAGE}?${params.toString()}`;
  };

  const connectSelectedApp = () => {
    if (!selected?.service_id) return null;
    if (!embedToken) {
      toast.error("The embed token is still loading. Try again in a moment.");
      return null;
    }

    setConnecting(true);
    const captured = { current: "" };
    const onMessage = (event) => {
      let hostname = "";
      try {
        hostname = new URL(event.origin).hostname;
      } catch {
        hostname = "";
      }
      const trusted =
        hostname === "viasocket.com" || hostname.endsWith(".viasocket.com") || event.origin === window.location.origin;
      if (!trusted) return;
      let payload = event?.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }
      const id =
        authIdFromPayload(payload) ||
        authIdFromPayload(payload?.data) ||
        (payload?.type === "viasocket_connection_success" ? authIdFromPayload(payload.data) : "");
      if (id) captured.current = id;
    };
    window.addEventListener("message", onMessage);

    // Slack's workspace page stays blank if this window started as about:blank
    // and only moved to OAuth after an async call. Open the viaSocket URL on the click.
    const readyUrl = connectUrl(selected.service_id, selected.name);
    const popup = window.open(readyUrl || EMBED_PAGE, "_blank");
    if (!popup) {
      window.removeEventListener("message", onMessage);
      setConnecting(false);
      toast.error("Allow popups for this site, then click Add as tool again.");
      return null;
    }

    return (async () => {
      try {
        const existingIds = new Set(await lookupAuthIds().catch(() => []));
        if (!readyUrl) {
          const response = await fetch("/api/viasocket/register", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ embed_token: embedToken }),
          });
          const json = await response.json().catch(() => ({}));
          const embedDetails = json?.data;
          if (!response.ok || !embedDetails) {
            try {
              popup.close();
            } catch {
              // ignore
            }
            throw new Error(json?.error || json?.message || "Could not start the connection.");
          }
          delete embedDetails.config;
          embedDetailsRef.current = embedDetails;
          popup.location.replace(connectUrl(selected.service_id, selected.name));
        }

        const listed = await waitForAuthRecord(captured, existingIds);
        if (listed) return rememberAuth(listed);
        throw new Error(
          `Could not link ${selected.name}. Finish Slack sign-in in the tab, then click Add as tool again.`
        );
      } catch (error) {
        toast.error(error?.message || "Could not connect this app");
        return null;
      } finally {
        window.removeEventListener("message", onMessage);
        setConnecting(false);
      }
    })();
  };

  const addApp = () => {
    if (disabled || !agentId || !selected?.service_id || addingId || connecting) return;
    const app = selected;
    setAddingId(app.service_id);

    const persist = async (connectedAuthId) => {
      if (!connectedAuthId) {
        setAddingId(null);
        return;
      }
      try {
        const res = await fetch("/api/viasocket/app-tools", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            org_id: orgId,
            agent_id: agentId,
            version_id: versionId,
            user_id: getStoredGtwyUserId(),
            service_id: app.service_id,
            service_name: app.name,
            icon_url: app.iconurl,
            auth_id: connectedAuthId,
            embed_token: embedToken,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) throw new Error(data?.error || "Could not add the app");
        linkedThisSession.current.add(app.service_id);
        await loadAppTools();
        toast.success(`${app.name} added as a tool with ${data.tool?.actions?.length || 0} actions`);
      } catch (error) {
        toast.error(error?.message || "Could not add the app");
      } finally {
        setAddingId(null);
      }
    };

    if (linkedThisSession.current.has(app.service_id) && authId) {
      persist(authId);
      return;
    }
    const pending = connectSelectedApp();
    if (pending) pending.then((id) => persist(id));
    else setAddingId(null);
  };

  const removeApp = async (tool) => {
    if (disabled || removingId) return;
    if (!window.confirm(`Remove ${tool.service_name} from this agent? You can add it again from the catalog.`)) return;
    setRemovingId(tool.id);
    try {
      const res = await fetch(`/api/viasocket/app-tools/${encodeURIComponent(tool.id)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) throw new Error(data?.error || "Could not remove the app");
      await loadAppTools();
      toast.success(`${tool.service_name} removed`);
    } catch (error) {
      toast.error(error?.message || "Could not remove the app");
    } finally {
      setRemovingId(null);
    }
  };

  const selectedTool = appTools.find((tool) => tool.service_id === selected?.service_id) || null;

  return (
    <div className="rounded-xl border-2 border-stroke bg-card p-4" data-testid="viasocket-catalog">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-base-content">App catalog</h3>
        <p className="mt-1 text-xs text-soft">
          Pick an app, then add it as one tool. That opens the connection page first; the agent gets every action of the
          app after sign-in succeeds.
        </p>
      </div>

      {appTools.length > 0 && (
        <div className="mb-3 flex flex-col gap-2" data-testid="viasocket-app-tools">
          {appTools.map((tool) => (
            <div
              key={tool.id}
              className="flex items-center gap-2 rounded-lg border border-stroke bg-base-100 px-2.5 py-2"
            >
              <span className="grid h-7 w-7 flex-none place-items-center overflow-hidden rounded-md bg-base-200">
                {tool.icon_url ? (
                  <img src={tool.icon_url} alt="" className="h-4 w-4 object-contain" />
                ) : (
                  <Link2 size={13} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-base-content">{tool.service_name}</p>
                <p className="truncate text-[11px] text-soft">
                  {tool.tool_name} · {tool.actions?.length || 0} actions
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-xs gap-1 text-error"
                disabled={disabled || Boolean(removingId)}
                onClick={() => removeApp(tool)}
              >
                <Trash2 size={12} />
                {removingId === tool.id ? "Removing…" : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 rounded-[10px] border border-stroke bg-base-100 px-2.5 py-2">
        <Search size={14} className="text-soft" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Gmail, Slack, Sheets…"
          className="w-full bg-transparent text-[13px] text-base-content outline-none placeholder:text-soft"
          data-testid="viasocket-app-search"
        />
      </label>

      {searching && (
        <p className="mt-2 text-[12px] text-soft">{query.trim().length < 2 ? "Loading apps…" : "Searching…"}</p>
      )}

      {apps.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {apps.map((app) => (
            <button
              key={app.service_id}
              type="button"
              onClick={() => openApp(app)}
              className={`flex min-w-0 items-center gap-2 rounded-lg border-2 bg-base-100 p-2 text-left ${
                selected?.service_id === app.service_id ? "border-primary" : "border-stroke"
              }`}
            >
              <span className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-md bg-base-200">
                {app.iconurl ? (
                  <img src={app.iconurl} alt="" className="h-5 w-5 object-contain" />
                ) : (
                  <Link2 size={14} />
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-base-content">{app.name}</span>
                <span className="block truncate text-[11px] text-soft">{app.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="mt-4 border-t border-stroke pt-3">
          <div className="mb-2 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-base-content">
              {selected.name} actions
            </p>
            {selectedTool ? (
              <span className="badge badge-success badge-sm">Added</span>
            ) : (
              <button
                type="button"
                className="btn btn-outline btn-xs gap-1"
                disabled={disabled || !agentId || !embedToken || Boolean(addingId) || connecting || loadingActions}
                onClick={addApp}
                data-testid="viasocket-add-app"
              >
                <Plus size={12} />
                {addingId === selected.service_id
                  ? connecting
                    ? "Connecting…"
                    : "Adding…"
                  : `Add ${selected.name} as tool`}
              </button>
            )}
          </div>
          {!embedToken && (
            <p className="mb-2 text-[12px] text-warning">The organization embed token is not loaded yet.</p>
          )}
          {embedToken && !selectedTool && (
            <p className="mb-2 text-[12px] text-soft">
              {linkedThisSession.current.has(selected.service_id) && authId
                ? `${selected.name} is linked for this session.`
                : `Adding opens the ${selected.name} connection page. Allow popups if the browser asks.`}
            </p>
          )}
          {embedToken && selectedTool && (
            <p className="mb-2 text-[12px] text-soft">
              The agent can run every action below through the {selectedTool.tool_name} tool.
            </p>
          )}
          {loadingActions ? (
            <p className="text-[12px] text-soft">Loading actions…</p>
          ) : actions.length === 0 ? (
            <p className="text-[12px] text-soft">This app has no published actions.</p>
          ) : (
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {actions.map((action) => (
                <div
                  key={String(action.actionversionrecordid || action.rowid)}
                  className="rounded-lg border border-stroke bg-base-100 px-2.5 py-2"
                >
                  <p className="truncate text-[13px] font-medium text-base-content">{action.name}</p>
                  <p className="truncate text-[11px] text-soft">{action.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ViaSocketCatalog;
