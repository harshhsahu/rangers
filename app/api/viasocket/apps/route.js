import { NextResponse } from "next/server";
import { AuthError, errorResponse, getSessionToken } from "@/lib/apiAuth";
import { searchViaSocketApps, listAllViaSocketApps } from "@/lib/viasocket";

export const runtime = "nodejs";

/** GET /api/viasocket/apps?key= — catalog search, or the full popular list when key is empty. */
export async function GET(request) {
  try {
    if (!getSessionToken(request)) throw new AuthError("Authorization token is required", 401);
    const key = new URL(request.url).searchParams.get("key") || "";
    const apps = key.trim()
      ? await searchViaSocketApps(key.trim())
      : await listAllViaSocketApps({ limit: 200, offset: 0 });
    return NextResponse.json({ success: true, apps });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[viasocket] app search failed", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Could not search apps" }, { status: 502 });
  }
}
