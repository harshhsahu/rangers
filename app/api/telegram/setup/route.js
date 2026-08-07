import { NextResponse } from "next/server";
import { getChannelDetailsCollection } from "@/lib/mongo";

export const runtime = "nodejs";

function extractBotId(botToken) {
  return String(botToken || "").split(":")[0];
}

function buildWebhookUrl({ botId, versionId }) {
  const base = (process.env.TELEGRAM_WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || "").replace(/\/$/, "");
  if (!base) return null;
  return `${base}/api/telegram/webhook?botId=${encodeURIComponent(botId)}&version_id=${encodeURIComponent(versionId)}`;
}

/**
 * POST /api/telegram/setup
 * Saves bot token for a version and attempts Telegram setWebhook.
 * Body: { botToken, version_id, agent_id?, org_id? }
 *
 * NOTE: setWebhook requires a publicly reachable HTTPS URL.
 * Localhost will save the channel but webhook registration may fail until
 * TELEGRAM_WEBHOOK_BASE_URL points to a public tunnel (e.g. ngrok).
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

    const botId = extractBotId(botToken);
    const webhookUrl = buildWebhookUrl({ botId, versionId: version_id });
    const now = new Date();

    // 1) Persist channel details (one bot per version)
    const collection = await getChannelDetailsCollection();
    const channelDoc = {
      telegram: {
        botToken,
        botId,
        webhookUrl,
        webhookSet: false,
      },
      version_id,
      agent_id,
      org_id,
      updated_at: now,
    };

    await collection.updateOne(
      { version_id },
      {
        $set: channelDoc,
        $setOnInsert: { created_at: now },
      },
      { upsert: true }
    );

    // 2) Register Telegram webhook (may fail on localhost — keep flow clean)
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
      data: saved || channelDoc,
      webhook: {
        url: webhookUrl,
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
