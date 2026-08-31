import { getOrCreateNotificationAuthKey } from "@/config/index";
import { useEffect } from "react";

/** Traces the viasocket embed script lifecycle. Prefix is grep-able in the console. */
const log = (...args) => console.log("[viasocket-embed]", ...args);

export const isValidEmbedToken = (token) => {
  if (typeof token !== "string") return false;

  const normalizedToken = token.trim();
  return normalizedToken !== "" && normalizedToken !== "undefined" && normalizedToken !== "null";
};

export const useEmbedScriptLoader = (embedToken = null, isEmbedUser = false, isViewer = false) => {
  async function embedMaker(token, shouldAppendScript) {
    log("3. token accepted, length:", token.length, "| isEmbedUser:", isEmbedUser, "| isViewer:", isViewer);

    let pAuthKey = null;
    if (!isEmbedUser && !isViewer) {
      log("4. fetching notification auth key (gtwy_bridge_trigger)...");
      try {
        pAuthKey = await getOrCreateNotificationAuthKey("gtwy_bridge_trigger").then((res) => res?.authkey);
        log("4a. pauthkey resolved:", pAuthKey ? "yes" : "NO (undefined)");
      } catch (error) {
        console.error("[viasocket-embed] 4a. pauthkey fetch FAILED:", error);
      }
    } else {
      log("4. skipping pauthkey (embed user or viewer)");
    }

    if (!shouldAppendScript()) {
      console.warn("[viasocket-embed] 5. ABORTED — component unmounted before the script was appended");
      return;
    }

    const scriptId = process.env.NEXT_PUBLIC_EMBED_SCRIPT_ID;
    const scriptSrc = process.env.NEXT_PUBLIC_EMBED_SCRIPT_SRC;
    log("5. env vars — NEXT_PUBLIC_EMBED_SCRIPT_ID:", scriptId, "| NEXT_PUBLIC_EMBED_SCRIPT_SRC:", scriptSrc);
    if (!scriptId || !scriptSrc) {
      console.error(
        "[viasocket-embed] 5a. ABORT — NEXT_PUBLIC_EMBED_SCRIPT_ID / _SRC is undefined. " +
          "NEXT_PUBLIC_* vars are inlined at build time; add them to the Docker build args."
      );
      return;
    }

    if (document.getElementById(scriptId)) {
      log("5b. script tag already present — skipping duplicate append");
      return;
    }

    const script = document.createElement("script");
    script.setAttribute("embedToken", token);
    script.id = process.env.NEXT_PUBLIC_EMBED_SCRIPT_ID;
    script.src = process.env.NEXT_PUBLIC_EMBED_SCRIPT_SRC;
    script.setAttribute("parentId", "alert-embed-parent");
    const configurationJson = {
      rowxvl39hxd0: {
        key: "Alert_On_Error",
        authValues: {
          pauth_key: pAuthKey,
        },
      },
      rowhup02ji8l: {
        key: "Alert_On_Fallback",
        authValues: {
          pauth_key: pAuthKey,
        },
      },
      row3atttp4du: {
        key: "Alert_On_Missing_Variables",
        authValues: {
          pauth_key: pAuthKey,
        },
      },
    };
    script.setAttribute("configurationJson", JSON.stringify(configurationJson));

    script.onload = () => {
      log("7. script LOADED. window.openViasocket is", typeof window.openViasocket);
    };
    script.onerror = (event) => {
      console.error("[viasocket-embed] 7. script FAILED to load from:", scriptSrc, event);
    };

    log("6. appending script tag to <body>...");
    document.body.appendChild(script);
  }
  useEffect(() => {
    let shouldLoadScript = true;

    log("1. hook ran. embedToken type:", typeof embedToken, "| valid:", isValidEmbedToken(embedToken));

    if (isValidEmbedToken(embedToken)) {
      log("2. embed token is valid — starting load");
      embedMaker(embedToken.trim(), () => shouldLoadScript);

      return () => {
        shouldLoadScript = false;
        log("8. cleanup — removing script + embed container");
        try {
          const script = document.getElementById(process.env.NEXT_PUBLIC_EMBED_SCRIPT_ID);
          if (script && script.parentNode === document.body) {
            document.body.removeChild(script);
          }

          const embedContainer = document.getElementById("iframe-viasocket-embed-parent-container");
          if (embedContainer && embedContainer.parentNode === document.body) {
            document.body.removeChild(embedContainer);
          }
        } catch (error) {
          console.warn("Error removing embed scripts:", error);
        }
      };
    }

    console.warn(
      "[viasocket-embed] 2. NO LOAD — embed token is missing or invalid:",
      JSON.stringify(embedToken),
      "(it arrives from getAllBridgesAction; this is expected until that resolves)"
    );

    return () => {
      shouldLoadScript = false;
    };
  }, [embedToken, isEmbedUser, isViewer]);
};
