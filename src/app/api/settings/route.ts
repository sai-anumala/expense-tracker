import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { MAX_AMOUNT, dbErrorResponse, fail, ok, readJsonObject, requireDb, toPaise } from "@/lib/api";
import { SettingsModel } from "@/models/Settings";

export const dynamic = "force-dynamic";

const KEY = "default";

type Lean = { openingBalance?: number | null };
const toDto = (d: Lean | null) => ({ openingBalance: d?.openingBalance ?? null });

export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  try {
    await connectDb();
    const doc = await SettingsModel.findOne({ key: KEY }).lean<Lean>();
    return ok(toDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/settings", "Failed to load settings.");
  }
}

/** PUT { openingBalance: number >= 0 | null } */
export async function PUT(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  if (!("openingBalance" in body)) return fail(400, "openingBalance is required.");

  const raw = body.openingBalance;
  const openingBalance = raw === null ? null : Number(raw);
  if (openingBalance !== null) {
    if (!Number.isFinite(openingBalance) || openingBalance < 0) return fail(400, "Opening balance must be 0 or more.");
    if (openingBalance > MAX_AMOUNT) return fail(400, "Opening balance is too large.");
  }

  try {
    await connectDb();
    const doc = await SettingsModel.findOneAndUpdate(
      { key: KEY },
      { $set: { openingBalance: openingBalance === null ? null : toPaise(openingBalance) } },
      { upsert: true, new: true, runValidators: true },
    ).lean<Lean>();
    return ok(toDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "PUT /api/settings", "Failed to save settings.");
  }
}
