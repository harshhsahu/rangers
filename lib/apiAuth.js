import { NextResponse } from "next/server";

const SERVER_URL = (process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/$/, "");

/**
 * Auth/authorization failure with an HTTP status attached.
 * Message is safe to return to the caller (no internals).
 */
export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/** Cookie name used by setInCookies() in utils/utility.js (env-prefixed). */
function localTokenCookieName() {
  const env = process.env.NEXT_PUBLIC_ENV;
  return env ? `${env}_env_local_token` : "local_token";
}

/**
 * Cookies are sent by the browser on every same-origin request, so a
 * cookie-authenticated POST is CSRF-able. Accept it only when the request
 * demonstrably originated from this app.
 */
function isSameOrigin(request) {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === new URL(request.url).host;
    } catch {
      return false;
    }
  }
  // No Origin and no Sec-Fetch-Site (e.g. curl / server-to-server):
  // such callers must send the Authorization header instead.
  return false;
}

/**
 * GTWY session token (`local_token`). Preferred as `Authorization: <token>`;
 * falls back to the `local_token` cookie for same-origin browser requests.
 */
export function getSessionToken(request) {
  const raw = request.headers.get("authorization") || "";
  const fromHeader = raw.replace(/^Bearer\s+/i, "").trim();
  if (fromHeader) return fromHeader;

  if (!isSameOrigin(request)) return null;
  const fromCookie = request.cookies?.get(localTokenCookieName())?.value?.trim();
  return fromCookie || null;
}

/**
 * Verify the caller against the GTWY server and confirm they may manage this
 * agent version. The session token issued by /api/auth/internal-login (or the
 * embed login) is signed by the GTWY server, so it is validated there rather
 * than locally — GTWY answers both "is this token valid" and "does this org
 * own this agent" in one call, which also closes the IDOR on version_id.
 *
 * Returns { token, agent, orgId }. Throws AuthError otherwise.
 */
export async function requireAgentAccess(request, { agentId, versionId }) {
  const token = getSessionToken(request);
  if (!token) {
    throw new AuthError("Authorization token is required", 401);
  }
  if (!SERVER_URL) {
    throw new AuthError("NEXT_PUBLIC_SERVER_URL is not configured", 500);
  }
  if (!agentId) {
    throw new AuthError("agent_id is required", 400);
  }

  let res;
  try {
    res = await fetch(`${SERVER_URL}/api/agent/${encodeURIComponent(agentId)}`, {
      headers: { Authorization: token },
      cache: "no-store",
    });
  } catch (error) {
    console.error("[auth] agent verification request failed:", error?.message || error);
    throw new AuthError("Could not verify authorization, please retry", 503);
  }

  if (res.status === 401) {
    throw new AuthError("Invalid or expired session token", 401);
  }
  if (!res.ok) {
    // 403/404/anything else — do not disclose whether the agent exists
    throw new AuthError("You do not have access to this agent", 403);
  }

  const body = await res.json().catch(() => ({}));
  const agent = body?.agent || body?.data?.agent || body?.data || null;
  if (!agent) {
    throw new AuthError("You do not have access to this agent", 403);
  }

  // The version being wired to a bot must belong to the agent we just authorized
  const versions = Array.isArray(agent.versions) ? agent.versions.map(String) : [];
  if (versionId && versions.length > 0 && !versions.includes(String(versionId))) {
    throw new AuthError("version_id does not belong to this agent", 403);
  }

  return {
    token,
    agent,
    orgId: agent.org_id != null ? String(agent.org_id) : null,
  };
}

/** Turn an AuthError (or anything else) into a response with no internals leaked. */
export function errorResponse(error, fallbackMessage = "Something went wrong") {
  if (error instanceof AuthError) {
    return NextResponse.json({ success: false, error: error.message }, { status: error.status });
  }
  return NextResponse.json({ success: false, error: fallbackMessage }, { status: 500 });
}
