/**
 * Origin of the rangers-backend API. Dependency-free so server components (the
 * manifest <link> in app/layout.js) can use it too.
 */
const RANGERS_API_URL = (process.env.NEXT_PUBLIC_RANGERS_API_URL || "").replace(/\/$/, "");

/** Absolute URL of a rangers-backend route, e.g. rangersApiUrl("/api/scheduler"). */
export const rangersApiUrl = (path) => `${RANGERS_API_URL}${path}`;
