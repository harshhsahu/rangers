"use client";

import React from "react";
import { RotateCcw } from "lucide-react";

/**
 * The right-hand pane of the ranger config screen: one chat for both jobs.
 *
 * It used to be two tabs — "Test the ranger" and "Update the ranger". A typed message is now checked
 * and routed to whichever it is (see handleSendMessage in ChatTextInput), and both write into the same
 * thread, so this is only the frame: a hairline bar with the thread reset, and the chat below it.
 *
 * "New thread" lives up here, outside the chat, so it asks over an event, as it did on the tab bar.
 */
const RangerChatWindow = ({ children, idPrefix = "chat-panel" }) => {
  return (
    <div id={`${idPrefix}-window`} data-testid="chat-panel-window" className="flex h-full min-h-0 flex-col">
      <div className="flex flex-none items-center gap-2 border-b border-line bg-card px-[18px] py-[11px]">
        <span className="text-[12.5px] font-semibold text-base-content">Chat</span>
        <span className="flex-1" />
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
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
};

export default RangerChatWindow;
