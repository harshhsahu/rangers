"use client";

import React, { useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";

/**
 * The right-hand pane of the ranger config screen. It used to open with the
 * agent setup guide sitting on top of the playground; the setup checklist now
 * lives at the top of the left pane, so this pane is purely the two chats:
 *
 *   - Test the ranger — the playground, run against the unsaved prompt.
 *   - Update the ranger — the prompt helper, which rewrites the prompt.
 *
 * Both stay mounted and the inactive one is hidden, so switching tabs does not
 * throw away a conversation.
 */
const TABS = [
  { key: "test", label: "Test the ranger" },
  { key: "helper", label: "Update the ranger" },
];

/**
 * Placeholder for the helper tab while it is being built. It keeps the pane's
 * shape — same empty state, same composer — so the tab reads as unfinished
 * rather than broken, with every control inert.
 */
const ComingSoonPane = ({ idPrefix }) => (
  <div
    id={`${idPrefix}-coming-soon`}
    data-testid="chat-panel-coming-soon"
    className="rg-chat-pane flex min-h-0 flex-1 flex-col"
  >
    <div className="rg-chat-scroll flex min-h-0 flex-1 flex-col items-center justify-center gap-3.5 text-center">
      <span className="rg-chat-card-avatar">
        <Sparkles size={15} />
      </span>
      <div>
        <p className="text-[14.5px] font-semibold text-base-content">Coming soon</p>
        <p className="pt-1 text-[12.5px] text-soft">
          Updating the ranger from chat is on the way. Edit it from the sections on the left for now.
        </p>
      </div>
    </div>

    {/* Inert composer: shown so the pane keeps its shape, never focusable. */}
    <div className="rg-chat-composer opacity-60">
      <div className="flex items-end gap-[9px]">
        <textarea
          className="rg-chat-input cursor-not-allowed"
          rows={1}
          disabled
          readOnly
          tabIndex={-1}
          aria-disabled="true"
          placeholder="Coming soon"
          data-testid="chat-panel-coming-soon-input"
        />
        <button type="button" className="rg-chat-send cursor-not-allowed" disabled tabIndex={-1} aria-hidden="true">
          <Sparkles size={15} />
        </button>
      </div>
    </div>
  </div>
);

const ChatPanelTabs = ({ testPanel, helperPanel, idPrefix = "chat-panel", helperComingSoon = false }) => {
  const [activeTab, setActiveTab] = useState("test");

  return (
    <div id={`${idPrefix}-tabs`} data-testid="chat-panel-tabs" className="flex h-full min-h-0 flex-col">
      {/* Hairline bar and recessed track, matching the design canvas — the pane
          below is one continuous surface, so a 2px ink rule would cut it in half. */}
      <div className="flex flex-none items-center gap-2 border-b border-line bg-card px-[18px] py-[11px]">
        <div className="inline-flex flex-none items-center gap-[3px] rounded-[10px] bg-paper-sunken p-[3px]">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const isSoon = tab.key === "helper" && helperComingSoon;
            return (
              <button
                key={tab.key}
                type="button"
                data-testid={`chat-panel-tab-${tab.key}`}
                aria-pressed={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 rounded-lg px-[13px] py-[6px] text-[12.5px] font-semibold transition-colors duration-200 ${
                  isActive ? "bg-card text-base-content shadow-sm" : "text-soft hover:text-base-content"
                }`}
              >
                {tab.label}
                {isSoon && (
                  <span className="rounded bg-acc-soft px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-acc-deep">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <span className="flex-1" />

        {/* The playground's reset lives up here rather than in a second bar of
            its own; Chat listens for the event because it is a sibling. */}
        {activeTab === "test" && (
          <button
            type="button"
            data-testid="chat-panel-new-thread"
            onClick={() => window.dispatchEvent(new CustomEvent("gtwy:new-thread"))}
            title="Start a new thread"
            className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-soft transition-colors hover:text-base-content"
          >
            <RotateCcw size={13} className="opacity-60" />
            New thread
          </button>
        )}
      </div>

      <div data-testid="chat-panel-test" className={activeTab === "test" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
        {testPanel}
      </div>
      <div
        data-testid="chat-panel-helper"
        className={activeTab === "helper" ? "flex min-h-0 flex-1 flex-col" : "hidden"}
      >
        {helperComingSoon ? <ComingSoonPane idPrefix={idPrefix} /> : helperPanel}
      </div>
    </div>
  );
};

export default ChatPanelTabs;
