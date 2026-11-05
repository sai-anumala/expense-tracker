import { NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { MAX_DISMISSED_ALERTS, parseDismissInput, toSettingsDto, type SettingsLean } from "@/lib/settingsInput";
import { SettingsModel } from "@/models/Settings";

export const dynamic = "force-dynamic";

/**
 * POST { keys: string[] }: remembers reminders the user removed, across devices. Only the latest are kept: old keys
 * belong to past months and bills and can never match again. Returns the full settings DTO.
 */
export async function POST(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;
  const parsed = parseDismissInput(body);
  if (!parsed.ok) return fail(400, parsed.error);

  try {
    await connectDb();
    const doc = await SettingsModel.findOneAndUpdate(
      { key: user.userId },
      { $push: { dismissedAlerts: { $each: parsed.value, $slice: -MAX_DISMISSED_ALERTS } } },
      { upsert: true, new: true, runValidators: true },
    ).lean<SettingsLean>();
    return ok(toSettingsDto(doc));
  } catch (err) {
    return dbErrorResponse(err, "POST /api/settings/alerts", "Failed to save.");
  }
}
