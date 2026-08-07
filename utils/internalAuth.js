import { getFromCookies, setInCookies } from "@/utils/utility";

/**
 * Store auth the same way embed layout does after /api/embed/login.
 */
export function storeAuthToken(token, { orgId, folderId, userId } = {}) {
  if (!token) return;
  setInCookies("local_token", token);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("local_token", token);
    if (orgId) sessionStorage.setItem("gtwy_org_id", String(orgId));
    if (folderId) sessionStorage.setItem("gtwy_folder_id", String(folderId));
    if (userId) sessionStorage.setItem("gtwy_user_id", String(userId));
  }
}

function getStoredProxyToken() {
  if (typeof sessionStorage !== "undefined") {
    const fromSession = sessionStorage.getItem("proxy_token");
    if (fromSession) return fromSession;
  }
  return getFromCookies("proxy_token");
}

/**
 * proxy_auth_token → internal-login (getDetails + embed JWT + GTWY embed/login)
 * → store GTWY session token as local_token
 */
export async function loginWithProxyAuthToken(proxyAuthToken, { userOrgId } = {}) {
  if (!proxyAuthToken) return null;

  const res = await fetch("/api/auth/internal-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proxy_auth_token: proxyAuthToken,
      ...(userOrgId ? { userOrgId: String(userOrgId) } : {}),
    }),
  });

  const data = await res.json();
  if (!res.ok || !data?.success || !data?.data?.token) {
    console.error("internal login failed:", data?.error);
    return null;
  }

  const auth = data.data;
  storeAuthToken(auth.token, {
    orgId: auth.org_id,
    folderId: auth.folder_id,
    userId: auth.gtwy_user_id,
  });
  return auth;
}

export async function createAndStoreInternalJwt(userOrgId) {
  const proxyAuthToken = getStoredProxyToken();
  if (!proxyAuthToken) {
    console.error("createAndStoreInternalJwt: missing proxy_token");
    return null;
  }
  const result = await loginWithProxyAuthToken(proxyAuthToken, {
    userOrgId: userOrgId || undefined,
  });
  return result?.token || null;
}

export function getCurrentUserOrgId(userDetailsData) {
  return userDetailsData?.currentCompany?.id || userDetailsData?.c_companies?.[0]?.id || null;
}

export function getStoredGtwyOrgId() {
  if (typeof sessionStorage !== "undefined") {
    return sessionStorage.getItem("gtwy_org_id");
  }
  return null;
}
