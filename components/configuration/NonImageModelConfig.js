"use client";

import React, { memo } from "react";
import RangerSetupSections from "./sections/RangerSetupSections";
import RangerUsageStats from "./sections/RangerUsageStats";

/**
 * Agent setup. Every agent uses this single-page list of sections, whose options
 * open in modals. The heading and setup progress live in RangerSetupSections so
 * they stay next to the rows they count.
 *
 * This previously forked on `isRanger` (i.e. whether the agent document had a
 * `meta.ranger` key): rangers got this UI, and every agent created before the
 * ranger flow fell back to a four-tab layout. That meant two different UIs for
 * the same screen depending on when the agent happened to be created, so the
 * tabbed layout is gone and the sections are the only UI.
 */
const NonImageModelConfig = memo(() => {
  return (
    <div data-testid="ranger-single-page-config" className="space-y-4 pt-5 pb-8">
      <RangerSetupSections />
      <RangerUsageStats />
    </div>
  );
});

NonImageModelConfig.displayName = "NonImageModelConfig";

export default NonImageModelConfig;
