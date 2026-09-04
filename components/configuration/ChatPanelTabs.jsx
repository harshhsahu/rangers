"use client";

import React, { useState } from "react";
import { RotateCcw } from "lucide-react";

/**
 * The right-hand pane of the ranger config screen. It used to open with the
 * agent setup guide sitting on top of the playground; the setup checklist now
 * lives at the top of the left pane, so this pane is purely the two chats:
 *
 *   - Test the ranger — the playground, run against the unsaved prompt.
 *   - Update the ranger — the chat that edits this ranger's prompt, model and channels.
 *
 * Both stay mounted and the inactive one is hidden, so switching tabs does not
 * throw away a conversation.
 */
const TABS = [
  { key: "test", label: "Test the ranger" },
  { key: "helper", label: "Update the ranger" },
];

const ChatPanelTabs = ({ testPanel, helperPanel, idPrefix = "chat-panel" }) => {
  const [activeTab, setActiveTab] = useState("test");

  return (
    <div id={`${idPrefix}-tabs`} data-testid="chat-panel-tabs" className="flex h-full min-h-0 flex-col">
      {/* Hairline bar and recessed track, matching the design canvas — the pane
          below is one continuous surface, so a 2px ink rule would cut it in half. */}
      <div className="flex flex-none items-center gap-2 border-b border-line bg-card px-[18px] py-[11px]">
        <div className="inline-flex flex-none items-center gap-[3px] rounded-[10px] bg-paper-sunken p-[3px]">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
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
              </button>
            );
          })}
        </div>

        <span className="flex-1" />

        {/* Each pane's reset lives up here rather than in a second bar of its own; the
            panes listen for their own event because they are siblings, not children. */}
        {(activeTab === "test" || activeTab === "helper") && (
          <button
            type="button"
            data-testid={activeTab === "test" ? "chat-panel-new-thread" : "chat-panel-new-update-thread"}
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent(activeTab === "test" ? "gtwy:new-thread" : "gtwy:new-ranger-update-thread")
              )
            }
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
        {helperPanel}
      </div>
    </div>
  );
};

export default ChatPanelTabs;
