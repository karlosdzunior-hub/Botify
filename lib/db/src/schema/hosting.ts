import { pgTable, text, integer, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hostingPlanEnum = pgEnum("hosting_plan", ["nano", "start", "pro", "business"]);
export const hostingStatusEnum = pgEnum("hosting_status", ["active", "expired", "cancelled", "pending"]);

export const hostingSubscriptionsTable = pgTable("hosting_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  botId: text("bot_id"),
  plan: hostingPlanEnum("plan").notNull(),
  status: hostingStatusEnum("status").notNull().default("pending"),
  ramGb: integer("ram_gb").notNull(),
  storageGb: integer("storage_gb").notNull(),
  maxBots: integer("max_bots").notNull(),
  priceRub: integer("price_rub").notNull(),
  paidUntil: timestamp("paid_until", { withTimezone: true }),
  yumonyLabel: text("yumoney_label"),
  autoRenew: boolean("auto_renew").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHostingSubscriptionSchema = createInsertSchema(hostingSubscriptionsTable).omit({ createdAt: true, updatedAt: true });
export type InsertHostingSubscription = z.infer<typeof insertHostingSubscriptionSchema>;
export type HostingSubscription = typeof hostingSubscriptionsTable.$inferSelect;
