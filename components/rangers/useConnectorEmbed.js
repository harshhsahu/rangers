"use client";

import { useEffect, useState } from "react";
import { EMBED_SCRIPT_ID, EMBED_SCRIPT_SRC } from "@/utils/viasocketEmbed";

const appendEmbedScript = () => {
  const script = document.createElement("script");
  script.id = EMBED_SCRIPT_ID;
  script.src = EMBED_SCRIPT_SRC;
  script.async = true;
  script.onerror = () => console.error("[useConnectorEmbed] Embed script failed to load");
  document.body.appendChild(script);
  return script;
};

/**
 * Mounts the ViaSocket tool builder as an inline component that fills `host`.
 *
 * `viaSocket.mount` gives each box its own instance and iframe, separate from
 * the page-wide slider behind `window.openViasocket`, so nothing is re-parented
 * and the builder takes whatever size the box has. The box must have a height.
 *
 * `scriptId` is the tool to reopen for editing; omitted, the builder starts blank.
 *
 * The embed token and the script-provided `window.viaSocket` arrive
 * asynchronously and in no fixed order, so readiness is polled rather than
 * guessed at with a fixed delay. Bumping `reloadKey` tears the builder down and
 * mounts a fresh one in the same box.
 *
 * Returns `{ error }` — a message once the script has had long enough to load
 * and still is not there, otherwise null.
 */
const useConnectorEmbed = ({ embedToken, host, reloadKey = 0, enabled = true, meta, scriptId = null }) => {
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !embedToken || !host) return undefined;

    // The org layout appends this on every org route; this covers the case
    // where the builder is opened before that has finished.
    if (!document.getElementById(EMBED_SCRIPT_ID)) appendEmbedScript();

    let cancelled = false;
    let readyTimer;
    let embed = null;

    // ~15s at 100ms. Generous: the script is fetched over the network and the
    // user may be on a slow connection.
    let attemptsLeft = 150;

    const mountWhenReady = () => {
      if (cancelled) return;

      if (typeof window.viaSocket?.mount !== "function") {
        if (attemptsLeft-- <= 0) {
          setError("The connector builder could not be loaded. Check your connection and try again.");
          return;
        }
        readyTimer = window.setTimeout(mountWhenReady, 100);
        return;
      }

      setError(null);
      embed = window.viaSocket.mount({
        embedToken,
        parent: host,
        config: { type: "all_space" },
        open: { flowId: scriptId || undefined, meta },
      });
    };

    mountWhenReady();

    return () => {
      cancelled = true;
      window.clearTimeout(readyTimer);
      try {
        embed?.destroy();
      } catch (err) {
        console.warn("Closing the connector builder failed", err);
      }
    };
    // `meta` is a literal at every call site; leaving it out of the deps keeps
    // the builder from being torn down and reopened on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedToken, host, reloadKey, enabled, scriptId]);

  return { error, clearError: () => setError(null) };
};

export default useConnectorEmbed;
