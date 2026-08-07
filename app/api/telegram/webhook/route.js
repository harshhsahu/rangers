import { NextResponse } from "next/server";
import { getChannelDetailsCollection } from "@/lib/mongo";
import { decryptSecret } from "@/lib/crypto";

export const runtime = "nodejs";

const TELEGRAM_TEXT_LIMIT = 4096;

function truncateTelegramText(text) {
  const t = String(text || "");
  if (t.length <= TELEGRAM_TEXT_LIMIT) return t;
  return `${t.slice(0, TELEGRAM_TEXT_LIMIT - 1)}…`;
}

function extractAssistantText(gtwyResponse) {
  return (
    gtwyResponse?.response?.data?.content ||
    gtwyResponse?.data?.content ||
    gtwyResponse?.content ||
    gtwyResponse?.response?.content ||
    (typeof gtwyResponse?.response === "string" ? gtwyResponse.response : null) ||
    null
  );
}

async function telegramApi(botToken, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

async function sendChatAction({ botToken, chatId, action = "typing" }) {
  return telegramApi(botToken, "sendChatAction", { chat_id: chatId, action });
}

async function sendTelegramMessage({ botToken, chatId, text }) {
  return telegramApi(botToken, "sendMessage", {
    chat_id: chatId,
    text: truncateTelegramText(text || "…"),
  });
}

/**
 * Non-streaming GTWY call — just get the full completion, no SSE handling needed.
 */
async function getGtwyCompletion({ versionId, userText, threadId }) {
  const pythonUrl = (process.env.NEXT_PUBLIC_PYTHON_SERVER_URL || "").replace(/\/$/, "");
  const pauthkey = process.env.GTWY_PAUTH_KEY || process.env.ACCESS_KEY;

  if (!pythonUrl) throw new Error("NEXT_PUBLIC_PYTHON_SERVER_URL is not set");
  if (!pauthkey) throw new Error("GTWY_PAUTH_KEY is not set");

  const payload = {
    user: userText,
    version_id: versionId,
    response_type: "text",
    stream: false, // <-- key change: no SSE, just wait for the full response
  };
  if (threadId) payload.thread_id = String(threadId);

  const response = await fetch(`${pythonUrl}/api/v2/model/chat/completion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      pauthkey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("[telegram webhook] GTWY completion failed", { status: response.status, data });
    throw new Error(data?.error || data?.message || `GTWY completion failed (${response.status})`);
  }

  return extractAssistantText(data) || "";
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get("version_id");
    const update = await request.json().catch(() => ({}));

    const message = update?.message || update?.edited_message;
    const chatId = message?.chat?.id;
    const userText = message?.text;

    if (!userText || chatId == null) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    if (!versionId) {
      console.error("[telegram webhook] missing version_id");
      return NextResponse.json({ ok: true, error: "missing_version_id" });
    }

    const collection = await getChannelDetailsCollection();
    const channel = await collection.findOne({ version_id: versionId });

    if (!channel?.telegram?.botToken || !channel?.version_id) {
      console.error("[telegram webhook] channel not found", { versionId });
      return NextResponse.json({ ok: true, error: "channel_not_found" });
    }

    // botToken is AES-GCM encrypted at rest; legacy plaintext still decrypts as-is
    const botToken = decryptSecret(channel.telegram.botToken);
    const threadId = `tg_${chatId}`;

    // Show typing indicator (good UX, single call, no repeat risk)
    await sendChatAction({ botToken, chatId, action: "typing" });

    // Get the full response from GTWY (no streaming)
    let replyText;
    try {
      replyText = await getGtwyCompletion({ versionId: channel.version_id, userText, threadId });
    } catch (err) {
      console.error("[telegram webhook] GTWY error", err);
      replyText = "Sorry, something went wrong generating a response.";
    }

    // Send exactly ONE message back
    const sent = await sendTelegramMessage({
      botToken,
      chatId,
      text: replyText || "Sorry, I could not generate a response.",
    });

    if (!sent?.ok) {
      console.error("[telegram webhook] sendMessage failed", sent);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[telegram webhook] error:", error);
    return NextResponse.json({ ok: true, error: error.message });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Telegram webhook endpoint (single-reply). Use POST from Telegram.",
  });
}
