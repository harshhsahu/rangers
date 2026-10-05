"use client";

import { use, useEffect } from "react";
import Protected from "@/components/Protected";
import { LAST_CHATBOT_KEY } from "@/components/RegisterSW";
import InstallButton from "@/components/common/installButton";
import { useCustomSelector } from "@/customHooks/customSelector";
import { ORG_ID } from "@/utils/enums";

export const runtime = "edge";

const SCRIPT_ID = "chatbot-main-script";
const CONTAINER_ID = "chatbot-container";

const Page = ({ params }) => {
  const { id } = use(params);

  const { chatbotToken, slugName } = useCustomSelector((state) => ({
    chatbotToken: state?.bridgeReducer?.org?.[ORG_ID]?.history_page_chatbot_token,
    slugName: state?.bridgeReducer?.allBridgesMap?.[id]?.slugName,
  }));

  // Remembered so the installed app, which launches at "/", can reopen this chat.
  useEffect(() => {
    try {
      localStorage.setItem(LAST_CHATBOT_KEY, `/agents/chatbot/${id}`);
    } catch {}
  }, [id]);


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
        bridgeName: slugName,
        threadId: `mobile-${id}`,
        parentId: CONTAINER_ID,
        fullScreen: true,
        hideCloseButton: "true",
        variables: {},
      });
      window.openChatbot?.();
    };
    document.head.appendChild(script);

    return () => {
      window.closeChatbot?.();
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, [chatbotToken, slugName, id]);

  
  // The embed sets position: relative on its parent element, which would undo "fixed" on that same element,
  // so the fixed full-viewport layer is a separate wrapper and the embed gets the element inside it.
  // The embed also sizes its frame from the chatbot config (e.g. 80%), so the frame is pinned to 100%.
  return (
    <>
      <InstallButton />
      <style>{`#iframe-parent-container{height:100% !important;width:100% !important;max-height:none !important}`}</style>
      <div className="fixed inset-0 z-[9999] h-dvh w-screen bg-base-100">
        <div id={CONTAINER_ID} className="h-full w-full" />
      </div>
    </>
  );
};

export default Protected(Page);
