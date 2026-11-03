import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { parseBalanceInput, toSettingsDto, type SettingsLean } from "@/lib/settingsInput";
import { SettingsModel } from "@/models/Settings";

export const dynamic = "force-dynamic";

/** Now, truncated to the minute, so a transaction picked for the same minute counts (≥ rule). */
function nowToMinute() {
  const d = new Date();
  d.setSeconds(0, 0);
  return d;
}

export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    await connectDb();
    const doc = await SettingsModel.findOne({ key: user.userId }).lean<SettingsLean>();
    return ok(toSettingsDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/settings", "Failed to load settings.");
  }
}

/**
 * PUT { openingBalance: number >= 0 | null, cardDueAtAnchor?: number >= 0 }
 * Saving a balance re-anchors it (and the unpaid card amount, default 0) to "now": only transactions dated
 * at/after this minute affect them. Card setup is saved separately via PUT /api/settings/card.
 */
export async function PUT(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const parsed = parseBalanceInput(body);
  if (!parsed.ok) return fail(400, parsed.error);
  const { openingBalance, cardDueAtAnchor } = parsed.value;

  try {
    await connectDb();
    const doc = await SettingsModel.findOneAndUpdate(
      { key: user.userId },
      { $set: { openingBalance, cardDueAtAnchor, balanceAsOf: openingBalance === null ? null : nowToMinute() } },
      { upsert: true, new: true, runValidators: true },
    ).lean<SettingsLean>();
    return ok(toSettingsDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "PUT /api/settings", "Failed to save settings.");
  }
}
