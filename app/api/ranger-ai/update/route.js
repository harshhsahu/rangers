import { NextResponse } from "next/server";
import { requireAgentAccess, errorResponse, AuthError } from "@/lib/apiAuth";

export const runtime = "nodejs";

/** The published "Update the ranger" agent. */
const RANGER_UPDATE_AGENT_ID = "6a98e24a1b30b30277b9f371";

/**
 * Server-side proxy for the "Update the ranger" chat.
 *
 * First cut: the agent can rename the ranger and nothing else. The reply contract
 * The reply is streamed straight through as SSE; the client reads the tool_call and
 * tool_result events to know what changed on screen, so prompt / model / channel tools
 * can be added agent-side later without touching this route.
 *
 * Two different credentials are in play and they are not interchangeable:
 *   - pauthkey  — ours, identifies this app to the completion API. Never leaves the server.
 *   - auth_token — the caller's GTWY session token, forwarded as a *variable* so the
 *     agent's tools can authenticate as the user against /api/versions, /api/agent and
 *     the channel setup routes. The agent acts strictly within that user's permissions.
 *
 * The caller is verified against the agent + version first, so a valid session cannot
 * be used to spend our pauthkey on an agent the caller does not own.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const threadId = typeof body?.thread_id === "string" ? body.thread_id.trim() : "";
    const agentId = typeof body?.agent_id === "string" ? body.agent_id.trim() : "";
    const versionId = typeof body?.version_id === "string" ? body.version_id.trim() : "";
    // Arrays the version API replaces wholesale, plus what is available to attach. Sent
    // as JSON strings because variables are substituted into the prompt as text.
    const asJson = (value) => JSON.stringify(Array.isArray(value) ? value : []);

    if (!message) return NextResponse.json({ success: false, error: "message is required" }, { status: 400 });
    if (!threadId) return NextResponse.json({ success: false, error: "thread_id is required" }, { status: 400 });
    if (!versionId) return NextResponse.json({ success: false, error: "version_id is required" }, { status: 400 });

    const { token } = await requireAgentAccess(request, { agentId, versionId });

    const pythonUrl = (process.env.NEXT_PUBLIC_PYTHON_SERVER_URL || "").replace(/\/$/, "");
    const pauthkey = process.env.GTWY_PAUTH_KEY;
    /**
     * Where the agent's tools reach THIS app. Separate from TELEGRAM_WEBHOOK_BASE_URL:
     * that one is where Telegram delivers messages, which in a shared deployment is the
     * hosted app, while a developer needs the agent to call back to their own machine —
     * pointing both at the hosted app writes channel documents into the hosted database
     * while the local UI reads its own, so the change appears to vanish.
     */
    const frontendUrl = (
      process.env.RANGER_PUBLIC_URL ||
      process.env.TELEGRAM_WEBHOOK_BASE_URL ||
      process.env.NEXT_PUBLIC_FRONTEND_URL ||
      ""
    ).replace(/\/$/, "");

    if (!pythonUrl) throw new Error("NEXT_PUBLIC_PYTHON_SERVER_URL is not set");
    if (!pauthkey) throw new Error("GTWY_PAUTH_KEY is not set");

    const upstream = await fetch(`${pythonUrl}/api/v2/model/chat/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", pauthkey },
      body: JSON.stringify({
        user: message,
        agent_id: RANGER_UPDATE_AGENT_ID,
        thread_id: threadId,
        stream: true,
        variables: {
          auth_token: token,
          agent_id: agentId,
          version_id: versionId,
          // The channel setup routes live in this app, not on the GTWY API, so the
          // agent's tool needs a publicly reachable origin for them. Unset on a bare
          // localhost dev server, hence the companion flag: the agent is told the
          // capability is unavailable rather than handed a URL it cannot reach.
          frontend_url: frontendUrl,
          channels_available: frontendUrl ? "true" : "false",
          server_url: (process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/$/, ""),
          // The ranger's own configuration is read by the agent's pre-function, straight
          // from the API each turn, so none of it is duplicated here. Only what a tool
          // needs and the pre-function cannot supply is forwarded.
          available_knowledge_bases: asJson(body?.available_knowledge_bases),
          model_type: String(body?.model_type || "chat"),
        },
      }),
    });

    if (!upstream.ok) {
      const rawText = await upstream.text();
      let data = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        data = {};
      }
      const upstreamMessage = data?.message || data?.error || rawText?.slice(0, 500) || "GTWY request failed";
      return NextResponse.json({ success: false, error: upstreamMessage }, { status: upstream.status });
    }

    /**
     * Whether the answer streams is a property of the agent's own configuration
     * (`configuration.stream`), not of this request — the playground sends no stream flag
     * at all (config/modelApi.js deletes it). So both shapes have to be handled: an SSE
     * body is piped through untouched, and a plain JSON body is normalised into a single
     * synthetic delta so the client has only one format to read.
     */
    const contentType = upstream.headers.get("content-type") || "";

    if (contentType.includes("text/event-stream") && upstream.body) {
      return new Response(upstream.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          // Nginx buffers proxied responses by default, which would batch the whole
          // stream into one write and defeat the point.
          "X-Accel-Buffering": "no",
        },
      });
    }

    const rawText = await upstream.text();
    const text = extractAssistantText(rawText);
    if (!text) {
      console.error("ranger-ai update: no assistant text in reply", rawText?.slice(0, 500));
      return NextResponse.json(
        { success: false, error: "The assistant returned an empty response. Try again." },
        { status: 502 }
      );
    }

    return new Response(sseEvents(text), {
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("ranger-ai update error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/** A non-streamed answer, re-emitted as the same event sequence a stream would produce. */
function sseEvents(text) {
  return [
    `data: ${JSON.stringify({ event: "start" })}\n\n`,
    `data: ${JSON.stringify({ event: "delta", content: text })}\n\n`,
    `data: ${JSON.stringify({ event: "done" })}\n\n`,
  ].join("");
}

/** The completion envelope's shape varies by deployment, so every known nesting is tried. */
function extractAssistantText(rawText) {
  let data;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    // Not JSON at all — the body is the answer.
    return (rawText || "").trim();
  }

  const content =
    data?.response?.data?.content ??
    data?.data?.content ??
    data?.content ??
    data?.response?.content ??
    data?.response ??
    null;

  if (typeof content === "string") return content.trim();
  if (content && typeof content === "object") return JSON.stringify(content);
  return "";
}
