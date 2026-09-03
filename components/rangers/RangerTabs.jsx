"use client";

import React from "react";

export const RANGER_TAB_KEYS = { COMMAND: "command", SQUAD: "squad" };

const TABS = [
  { key: RANGER_TAB_KEYS.COMMAND, label: "Command Center" },
  { key: RANGER_TAB_KEYS.SQUAD, label: "Ranger Squad" },
];

/**
 * Two-tab segmented control for the Rangers page.
 *
 * Deliberately not built on components/configuration/sections/TabsLayout.js —
 * that one hardcodes the prompt unsaved-changes guard and configure-page
 * margins, neither of which apply here.
 */
const RangerTabs = ({ activeTab, onChange }) => (
  <div
    role="tablist"
    aria-label="Rangers views"
    className="inline-flex flex-none items-center gap-[3px] rounded-[10px] bg-paper-sunken p-[3px]"
  >
    {TABS.map((tab) => {
      const isActive = activeTab === tab.key;
      return (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={isActive}
          data-testid={`ranger-tab-${tab.key}`}
          id={`ranger-tab-${tab.key}`}
          onClick={() => onChange(tab.key)}
          className={`whitespace-nowrap rounded-[8px] px-[13px] py-[6px] text-[13px] font-semibold transition-colors ${
            isActive ? "bg-card text-ink shadow-[0_1px_1px_var(--shadow-tint)]" : "text-soft hover:text-ink"
          }`}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);

export default RangerTabs;
