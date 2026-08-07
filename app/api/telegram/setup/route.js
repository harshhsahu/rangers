import { NextResponse } from "next/server";
import { getChannelDetailsCollection } from "@/lib/mongo";
import { encryptSecret, maskSecret, decryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";

function buildWebhookUrl(versionId) {
  const base = (process.env.TELEGRAM_WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "").replace(/\/$/, "");
  if (!base) return null;
  return `${base}/api/telegram/webhook?version_id=${encodeURIComponent(versionId)}`;
}

function sanitizeChannel(doc) {
  if (!doc?.telegram) return doc;
  return {
    ...doc,
    telegram: {
      ...doc.telegram,
      botToken: maskSecret(doc.telegram.botToken),
    },
  };
}

/**
 * POST /api/telegram/setup
 * Body: { botToken, version_id, agent_id?, org_id? }
 *
 * Webhook URL query params:
 *   - version_id  → agent version this bot is bound to
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
    if (!botToken.includes(":")) {
      return NextResponse.json(
        { success: false, error: "Invalid bot token format. Expected 123456:ABC..." },
        { status: 400 }
      );
    }

    const webhookUrl = buildWebhookUrl(version_id);
    const now = new Date();
    const encryptedToken = encryptSecret(botToken);

    const collection = await getChannelDetailsCollection();
    const channelDoc = {
      telegram: {
        botToken: encryptedToken,
        webhookUrl,
        webhookSet: false,
      },
      version_id,
      agent_id,
      org_id,
      updated_at: now,
    };

    // $set on whole `telegram` replaces the object (drops legacy botId) — do not also $unset telegram.botId
    await collection.updateOne(
      { version_id },
      {
        $set: channelDoc,
        $setOnInsert: { created_at: now },
      },
      { upsert: true }
    );

    let webhookResult = null;
    let webhookError = null;
    if (webhookUrl && !webhookUrl.includes("localhost") && webhookUrl.startsWith("https://")) {
      try {
        const form = new FormData();
        form.append("url", webhookUrl);
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
          method: "POST",
          body: form,
        });
        webhookResult = await tgRes.json();
        if (webhookResult?.ok) {
          await collection.updateOne({ version_id }, { $set: { "telegram.webhookSet": true, updated_at: new Date() } });
          channelDoc.telegram.webhookSet = true;
        } else {
          webhookError = webhookResult?.description || "Telegram setWebhook failed";
        }
      } catch (err) {
        webhookError = err.message;
      }
    } else {
      webhookError =
        "Webhook not registered yet — set TELEGRAM_WEBHOOK_BASE_URL to a public HTTPS URL (e.g. ngrok) and re-save.";
    }

    const saved = await collection.findOne({ version_id });

    return NextResponse.json({
      success: true,
      data: sanitizeChannel(saved || channelDoc),
      webhook: {
        url: webhookUrl,
        params: { version_id },
        registered: Boolean(webhookResult?.ok),
        result: webhookResult,
        message: webhookError,
      },
    });
  } catch (error) {
    console.error("telegram setup error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/telegram/setup?version_id=...
 * Clears Telegram webhook (best-effort) and removes the channel document.
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

    // Best-effort: remove webhook from Telegram using decrypted token
    try {
      const token = decryptSecret(existing?.telegram?.botToken);
      if (token) {
        await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`, { method: "POST" });
      }
    } catch (err) {
      console.warn("telegram deleteWebhook skipped:", err?.message || err);
    }

    const result = await collection.deleteOne({ version_id });
    return NextResponse.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error("telegram setup DELETE error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
