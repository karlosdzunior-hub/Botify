import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, botsTable, generationsTable, transactionsTable } from "@workspace/db";
import { eq, count, sum, gte, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/admin/stats", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [totalUsersRow] = await db.select({ count: count() }).from(usersTable);
  const [activeUsersRow] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(gte(usersTable.updatedAt, thirtyDaysAgo));
  const [totalBotsRow] = await db.select({ count: count() }).from(botsTable);
  const [runningBotsRow] = await db
    .select({ count: count() })
    .from(botsTable)
    .where(eq(botsTable.status, "running"));
  const [totalGenRow] = await db.select({ count: count() }).from(generationsTable);
  const [totalRevenueRow] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(eq(transactionsTable.type, "purchase"));

  res.json({
    totalUsers: totalUsersRow?.count ?? 0,
    activeUsers: activeUsersRow?.count ?? 0,
    totalBots: totalBotsRow?.count ?? 0,
    runningBots: runningBotsRow?.count ?? 0,
    totalGenerations: totalGenRow?.count ?? 0,
    totalRevenue: Math.abs(Number(totalRevenueRow?.total ?? 0)),
  });
});

router.get("/admin/users", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const users = await db.select().from(usersTable).limit(100);
  res.json(
    users.map((u) => ({
      id: u.id,
      telegramId: u.telegramId,
      username: u.username,
      firstName: u.firstName,
      credits: u.credits,
      plan: u.plan,
      planExpiresAt: u.planExpiresAt,
      referralCode: u.referralCode,
      isBanned: u.isBanned,
      createdAt: u.createdAt,
    })),
  );
});

router.post("/admin/credits", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { userId, amount, reason } = req.body as { userId?: string; amount?: number; reason?: string };

  if (!userId || !amount) {
    res.status(400).json({ error: "userId and amount are required" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db
    .update(usersTable)
    .set({ credits: target.credits + amount })
    .where(eq(usersTable.id, userId));

  await db.insert(transactionsTable).values({
    id: randomUUID(),
    userId,
    amount,
    type: "bonus",
    description: reason ?? "Ручное начисление администратором",
  });

  res.json({ success: true, message: `Added ${amount} credits to user ${userId}` });
});

export default router;
