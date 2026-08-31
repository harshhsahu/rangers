import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** The published "Build with AI" ranger-builder agent. */
const RANGER_BUILDER_AGENT_ID = "6a881574306498162b09a296";

/**
 * Server-side proxy for the "Build with AI" chat — keeps pauthkey off the
 * client. response_type is omitted on purpose: the completion API returns
 * JSON by default, letting the agent's own json_schema drive the shape.
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
    const pauthkey = process.env.GTWY_PAUTH_KEY;

    if (!pythonUrl) throw new Error("NEXT_PUBLIC_PYTHON_SERVER_URL is not set");
    if (!pauthkey) throw new Error("GTWY_PAUTH_KEY is not set");

    const upstream = await fetch(`${pythonUrl}/api/v2/model/chat/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", pauthkey },
      body: JSON.stringify({
        user: message,
        agent_id: RANGER_BUILDER_AGENT_ID,
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

/** Mirrors gtwyChannelHelpers.extractAssistantText — the envelope shape varies by deployment. */
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
