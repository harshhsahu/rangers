import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Server-side proxy for the "Build with AI" ranger wizard chat.
 *
 * The GTWY agent behind this feature (GTWY_RANGER_BUILDER_AGENT_ID) is
 * configured on the platform with a strict json_schema response format —
 * {response, draft_config} — so the request itself carries no schema, only
 * the running thread_id and the user's latest message. `response_type` is
 * deliberately omitted: per the chat/completion API, the response is JSON by
 * default, which is what lets the agent's own schema drive the shape below.
 *
 * Kept server-side because the pauthkey is a real secret — unlike the
 * NEXT_PUBLIC_* host vars, it must never reach the browser bundle.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const threadId = typeof body?.thread_id === "string" ? body.thread_id.trim() : "";

    if (!message) {
      return NextResponse.json({ success: false, error: "message is required" }, { status: 400 });
    }
    if (!threadId) {
      return NextResponse.json({ success: false, error: "thread_id is required" }, { status: 400 });
    }

    const pythonUrl = (process.env.NEXT_PUBLIC_PYTHON_SERVER_URL || "").replace(/\/$/, "");
    const pauthkey = process.env.GTWY_RANGER_BUILDER_PAUTHKEY;
    const agentId = process.env.GTWY_RANGER_BUILDER_AGENT_ID;

    if (!pythonUrl) throw new Error("NEXT_PUBLIC_PYTHON_SERVER_URL is not set");
    if (!pauthkey) throw new Error("GTWY_RANGER_BUILDER_PAUTHKEY is not set");
    if (!agentId) throw new Error("GTWY_RANGER_BUILDER_AGENT_ID is not set");

    const upstream = await fetch(`${pythonUrl}/api/v2/model/chat/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", pauthkey },
      body: JSON.stringify({
        user: message,
        agent_id: agentId,
        thread_id: threadId,
        variables: {},
      }),
    });

    const rawText = await upstream.text();
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }

    if (!upstream.ok) {
      const upstreamMessage = data?.message || data?.error || rawText?.slice(0, 500) || "GTWY request failed";
      return NextResponse.json({ success: false, error: upstreamMessage }, { status: upstream.status });
    }

    const parsed = extractStructuredReply(data);
    if (!parsed) {
      console.error("ranger-ai chat: could not parse a structured reply", rawText?.slice(0, 500));
      return NextResponse.json(
        { success: false, error: "The assistant returned an unexpected response. Try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      response: parsed.response,
      draft_config: parsed.draft_config,
      thread_id: threadId,
    });
  } catch (error) {
    console.error("ranger-ai chat error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * The completion envelope varies by deployment (seen here as
 * `response.data.content`, `data.content` or a bare `content`/`response`
 * string) — mirrors lib/gtwyChannelHelpers.js's extractAssistantText. The
 * payload inside is the agent's structured `{response, draft_config}` object,
 * either already parsed or JSON-encoded as text.
 */
function extractStructuredReply(gtwyResponse) {
  const content =
    gtwyResponse?.response?.data?.content ??
    gtwyResponse?.data?.content ??
    gtwyResponse?.content ??
    gtwyResponse?.response?.content ??
    gtwyResponse?.response ??
    null;

  const candidate = typeof content === "string" ? safeJsonParse(content) : content;
  if (!candidate || typeof candidate !== "object") return null;
  if (typeof candidate.response !== "string" || !candidate.draft_config) return null;

  return candidate;
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
