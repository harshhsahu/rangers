"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { Menu, Search } from "lucide-react";
import { getSingleBridgesAction } from "@/store/action/bridgeAction";
import Protected from "@/components/Protected";
import { LAST_CHATBOT_KEY } from "@/components/RegisterSW";
import InstallButton from "@/components/common/installButton";
import { getIconOfService } from "@/utils/utility";
import { readRangerMeta } from "@/components/rangers/rangerMeta";
import { CALLSIGN_BY_HEX } from "@/components/rangers/rangerConstants";
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

// The agent's accent colour at a given alpha, for the active row's border and glow.
const tint = (hex, alpha) => {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const agentName = (agent) => agent?.name || toTitleCase(agent?.slugName) || "Untitled agent";

const agentSubtitle = (agent) => {
  const { color, role } = readRangerMeta(agent);
  const callsign = CALLSIGN_BY_HEX[color] || "Ranger";
  return role ? `${callsign} · ${role.toLowerCase()}` : callsign;
};

// Service logo (OpenAI, Anthropic, ...) on a rounded tile, same as the agent cards.
const AgentAvatar = ({ agent, size = 36 }) => (
  <span
    className="grid shrink-0 place-items-center rounded-[10px] border border-base-300 bg-base-100 shadow-sm"
    style={{ width: size, height: size }}
  >
    {getIconOfService(agent?.service, Math.round(size * 0.55), Math.round(size * 0.55))}
  </span>
);

const AgentSidebar = ({ agents, activeId, onSelect, open, onClose }) => {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return agents;
    return agents.filter((agent) => agentName(agent).toLowerCase().includes(term));
  }, [agents, query]);

  return (
    <>
      {/* Phone: the list is a drawer over the chat; this backdrop closes it. */}
      <div
        className={`absolute inset-0 z-20 bg-black/40 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`absolute inset-y-0 left-0 z-30 flex h-full w-[280px] max-w-[85vw] shrink-0 flex-col border-r border-base-300 bg-base-200 transition-transform duration-200 md:static md:z-auto md:w-[260px] md:max-w-none md:translate-x-0 md:bg-base-200/60 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-1 flex h-14 shrink-0 items-center px-5 text-sm font-semibold">Rangers</div>
        <label className="mx-4 mb-3 flex h-9 items-center gap-2 rounded-lg border border-base-300 bg-base-100 px-3 focus-within:border-primary">
          <Search size={14} className="opacity-60" />
          <input
            type="text"
            className="min-w-0 grow !h-auto !border-0 !bg-transparent !p-0 !shadow-none !outline-none !ring-0 text-sm"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="px-5 pb-1 text-[10px] font-semibold uppercase tracking-wider opacity-50">Rangers</div>
        <ul className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {filtered.map((agent) => {
            const { color } = readRangerMeta(agent);
            const active = agent._id === activeId;
            return (
              <li key={agent._id}>
                <button
                  type="button"
                  onClick={() => onSelect(agent)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-2 py-2 text-left transition-all ${
                    active ? "bg-card" : "border-transparent hover:bg-base-300/60"
                  }`}
                  style={
                    active
                      ? { borderColor: tint(color, 0.55), boxShadow: `0 6px 14px -10px ${tint(color, 0.55)}` }
                      : undefined
                  }
                >
                  <AgentAvatar agent={agent} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{agentName(agent)}</span>
                    <span
                      className="mt-0.5 block truncate font-mono text-[9.5px] font-semibold uppercase tracking-[.16em]"
                      style={{ color }}
                    >
                      {agentSubtitle(agent)}
                    </span>
                  </span>
                  {agent.bridge_status === 0 && <span className="text-[10px] opacity-50">Paused</span>}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-xs opacity-60">No agents found</li>}
        </ul>
      </aside>
    </>
  );
};

const Page = ({ params, searchParams }) => {
  const { agentId: id } = use(params);
  const versionId = searchParams?.versionId;
  const router = useRouter();
  const dispatch = useDispatch();
  // allBridgesMap is only filled by the agent config pages, so on a direct launch (e.g. the installed app) it is
  // empty. The agents list the layout loads carries slugName too, so fall back to it and fetch the agent itself.
  const { historyToken, agents, activeAgent, hasBridge } = useCustomSelector((state) => {
    const list = state?.bridgeReducer?.org?.[ORG_ID]?.orgs;
    return {
      historyToken: state?.bridgeReducer?.org?.[ORG_ID]?.history_page_chatbot_token,
      agents: list,
      activeAgent: state?.bridgeReducer?.allBridgesMap?.[id] || list?.find((agent) => agent?._id === id),
      hasBridge: Boolean(state?.bridgeReducer?.allBridgesMap?.[id]),
    };
  });
  const slugName = activeAgent?.slugName;
  const chatVersionId = versionId || activeAgent?.published_version_id;
  const selectableAgents = useMemo(() => (agents || []).filter((agent) => agent?.slugName), [agents]);

  useEffect(() => {
    if (!hasBridge) dispatch(getSingleBridgesAction({ id, version: chatVersionId })).catch(() => {});
  }, [id]);

  const chatbotToken = historyToken;
  // Bumped when the installed app comes back from the background (or from the back/forward cache) with the
  // chat frame gone, so the embed below is mounted again instead of leaving a blank page.
  const [embedKey, setEmbedKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Installed app: the app's own navbar rail is hidden so the chat gets the whole window.
  const [isInstalledApp, setIsInstalledApp] = useState(false);
  useEffect(() => {
    setIsInstalledApp(window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true);
  }, []);
  const path = `/agents/agent-chatbot/${id}${versionId ? `?versionId=${versionId}` : ""}`;

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

  // Same embed script and token the history page uses. Re-run for every agent switch so the frame is rebuilt
  // with that agent's slug and its own thread.
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
        version_id: chatVersionId || "null",
      });
      window.openChatbot?.();
    };
    document.head.appendChild(script);

    return () => {
      window.closeChatbot?.();
      document.getElementById(SCRIPT_ID)?.remove();
    };
  }, [chatbotToken, slugName, id, chatVersionId, embedKey]);

  const selectAgent = (agent) => {
    setSidebarOpen(false);
    if (agent._id === id) return;
    const version = agent.published_version_id;
    router.replace(`/agents/agent-chatbot/${agent._id}${version ? `?versionId=${version}` : ""}`);
  };

  // The embed sets position: relative on its parent element, which would undo "fixed" on that same element,
  // so the fixed full-viewport layer is a separate wrapper and the embed gets the element inside it.
  // The embed also sizes its frame from the chatbot config (e.g. 80%), so the frame is pinned to 100%.
  return (
    <>
      <InstallButton />
      <style>{`#iframe-parent-container{height:100% !important;width:100% !important;max-height:none !important}
        @media (max-width: 767px){#main-slider-mobile-menu-toggle{display:none !important}}
        ${isInstalledApp ? "#main-slider-mobile-menu-toggle{display:none !important}" : ""}`}</style>
      <div
        className={`fixed inset-y-0 right-0 z-[9999] flex h-dvh bg-base-100 ${isInstalledApp ? "left-0" : "left-0 md:left-[51px]"}`}
      >
        <AgentSidebar
          agents={selectableAgents}
          activeId={id}
          onSelect={selectAgent}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-base-300 px-4">
            <button
              type="button"
              aria-label="Show agents"
              className="btn btn-ghost btn-sm btn-square -ml-2 md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={18} />
            </button>
            {activeAgent && <AgentAvatar agent={activeAgent} size={36} />}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {activeAgent ? agentName(activeAgent) : "Loading..."}
              </div>
              {activeAgent && (
                <div
                  className="truncate font-mono text-[9.5px] font-semibold uppercase tracking-[.16em]"
                  style={{ color: readRangerMeta(activeAgent).color }}
                >
                  {agentSubtitle(activeAgent)}
                </div>
              )}
            </div>
          </header>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div id={CONTAINER_ID} className="h-full w-full" />
          </div>
        </main>
      </div>
    </>
  );
};

export default Protected(Page);
