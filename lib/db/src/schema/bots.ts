import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botsTable = sqliteTable("bots", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  botToken: text("bot_token"),
  botUsername: text("bot_username"),
  status: text("status", { enum: ["generating", "running", "stopped", "error"] }).notNull().default("generating"),
  botType: text("bot_type", { enum: ["simple", "complex", "miniapp"] }).notNull().default("simple"),
  generationId: text("generation_id"),
  pid: integer("pid"),
  dirPath: text("dir_path"),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export const insertBotSchema = createInsertSchema(botsTable).omit({ createdAt: true, updatedAt: true });
export type InsertBot = z.infer<typeof insertBotSchema>;
export type Bot = typeof botsTable.$inferSelect;
