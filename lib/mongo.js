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

export async function getDb() {
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
  await collection.createIndex({ "telegram.botId": 1 });
  return collection;
}
