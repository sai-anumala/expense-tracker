import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { parseCardInput, toSettingsDto, type SettingsLean } from "@/lib/settingsInput";
import { SettingsModel } from "@/models/Settings";

export const dynamic = "force-dynamic";

/**
 * PUT { statementDay 1–28, dueDay 1–28, limit? > 0 } sets up / edits the user's credit card;
 * PUT { card: null } removes it. Does NOT touch the balance or its anchor. Returns the full settings DTO.
 */
export async function PUT(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const parsed = parseCardInput(body);
  if (!parsed.ok) return fail(400, parsed.error);

  try {
    await connectDb();
    const doc = await SettingsModel.findOneAndUpdate(
      { key: user.userId },
      { $set: { card: parsed.value } },
      { upsert: true, new: true, runValidators: true },
    ).lean<SettingsLean>();
    return ok(toSettingsDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "PUT /api/settings/card", "Failed to save the card.");
  }
}
