import { NextResponse } from "next/server";
import { processDiscordMessage } from "@/lib/discordMessageHandler";

export const runtime = "nodejs";

function assertInternalAuth(request) {
  const secret = process.env.DISCORD_INTERNAL_SECRET;
  if (!secret) return true;
  return request.headers.get("x-discord-internal-secret") === secret;
}

/**
 * Relay entry point for a Discord message payload bound to an agent version.
 * The Gateway client calls the handler in-process; this stays for debugging and future relays.
 */
export async function POST(request) {
  try {
    if (!assertInternalAuth(request)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get("version_id");
    const body = await request.json().catch(() => ({}));
    const result = await processDiscordMessage({ versionId, message: body?.message });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[discord] webhook FATAL", error);
    return NextResponse.json({ ok: true, error: error.message });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Discord webhook — stream text (no reasoning), embeds for images, DMs only",
  });
}
