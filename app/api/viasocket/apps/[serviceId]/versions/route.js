import { NextResponse } from "next/server";
import { AuthError, errorResponse, getSessionToken } from "@/lib/apiAuth";
import { listViaSocketVersions } from "@/lib/viasocket";

export const runtime = "nodejs";

/** GET /api/viasocket/apps/:serviceId/versions — actions and triggers, without baking ids into the client. */
export async function GET(request, { params }) {
  try {
    if (!getSessionToken(request)) throw new AuthError("Authorization token is required", 401);
    const { serviceId } = await params;
    if (!serviceId) throw new AuthError("service id is required", 400);
    const versions = await listViaSocketVersions(serviceId);
    return NextResponse.json({ success: true, ...versions });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[viasocket] versions failed", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Could not list actions" }, { status: 502 });
  }
}
