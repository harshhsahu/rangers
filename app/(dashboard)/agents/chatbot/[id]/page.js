"use client";

import { use, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { getSingleBridgesAction } from "@/store/action/bridgeAction";
import Protected from "@/components/Protected";
import { LAST_CHATBOT_KEY } from "@/components/RegisterSW";
import InstallButton from "@/components/common/installButton";
import { useCustomSelector } from "@/customHooks/customSelector";
import { ORG_ID } from "@/utils/enums";

export const runtime = "edge";

const SCRIPT_ID = "chatbot-main-script";
const CONTAINER_ID = "chatbot-container";

const toTitleCase = (text = "") =>
  text
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

const Page = ({ params, searchParams }) => {
  const { id } = use(params);
  const versionId = searchParams?.versionId;
  const dispatch = useDispatch();
  // allBridgesMap is only filled by the agent config pages, so on a direct launch (e.g. the installed app) it is
  // empty. The agents list the layout loads carries slugName too, so fall back to it and fetch the agent itself.
  const { historyToken, slugName, hasBridge } = useCustomSelector((state) => ({
    historyToken: state?.bridgeReducer?.org?.[ORG_ID]?.history_page_chatbot_token,
    slugName:
      state?.bridgeReducer?.allBridgesMap?.[id]?.slugName ||
      state?.bridgeReducer?.org?.[ORG_ID]?.orgs?.find((agent) => agent?._id === id)?.slugName,
    hasBridge: Boolean(state?.bridgeReducer?.allBridgesMap?.[id]),
  }));

  useEffect(() => {
    if (!hasBridge) dispatch(getSingleBridgesAction({ id, version: versionId })).catch(() => {});
  }, [id]);

  // Token of the chatbot created in chatbotConfig > integration, which includes the user's agents.
  // The history token belongs to the Debug Agent chatbot and only works as a fallback.
  const chatbotToken = historyToken;
  // Bumped when the installed app comes back from the background (or from the back/forward cache) with the
  // chat frame gone, so the embed below is mounted again instead of leaving a blank page.
  const [embedKey, setEmbedKey] = useState(0);
  const path = `/agents/chatbot/${id}${versionId ? `?versionId=${versionId}` : ""}`;

  // Installing from here should launch the app straight into this chatbot (start_url comes from the manifest
  // route). A new <link> is inserted instead of editing href: browsers re-read the manifest for a new element.
  useEffect(() => {
    const setManifest = (href) => {
      document.querySelectorAll('link[rel="manifest"]').forEach((el) => el.remove());
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = href;
      link.crossOrigin = "use-credentials";
      document.head.appendChild(link);
    };
    setManifest(`/api/manifest?start=${encodeURIComponent(path)}`);
    return () => setManifest("/api/manifest");
  }, [path]);

  useEffect(() => {
    try {
      localStorage.setItem(LAST_CHATBOT_KEY, path);
    } catch {}
  }, [path]);

  useEffect(() => {
    const remountIfEmpty = () => {
      if (document.visibilityState === "hidden") return;
      if (!document.getElementById(CONTAINER_ID)?.querySelector("iframe")) setEmbedKey((key) => key + 1);
    };
    document.addEventListener("visibilitychange", remountIfEmpty);
    window.addEventListener("pageshow", remountIfEmpty);
    return () => {
      document.removeEventListener("visibilitychange", remountIfEmpty);
      window.removeEventListener("pageshow", remountIfEmpty);
    };
  }, []);

  // Same embed script and token the history page uses. The token lands after mount on a hard load.
  useEffect(() => {
    const scriptSrc = process.env.NEXT_PUBLIC_CHATBOT_SCRIPT_SRC;
    if (!scriptSrc || !chatbotToken || !slugName) return;

    document.getElementById(SCRIPT_ID)?.remove();

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = scriptSrc;
    script.setAttribute("embedToken", chatbotToken);
    script.setAttribute("hideIcon", "true");
    script.onload = () => {
      window.SendDataToChatbot?.({
        chatbotTitle: `${toTitleCase(slugName)} agent`,
        chatbotSubtitle: "",
        bridgeName: slugName,
        threadId: `mobile-${id}`,
        parentId: CONTAINER_ID,
        fullScreen: true,
        hideCloseButton: "true",
        variables: {},
        version_id: versionId || "null",
      });
      window.openChatbot?.();
    };
    document.head.appendChild(script);

    return () => {
      window.closeChatbot?.();
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, [chatbotToken, slugName, id, embedKey]);

  // The embed sets position: relative on its parent element, which would undo "fixed" on that same element,
  // so the fixed full-viewport layer is a separate wrapper and the embed gets the element inside it.
  // The embed also sizes its frame from the chatbot config (e.g. 80%), so the frame is pinned to 100%.
  return (
    <>
      <InstallButton />
      <style>{`#iframe-parent-container{height:100% !important;width:100% !important;max-height:none !important}`}</style>
      <div className="fixed inset-y-0 right-0 left-[56px] z-[9999] h-dvh bg-base-100">
        <div id={CONTAINER_ID} className="h-full w-full" />
      </div>
    </>
  );
};

export default Protected(Page);
