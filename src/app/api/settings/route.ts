import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { MAX_AMOUNT, dbErrorResponse, fail, ok, readJsonObject, requireDb, toPaise } from "@/lib/api";
import { SettingsModel } from "@/models/Settings";

export const dynamic = "force-dynamic";


type Lean = { openingBalance?: number | null; balanceAsOf?: Date | null; updatedAt?: Date };

const toDto = (d: Lean | null) => {
  const openingBalance = d?.openingBalance ?? null;
  // Older docs have no balanceAsOf: the balance was entered when the doc was last saved.
  const asOf = openingBalance === null ? null : (d?.balanceAsOf ?? d?.updatedAt ?? null);
  return { openingBalance, balanceAsOf: asOf ? new Date(asOf).toISOString() : null };
};

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
    const doc = await SettingsModel.findOne({ key: user.userId }).lean<Lean>();
    return ok(toDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/settings", "Failed to load settings.");
  }
}

/**
 * PUT { openingBalance: number >= 0 | null }
 * Saving a balance re-anchors it to "now": only transactions dated at/after this minute affect it.
 */
export async function PUT(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
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
      { key: user.userId },
      {
        $set: {
          openingBalance: openingBalance === null ? null : toPaise(openingBalance),
          balanceAsOf: openingBalance === null ? null : nowToMinute(),
        },
      },
      { upsert: true, new: true, runValidators: true },
    ).lean<Lean>();
    return ok(toDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "PUT /api/settings", "Failed to save settings.");
  }
}
