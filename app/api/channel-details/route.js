import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getChannelDetailsCollection } from "@/lib/mongo";
import { encryptSecret, maskSecret } from "@/lib/crypto";

export const runtime = "nodejs";

function jsonError(message, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function sanitizeChannel(doc) {
  if (!doc) return doc;
  if (!doc.telegram) return doc;
  return {
    ...doc,
    telegram: {
      ...doc.telegram,
      botToken: maskSecret(doc.telegram.botToken),
    },
  };
}

/**
 * GET /api/channel-details?version_id=... | ?id=...
 * GET /api/channel-details  → list all
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get("version_id");
    const id = searchParams.get("id");
    const collection = await getChannelDetailsCollection();

    if (id) {
      if (!ObjectId.isValid(id)) return jsonError("Invalid id");
      const doc = await collection.findOne({ _id: new ObjectId(id) });
      return NextResponse.json({ success: true, data: sanitizeChannel(doc) });
    }

    if (versionId) {
      const doc = await collection.findOne({ version_id: versionId });
      return NextResponse.json({ success: true, data: sanitizeChannel(doc) });
    }

    const docs = await collection.find({}).sort({ updated_at: -1 }).limit(200).toArray();
    return NextResponse.json({ success: true, data: docs.map(sanitizeChannel) });
  } catch (error) {
    console.error("channel-details GET error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/channel-details
 * Body: { telegram: { botToken }, version_id, agent_id?, org_id? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const version_id = body?.version_id;
    const telegram = body?.telegram || {};

    if (!version_id) return jsonError("version_id is required");
    if (!telegram?.botToken) return jsonError("telegram.botToken is required");

    const collection = await getChannelDetailsCollection();
    const now = new Date();

    const doc = {
      telegram: {
        botToken: encryptSecret(telegram.botToken),
        webhookUrl: telegram.webhookUrl || null,
        webhookSet: Boolean(telegram.webhookSet),
      },
      version_id,
      agent_id: body?.agent_id || null,
      org_id: body?.org_id || process.env.ORG_ID || null,
      created_at: now,
      updated_at: now,
    };

    const { created_at, ...setFields } = doc;
    // Replacing whole `telegram` drops legacy botId — no $unset (conflicts with $set telegram)
    await collection.updateOne({ version_id }, { $set: setFields, $setOnInsert: { created_at } }, { upsert: true });

    const saved = await collection.findOne({ version_id });
    return NextResponse.json({ success: true, data: sanitizeChannel(saved || doc) });
  } catch (error) {
    console.error("channel-details POST error:", error);
    if (error?.code === 11000) {
      return jsonError("A channel already exists for this version_id", 409);
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/channel-details
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const collection = await getChannelDetailsCollection();
    const filter = body?.id
      ? ObjectId.isValid(body.id)
        ? { _id: new ObjectId(body.id) }
        : null
      : body?.version_id
        ? { version_id: body.version_id }
        : null;

    if (!filter) return jsonError("id or version_id is required");

    const update = { updated_at: new Date() };
    if (body.telegram) {
      const next = { ...body.telegram };
      delete next.botId;
      if (next.botToken) next.botToken = encryptSecret(next.botToken);
      update.telegram = next;
    }
    if (body.agent_id !== undefined) update.agent_id = body.agent_id;
    if (body.org_id !== undefined) update.org_id = body.org_id;

    const result = await collection.findOneAndUpdate(filter, { $set: update }, { returnDocument: "after" });
    const saved = result?.value || result;
    if (!saved) return jsonError("Channel not found", 404);
    return NextResponse.json({ success: true, data: sanitizeChannel(saved) });
  } catch (error) {
    console.error("channel-details PUT error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/channel-details?version_id=... | ?id=...
 */
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const versionId = searchParams.get("version_id");
    const id = searchParams.get("id");
    const collection = await getChannelDetailsCollection();

    let filter = null;
    if (id && ObjectId.isValid(id)) filter = { _id: new ObjectId(id) };
    else if (versionId) filter = { version_id: versionId };
    if (!filter) return jsonError("id or version_id is required");

    const result = await collection.deleteOne(filter);
    return NextResponse.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error("channel-details DELETE error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
