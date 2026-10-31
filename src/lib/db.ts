import "server-only";
import mongoose from "mongoose";

export function isDbConfigured() {
  return Boolean(process.env.MONGODB_URI);
}

// Reuse one connection across hot reloads in dev and across requests in prod.
const globalForMongoose = globalThis as unknown as {
  mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
};
const cached = (globalForMongoose.mongoose ??= { conn: null, promise: null });

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local.");
  if (cached.conn) return cached.conn;

  cached.promise ??= mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || "ledgerly",
    bufferCommands: false,
    serverSelectionTimeoutMS: 8000,
  });
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // allow retry on next request
    throw err;
  }
  return cached.conn;
}
