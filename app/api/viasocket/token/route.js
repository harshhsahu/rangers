import { NextResponse } from "next/server";
import { AuthError, errorResponse, getSessionToken, requireAgentAccess } from "@/lib/apiAuth";
import { signViaSocketEmbedToken } from "@/lib/viasocket";

export const runtime = "nodejs";

/**
 * POST /api/viasocket/token
 * Body: { org_id, agent_id?, version_id? }
 * Returns a per-org embed token for the connect popup. The secret never leaves the server.
 */
export async function POST(request) {
  try {
    if (!getSessionToken(request)) throw new AuthError("Authorization token is required", 401);
    const body = await request.json().catch(() => ({}));
    let orgId = body?.org_id ? String(body.org_id) : "";

    if (body?.agent_id) {
      const access = await requireAgentAccess(request, {
        agentId: body.agent_id,
        versionId: body.version_id,
      });
      orgId = access.orgId || orgId;
    }

    if (!orgId) throw new AuthError("org_id is required", 400);
    const embedToken = signViaSocketEmbedToken(orgId);
    return NextResponse.json({ success: true, embed_token: embedToken });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    const status = error?.status || 500;
    if (status >= 500) console.error("[viasocket] token failed", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Could not sign embed token" }, { status });
  }
}
