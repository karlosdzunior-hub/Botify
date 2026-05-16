import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, transactionsTable } from "@workspace/db";
import { eq, sum, count, and } from "drizzle-orm";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/referral", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [referralsCountRow] = await db
    .select({ count: count() })
    .from(usersTable)
    .where(eq(usersTable.referredBy, user.id));

  const [totalEarnedRow] = await db
    .select({ total: sum(transactionsTable.amount) })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.userId, req.userId!), eq(transactionsTable.type, "referral")));

  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "https://t.me/BotFactoryBot";

  res.json({
    referralCode: user.referralCode,
    referralLink: `${baseUrl}?start=${user.referralCode}`,
    referralsCount: referralsCountRow?.count ?? 0,
    totalEarned: Number(totalEarnedRow?.total ?? 0),
  });
});

export default router;
