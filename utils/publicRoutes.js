/**
 * Routes that render for logged-out visitors. A failed/absent session on one of
 * these must never bounce the visitor to /login — they leave only when they
 * click "Open console" / "Login" themselves.
 */
const PUBLIC_ROUTES = ["/", "/login", "/session-expired", "/auth_verify"];

export function isPublicRoute(pathname) {
  if (typeof pathname !== "string") return false;
  const path = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  return PUBLIC_ROUTES.includes(path);
}

export function isCurrentRoutePublic() {
  if (typeof window === "undefined") return false;
  return isPublicRoute(window.location.pathname);
}
