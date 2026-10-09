import { NextResponse } from "next/server";
import { requireAgentAccess, errorResponse, AuthError } from "@/lib/apiAuth";

export const runtime = "nodejs";

/** The published agent that runs the typed check. Overridable per deployment. */
const INTENT_MODEL = "jev-latest";
const INTENT_SERVICE = "typesafe";
const INTENTS = ["test", "update"];

// A check only needs the opening of a message; capping it bounds the cost of a pasted wall of text.
const MAX_MESSAGE_CHARS = 2000;

const INTENT_QUESTIONS = {
  intent: {
    type: "choice",
    instructions: "Is the user asking to TEST/talk to the ranger, or to UPDATE/change the ranger configuration?",
    criteria: {
      test: "A message meant for the ranger itself, to try how it answers",
      update:
        "A request to change the ranger: rename it, edit prompt, change model, channels, schedule, knowledge base, MCP",
    },
  },
};

/**
 * Decides whether a message typed into the ranger chat is something to run against the ranger
 * ("test") or an instruction to change it ("update"), so one chat window can serve both.
 *
 * Server-side for the same reason as the other ranger-ai routes: the pauthkey identifies this app to
 * the completion API and never leaves the server. The caller is verified against the agent first, so
 * a valid session cannot be used to spend our key on an agent it does not own.
 *
 * The reply carries the chosen intent, its confidence and the per-intent probabilities. The client
 * treats a failure or a low confidence as a test, because only "update" writes changes.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_CHARS) : "";
    const agentId = typeof body?.agent_id === "string" ? body.agent_id.trim() : "";
    const versionId = typeof body?.version_id === "string" ? body.version_id.trim() : "";

    if (!message) return NextResponse.json({ success: false, error: "message is required" }, { status: 400 });
    if (!versionId) return NextResponse.json({ success: false, error: "version_id is required" }, { status: 400 });

    await requireAgentAccess(request, { agentId, versionId });

    const pythonUrl = (process.env.NEXT_PUBLIC_PYTHON_SERVER_URL || "").replace(/\/$/, "");
    const pauthkey = process.env.GTWY_PAUTH_KEY;
    if (!pythonUrl) throw new Error("NEXT_PUBLIC_PYTHON_SERVER_URL is not set");
    if (!pauthkey) throw new Error("GTWY_PAUTH_KEY is not set");

    let upstream;
    try {
      upstream = await fetch(`${pythonUrl}/api/v2/model/chat/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json", pauthkey },
        body: JSON.stringify({
          agent_id: agentId,
          configuration: { model: INTENT_MODEL, questions: INTENT_QUESTIONS },
          user: message,
          service: INTENT_SERVICE,
        }),
        // The user is waiting on this before anything else happens; a hung check is worse than none.
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
    } catch (error) {
      console.error("ranger-ai intent request failed:", error?.message || error);
      return NextResponse.json({ success: false, error: "Could not check the message" }, { status: 502 });
    }

    const data = await upstream.json().catch(() => ({}));
    const answer = data?.response?.data?.answers?.intent;
    const intent = answer?.choice;

    if (!upstream.ok || !INTENTS.includes(intent)) {
      console.error("ranger-ai intent: unusable reply", upstream.status, JSON.stringify(data)?.slice(0, 500));
      return NextResponse.json({ success: false, error: "Could not check the message" }, { status: 502 });
    }

    const probabilities = answer?.probabilities || {};
    const confidence = Number.isFinite(answer?.confidence) ? answer.confidence : (probabilities[intent] ?? 0);

    return NextResponse.json({ success: true, intent, confidence, probabilities });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("ranger-ai intent error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
