import { NextResponse } from "next/server";
import { getChannelDetailsCollection } from "@/lib/mongo";
import { decryptSecret } from "@/lib/crypto";
import { TelegramStreamUpdater } from "@/lib/telegramStreamUpdater";

export const runtime = "nodejs";

const TELEGRAM_TEXT_LIMIT = 4096;
const DRAFT_CHUNK_THRESHOLD = Number(process.env.TELEGRAM_DRAFT_CHUNK_THRESHOLD) || 1000;

/** Draft/preview only — Telegram hard-caps a single message at 4096. */
function truncateTelegramText(text) {
  const t = String(text || "");
  if (t.length <= TELEGRAM_TEXT_LIMIT) return t;
  return `${t.slice(0, TELEGRAM_TEXT_LIMIT - 1)}…`;
}

/**
 * Split long text into Telegram-safe parts (≤4096), preferring line breaks.
 * Final replies must use this — truncate drops the rest of the answer.
 */
function splitTelegramText(text, limit = TELEGRAM_TEXT_LIMIT) {
  const t = String(text || "");
  if (!t) return [];
  if (t.length <= limit) return [t];

  const parts = [];
  let remaining = t;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < Math.floor(limit * 0.5)) cut = remaining.lastIndexOf(" ", limit);
    if (cut < Math.floor(limit * 0.5)) cut = limit;
    parts.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

/**
 * Strip model reasoning / task preamble from text before Telegram.
 */
function stripReasoning(text) {
  let t = String(text || "");
  if (!t.trim()) return "";

  // Drop leading "Task identified: …" block if present
  t = t.replace(/^\s*Task identified:\s*[\s\S]*?(?=\n\s*Reasoning:|\n\s*Answer:)/i, "");

  // Reasoning: ... Answer: <answer>
  const answerMatch = t.match(/(?:^|\n)\s*Answer:\s*([\s\S]*)$/i);
  if (/\bReasoning:\s*/i.test(t) && answerMatch) {
    t = answerMatch[1];
  } else {
    t = t.replace(/^\s*Reasoning:\s*[\s\S]*?(?=\n\s*Answer:|\n\s*\n|$)/i, "");
    t = t.replace(/^\s*Answer:\s*/i, "");
  }

  t = t
    .split("\n")
    .filter((line) => !/^\s*Reasoning:\s*/i.test(line) && !/^\s*Task identified:\s*/i.test(line))
    .join("\n");

  return t.trim();
}

function extractAssistantText(gtwyResponse) {
  // Prefer content only — never use data.reasoning
  return (
    gtwyResponse?.response?.data?.content ||
    gtwyResponse?.data?.content ||
    gtwyResponse?.content ||
    gtwyResponse?.response?.content ||
    (typeof gtwyResponse?.response === "string" ? gtwyResponse.response : null) ||
    null
  );
}

/**
 * Resolve image URLs from GTWY payloads.
 * Streaming done events expose image_urls under response.data.
 * History / API shapes may put llm_urls at the root.
 */
function resolveUrl(item) {
  if (!item) return null;
  if (typeof item === "string") return item;
  return item.permanent_url || item.image_url || item.url || null;
}

function collectUrlsFromList(list, into) {
  if (!Array.isArray(list)) return;
  for (const item of list) {
    const url = resolveUrl(item);
    if (url && !into.includes(url)) into.push(url);
  }
}

function extractImageUrls(parsed) {
  const urls = [];
  if (!parsed || typeof parsed !== "object") return urls;

  // Root-level llm_urls (history / metrics / some wrappers)
  collectUrlsFromList(parsed.llm_urls, urls);
  collectUrlsFromList(parsed.llm_url, urls); // singular, if ever used

  // Nested under response (SSE done.accumulated → payload.response)
  const response = parsed.response;
  if (response && typeof response === "object") {
    collectUrlsFromList(response.llm_urls, urls);
    collectUrlsFromList(response.llm_url, urls);
    collectUrlsFromList(response.data?.image_urls, urls);
    collectUrlsFromList(response.data?.llm_urls, urls);
    collectUrlsFromList(response.data?.images, urls);
  }

  // Direct data (non-stream body already unwrapped)
  collectUrlsFromList(parsed.data?.image_urls, urls);
  collectUrlsFromList(parsed.data?.llm_urls, urls);
  collectUrlsFromList(parsed.data?.images, urls);
  collectUrlsFromList(parsed.image_urls, urls);

  return urls;
}

async function telegramApi(botToken, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({}));
}

