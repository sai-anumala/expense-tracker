import mongoose, { type Model, type Schema } from "mongoose";

/**
 * Register a Mongoose model once per process, but re-register it in development.
 * `npm run dev` hot-reloads model files while Mongoose keeps the old compiled model in memory; with
 * `strict: "throw"` a new field then fails as "Request contains unknown fields" until a restart.
 * Deleting the cached model on reload (dev only) picks up schema changes immediately.
 */
export function defineModel<T>(name: string, schema: Schema): Model<T> {
  if (process.env.NODE_ENV !== "production" && mongoose.models[name]) mongoose.deleteModel(name);
  // Cast instead of passing <T> through mongoose.model(): the generic inference over Mongoose's
  // schema types is extremely expensive and made `tsc` run out of memory.
  return (mongoose.models[name] ?? mongoose.model(name, schema)) as unknown as Model<T>;
}
