import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise;

if (!uri) {
  console.warn("MONGODB_URI is not set — channel APIs will fail until it is configured.");
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClientPromise && uri) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else if (uri) {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

async function getDb() {
  if (!clientPromise) {
    throw new Error("MongoDB is not configured. Set MONGODB_URI in .env");
  }
  const connected = await clientPromise;
  return connected.db();
}

export async function getChannelDetailsCollection() {
  const db = await getDb();
  const collection = db.collection("channeldetails");
  await collection.createIndex({ version_id: 1 }, { unique: true });
  return collection;
}

/**
 * Scheduled ranger runs. Schedules live here rather than on the bridge version
 * because they hold a run token and an EasyCron job id, are looked up by the
 * public run endpoint (which has no session), and must outlive version
 * publishes. `_id` is the id carried in the run URL.
 */
export async function getRangerSchedulesCollection() {
  const db = await getDb();
  const collection = db.collection("rangerschedules");
  await collection.createIndex({ version_id: 1 });
  await collection.createIndex({ org_id: 1 });
  // Sparse: a row exists briefly before its EasyCron job does.
  await collection.createIndex({ easycron_id: 1 }, { unique: true, sparse: true });
  return collection;
}

/** viaSocket action tools. script_id stays here and is never sent to the browser. */
export async function getViaSocketToolsCollection() {
  const db = await getDb();
  const collection = db.collection("viasockettools");
  await collection.createIndex({ org_id: 1, action_version_id: 1 });
  return collection;
}

/**
 * One row per agent and viaSocket app: every action of that app behind one tool.
 * `_id` is in the run URL GTWY calls; `run_key` is the header it must send.
 * script_id and embed_token never leave the server.
 */
export async function getViaSocketAppToolsCollection() {
  const db = await getDb();
  const collection = db.collection("viasocketapptools");
  await collection.createIndex({ agent_id: 1, service_id: 1 }, { unique: true });
  await collection.createIndex({ version_ids: 1 });
  await collection.createIndex({ org_id: 1 });
  return collection;
}
