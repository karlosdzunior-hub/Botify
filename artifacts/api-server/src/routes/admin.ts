import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, botsTable, generationsTable, transactionsTable } from "@workspace/db";
import { eq, count, sum, gte, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const ADMIN_IDS = (process.env.ADMIN_USER_IDS ?? process.env.ADMIN_USER_ID ?? "12345")
  .split(",")
  .map((s) => s.trim());

async function isAdmin(userId: string): Promise<boolean> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return user ? ADMIN_IDS.includes(user.telegramId) : false;
}

router.get("/admin/stats", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

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
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(200);

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
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

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

  res.json({ success: true, message: `Начислено ${amount} кредитов пользователю ${userId}` });
});

router.post("/admin/ban", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { userId, banned = true } = req.body as { userId?: string; banned?: boolean };

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.update(usersTable).set({ isBanned: banned }).where(eq(usersTable.id, userId));

  res.json({
    success: true,
    message: banned ? `Пользователь ${userId} заблокирован` : `Пользователь ${userId} разблокирован`,
  });
});

router.post("/admin/broadcast", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { message } = req.body as { message?: string };

  if (!message || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const botToken = process.env.MAIN_BOT_TOKEN;
  if (!botToken) {
    res.status(503).json({ error: "Bot token not configured" });
    return;
  }

  const users = await db.select({ telegramId: usersTable.telegramId }).from(usersTable).where(eq(usersTable.isBanned, false));

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: user.telegramId,
          text: message,
          parse_mode: "HTML",
        }),
      });
      if (resp.ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }

  res.json({ success: true, sent, failed, total: users.length });
});

router.get("/admin/bots", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  if (!(await isAdmin(req.userId!))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const bots = await db
    .select({
      id: botsTable.id,
      name: botsTable.name,
      status: botsTable.status,
      botType: botsTable.botType,
      userId: botsTable.userId,
      createdAt: botsTable.createdAt,
      lastActiveAt: botsTable.lastActiveAt,
    })
    .from(botsTable)
    .orderBy(desc(botsTable.createdAt))
    .limit(500);

  res.json(bots);
});

export default router;
