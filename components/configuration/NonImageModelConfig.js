"use client";

import React, { memo } from "react";
import RangerSetupSections from "./sections/RangerSetupSections";

/**
 * Agent setup. Every agent uses this single-page list of sections, whose options
 * open in modals.
 *
 * This previously forked on `isRanger` (i.e. whether the agent document had a
 * `meta.ranger` key): rangers got this UI, and every agent created before the
 * ranger flow fell back to a four-tab layout. That meant two different UIs for
 * the same screen depending on when the agent happened to be created, so the
 * tabbed layout is gone and the sections are the only UI.
 */
const NonImageModelConfig = memo(() => {
  return (
    <div data-testid="ranger-single-page-config" className="space-y-4 pb-8">
      <div className="sticky top-0 z-10 -mx-4 border-b-2 border-stroke bg-base-200/95 px-4 py-3 backdrop-blur">
        <h2 className="text-base font-semibold text-base-content">Agent setup</h2>
        <p className="mt-0.5 text-xs text-soft">Open a section to edit its options.</p>
      </div>

      <RangerSetupSections />
    </div>
  );
});

NonImageModelConfig.displayName = "NonImageModelConfig";

export default NonImageModelConfig;
