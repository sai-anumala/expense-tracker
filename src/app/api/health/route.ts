import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/health — quick check that MongoDB is reachable. */
export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ success: false, db: "not-configured" }, { status: 503 });
  }
  try {
    await connectDb();
    await mongoose.connection.db?.admin().ping();
    return NextResponse.json({ success: true, db: "connected", name: mongoose.connection.name });
  } catch (err) {
    return NextResponse.json(
      { success: false, db: "error", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
