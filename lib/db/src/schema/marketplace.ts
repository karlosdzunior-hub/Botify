import { pgTable, text, integer, timestamp, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketplaceBotTypeEnum = pgEnum("marketplace_bot_type", ["simple", "complex", "miniapp"]);

export const marketplaceTable = pgTable("marketplace", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  botType: marketplaceBotTypeEnum("bot_type").notNull().default("simple"),
  price: integer("price").notNull().default(10),
  authorId: text("author_id"),
  authorUsername: text("author_username"),
  deployCount: integer("deploy_count").notNull().default(0),
  rating: real("rating"),
  codeSnapshot: text("code_snapshot"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketplaceSchema = createInsertSchema(marketplaceTable).omit({ createdAt: true });
export type InsertMarketplace = z.infer<typeof insertMarketplaceSchema>;
export type MarketplaceTemplate = typeof marketplaceTable.$inferSelect;
