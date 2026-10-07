export const runtime = "edge";

const CHATBOT_PATH = /^\/agents\/chatbot\/[\w-]+(\?versionId=[\w-]+)?$/;

/**
 * Web app manifest. `start` lets the chatbot page install the app so it launches straight into that
 * chatbot; anything that isn't a chatbot path falls back to "/". `id` stays fixed so every chatbot
 * is the same installed app.
 */
// Chrome sends the page's own URL as Referer when it fetches a same-origin manifest, so the route can
// work out the chatbot being viewed even if the page never rewrote the manifest link.
function refererPath(request) {
  try {
    const referer = new URL(request.headers.get("referer") || "");
    const versionId = referer.searchParams.get("versionId");
    return `${referer.pathname}${versionId ? `?versionId=${versionId}` : ""}`;
  } catch {
    return "";
  }
}

export function GET(request) {
  const requested = new URL(request.url).searchParams.get("start");
  const startUrl = [requested, refererPath(request)].find((path) => path && CHATBOT_PATH.test(path)) || "/";

  return Response.json(
    {
      name: "Rangers Agent Chat",
      short_name: "Rangers Chat",
      description: "Chat with your Rangers agent",
      id: "/",
      start_url: startUrl,
      scope: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#1c1714",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } }
  );
}
