import { NextResponse } from "next/server";
import { connectDb, ensureIndexes } from "@/lib/db";
import { dbErrorResponse, fail, ok, readJsonObject, requireDb } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { toCustomCategoryDto } from "@/lib/categoryAccess";
import { MAX_CUSTOM_CATEGORIES, validateCategoryName } from "@/lib/categoryRules";
import { builtInCategoryByName } from "@/lib/data";
import { CustomCategoryModel } from "@/models/CustomCategory";

export const dynamic = "force-dynamic";

/** GET /api/categories: the signed-in user's own categories, A to Z. */
export async function GET() {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    await connectDb();
    const docs = await CustomCategoryModel.find({ userId: user.userId }).sort({ nameKey: 1 }).lean();
    return ok(docs.map(toCustomCategoryDto));
  } catch (err) {
    return dbErrorResponse(err, "GET /api/categories", "Failed to load categories.");
  }
}

/**
 * POST { name }: finds or creates a category and returns { category, custom? }. A name that matches a built-in
 * category or one the user already has reuses it, so duplicates can't appear.
 */
export async function POST(req: Request) {
  const noDb = requireDb();
  if (noDb) return noDb;
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const body = await readJsonObject(req);
  if (body instanceof NextResponse) return body;

  const parsed = validateCategoryName(body.name);
  if (!parsed.ok) return fail(400, parsed.error);
  const builtIn = builtInCategoryByName(parsed.name);
  if (builtIn) return ok({ category: builtIn });

  const reply = (doc: Parameters<typeof toCustomCategoryDto>[0], status?: number) => {
    const custom = toCustomCategoryDto(doc);
    return ok({ category: custom.id, custom }, status);
  };
  const owned = { userId: user.userId, nameKey: parsed.key };
  try {
    await connectDb();
    await ensureIndexes(CustomCategoryModel);
    const existing = await CustomCategoryModel.findOne(owned).lean();
    if (existing) return reply(existing);
    if ((await CustomCategoryModel.countDocuments({ userId: user.userId })) >= MAX_CUSTOM_CATEGORIES)
      return fail(400, `You can have up to ${MAX_CUSTOM_CATEGORIES} of your own categories. Delete one to add another.`);
    const doc = await CustomCategoryModel.create({ ...owned, name: parsed.name });
    return reply(doc.toObject(), 201);
  } catch (err) {
    // Two saves at the same moment: the unique index let one through, so use that one.
    if ((err as { code?: number }).code === 11000) {
      const winner = await CustomCategoryModel.findOne(owned).lean().catch(() => null);
      if (winner) return reply(winner);
    }
    return dbErrorResponse(err, "POST /api/categories", "Failed to save the category.");
  }
}
