import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hostingSubscriptionsTable = sqliteTable("hosting_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  botId: text("bot_id"),
  plan: text("plan", { enum: ["nano", "start", "pro", "business"] }).notNull(),
  status: text("status", { enum: ["active", "expired", "cancelled", "pending"] }).notNull().default("pending"),
  ramGb: integer("ram_gb").notNull(),
  storageGb: integer("storage_gb").notNull(),
  maxBots: integer("max_bots").notNull(),
  priceRub: integer("price_rub").notNull(),
  paidUntil: integer("paid_until", { mode: "timestamp" }),
  yumonyLabel: text("yumoney_label"),
  autoRenew: integer("auto_renew", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`).$onUpdate(() => new Date()),
});

export const insertHostingSubscriptionSchema = createInsertSchema(hostingSubscriptionsTable).omit({ createdAt: true, updatedAt: true });
export type InsertHostingSubscription = z.infer<typeof insertHostingSubscriptionSchema>;
export type HostingSubscription = typeof hostingSubscriptionsTable.$inferSelect;
