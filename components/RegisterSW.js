"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const INSTALLABLE_EVENT = "pwa-installable";
export const LAST_CHATBOT_KEY = "last-chatbot-path";

export default function RegisterSW() {
  const router = useRouter();

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");

    // Installed app launches at start_url "/". Send it straight to the chat it was installed from.
    const isInstalledApp =
      window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isInstalledApp && window.location.pathname === "/") {
      try {
        const last = localStorage.getItem(LAST_CHATBOT_KEY);
        if (last) router.replace(last);
      } catch {}
    }

    // The browser fires beforeinstallprompt once, early. Keep it so a page that mounts later can still use it.
    const onBeforeInstall = (e) => {
      e.preventDefault();
      window.__pwaInstallEvent = e;
      window.dispatchEvent(new Event(INSTALLABLE_EVENT));
    };
    const onInstalled = () => {
      window.__pwaInstallEvent = null;
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}
