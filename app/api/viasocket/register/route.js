import { NextResponse } from "next/server";
import { AuthError, errorResponse, getSessionToken } from "@/lib/apiAuth";

export const runtime = "nodejs";

/**
 * POST /api/viasocket/register
 * Verifies the org embed token with viaSocket so the connect popup can open.
 */
export async function POST(request) {
  try {
    if (!getSessionToken(request)) throw new AuthError("Authorization token is required", 401);
    const body = await request.json().catch(() => ({}));
    const embedToken = String(body?.embed_token || "");
    if (!embedToken) throw new AuthError("embed_token is required", 400);

    const res = await fetch("https://flow-api.viasocket.com/users/register", {
      method: "GET",
      headers: { authorization: embedToken, "Content-Type": "application/json" },
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    const embedDetails = json?.data;
    if (!res.ok || !embedDetails) {
      return NextResponse.json(
        { success: false, error: json?.message || json?.error || "Could not start the connection" },
        { status: res.ok ? 502 : res.status }
      );
    }
    return NextResponse.json({ success: true, data: embedDetails });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[viasocket] register failed", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not start the connection" },
      { status: 502 }
    );
  }
}
