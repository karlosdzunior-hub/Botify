import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketplaceTable = sqliteTable("marketplace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  botType: text("bot_type", { enum: ["simple", "complex", "miniapp"] }).notNull().default("simple"),
  price: integer("price").notNull().default(10),
  authorId: text("author_id"),
  authorUsername: text("author_username"),
  deployCount: integer("deploy_count").notNull().default(0),
  rating: real("rating"),
  codeSnapshot: text("code_snapshot"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const insertMarketplaceSchema = createInsertSchema(marketplaceTable).omit({ createdAt: true });
export type InsertMarketplace = z.infer<typeof insertMarketplaceSchema>;
export type MarketplaceTemplate = typeof marketplaceTable.$inferSelect;
