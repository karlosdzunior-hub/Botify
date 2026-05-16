import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const botStatusEnum = pgEnum("bot_status", ["generating", "running", "stopped", "error"]);
export const botTypeEnum = pgEnum("bot_type", ["simple", "complex", "miniapp"]);

export const botsTable = pgTable("bots", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  botToken: text("bot_token"),
  botUsername: text("bot_username"),
  status: botStatusEnum("status").notNull().default("generating"),
  botType: botTypeEnum("bot_type").notNull().default("simple"),
  generationId: text("generation_id"),
  pid: integer("pid"),
  dirPath: text("dir_path"),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBotSchema = createInsertSchema(botsTable).omit({ createdAt: true, updatedAt: true });
export type InsertBot = z.infer<typeof insertBotSchema>;
export type Bot = typeof botsTable.$inferSelect;
