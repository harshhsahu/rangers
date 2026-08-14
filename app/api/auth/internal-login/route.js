import { NextResponse } from "next/server";
import { signInternalJwt } from "@/lib/jwt";

export const runtime = "nodejs";

/**
 * Resolve user/org from MSG91 proxy_auth_token via getDetails
 */
async function resolveProxyAuthToken(proxyAuthToken) {
  const proxyUrl = (process.env.NEXT_PUBLIC_PROXY_URL || "https://routes.msg91.com").replace(/\/$/, "");
  const res = await fetch(`${proxyUrl}/api/c/getDetails`, {
    method: "GET",
    headers: {
      proxy_auth_token: proxyAuthToken,
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `getDetails failed (${res.status})`);
  }

  const user = json?.data?.[0] || json?.data?.data?.[0];
  if (!user) {
    throw new Error("Invalid proxy_auth_token — no user in getDetails");
  }

  return { user, orgId: user?.currentCompany?.id || null };
}

/**
 * Same as public/gtwy.js embed login:
 * POST /api/embed/login with Authorization: embedJWT
 * Returns GTWY session token used for all subsequent APIs.
 */
async function gtwyEmbedLogin(embedJwt) {
  const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/$/, "");
  if (!serverUrl) throw new Error("NEXT_PUBLIC_SERVER_URL is not set");

  const res = await fetch(`${serverUrl}/api/embed/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: embedJwt,
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `GTWY embed login failed (${res.status})`);
  }

  const data = json?.data || json;
  if (!data?.token) {
    throw new Error("GTWY embed login did not return a token");
  }
  return data;
}

/**
 * POST /api/auth/internal-login
 * Body fields: proxy_auth_token, optional userOrgId.
 *
 * 1) getDetails(proxy) to resolve current user org id
 * 2) Sign embed JWT with org_id, folder_id, user_id using ACCESS_KEY
 * 3) Call GTWY embed login with that JWT
 * 4) Return GTWY session token for subsequent GTWY APIs
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const proxyAuthToken = body?.proxy_auth_token || body?.proxyAuthToken;

    if (!proxyAuthToken) {
      return NextResponse.json({ success: false, error: "proxy_auth_token is required" }, { status: 400 });
    }

    if (!process.env.ORG_ID || !process.env.ACCESS_KEY || !process.env.FOLDER_ID) {
      return NextResponse.json(
        { success: false, error: "ORG_ID, FOLDER_ID, or ACCESS_KEY missing in env" },
        { status: 500 }
      );
    }

    const { user, orgId: detailsOrgId } = await resolveProxyAuthToken(proxyAuthToken);
    const userOrgId = detailsOrgId;

    if (!userOrgId) {
      return NextResponse.json(
        { success: false, error: "No org id from getDetails (and no userOrgId override)" },
        { status: 400 }
      );
    }

    // Step A — embed-style JWT (ACCESS_KEY)
    const embedJwt = signInternalJwt({ userOrgId });

    // Step B — exchange for GTWY session token (SecretKey JWT)
    const gtwy = await gtwyEmbedLogin(embedJwt);

    return NextResponse.json({
      success: true,
      data: {
        // Use THIS token for all GTWY API Authorization (same as embed)
        token: gtwy.token,
        org_id: String(gtwy.org_id || gtwy.company_id || ""),
        folder_id: String(gtwy.folder_id || process.env.FOLDER_ID),
        gtwy_user_id: String(gtwy.user_id || ""),
        // MSG91 user context
        user_org_id: String(userOrgId),
        user_id: String(user.id),
        user_name: user.name || "",
        company_name: user?.currentCompany?.name || "",
        jwt_org_id: process.env.ORG_ID,
        config: gtwy.config || null,
      },
    });
  } catch (error) {
    console.error("internal-login error:", error);
    return NextResponse.json({ success: false, error: error.message || "Login failed" }, { status: 500 });
  }
}
