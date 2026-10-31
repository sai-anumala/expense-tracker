import mongoose from "mongoose";
import { connectDb, isDbConfigured } from "@/lib/db";
import { isAuthConfigured } from "@/lib/session";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /api/health — public liveness check. Reports status only, never internal error details. */
export async function GET() {
  const auth = isAuthConfigured() ? "configured" : "missing-secret";
  if (!isDbConfigured()) return NextResponse.json({ success: false, db: "not-configured", auth }, { status: 503 });
  try {
    await connectDb();
    await mongoose.connection.db?.admin().ping();
    return NextResponse.json({ success: true, db: "connected", auth });
  } catch (err) {
    console.error("GET /api/health", err);
    return NextResponse.json({ success: false, db: "error", auth }, { status: 503 });
  }
}
