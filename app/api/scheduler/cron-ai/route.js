import { NextResponse } from "next/server";
import { requireAgentAccess, errorResponse, AuthError } from "@/lib/apiAuth";
import { describeCron, nextCronRuns, validateCronExpression } from "@/lib/cronExpression";
import { cronCaveat } from "@/lib/rangerSchedules";

export const runtime = "nodejs";

/** The published agent that turns "every weekday at 9" into a cron expression. */
const CRON_AGENT_ID = "6aa016abb54ce2b5442ddcea";

/**
 * POST /api/scheduler/cron-ai
 * Body: { agent_id, version_id, text, timezone }
 *
 * Turns a plain-English cadence into a cron expression, for the Scheduler panel's
 * "generate with AI" field.
 *
 * Server-side because of the pauthkey: it identifies this app to the completion API and
 * must never reach the browser. The caller is checked against their own agent first, so a
 * session cannot be used to spend it on anything else.
 *
 * Nothing is written here. The expression is validated and handed back with its next fire
 * times so the user confirms a real schedule rather than a string they cannot read — the
 * model is a convenience over the preset dropdowns, not an authority.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const text = String(body?.text || "").trim();
    const timezone = String(body?.timezone || "UTC").trim();

    if (!text) {
      return NextResponse.json({ success: false, error: "Describe when it should run" }, { status: 400 });
    }

    await requireAgentAccess(request, { agentId: body?.agent_id, versionId: body?.version_id });

    const pythonUrl = (process.env.NEXT_PUBLIC_PYTHON_SERVER_URL || "").replace(/\/$/, "");
    const pauthkey = process.env.GTWY_PAUTH_KEY || process.env.ACCESS_KEY;
    if (!pythonUrl || !pauthkey) throw new Error("The completion API is not configured");

    const upstream = await fetch(`${pythonUrl}/api/v2/model/chat/completion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", pauthkey },
      body: JSON.stringify({
        user: text,
        agent_id: CRON_AGENT_ID,
        // One thread per request: each cadence is asked in isolation, so an earlier
        // question cannot colour the answer to this one.
        thread_id: `cron_ai_${Date.now()}`,
        response_type: "text",
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      console.error("[cron-ai] completion failed", upstream.status, detail.slice(0, 300));
      return NextResponse.json({ success: false, error: "The cron assistant did not respond" }, { status: 502 });
    }

    const data = await upstream.json().catch(() => ({}));
    const answer = extractText(data);
    const parsed = parseAnswer(answer);

    // The agent says so itself when a cadence cannot be expressed as cron — "the first
    // Monday of each month" has no representation. Its reason is better than a generic
    // parse failure, so it is passed to the user as written.
    if (parsed?.answerable === false) {
      return NextResponse.json(
        { success: false, error: parsed.reason || "That cadence cannot be written as a cron expression" },
        { status: 422 }
      );
    }

    const expression = parsed?.cronExpression || extractCron(answer);
    if (!expression) {
      return NextResponse.json(
        { success: false, error: `No cron expression came back. It said: ${answer.slice(0, 200) || "nothing"}` },
        { status: 422 }
      );
    }

    // Validated here, not trusted: the panel is about to offer this to the user as a real
    // schedule, and an out-of-range field would otherwise fail later at save time.
    const cron = validateCronExpression(expression);

    return NextResponse.json({
      success: true,
      cron_expression: cron,
      description: describeCron(cron, timezone),
      next_runs: nextCronRuns(cron, timezone, 3),
      warning: cronCaveat(cron),
    });
  } catch (error) {
    if (error instanceof AuthError) return errorResponse(error);
    console.error("[cron-ai] failed", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Could not read that schedule" },
      { status: 400 }
    );
  }
}

/**
 * The agent answers with JSON — { cronExpression, meaning, answerable, reason } — usually
 * as a bare string, sometimes fenced. Anything else falls through to the text scan below,
 * so a plain-text reply still works if the agent's response format is ever changed.
 */
function parseAnswer(answer) {
  const text = String(answer || "")
    .replace(/```[a-z]*|```/gi, "")
    .trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** The completion response shape varies by model; take the first assistant text found. */
function extractText(data) {
  const candidates = [
    data?.response?.data?.content,
    data?.response?.content,
    data?.data?.content,
    data?.content,
    data?.response?.data?.choices?.[0]?.message?.content,
    data?.choices?.[0]?.message?.content,
    typeof data?.response === "string" ? data.response : null,
  ];
  const found = candidates.find((value) => typeof value === "string" && value.trim());
  return String(found || "").trim();
}

/**
 * Pulls the expression out of whatever the agent wrapped it in — a code fence, a sentence,
 * a quoted string. Six-field (seconds) expressions are ignored rather than truncated: a
 * schedule the rest of the system cannot represent is worse than no answer.
 */
function extractCron(answer) {
  const cleaned = String(answer || "")
    .replace(/```[a-z]*|`/gi, " ")
    .replace(/["']/g, " ");
  const field = "[0-9*/,\\-]+";
  const five = new RegExp(`(?:^|\\s)(${field}\\s+${field}\\s+${field}\\s+${field}\\s+${field})(?=\\s|$)`, "m");
  const match = five.exec(cleaned);
  if (!match) return null;
  const candidate = match[1].trim().split(/\s+/);
  // A six-field match would have consumed the first five and left one behind.
  const after = cleaned.slice(match.index + match[0].length).trim();
  if (/^[0-9*/,\-]+(\s|$)/.test(after)) return null;
  return candidate.join(" ");
}
