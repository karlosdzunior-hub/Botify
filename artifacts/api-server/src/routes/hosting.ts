import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { hostingSubscriptionsTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { notifyUser } from "./telegram-bot-notify";
import { publishBotAfterPayment } from "./bots";

const router: IRouter = Router();

export const HOSTING_PLANS = {
  nano: {
    id: "nano",
    name: "Nano",
    ramGb: 1,
    storageGb: 10,
    maxBots: 1,
    priceRub: 149,
    description: "Для одного простого бота",
    color: "text-blue-400",
    emoji: "🪐",
  },
  start: {
    id: "start",
    name: "Start",
    ramGb: 1,
    storageGb: 20,
    maxBots: 3,
    priceRub: 299,
    description: "До 3 ботов",
    color: "text-green-400",
    emoji: "⚡",
    popular: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    ramGb: 2,
    storageGb: 40,
    maxBots: 10,
    priceRub: 599,
    description: "До 10 ботов",
    color: "text-yellow-400",
    emoji: "🚀",
  },
  business: {
    id: "business",
    name: "Business",
    ramGb: 4,
    storageGb: 80,
    maxBots: 30,
    priceRub: 1190,
    description: "До 30 ботов",
    color: "text-purple-400",
    emoji: "💎",
  },
} as const;

// GET /api/hosting/plans — список тарифов
router.get("/hosting/plans", (_req, res) => {
  res.json(Object.values(HOSTING_PLANS));
});

// GET /api/hosting/my — текущая подписка пользователя
router.get("/hosting/my", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const subs = await db
    .select()
    .from(hostingSubscriptionsTable)
    .where(eq(hostingSubscriptionsTable.userId, req.userId!));

  res.json(subs);
});

// POST /api/hosting/subscribe — оформить или продлить подписку
router.post("/hosting/subscribe", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { planId } = req.body as { planId?: string };

  if (!planId || !(planId in HOSTING_PLANS)) {
    res.status(400).json({ error: "Неверный тариф. Доступны: nano, start, pro, business" });
    return;
  }

  const plan = HOSTING_PLANS[planId as keyof typeof HOSTING_PLANS];
  const wallet = process.env.YUMONEY_WALLET;

  if (!wallet) {
    res.status(503).json({ error: "ЮМани не настроен" });
    return;
  }

  const orderId = randomUUID();
  const label = `hosting:${req.userId!}:${planId}:${orderId}`;
  const returnUrl = process.env.MINI_APP_URL ?? "https://t.me";

  const url = new URL("https://yoomoney.ru/quickpay/confirm.xml");
  url.searchParams.set("receiver", wallet);
  url.searchParams.set("quickpay-form", "shop");
  url.searchParams.set("targets", `Botify Хостинг ${plan.name} — ${plan.ramGb}GB RAM, ${plan.storageGb}GB SSD`);
  url.searchParams.set("paymentType", "AC");
  url.searchParams.set("sum", plan.priceRub.toFixed(2));
  url.searchParams.set("label", label);
  url.searchParams.set("successURL", returnUrl);

  // Создаём pending-запись в БД
  const subId = randomUUID();
  await db.insert(hostingSubscriptionsTable).values({
    id: subId,
    userId: req.userId!,
    plan: planId as any,
    status: "pending",
    ramGb: plan.ramGb,
    storageGb: plan.storageGb,
    maxBots: plan.maxBots,
    priceRub: plan.priceRub,
    yumonyLabel: label,
  });

  res.json({
    paymentUrl: url.toString(),
    subscriptionId: subId,
    plan,
    label,
  });
});

// POST /api/hosting/cancel — отмена подписки
router.post("/hosting/cancel", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { subscriptionId } = req.body as { subscriptionId?: string };

  if (!subscriptionId) {
    res.status(400).json({ error: "subscriptionId обязателен" });
    return;
  }

  const [sub] = await db
    .select()
    .from(hostingSubscriptionsTable)
    .where(
      and(
        eq(hostingSubscriptionsTable.id, subscriptionId),
        eq(hostingSubscriptionsTable.userId, req.userId!)
      )
    );

  if (!sub) {
    res.status(404).json({ error: "Подписка не найдена" });
    return;
  }

  await db
    .update(hostingSubscriptionsTable)
    .set({ status: "cancelled" })
    .where(eq(hostingSubscriptionsTable.id, subscriptionId));

  res.json({ success: true });
});

// Внутренняя функция — активировать подписку после оплаты (вызывается из payments.ts)
export async function activateHostingSubscription(label: string): Promise<void> {
  const [sub] = await db
    .select()
    .from(hostingSubscriptionsTable)
    .where(eq(hostingSubscriptionsTable.yumonyLabel, label));

  if (!sub || sub.status === "active") return;

  const paidUntil = new Date();
  paidUntil.setMonth(paidUntil.getMonth() + 1);

  await db
    .update(hostingSubscriptionsTable)
    .set({ status: "active", paidUntil })
    .where(eq(hostingSubscriptionsTable.id, sub.id));

  await db.insert(transactionsTable).values({
    id: randomUUID(),
    userId: sub.userId,
    amount: 0,
    type: "hosting",
    description: `Хостинг ${sub.plan.toUpperCase()} — ${sub.ramGb}GB RAM, ${sub.storageGb}GB SSD (до ${paidUntil.toLocaleDateString("ru")})`,
  });

  // If a specific bot was linked to this subscription, start it now
  if (sub.botId) {
    publishBotAfterPayment(sub.botId).catch((err) => {
      console.error("Failed to publish bot after payment:", err);
    });
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, sub.userId));
  if (user?.telegramId) {
    const plan = HOSTING_PLANS[sub.plan as keyof typeof HOSTING_PLANS];
    await notifyUser(
      user.telegramId,
      `✅ Хостинг <b>${plan.name}</b> активирован!\n\n🖥 ${plan.ramGb}GB RAM / ${plan.storageGb}GB SSD\n🤖 До ${plan.maxBots} ${plan.maxBots === 1 ? "бота" : "ботов"}\n📅 Оплачен до: ${paidUntil.toLocaleDateString("ru")}`
    );
  }
}

export default router;
