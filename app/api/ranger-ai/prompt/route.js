import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** The published prompt-builder agent. */
const RANGER_PROMPT_AGENT_ID = "6843d832aab19264b8967f3b";

/**
 * POST /api/ranger-ai/prompt — asks the LLM for a system prompt.
 *
 * Creates nothing: the wizard creates the agent on its last step.
 * Lives on the server so the pauthkey never reaches the browser.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const name = String(body?.name || "").trim();
    const role = String(body?.role || "").trim();
    const description = String(body?.description || "").trim();

    if (!description) {
      return NextResponse.json({ success: false, error: "Describe what the ranger does" }, { status: 400 });
    }

    const pythonUrl = (process.env.NEXT_PUBLIC_PYTHON_SERVER_URL || "").replace(/\/$/, "");
    const pauthkey = process.env.GTWY_PAUTH_KEY || process.env.ACCESS_KEY;
    if (!pythonUrl || !pauthkey) throw new Error("The completion API is not configured");

    const upstream = await fetch(`${pythonUrl}/api/v2/model/chat/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", pauthkey },
      body: JSON.stringify({
        user: "Write the role, goal and instruction for this agent.",
        agent_id: RANGER_PROMPT_AGENT_ID,
        // A fresh thread each time, so one draft never influences the next.
        thread_id: `ranger_prompt_${Date.now()}`,
        // The agent needs both: `fields` is what to write, `query` is what to write it from.
        variables: {
          fields: "role,goal,instruction",
          query: [
            name ? `Agent name: ${name}` : "",
            role ? `Role title: ${role}` : "",
            `Responsibilities: ${description}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      }),
    });

    // Read once as text: it is the reply on the way through, and the reason when it fails.
    const raw = await upstream.text().catch(() => "");
    const prompt = upstream.ok ? extractPrompt(parseJson(raw)) : "";

    if (!prompt) {
      console.error("[ranger-prompt] no draft", upstream.status, raw.slice(0, 300));
      // A failure is shown as the API wrote it — a wrong agent id looks like an outage otherwise.
      const error = upstream.ok ? "No draft came back. Try again." : raw.slice(0, 300);
      return NextResponse.json(
        { success: false, error: error || "The prompt assistant did not respond" },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, prompt });
  } catch (error) {
    console.error("[ranger-prompt] failed", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not draft the prompt" },
      { status: 500 }
    );
  }
}

/** The body as an object, or an empty one when it is not JSON. */
function parseJson(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** The reply content, whichever shape the API wrapped it in. */
function extractPrompt(data) {
  const content =
    data?.response?.data?.content ??
    data?.data?.content ??
    data?.content ??
    data?.response?.content ??
    data?.response ??
    null;

  if (content && typeof content === "object") return unwrap(content);
  if (typeof content !== "string") return "";

  // JSON replies come back as a string, sometimes inside a code fence.
  const cleaned = content.replace(/```[a-z]*|```/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return cleaned;

  try {
    const unwrapped = unwrap(JSON.parse(cleaned.slice(start, end + 1)));
    if (unwrapped) return unwrapped;
    // An object with no prompt field is not a draft. Braces inside prose are part of one.
    return cleaned.startsWith("{") && cleaned.endsWith("}") ? "" : cleaned;
  } catch {
    return cleaned;
  }
}

/** Keeps {role, goal, instruction} as it is; unwraps anything else to plain text. */
function unwrap(value) {
  if (["role", "goal", "instruction"].some((key) => String(value?.[key] || "").trim())) return value;
  const flat = value?.prompt ?? value?.system_prompt ?? value?.content ?? value?.text ?? "";
  return typeof flat === "string" ? flat.trim() : "";
}
