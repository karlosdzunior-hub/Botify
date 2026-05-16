import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const CREDIT_PACKAGES = {
  starter: { credits: 100, price: 199, bonus: 0, name: "Старт" },
  basic: { credits: 300, price: 499, bonus: 30, name: "Базовый" },
  pro: { credits: 800, price: 1190, bonus: 100, name: "Про" },
  max: { credits: 2000, price: 2490, bonus: 300, name: "Макс" },
};

router.get("/transactions", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const txns = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, req.userId!))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(50);

  res.json(
    txns.map((t) => ({
      id: t.id,
      userId: t.userId,
      amount: t.amount,
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
    })),
  );
});

router.post("/credits/purchase", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { packageId } = req.body as { packageId?: string };

  if (!packageId || !(packageId in CREDIT_PACKAGES)) {
    res.status(400).json({ error: "Invalid packageId. Use: starter, basic, pro, max" });
    return;
  }

  const pkg = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
  const totalCredits = pkg.credits + pkg.bonus;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const newBalance = user.credits + totalCredits;

  await db.update(usersTable).set({ credits: newBalance }).where(eq(usersTable.id, req.userId!));

  const txnId = randomUUID();
  await db.insert(transactionsTable).values({
    id: txnId,
    userId: req.userId!,
    amount: totalCredits,
    type: "purchase",
    description: `Пополнение: пакет «${pkg.name}» (${pkg.credits}${pkg.bonus > 0 ? `+${pkg.bonus}` : ""} кредитов)`,
  });

  res.json({
    success: true,
    creditsAdded: totalCredits,
    newBalance,
    transactionId: txnId,
  });
});

export default router;
