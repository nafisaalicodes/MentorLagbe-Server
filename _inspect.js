import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);
await client.connect();
const db = client.db(process.env.DB_NAME || "MentorLagbe");

const users = await db
  .collection("users")
  .find({}, { projection: { email: 1, name: 1, role: 1 } })
  .toArray();
const byId = new Map(users.map((u) => [u._id.toString(), u]));

console.log("--- SESSIONS ---");
const sessions = await db.collection("session").find({}).toArray();
sessions.forEach((s) => {
  const u = byId.get(String(s.userId));
  console.log([
    s.token,
    "expires:",
    s.expiresAt.toISOString(),
    "user:",
    u ? `${u.email} (${u.role})` : String(s.userId),
  ].join(" | "));
});

await client.close();
