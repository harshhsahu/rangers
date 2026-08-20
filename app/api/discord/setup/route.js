import { NextResponse } from "next/server";
import { getChannelDetailsCollection } from "@/lib/mongo";
import { encryptSecret, maskSecret, decryptSecret } from "@/lib/crypto";
import { startDiscordBot, stopDiscordBot } from "@/lib/discordBotManager";
import { registerDiscordCommands, clearDiscordCommands } from "@/lib/discordCommands";

export const runtime = "nodejs";

function sanitizeChannel(doc) {
  if (!doc) return doc;
  const out = { ...doc };
  if (out.telegram?.botToken) {
    out.telegram = { ...out.telegram, botToken: maskSecret(out.telegram.botToken) };
  }
  if (out.discord?.botToken) {
    out.discord = { ...out.discord, botToken: maskSecret(out.discord.botToken) };
  }
  return out;
}

/**
 * POST /api/discord/setup
 * Body: { botToken, version_id, agent_id?, org_id? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const botToken = body?.botToken?.trim();
    const version_id = body?.version_id;
    const agent_id = body?.agent_id || null;
    const org_id = body?.org_id || process.env.ORG_ID || null;

    if (!botToken) {
      return NextResponse.json({ success: false, error: "botToken is required" }, { status: 400 });
    }
    if (!version_id) {
      return NextResponse.json({ success: false, error: "version_id is required" }, { status: 400 });
    }
    // Discord bot tokens are typically ~70 chars; reject obvious empties / telegram-style
    if (botToken.length < 50) {
      return NextResponse.json(
        { success: false, error: "Invalid Discord bot token. Paste the full token from the Developer Portal." },
        { status: 400 }
      );
    }

    const now = new Date();
    const encryptedToken = encryptSecret(botToken);
    const collection = await getChannelDetailsCollection();
    const existing = await collection.findOne({ version_id });

    const discord = {
      botToken: encryptedToken,
      ...(existing?.discord?.chatThreads ? { chatThreads: existing.discord.chatThreads } : {}),
    };

    await collection.updateOne(
      { version_id },
      {
        $set: {
          discord,
          version_id,
          ...(agent_id != null ? { agent_id } : {}),
          ...(org_id != null ? { org_id } : {}),
          updated_at: now,
        },
        $setOnInsert: { created_at: now },
      },
      { upsert: true }
    );

    let gateway = { connected: false, message: null, tag: null };
    try {
      const started = await startDiscordBot(version_id, botToken);
      gateway = {
        connected: Boolean(started?.ok),
        alreadyRunning: Boolean(started?.alreadyRunning),
        tag: started?.tag || null,
        message: started?.ok ? "Discord Gateway connected" : "Failed to connect Gateway",
      };
    } catch (err) {
      gateway = { connected: false, message: err?.message || String(err) };
      console.error("[discord] setup start failed", gateway.message);
    }

    // Best-effort slash-command registration (do not fail setup)
    let commands = { registered: false, message: null };
    try {
      const result = await registerDiscordCommands(botToken);
      commands = {
        registered: true,
        names: result.registered,
        message: "Slash commands registered — they may take a few minutes to appear in Discord.",
      };
    } catch (err) {
      commands = { registered: false, message: err?.message || String(err) };
      console.warn("[discord] registerCommands skipped:", commands.message);
    }

    const saved = await collection.findOne({ version_id });

    return NextResponse.json({
      success: true,
      data: sanitizeChannel(saved),
      gateway,
      commands,
    });
  } catch (error) {
    console.error("discord setup error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/discord/setup?version_id=...
 * Removes only the discord field (keeps telegram if present).
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const version_id = searchParams.get("version_id");
    if (!version_id) {
      return NextResponse.json({ success: false, error: "version_id is required" }, { status: 400 });
    }

    const collection = await getChannelDetailsCollection();
    const existing = await collection.findOne({ version_id });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Channel not found" }, { status: 404 });
    }

    try {
      const token = decryptSecret(existing?.discord?.botToken);
      if (token) await clearDiscordCommands(token);
    } catch (err) {
      console.warn("[discord] clearCommands skipped:", err?.message || err);
    }

    try {
      await stopDiscordBot(version_id);
    } catch (err) {
      console.warn("[discord] stop on delete skipped:", err?.message || err);
    }

    // Only remove discord — preserve telegram on the same document
    await collection.updateOne({ version_id }, { $unset: { discord: "" }, $set: { updated_at: new Date() } });

    // If nothing channel-related remains, drop the doc
    const after = await collection.findOne({ version_id });
    if (after && !after.telegram && !after.discord) {
      await collection.deleteOne({ version_id });
      return NextResponse.json({ success: true, deleted: 1 });
    }

    return NextResponse.json({ success: true, deleted: 0, unset: "discord" });
  } catch (error) {
    console.error("discord setup DELETE error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
