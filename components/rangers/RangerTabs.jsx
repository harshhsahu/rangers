"use client";

import React from "react";

export const RANGER_TAB_KEYS = { COMMAND: "command", SQUAD: "squad" };

const TABS = [
  { key: RANGER_TAB_KEYS.COMMAND, label: "Command Center" },
  { key: RANGER_TAB_KEYS.SQUAD, label: "Ranger Squad" },
];

/**
 * Two-tab strip for the Rangers page.
 *
 * Deliberately not built on components/configuration/sections/TabsLayout.js —
 * that one hardcodes the prompt unsaved-changes guard and configure-page
 * margins, neither of which apply here.
 */
const RangerTabs = ({ activeTab, onChange }) => (
  <div
    role="tablist"
    aria-label="Rangers views"
    className="inline-flex items-center gap-1 rounded-full border-2 border-stroke bg-card p-1"
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
          className={`rounded-full px-4 py-[6px] text-[13px] font-bold transition-colors ${
            isActive ? "bg-acc text-acc-ink" : "text-soft hover:text-ink"
          }`}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
);

export default RangerTabs;
