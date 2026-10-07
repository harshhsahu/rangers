"use client";
import { useEffect, useState } from "react";
import { INSTALLABLE_EVENT } from "@/components/RegisterSW";

/**
 * "Install app" button, fixed to the top right. The install event is captured once by RegisterSW
 * (root layout) in window.__pwaInstallEvent; clicking the button opens the browser's native
 * install dialog. Hidden when the app is already installed or the browser can't install it.
 */
export default function InstallButton() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const sync = () => setAvailable(Boolean(window.__pwaInstallEvent));
    sync();
    window.addEventListener(INSTALLABLE_EVENT, sync);
    window.addEventListener("appinstalled", sync);
    return () => {
      window.removeEventListener(INSTALLABLE_EVENT, sync);
      window.removeEventListener("appinstalled", sync);
    };
  }, []);

  const install = async () => {
    const event = window.__pwaInstallEvent;
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
      // A prompt event can be used once. If the user dismissed it, the browser fires a new one later.
      window.__pwaInstallEvent = null;
      setAvailable(false);
    } catch {
      // prompt() already used or blocked; nothing to do.
    }
  };

  if (!available) return null;

  return (
    <button type="button" className="btn btn-primary btn-sm fixed right-3 top-3 z-[2147483647]" onClick={install}>
      Install app
    </button>
  );
}
