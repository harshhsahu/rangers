import { NextResponse } from "next/server";
import { AuthError, errorResponse, requireAgentAccess } from "@/lib/apiAuth";
import { getViaSocketAppToolsCollection } from "@/lib/mongo";
import {
  enableViaSocketApp,
  getViaSocketCatalog,
  newViaSocketRunKey,
  newViaSocketToolId,
  safeToolTitle,
  summarizeViaSocketActions,
  viaSocketAppToolDefinition,
} from "@/lib/viasocket";
import { viaSocketAppToolRunUrl } from "@/lib/viasocketAppTools";

export const runtime = "nodejs";

const publicTool = (row) => ({
  id: String(row._id),
  service_id: row.service_id,
  service_name: row.service_name,
  icon_url: row.icon_url || null,
  tool_name: row.tool_name,
  actions: (row.actions || []).map((action) => ({ action_version_id: action.action_version_id, name: action.name })),
  created_at: row.created_at,
});

/**
 * GET /api/viasocket/app-tools?agent_id=&version_id=
 * This agent's app tools, plus the GTWY `extra_tools` the playground sends with each turn.
 * The version is recorded on the agent's rows so channels that only know it find them.
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agent_id") || "";
    const versionId = url.searchParams.get("version_id") || "";
    await requireAgentAccess(request, { agentId, versionId });

    const tools = await getViaSocketAppToolsCollection();
    if (versionId) {
      await tools.updateMany({ agent_id: agentId }, { $addToSet: { version_ids: versionId } });
    }
    const rows = await tools.find({ agent_id: agentId }).sort({ created_at: 1 }).toArray();
    return NextResponse.json({
      success: true,
      tools: rows.map(publicTool),
      extra_tools: rows.map((row) => viaSocketAppToolDefinition(row, { url: viaSocketAppToolRunUrl(row._id) })),
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[viasocket] list app tools failed", error?.message || error);
    return NextResponse.json({ success: false, error: "Could not list app tools" }, { status: 500 });
  }
}

/**
 * POST /api/viasocket/app-tools
 * Enable the app once for this connection and save every action of it as one tool on the agent.
 * Adding the same app again refreshes its actions and connection.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const agentId = String(body?.agent_id || "");
    const versionId = String(body?.version_id || "");
    const serviceId = String(body?.service_id || "");
    const authId = String(body?.auth_id || "");
    const embedToken = String(body?.embed_token || "");
    if (!serviceId || !authId || !embedToken) {
      throw new AuthError("service_id, auth_id and embed_token are required", 400);
    }
    const { agent, orgId } = await requireAgentAccess(request, { agentId, versionId });

    const catalog = await getViaSocketCatalog(serviceId);
    const actions = summarizeViaSocketActions(catalog.actions);
    if (!actions.length) throw new AuthError("This app has no published actions to add", 400);

    const { script_id: scriptId } = await enableViaSocketApp({ embedToken, serviceId, authId });
    const serviceName = String(catalog.service?.name || body?.service_name || "App");
    const versionIds = [
      ...new Set([versionId, ...(Array.isArray(agent?.versions) ? agent.versions.map(String) : [])].filter(Boolean)),
    ];
    const now = new Date();

    const tools = await getViaSocketAppToolsCollection();
    const row = await tools.findOneAndUpdate(
      { agent_id: agentId, service_id: serviceId },
      {
        $set: {
          org_id: orgId || (body?.org_id ? String(body.org_id) : null),
          version_id: versionId || null,
          user_id: body?.user_id ? String(body.user_id) : null,
          service_name: serviceName,
          icon_url: catalog.service?.iconurl || body?.icon_url || null,
          tool_name: safeToolTitle(serviceName).toLowerCase(),
          auth_id: authId,
          script_id: scriptId,
          embed_token: embedToken,
          actions,
          updated_at: now,
        },
        $addToSet: { version_ids: { $each: versionIds } },
        $setOnInsert: { _id: newViaSocketToolId(), run_key: newViaSocketRunKey(), created_at: now },
      },
      { upsert: true, returnDocument: "after" }
    );

    return NextResponse.json({ success: true, tool: publicTool(row) });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    const status = error?.status || 500;
    console.error("[viasocket] add app tool failed", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Could not add the app" }, { status });
  }
}
