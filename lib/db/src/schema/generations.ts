import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const generationsTable = sqliteTable("generations", {
  id: text("id").primaryKey(),
  botId: text("bot_id").notNull(),
  userId: text("user_id").notNull(),
  status: text("status", { enum: ["pending", "in_progress", "done", "failed"] }).notNull().default("pending"),
  steps: text("steps", { mode: "json" }).notNull().default("[]"),
  creditsUsed: integer("credits_used").notNull().default(0),
  elapsedSeconds: integer("elapsed_seconds"),
  errorMessage: text("error_message"),
  generatedCode: text("generated_code"),
  fixAttempts: integer("fix_attempts").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({ createdAt: true, updatedAt: true });
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;
