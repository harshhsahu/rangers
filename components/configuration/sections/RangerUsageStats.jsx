"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getMetricsDataApi } from "@/config/index";
import { useConfigurationContext } from "../ConfigurationContext";

/** `range: 5` is the API's "last 1 day" bucket; `factor` is required by it. */
const LAST_24_HOURS = 5;

const formatTokens = (value) => (value > 0 ? Math.round(value).toLocaleString() : "0");
const formatCost = (value) => `$${(value || 0).toFixed(4)}`;
const formatLatency = (value) => (value > 0 ? `${value.toFixed(1)}s` : "—");

const StatCard = ({ label, value, testId }) => (
  <div data-testid={testId} className="rounded-[13px] border border-line bg-card px-3.5 py-3">
    <div className="font-mono text-[19px] font-bold leading-tight text-base-content">{value}</div>
    <div className="pt-0.5 text-[11px] text-soft">{label}</div>
  </div>
);

/**
 * Last-24-hours usage for the agent being configured, sitting under the setup
 * rows. Failures are silent: this is a glance, never a blocker, so an empty or
 * erroring metrics call just leaves zeroes rather than an error state.
 */
const RangerUsageStats = () => {
  const { params, searchParams } = useConfigurationContext();
  const [rows, setRows] = useState([]);

  const bridgeId = params?.id;
  const orgId = params?.org_id;
  const versionId = searchParams?.version;

  useEffect(() => {
    if (!bridgeId) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const data = await getMetricsDataApi({
          bridge_id: bridgeId,
          range: LAST_24_HOURS,
          factor: "bridge_id",
        });
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Loading agent usage metrics failed", error);
        if (!cancelled) setRows([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bridgeId, versionId]);

  const { tokens, cost, latency } = useMemo(() => {
    let tokenTotal = 0;
    let costTotal = 0;
    let latencySum = 0;
    let latencyRows = 0;

    rows.forEach((row) => {
      tokenTotal += Number(row?.total_token_count) || 0;
      costTotal += Number(row?.cost_sum) || 0;
      // Already an average per bucket, so the mean across buckets is the figure.
      const rowLatency = Number(row?.latency_sum) || 0;
      if (rowLatency > 0) {
        latencySum += rowLatency;
        latencyRows += 1;
      }
    });

    return {
      tokens: tokenTotal,
      cost: costTotal,
      latency: latencyRows ? latencySum / latencyRows : 0,
    };
  }, [rows]);

  return (
    <section data-testid="ranger-usage-stats" className="pt-[22px]">
      <div className="flex items-baseline justify-between pb-2.5">
        <h3 className="text-[13px] font-semibold text-base-content">Last 24 hours</h3>
        {orgId && bridgeId && (
          <Link
            // Carry the version through, so analytics opens on the one being configured.
            href={`/agents/analytics/${bridgeId}${versionId ? `?version=${versionId}` : ""}`}
            data-testid="ranger-usage-open-analytics"
            className="text-[12px] font-semibold text-acc hover:opacity-80"
          >
            Open analytics
          </Link>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <StatCard label="Tokens" value={formatTokens(tokens)} testId="ranger-usage-tokens" />
        <StatCard label="Cost" value={formatCost(cost)} testId="ranger-usage-cost" />
        <StatCard label="Avg response" value={formatLatency(latency)} testId="ranger-usage-latency" />
      </div>
    </section>
  );
};

export default RangerUsageStats;
