import crypto from "crypto";
import { NextResponse } from "next/server";
import { getViaSocketAppToolsCollection } from "@/lib/mongo";
import { describeViaSocketField, fetchViaSocketFieldOptions, prepareViaSocketInput } from "@/lib/viasocket";

export const runtime = "nodejs";

const MAX_OPTIONS = 100;

function sameKey(sent, stored) {
  const a = Buffer.from(String(sent || ""));
  const b = Buffer.from(String(stored || ""));
  return a.length === b.length && a.length > 0 && crypto.timingSafeEqual(a, b);
}

function parseBody(value) {
  if (typeof value !== "string") return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** viaSocket reports an action's own errors with HTTP 200 and a `status` of 400+ in the body. */
function actionFailure(res, json) {
  const bodyStatus = Number(json?.status ?? json?.data?.status);
  const message = json?.message || json?.error || json?.data?.message || json?.originalError?.message;
  if (json?.message === "No response" || json?.data?.message === "No response") return "viaSocket returned no response";
  if (res.ok && json?.success === true) return null;
  if (!res.ok || json?.success === false || bodyStatus >= 400 || json?.originalError) {
    return String(typeof message === "string" ? message : `HTTP ${res.status}`).slice(0, 1000);
  }
  return null;
}

// Failures answer 200 so GTWY hands the reason to the model, which can fix its inputs and retry.
const fail = (error, extra = {}) => NextResponse.json({ success: false, error, ...extra });

const getPath = (obj, key) => key.split(".").reduce((node, part) => (node == null ? undefined : node[part]), obj);
const setPath = (obj, key, value) => {
  const parts = key.split(".");
  let node = obj;
  parts.slice(0, -1).forEach((part) => {
    if (!node[part] || typeof node[part] !== "object") node[part] = {};
    node = node[part];
  });
  node[parts[parts.length - 1]] = value;
};
const missingValue = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (Array.isArray(value) && !value.length) ||
  (typeof value === "object" && !Array.isArray(value) && !Object.keys(value).length);

function resolveOptionValue(value, options) {
  const exactValue = options.find((option) => String(option.value) === String(value));
  if (exactValue) return { value: exactValue.value };
  const labels = options.filter((option) => String(option.label).toLowerCase() === String(value).toLowerCase());
  if (labels.length === 1) return { value: labels[0].value };
  if (labels.length > 1) return { error: `"${value}" matches more than one option` };
  return { value };
}

/**
 * Let a model send exact display labels in a write call. Resolve them to opaque viaSocket values
 * server-side, in field order, so discovery does not consume all of GTWY's tool-call rounds.
 */
async function resolveAccountValues(row, action, input) {
  if (!row.embed_token) return { input };

  // A keyed object already states which multiselect values it needs (for example column_name keys).
  for (const field of action.fields) {
    if (!field.key_source || !missingValue(getPath(input, field.key_source))) continue;
    const object = getPath(input, field.key);
    if (object && typeof object === "object" && !Array.isArray(object)) {
      setPath(input, field.key_source, Object.keys(object));
    }
  }

  for (const field of action.fields) {
    if (!field.picked) continue;
    let value = getPath(input, field.key);
    const dependenciesReady = (field.depends_on || []).every((dep) => !missingValue(getPath(input, dep)));
    if (!dependenciesReady) continue;

    const existingFields = { ...input };
    if (field.searchable && typeof value === "string") existingFields._searchText = value;
    const result = await fetchViaSocketFieldOptions({
      embedToken: row.embed_token,
      actionVersionId: action.action_version_id,
      fieldKey: field.key,
      authId: row.auth_id,
      existingFields,
    });
    if (result.error) return { error: `${field.key}: ${result.error}` };

    if (missingValue(value)) {
      if (field.required && result.options.length === 1) setPath(input, field.key, result.options[0].value);
      continue;
    }

    const values = Array.isArray(value) ? value : [value];
    const resolved = values.map((item) => resolveOptionValue(item, result.options));
    const problem = resolved.find((item) => item.error);
    if (problem) return { error: `${field.key}: ${problem.error}` };
    value = resolved.map((item) => item.value);
    setPath(input, field.key, Array.isArray(getPath(input, field.key)) ? value : value[0]);
  }

  delete input._searchText;
  return { input };
}

async function listOptions(row, action, fieldKey, existingFields) {
  const field = action.fields.find((item) => item.key === fieldKey);
  if (!field) {
    return fail(
      `"${fieldKey}" is not an input of ${action.name}. Inputs: ${action.fields.map((item) => item.key).join(", ")}`
    );
  }
  if (!row.embed_token) {
    return fail(`Options cannot be listed for this ${row.service_name} tool yet; remove the app and add it again.`);
  }
  if (field.options?.length) {
    return NextResponse.json({
      success: true,
      options_for_action_version_id: action.action_version_id,
      field: fieldKey,
      options: field.options.map((value) => ({ label: String(value), value })),
      usage: "Send the chosen value exactly.",
    });
  }
  const missingDeps = (field.depends_on || []).filter((dep) => {
    const value = dep.split(".").reduce((node, part) => (node == null ? undefined : node[part]), existingFields);
    return value === undefined || value === null || value === "";
  });
  if (missingDeps.length) {
    return fail(
      `List options for ${missingDeps.join(", ")} first and send ${missingDeps.length > 1 ? "them" : "it"} in body.`
    );
  }
  const { options, error } = await fetchViaSocketFieldOptions({
    embedToken: row.embed_token,
    actionVersionId: action.action_version_id,
    fieldKey,
    authId: row.auth_id,
    existingFields,
  });
  if (error) {
    console.error("[viasocket] app tool options failed", { id: row._id, action: action.name, field: fieldKey, error });
    return fail(error, { field: fieldKey });
  }
  return NextResponse.json({
    success: true,
    options_for_action_version_id: action.action_version_id,
    field: fieldKey,
    options: options.slice(0, MAX_OPTIONS),
    ...(options.length > MAX_OPTIONS
      ? { note: `First ${MAX_OPTIONS} of ${options.length}; send body._searchText to narrow.` }
      : {}),
    usage: field.keys_from_options
      ? "Use each value verbatim as a key of this object input."
      : "Send the chosen value exactly.",
  });
}

/**
 * POST /api/viasocket/app-tools/:id/run
 * GTWY calls this with the model's `{ action_version_id, body, options_for? }`. The row holds the
 * app's script_id; viaSocket runs the chosen action with `body` as its inputData, or lists one
 * input's options when `options_for` is set.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const tools = await getViaSocketAppToolsCollection();
    const row = await tools.findOne({ _id: String(id) });
    if (!row || !sameKey(request.headers.get("x-viasocket-tool-key"), row.run_key)) {
      return NextResponse.json({ success: false, error: "Tool not found" }, { status: 404 });
    }

    const args = await request.json().catch(() => ({}));
    const optionsFor = String(args?.options_for || "").trim();
    let actionVersionId = String(args?.action_version_id || "");
    let action = (row.actions || []).find((item) => item.action_version_id === actionVersionId);
    // Models occasionally assume options_for is app-wide and omit the action id. Recover using an
    // action that owns the requested field, preferring a write action so its dependencies match.
    if (!action && !actionVersionId && optionsFor) {
      const candidates = (row.actions || []).filter((item) => item.fields?.some((field) => field.key === optionsFor));
      action =
        candidates.find((item) => /^(add|create|send|post)\b/i.test(item.name || "")) ||
        candidates.find((item) => /^(update|delete|remove)\b/i.test(item.name || "")) ||
        candidates[0];
      actionVersionId = action?.action_version_id || "";
    }
    if (!action) {
      return fail(
        `Unknown action_version_id "${actionVersionId}". Use one of: ${(row.actions || [])
          .map((item) => `${item.action_version_id} (${item.name})`)
          .join(", ")}`
      );
    }

    let { input } = prepareViaSocketInput(action.fields, parseBody(args?.body));
    if (optionsFor) return listOptions(row, action, optionsFor, input);

    const resolved = await resolveAccountValues(row, action, input);
    if (resolved.error) return fail(resolved.error, { action: action.name });
    ({ input } = resolved);
    const prepared = prepareViaSocketInput(action.fields, input);
    input = prepared.input;
    const { missing } = prepared;

    if (missing.length) {
      console.error("[viasocket] app tool inputs missing", {
        id,
        action: action.name,
        missing: missing.map((f) => f.key),
      });
      return fail(`${action.name} needs these inputs in body: ${missing.map(describeViaSocketField).join("; ")}`);
    }

    const res = await fetch(`https://flow.sokt.io/func/${encodeURIComponent(row.script_id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_version_id: actionVersionId, inputData: input }),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    const failure = actionFailure(res, json);
    if (failure) {
      console.error("[viasocket] app tool run failed", { id, action: action.name, status: res.status, error: failure });
      return fail(failure, { action: action.name, sent: input });
    }
    return NextResponse.json(json?.success === undefined ? { success: true, data: json } : json);
  } catch (error) {
    console.error("[viasocket] app tool run failed", error?.message || error);
    return NextResponse.json({ success: false, error: "Run failed" }, { status: 500 });
  }
}
