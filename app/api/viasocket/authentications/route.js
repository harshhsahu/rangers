import { NextResponse } from "next/server";
import { AuthError, errorResponse, getSessionToken } from "@/lib/apiAuth";
import { authIdFromConnection, connectionMatchesService, listViaSocketAuthentications } from "@/lib/viasocket";

export const runtime = "nodejs";

/**
 * POST /api/viasocket/authentications
 * Look up this user's viaSocket connections. After Slack OAuth the popup often
 * closes before posting an id; the account is still listed here.
 */
export async function POST(request) {
  try {
    if (!getSessionToken(request)) throw new AuthError("Authorization token is required", 401);
    const body = await request.json().catch(() => ({}));
    const embedToken = String(body?.embed_token || "");
    const serviceId = String(body?.service_id || "");
    const serviceName = String(body?.service_name || "");
    if (!embedToken) throw new AuthError("embed_token is required", 400);

    const rows = await listViaSocketAuthentications(embedToken);
    const matches = serviceId ? rows.filter((row) => connectionMatchesService(row, serviceId, serviceName)) : rows;
    const authIds = [...new Set(matches.map(authIdFromConnection).filter(Boolean))];
    return NextResponse.json({
      success: true,
      auth_id: authIds[authIds.length - 1] || "",
      auth_ids: authIds,
      connections: matches.length,
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[viasocket] authentications failed", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not list connections" },
      { status: 502 }
    );
  }
}
