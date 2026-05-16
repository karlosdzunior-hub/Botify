import { pgTable, text, integer, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const generationStatusEnum = pgEnum("generation_status", ["pending", "in_progress", "done", "failed"]);

export const generationsTable = pgTable("generations", {
  id: text("id").primaryKey(),
  botId: text("bot_id").notNull(),
  userId: text("user_id").notNull(),
  status: generationStatusEnum("status").notNull().default("pending"),
  steps: jsonb("steps").notNull().default([]),
  creditsUsed: integer("credits_used").notNull().default(0),
  elapsedSeconds: integer("elapsed_seconds"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({ createdAt: true, updatedAt: true });
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;