async function sendDraft(botToken, chatId, draftId, text) {
  return telegramApi(botToken, "sendMessageDraft", {
    chat_id: chatId,
    draft_id: draftId,
    text: truncateTelegramText(text ?? ""),
  });
}

async function sendMessage(botToken, chatId, text) {
  return telegramApi(botToken, "sendMessage", {
    chat_id: chatId,
    text: String(text || "…").slice(0, TELEGRAM_TEXT_LIMIT),
  });
}

/** Send full reply as one or more messages (no silent truncation). */
async function sendLongMessage(botToken, chatId, text) {
  const parts = splitTelegramText(text || "…");
  const results = [];
  for (const part of parts) {
    const sent = await sendMessage(botToken, chatId, part);
    if (!sent?.ok) {
      console.error("[tg] sendMessage part failed", {
        partLen: part.length,
        desc: sent?.description,
      });
    }
    results.push(sent);
  }
  return results;
}

async function sendPhoto(botToken, chatId, photoUrl, caption) {
  const body = {
    chat_id: chatId,
    photo: photoUrl,
  };
  // Caption max 1024 — don't put a long essay here
  if (caption) body.caption = String(caption).slice(0, 1024);
  return telegramApi(botToken, "sendPhoto", body);
}

/**
 * GTWY SSE — onDelta is sync (must not await Telegram).
 * Skips `reasoning` events. onStart keeps Thinking… alive (does not clear it).
 * Returns { text, images }.
 */
/** Pull a human-readable message from GTWY error payloads. */
function extractGtwyErrorMessage(data, status, rawText = "") {
  const pick = (v) => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v && typeof v === "object") {
      if (typeof v.message === "string" && v.message.trim()) return v.message.trim();
      if (typeof v.error === "string" && v.error.trim()) return v.error.trim();
      if (typeof v.detail === "string" && v.detail.trim()) return v.detail.trim();
    }
    return null;
  };

  const fromFields =
    pick(data?.error) ||
    pick(data?.message) ||
    pick(data?.detail) ||
    pick(data?.msg) ||
    pick(data?.fallback_error) ||
    pick(data?.data) ||
    (Array.isArray(data?.errors)
      ? data.errors
          .map((e) => pick(e) || String(e))
          .filter(Boolean)
          .join("; ")
      : null);

  if (fromFields) return fromFields;

  const raw = String(rawText || "").trim();
  if (raw && raw.length <= 800 && !raw.startsWith("{") && !raw.startsWith("<")) return raw;

  return `GTWY failed (${status})`;
}

