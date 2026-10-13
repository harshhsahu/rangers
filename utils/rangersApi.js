import { getAuthToken } from "@/utils/interceptor";
import { rangersApiUrl } from "@/utils/rangersApiUrl";

export { rangersApiUrl };

/**
 * fetch() against rangers-backend. The API lives on its own origin, so the session
 * cookie never reaches it — every call carries the GTWY session as `Authorization`
 * instead. Callers' own headers win (e.g. Content-Type).
 */
export function rangersFetch(path, { headers, ...init } = {}) {
  const token = getAuthToken();
  return fetch(rangersApiUrl(path), {
    ...init,
    headers: { ...(token ? { Authorization: token } : {}), ...headers },
  });
}
