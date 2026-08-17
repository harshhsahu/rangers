import { RANGER_COLORS, DEFAULT_RANGER_COLOR } from "./rangerConstants";

/**
 * Ranger-specific presentation data (colour, role title, description) rides
 * along on the agent's `meta` field, namespaced under `meta.ranger` so it
 * coexists with the embed host's own meta keys.
 *
 * `name` is the real agent name, not meta. The description deliberately does
 * NOT reuse `bridge_summary` (publish regenerates it when generate_summary is
 * true) or `agent_info.description` (that is the sub-agent tool description).
 */

/** Stable colour for agents created before this feature existed. */
const colorFromId = (id) => {
  const key = String(id || "");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 100000;
  }
  return RANGER_COLORS[hash % RANGER_COLORS.length].hex;
};

export const readRangerMeta = (bridge) => {
  const stored = bridge?.meta?.ranger || {};
  return {
    color: stored.color || colorFromId(bridge?._id),
    role: stored.role || "",
    description: stored.description || "",
    // true when the agent predates the wizard, so cards can fall back gracefully
    isDerived: !stored.color,
  };
};

export const buildRangerMeta = ({ color, role, description }) => ({
  color: color || DEFAULT_RANGER_COLOR,
  role: (role || "").trim(),
  description: (description || "").trim(),
});

/** Merges ranger data into an existing meta object without dropping other keys. */
export const mergeRangerMeta = (existingMeta, ranger) => ({
  ...(existingMeta || {}),
  ranger: buildRangerMeta(ranger),
});

/** Contrast helper so text sitting on a swatch stays readable. */
export const readableInk = (hex) => {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return "#ffffff";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  // Perceived luminance (ITU-R BT.601)
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance > 160 ? "#14110D" : "#ffffff";
};
