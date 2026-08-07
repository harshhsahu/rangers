/** Trace accent colors — tailwind.config.js oklch tokens: trace-gold, trace-blue, trace-green */

/** Dark border on light theme, light border on dark theme (follows base-content) */
export const TRACE_ROW_BORDER = "border border-base-content/8 dark:border-base-content/15";

export const AGENT_HUES = ["trace-blue", "trace-green", "trace-gold"];

export const HUE_THEME = {
  "trace-blue": {
    shell: `rounded-[11px] ${TRACE_ROW_BORDER} bg-trace-blue/[0.02]`,
    shellOpen: "",
    rail: "border-trace-blue/15",
    head: "bg-trace-blue/[0.03] hover:bg-trace-blue/[0.06]",
    headOpen: `bg-trace-blue/[0.04] rounded-t-[10px]`,
    avatar: "bg-trace-blue/12 text-trace-blue border border-trace-blue/20",
    roleTag: "bg-trace-blue/10 text-trace-blue border-trace-blue/15",
  },
  "trace-green": {
    shell: `rounded-[11px] ${TRACE_ROW_BORDER} bg-trace-green/[0.02]`,
    shellOpen: "",
    rail: "border-trace-green/15",
    head: "bg-trace-green/[0.03] hover:bg-trace-green/[0.06]",
    headOpen: `bg-trace-green/[0.04] rounded-t-[10px]`,
    avatar: "bg-trace-green/12 text-trace-green border border-trace-green/20",
    roleTag: "bg-trace-green/10 text-trace-green border-trace-green/15",
  },
  "trace-gold": {
    shell: `rounded-[11px] ${TRACE_ROW_BORDER} bg-trace-gold/[0.02]`,
    shellOpen: "",
    rail: "border-trace-gold/15",
    head: "bg-trace-gold/[0.03] hover:bg-trace-gold/[0.06]",
    headOpen: `bg-trace-gold/[0.04] rounded-t-[10px]`,
    avatar: "bg-trace-gold/12 text-trace-gold border border-trace-gold/20",
    roleTag: "bg-trace-gold/10 text-trace-gold border-trace-gold/15",
  },
};

export const NEUTRAL_RAIL = "border-base-300/35";

export const NEUTRAL_HEAD = "bg-gradient-to-r from-base-200/70 via-base-200/30 to-transparent hover:from-base-200/90";

export const NEUTRAL_HEAD_OPEN = `rounded-lg ${TRACE_ROW_BORDER} bg-gradient-to-r from-base-200/80 via-base-200/40 to-transparent`;

/** Stable fallback when registry has no hue (legacy data) */
export function resolveAgentHue(agentMeta, agentKey, stepHue) {
  if (stepHue && HUE_THEME[stepHue]) return stepHue;
  if (agentMeta?.role === "Orchestrator") return "trace-gold";
  if (agentMeta?.hue && HUE_THEME[agentMeta.hue]) return agentMeta.hue;
  let h = 0;
  for (let i = 0; i < String(agentKey || "").length; i++) h += agentKey.charCodeAt(i);
  return AGENT_HUES[h % AGENT_HUES.length];
}

export function agentInitials(name, glyph) {
  if (glyph) return glyph;
  return String(name || "A")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
