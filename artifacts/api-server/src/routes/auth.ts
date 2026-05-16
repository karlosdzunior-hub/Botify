import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyTelegramInitData, generateToken, generateReferralCode } from "../lib/auth";
import { logger } from "../lib/logger";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.post("/auth/telegram", async (req, res): Promise<void> => {
  const { initData, referralCode } = req.body as { initData?: string; referralCode?: string };

  let telegramUser: Record<string, string> | null = null;

  if (initData) {
    telegramUser = verifyTelegramInitData(initData);
  }

  if (!telegramUser && process.env.NODE_ENV !== "production") {
    telegramUser = {
      id: req.body.telegramId ?? "12345",
      username: req.body.username ?? "demo_user",
      first_name: req.body.firstName ?? "Demo",
    };
  }

  if (!telegramUser) {
    res.status(401).json({ error: "Invalid Telegram initData" });
    return;
  }

  const telegramId = String(telegramUser["id"]);

  let [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId));

  if (!user) {
    let referredBy: string | null = null;

    if (referralCode) {
      const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode));
      if (referrer) {
        referredBy = referrer.id;
        await db
          .update(usersTable)
          .set({ credits: referrer.credits + 10 })
          .where(eq(usersTable.id, referrer.id));
      }
    }

    const newId = randomUUID();
    [user] = await db
      .insert(usersTable)
      .values({
        id: newId,
        telegramId,
        username: telegramUser["username"] ?? null,
        firstName: telegramUser["first_name"] ?? null,
        lastName: telegramUser["last_name"] ?? null,
        credits: 30,
        plan: "free",
        referralCode: generateReferralCode(),
        referredBy,
      })
      .returning();

    req.log.info({ telegramId }, "New user registered");
  }

  if (user.isBanned) {
    res.status(403).json({ error: "Account banned" });
    return;
  }

  const token = generateToken(user.id);

  res.json({
    user: {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      credits: user.credits,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      referralCode: user.referralCode,
      isBanned: user.isBanned,
      createdAt: user.createdAt,
    },
    token,
  });
});

export default router;
