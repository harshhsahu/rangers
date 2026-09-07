import axios from "axios";
import { clearCookie, getFromCookies, setInCookies } from "./utility";
import { isCurrentRoutePublic } from "./publicRoutes";
export const rawAxios = axios.create();

/**
 * Same pattern as embed / AI-middleware-frontend:
 * - MSG91 proxy APIs → proxy_auth_token
 * - GTWY APIs → Authorization: local_token (JWT from internal-login / embed)
 */
function isProxyRequest(url = "") {
  const PROXY_URL = process.env.NEXT_PUBLIC_PROXY_URL || "";
  return (PROXY_URL && url.includes(PROXY_URL)) || url.includes("/api/c/");
}

/**
 * The GTWY session token every authenticated call is made with. Exported so callers
 * that need to hand the token to something other than axios (e.g. forwarding it to an
 * agent) use this precedence rather than re-deriving it and drifting from it.
 */
export function getAuthToken() {
  // Embed + localhost prefer sessionStorage (same as embed layout)
  if (typeof window !== "undefined") {
    const fromSession = sessionStorage.getItem("local_token");
    if (fromSession) return fromSession;
  }
  return getFromCookies("local_token");
}

function getProxyToken() {
  if (typeof window !== "undefined") {
    const fromSession = sessionStorage.getItem("proxy_token");
    if (fromSession) return fromSession;
  }
  return getFromCookies("proxy_token");
}

axios.interceptors.request.use(
  async (config) => {
    const url = config.url || "";

    if (isProxyRequest(url)) {
      config.headers["proxy_auth_token"] = getProxyToken();
    } else {
      config.headers["Authorization"] = getAuthToken();
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axios.interceptors.response.use(
  (response) => response,
  async function (error) {
    if (error?.response?.status === 401) {
      clearCookie();
      // On public pages (landing, login) a 401 just means "not signed in".
      // Leave the visitor where they are; they choose when to go to /login.
      if (isCurrentRoutePublic()) {
        return Promise.reject(error);
      }
      const isEmbedContext =
        window.location.pathname.includes("/embed") ||
        sessionStorage.getItem("embedUser") === "true" ||
        window.location.hostname.includes("embed");

      if (isEmbedContext) {
        window.location.href = "/session-expired";
      } else {
        if (window.location.href !== "/login") {
          setInCookies("previous_url", window.location.href);
        }
        window.location.href = "/login";
      }
    }

    if (!error?.response && !error?.config?._retry) {
      error.config._retry = true;
      return axios(error.config);
    }

    if (!error?.response) {
      error.isNetworkError = true;
      error.message = error.message || "Connection lost. Please check your internet connection.";
    }

    return Promise.reject(error);
  }
);

export default axios;
