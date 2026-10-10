import { NextResponse } from "next/server";
import { getViaSocketToolsCollection } from "@/lib/mongo";
import { nestDottedInput } from "@/lib/viasocket";

export const runtime = "nodejs";

/**
 * POST /api/viasocket/run/:id
 * Fallback for tools whose URL is this proxy. GTWY axios-work POSTs model args;
 * we forward { action_version_id, inputData } to the stored script.
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const tools = await getViaSocketToolsCollection();
    const row = await tools.findOne({ _id: id });
    if (!row?.script_id || !row?.action_version_id) {
      return NextResponse.json({ success: false, error: "Tool not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const rawInput =
      body?.inputData && typeof body.inputData === "object" && !Array.isArray(body.inputData)
        ? body.inputData
        : body && typeof body === "object"
          ? (() => {
              const { action_version_id: _ignored, inputData: _nested, ...rest } = body;
              return rest;
            })()
          : {};

    const payload = {
      action_version_id: String(body?.action_version_id || row.action_version_id),
      inputData: nestDottedInput(rawInput),
    };

    const res = await fetch(`https://flow.sokt.io/func/${encodeURIComponent(row.script_id)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    const empty = json?.message === "No response" || json?.data?.message === "No response";
    if (!res.ok || empty) {
      console.error("[viasocket] run upstream failed", { id, status: res.status, empty });
      return NextResponse.json(
        { success: false, error: json?.message || json?.error || "viaSocket run failed", data: json },
        { status: empty ? 502 : res.status }
      );
    }
    return NextResponse.json(json?.success === undefined ? { success: true, data: json } : json);
  } catch (error) {
    console.error("[viasocket] run failed", error?.message || error);
    return NextResponse.json({ success: false, error: "Run failed" }, { status: 500 });
  }
}