async function streamGtwyCompletion({ versionId, userText, threadId, onDelta, onStart }) {
  const pythonUrl = (process.env.NEXT_PUBLIC_PYTHON_SERVER_URL || "").replace(/\/$/, "");
  const pauthkey = process.env.GTWY_PAUTH_KEY || process.env.ACCESS_KEY;
  if (!pythonUrl) throw new Error("NEXT_PUBLIC_PYTHON_SERVER_URL is not set");
  if (!pauthkey) throw new Error("GTWY_PAUTH_KEY is not set");

  const payload = {
    user: userText,
    version_id: versionId,
    response_type: "text",
    stream: true,
  };
  if (threadId) payload.thread_id = String(threadId);

  const response = await fetch(`${pythonUrl}/api/v2/model/chat/completion`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      pauthkey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }
    console.error("[tg] GTWY HTTP error", { status: response.status, body: rawText?.slice?.(0, 500) });
    throw new Error(extractGtwyErrorMessage(data, response.status, rawText));
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("event-stream") && !contentType.includes("stream")) {
    const data = await response.json().catch(() => ({}));
    const text = stripReasoning(extractAssistantText(data) || "");
    const images = extractImageUrls(data);
    onDelta?.(text);
    return { text, images };
  }

  if (!response.body) throw new Error("GTWY stream empty body");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sse = "";
  let full = "";
  let images = [];
  let deltas = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sse += decoder.decode(value, { stream: true });
    const lines = sse.split("\n");
    sse = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;

      let parsed;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        continue;
      }

      if (parsed.event === "start") {
        // Keep Thinking… visible — refresh empty draft, do NOT clear loader
        onStart?.();
        continue;
      }

      if (parsed.event === "reasoning") {
        // Never stream reasoning to Telegram (keeps Thinking… up)
        continue;
      }

      if (parsed.event === "delta") {
        const chunk = parsed.content || "";
        if (!chunk) continue;
        full += chunk;
        deltas += 1;
        const clean = stripReasoning(full);
        // Only forward when answer text exists — empty would blank the draft
        if (clean) onDelta?.(clean);
      } else if (parsed.event === "done") {
        const fromDone = extractAssistantText(parsed) || full;
        if (fromDone && fromDone.length > full.length) full = fromDone;
        const doneImages = extractImageUrls(parsed);
        if (doneImages.length) {
          images = doneImages;
          console.log("[tg] images from done", { count: doneImages.length, sample: doneImages[0]?.slice?.(0, 80) });
        }
      } else if (parsed.event === "error") {
        throw new Error(
          extractGtwyErrorMessage(parsed, "stream", "") || parsed.error || parsed.fallback_error || "GTWY stream error"
        );
      }
    }
  }

  const text = stripReasoning(full);
  console.log("[tg] GTWY done", { deltas, chars: text.length, images: images.length });
  return { text, images };
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
      console.error("[tg] missing version_id");
      return NextResponse.json({ ok: true, error: "missing_version_id" });
    }

    const collection = await getChannelDetailsCollection();
    const channel = await collection.findOne({ version_id: versionId });

    if (!channel?.telegram?.botToken || !channel?.version_id) {
      console.error("[tg] channel not found", { versionId });
      return NextResponse.json({ ok: true, error: "channel_not_found" });
    }

    const botToken = decryptSecret(channel.telegram.botToken);
    const threadId = `tg_${chatId}`;
    const draftId = Math.abs(Number(update?.update_id) || Date.now()) % 2147483646 || 1;

    console.log("[tg] HIT", { chatId, versionId, draftId, chunkThreshold: DRAFT_CHUNK_THRESHOLD });

    const probe = await sendDraft(botToken, chatId, draftId, "");
    if (!probe?.ok) {
      console.warn("[tg] sendMessageDraft unavailable:", probe?.description);
    } else {
      console.log("[tg] Thinking… draft ON (kept until first answer text)");
    }

    const streamer = new TelegramStreamUpdater({
      chunkThreshold: DRAFT_CHUNK_THRESHOLD,
      textLimit: TELEGRAM_TEXT_LIMIT,
      sendDraft: (text) => sendDraft(botToken, chatId, draftId, text),
    });

    let replyText = "";
    let images = [];
    try {
      const result = await streamGtwyCompletion({
        versionId: channel.version_id,
        userText,
        threadId,
        // Refresh Thinking… on start — do not clear the loader
        onStart: () => {
          if (probe?.ok) {
            sendDraft(botToken, chatId, draftId, "").catch(() => {});
          }
        },
        onDelta: (cleanText) => {
          if (probe?.ok) streamer.push(cleanText);
        },
      });
      replyText = result?.text || "";
      images = result?.images || [];
    } catch (err) {
      const errMsg = String(err?.message || err || "").trim();
      console.error("[tg] GTWY error", errMsg);
      // Prefer real GTWY error text; dummy only if nothing useful
      replyText = errMsg || "Sorry, something went wrong generating a response.";
    }

    const FALLBACK_MSG = "Sorry, I could not generate a response.";
    const finalText = stripReasoning(replyText || "").trim();
    const stats = probe?.ok
      ? await streamer.finish(finalText || (images.length ? " " : FALLBACK_MSG))
      : (streamer.stop(), { sentCount: 0, text: finalText });

    // Images → sendPhoto; long text goes as follow-up messages (split at 4096)
    if (images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        const photoRes = await sendPhoto(botToken, chatId, images[i], undefined);
        if (!photoRes?.ok) {
          console.error("[tg] sendPhoto failed", photoRes?.description);
          await sendMessage(botToken, chatId, images[i]);
        }
      }
      if (finalText) {
        await sendLongMessage(botToken, chatId, finalText);
      }
    } else {
      const parts = await sendLongMessage(botToken, chatId, finalText || FALLBACK_MSG);
      console.log("[tg] sent message parts", { count: parts.length });
    }

    console.log("[tg] done", {
      drafts: stats.sentCount,
      chars: finalText.length,
      parts: splitTelegramText(finalText || "…").length,
      images: images.length,
    });

    return NextResponse.json({
      ok: true,
      drafts: stats.sentCount,
      chars: finalText.length,
      images: images.length,
    });
  } catch (error) {
    console.error("[tg] FATAL", error);
    return NextResponse.json({ ok: true, error: error.message });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Telegram webhook — stream text (no reasoning), sendPhoto for images",
  });
}
