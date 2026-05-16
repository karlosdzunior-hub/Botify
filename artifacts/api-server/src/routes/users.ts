import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, botsTable, generationsTable, transactionsTable } from "@workspace/db";
import { eq, count, sum, and } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/users/me", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    credits: user.credits,
    plan: user.plan,
    planExpiresAt: user.planExpiresAt,
    referralCode: user.referralCode,
    isBanned: user.isBanned,
    createdAt: user.createdAt,
  });
});

router.get("/users/stats", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const userId = req.userId!;

  const [botsCountRow] = await db
    .select({ count: count() })
    .from(botsTable)
    .where(eq(botsTable.userId, userId));

  const [runningBotsRow] = await db
    .select({ count: count() })
    .from(botsTable)
    .where(and(eq(botsTable.userId, userId), eq(botsTable.status, "running")));

  const [generationsCountRow] = await db
    .select({ count: count() })
    .from(generationsTable)
    .where(eq(generationsTable.userId, userId));

  const [creditsSpentRow] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, userId), eq(transactionsTable.type, "generation")));

  res.json({
    botsCount: botsCountRow?.count ?? 0,
    botsRunning: runningBotsRow?.count ?? 0,
    totalGenerations: generationsCountRow?.count ?? 0,
    creditsSpent: Math.abs(Number(creditsSpentRow?.total ?? 0)),
  });
});

export default router;
