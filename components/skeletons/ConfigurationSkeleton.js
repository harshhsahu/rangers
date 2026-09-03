import React from "react";

/**
 * Loading state for the agent config screen. Mirrors what actually renders now:
 * a 50/50 split with the setup rows and usage tiles on the left, and the chat
 * pane (tab bar, message column, composer) on the right. The old version drew
 * the long-gone prompt/tools/knowledge-base stack, so the page visibly jumped
 * shape once data arrived.
 */
const Bar = ({ className = "" }) => <div className={`animate-pulse rounded bg-paper ${className}`} />;

const SetupRowSkeleton = () => (
  <div className="flex items-center gap-3 rounded-[13px] border border-line bg-card px-4 py-3">
    <div className="h-9 w-9 flex-none animate-pulse rounded-lg border border-line bg-paper" />
    <div className="min-w-0 flex-1 space-y-2">
      <Bar className="h-3 w-32" />
      <Bar className="h-2.5 w-52" />
    </div>
    <Bar className="h-4 w-12 flex-none" />
  </div>
);

const StatTileSkeleton = () => (
  <div className="rounded-[13px] border border-line bg-card px-3.5 py-3">
    <Bar className="h-5 w-20" />
    <Bar className="mt-2 h-2.5 w-12" />
  </div>
);

const ConfigurationSkeleton = () => {
  return (
    <div className="h-full w-full overflow-hidden bg-[#F4EFE7] text-base-content">
      <div className="flex h-full">
        {/* Left: agent setup */}
        <div className="flex w-1/2 min-w-0 flex-col gap-4 overflow-hidden px-8 pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <Bar className="h-4 w-28" />
            <Bar className="h-3 w-24" />
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-paper-sunken">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-paper" />
          </div>

          <div className="flex flex-col gap-2">
            <SetupRowSkeleton />
            <SetupRowSkeleton />
            <SetupRowSkeleton />
            <SetupRowSkeleton />
          </div>

          <div className="pt-3">
            <div className="flex items-baseline justify-between pb-2.5">
              <Bar className="h-3 w-24" />
              <Bar className="h-3 w-20" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <StatTileSkeleton />
              <StatTileSkeleton />
              <StatTileSkeleton />
            </div>
          </div>
        </div>

        {/* Right: the chat pane */}
        <div className="flex w-1/2 min-w-0 flex-col border-l border-line bg-card">
          <div className="flex flex-none items-center gap-2 border-b border-line px-[18px] py-[11px]">
            <div className="flex items-center gap-[3px] rounded-[10px] bg-paper-sunken p-[3px]">
              <Bar className="h-[26px] w-[104px] rounded-lg" />
              <Bar className="h-[26px] w-[112px] rounded-lg" />
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-end gap-[14px] p-[18px]">
            <div className="flex flex-col items-end">
              <Bar className="mb-1.5 h-2.5 w-16" />
              <Bar className="h-10 w-[45%] rounded-[14px]" />
            </div>
            <div className="flex flex-col items-start">
              <Bar className="mb-1.5 h-2.5 w-20" />
              <Bar className="h-16 w-[70%] rounded-[14px]" />
            </div>
            <div className="flex flex-col items-end">
              <Bar className="mb-1.5 h-2.5 w-16" />
              <Bar className="h-10 w-[38%] rounded-[14px]" />
            </div>
          </div>

          <div className="flex-none border-t border-line px-[18px] pb-4 pt-3">
            <div className="flex items-end gap-[9px]">
              <Bar className="h-[38px] w-[38px] flex-none rounded-[10px]" />
              <Bar className="h-[38px] flex-1 rounded-[10px]" />
              <Bar className="h-[38px] w-[38px] flex-none rounded-[10px]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationSkeleton;
