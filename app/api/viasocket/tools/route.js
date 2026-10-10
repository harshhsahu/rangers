import { NextResponse } from "next/server";
import { AuthError, errorResponse, getSessionToken, requireAgentAccess } from "@/lib/apiAuth";
import { getViaSocketToolsCollection } from "@/lib/mongo";
import { actionToOpenAiTool, enableViaSocketApp, newViaSocketToolId, safeToolTitle } from "@/lib/viasocket";

export const runtime = "nodejs";

/**
 * POST /api/viasocket/tools
 * Enable the app and register a GTWY function whose URL is the viaSocket
 * script. Axios-work POSTs { action_version_id, inputData } there.
 */
export async function POST(request) {
  try {
    if (!getSessionToken(request)) throw new AuthError("Authorization token is required", 401);
    const body = await request.json().catch(() => ({}));
    const serviceId = String(body?.service_id || "");
    const authId = String(body?.auth_id || "");
    const embedToken = String(body?.embed_token || "");
    const action = body?.action;
    if (!serviceId || !authId || !embedToken || !action?.actionversionrecordid) {
      throw new AuthError("service_id, auth_id, embed_token and action are required", 400);
    }

    let orgId = body?.org_id ? String(body.org_id) : "";
    if (body?.agent_id) {
      const access = await requireAgentAccess(request, {
        agentId: body.agent_id,
        versionId: body.version_id,
      });
      orgId = access.orgId || orgId;
    }
    if (!orgId) throw new AuthError("org_id is required", 400);

    const enabled = await enableViaSocketApp({ embedToken, serviceId, authId });
    const scriptId = enabled.script_id;
    const publicId = newViaSocketToolId();
    const title = safeToolTitle([action.pluginname, action.name].filter(Boolean).join("_"));
    const description = String(action.description || action.name || title);
    const openaiToolJson = await actionToOpenAiTool(action, { embedToken, authId });

    const tools = await getViaSocketToolsCollection();
    await tools.insertOne({
      _id: publicId,
      org_id: orgId,
      service_id: serviceId,
      action_version_id: String(action.actionversionrecordid),
      script_id: scriptId,
      title,
      created_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      tool: {
        public_id: publicId,
        script_id: scriptId,
        title,
        description,
        url: `https://flow.sokt.io/func/${scriptId}`,
        status: "published",
        openaiToolJson,
        folder_id: null,
        action_version_id: String(action.actionversionrecordid),
      },
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    const status = error?.status || 500;
    console.error("[viasocket] enable tool failed", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Could not add the tool" }, { status });
  }
}
