"use client";

import { useEffect, useState } from "react";
import { EMBED_SCRIPT_ID, EMBED_SCRIPT_SRC } from "@/utils/viasocketEmbed";

/** Hidden home the script points at; the builder always renders here first. */
const PAGE_CONTAINER_ID = "viasocket-embed-page-container";
/** Wrapper the embed injects — this is the node that gets moved into the box. */
const EMBED_WRAPPER_ID = "iframe-viasocket-embed-parent-container";

const ensurePageContainer = () => {
  let container = document.getElementById(PAGE_CONTAINER_ID);
  if (!container) {
    container = document.createElement("div");
    container.id = PAGE_CONTAINER_ID;
    container.style.display = "none";
    document.body.appendChild(container);
  }
  return container;
};

const appendEmbedScript = (embedToken) => {
  const script = document.createElement("script");
  script.id = EMBED_SCRIPT_ID;
  script.src = EMBED_SCRIPT_SRC;
  script.async = true;
  script.setAttribute("embedToken", embedToken);
  script.setAttribute("parentId", PAGE_CONTAINER_ID);
  script.onerror = () => console.error("[useConnectorEmbed] Embed script failed to load");
  document.body.appendChild(script);
  return script;
};

/**
 * The builder mounts itself fixed-position at page level, so docking it into a
 * box means overriding that positioning before re-parenting the node.
 */
const dockWrapper = (wrapper, target) => {
  wrapper.style.setProperty("position", "relative", "important");
  wrapper.style.setProperty("top", "auto", "important");
  wrapper.style.setProperty("left", "auto", "important");
  wrapper.style.setProperty("z-index", "auto", "important");
  wrapper.style.setProperty("width", "100%", "important");
  wrapper.style.setProperty("height", "100%", "important");
  target.appendChild(wrapper);
};

/**
 * Opens the ViaSocket tool builder and docks it into `host`.
 *
 * `scriptId` is the tool to reopen for editing; omitted, the builder starts blank. It is
 * the embed's own first argument, and passing undefined is what makes it a create.
 *
 * Both the embed token and the script-provided `window.openViasocket` arrive
 * asynchronously and in no fixed order, so readiness is polled rather than
 * guessed at with a fixed delay. Bumping `reloadKey` tears the builder down and
 * opens a fresh one in the same box.
 *
 * Returns `{ error }` — a message once the script has had long enough to load
 * and still is not there, otherwise null.
 */
const useConnectorEmbed = ({ embedToken, host, reloadKey = 0, enabled = true, meta, scriptId = null }) => {
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !embedToken || !host) return undefined;

    const pageContainer = ensurePageContainer();
    // The org layout appends this on every org route; this covers the case
    // where the builder is opened before that has finished.
    if (!document.getElementById(EMBED_SCRIPT_ID)) appendEmbedScript(embedToken);
    // The builder renders into its home first, so it cannot stay hidden.
    pageContainer.style.display = "block";

    let cancelled = false;
    let readyTimer;
    let dockTimer;

    // ~15s at 100ms. Generous: the script is fetched over the network and the
    // user may be on a slow connection.
    let attemptsLeft = 150;

    const openWhenReady = () => {
      if (cancelled) return;

      if (typeof window.openViasocket !== "function") {
        if (attemptsLeft-- <= 0) {
          setError("The connector builder could not be loaded. Check your connection and try again.");
          return;
        }
        readyTimer = window.setTimeout(openWhenReady, 100);
        return;
      }

      setError(null);
      window.openViasocket(scriptId || undefined, { embedToken, meta });

      // The embed injects its wrapper a tick after opening; poll for that too
      // rather than assuming it lands within a fixed delay.
      let dockAttempts = 50;
      const dockWhenPresent = () => {
        if (cancelled) return;
        const wrapper = document.getElementById(EMBED_WRAPPER_ID);
        if (wrapper) {
          dockWrapper(wrapper, host);
          return;
        }
        if (dockAttempts-- <= 0) return;
        dockTimer = window.setTimeout(dockWhenPresent, 100);
      };
      dockWhenPresent();
    };

    openWhenReady();

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimer);
      window.clearTimeout(dockTimer);
      try {
        if (typeof window.handleclose === "function") window.handleclose();
      } catch (err) {
        console.warn("Closing the connector builder failed", err);
      }
      // Park the builder back at page level so the box can unmount cleanly.
      const wrapper = document.getElementById(EMBED_WRAPPER_ID);
      if (wrapper) pageContainer.appendChild(wrapper);
      pageContainer.style.display = "none";
    };
    // `meta` is a literal at every call site; leaving it out of the deps keeps
    // the builder from being torn down and reopened on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedToken, host, reloadKey, enabled, scriptId]);

  return { error, clearError: () => setError(null) };
};

export default useConnectorEmbed;
