import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { transactionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

const CREDIT_PACKAGES = {
  starter: { credits: 100, price: 199, bonus: 0, name: "Старт 🌱" },
  basic: { credits: 300, price: 499, bonus: 30, name: "Базовый ⚡" },
  pro: { credits: 800, price: 1190, bonus: 100, name: "Про 🚀" },
  max: { credits: 2000, price: 2490, bonus: 300, name: "Макс 💎" },
};

const HOSTING_PLANS = {
  one: { price: 149, bots: 1, name: "Один бот" },
  three: { price: 349, bots: 3, name: "Три бота" },
  ten: { price: 899, bots: 10, name: "Десять ботов" },
  agency: { price: 1990, bots: 30, name: "Агентский" },
};

// ── YuMoney ────────────────────────────────────────────────────────────────

router.post("/payments/yumoney/create", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { packageId } = req.body as { packageId?: string };

  if (!packageId || !(packageId in CREDIT_PACKAGES)) {
    res.status(400).json({ error: "Invalid packageId" });
    return;
  }

  const pkg = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
  const shopId = process.env.YUMONEY_SHOP_ID;
  const secretKey = process.env.YUMONEY_SECRET_KEY;

  if (!shopId || !secretKey) {
    res.status(503).json({ error: "YuMoney not configured" });
    return;
  }

  const orderId = randomUUID();
  const returnUrl = process.env.MINI_APP_URL ?? "https://t.me";

  const body = {
    amount: { value: pkg.price.toFixed(2), currency: "RUB" },
    confirmation: { type: "redirect", return_url: returnUrl },
    description: `Bot Factory — ${pkg.name} (${pkg.credits + pkg.bonus} кредитов)`,
    metadata: { userId: req.userId!, packageId, orderId },
    capture: true,
  };

  try {
    const resp = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
        "Idempotence-Key": orderId,
      },
      body: JSON.stringify(body),
    });

    const data = (await resp.json()) as { id?: string; confirmation?: { confirmation_url?: string } };

    if (!resp.ok) {
      res.status(502).json({ error: "YuMoney API error" });
      return;
    }

    res.json({
      paymentId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url,
      orderId,
    });
  } catch {
    res.status(502).json({ error: "Payment service unavailable" });
  }
});

router.post("/payments/yumoney/webhook", async (req, res): Promise<void> => {
  const event = req.body as {
    event?: string;
    object?: {
      id?: string;
      status?: string;
      metadata?: { userId?: string; packageId?: string };
    };
  };

  if (event.event !== "payment.succeeded" || event.object?.status !== "succeeded") {
    res.sendStatus(200);
    return;
  }

  const { userId, packageId } = event.object?.metadata ?? {};
  if (!userId || !packageId || !(packageId in CREDIT_PACKAGES)) {
    res.sendStatus(400);
    return;
  }

  const pkg = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
  const totalCredits = pkg.credits + pkg.bonus;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.sendStatus(404);
    return;
  }

  await db.update(usersTable).set({ credits: user.credits + totalCredits }).where(eq(usersTable.id, userId));

  await db.insert(transactionsTable).values({
    id: randomUUID(),
    userId,
    amount: totalCredits,
    type: "purchase",
    description: `YuMoney: ${pkg.name} (${pkg.credits}${pkg.bonus > 0 ? `+${pkg.bonus}` : ""} кредитов)`,
  });

  res.sendStatus(200);
});

// ── Telegram Stars ─────────────────────────────────────────────────────────

router.post("/payments/stars/invoice", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { packageId } = req.body as { packageId?: string };

  if (!packageId || !(packageId in CREDIT_PACKAGES)) {
    res.status(400).json({ error: "Invalid packageId" });
    return;
  }

  const pkg = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
  const botToken = process.env.MAIN_BOT_TOKEN;

  if (!botToken) {
    res.status(503).json({ error: "Bot token not configured" });
    return;
  }

  // Stars price: ~1 Star ≈ 0.013$, 1$ ≈ 90₽ — so 199₽ ≈ ~17 Stars
  const starsPrice = Math.max(1, Math.round(pkg.price / 12));

  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Bot Factory — ${pkg.name}`,
        description: `${pkg.credits + pkg.bonus} кредитов для создания ботов`,
        payload: JSON.stringify({ userId: req.userId!, packageId }),
        currency: "XTR",
        prices: [{ label: pkg.name, amount: starsPrice }],
      }),
    });

    const data = (await resp.json()) as { ok?: boolean; result?: string };

    if (!data.ok) {
      res.status(502).json({ error: "Telegram API error" });
      return;
    }

    res.json({ invoiceLink: data.result, starsPrice });
  } catch {
    res.status(502).json({ error: "Payment service unavailable" });
  }
});

router.post("/payments/stars/webhook", async (req, res): Promise<void> => {
  const update = req.body as {
    pre_checkout_query?: { id?: string };
    message?: {
      successful_payment?: {
        invoice_payload?: string;
        telegram_payment_charge_id?: string;
      };
      from?: { id?: number };
    };
  };

  const botToken = process.env.MAIN_BOT_TOKEN;

  if (update.pre_checkout_query?.id && botToken) {
    await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true }),
    });
    res.sendStatus(200);
    return;
  }

  if (update.message?.successful_payment) {
    const payload = update.message.successful_payment.invoice_payload;
    try {
      const { userId, packageId } = JSON.parse(payload ?? "{}") as { userId?: string; packageId?: string };
      if (userId && packageId && packageId in CREDIT_PACKAGES) {
        const pkg = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
        const totalCredits = pkg.credits + pkg.bonus;
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
        if (user) {
          await db.update(usersTable).set({ credits: user.credits + totalCredits }).where(eq(usersTable.id, userId));
          await db.insert(transactionsTable).values({
            id: randomUUID(),
            userId,
            amount: totalCredits,
            type: "purchase",
            description: `Telegram Stars: ${pkg.name}`,
          });
        }
      }
    } catch {}
  }

  res.sendStatus(200);
});

// ── Hosting ────────────────────────────────────────────────────────────────

router.post("/payments/hosting/yumoney", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { planId } = req.body as { planId?: string };

  if (!planId || !(planId in HOSTING_PLANS)) {
    res.status(400).json({ error: "Invalid planId. Use: one, three, ten, agency" });
    return;
  }

  const plan = HOSTING_PLANS[planId as keyof typeof HOSTING_PLANS];
  const shopId = process.env.YUMONEY_SHOP_ID;
  const secretKey = process.env.YUMONEY_SECRET_KEY;

  if (!shopId || !secretKey) {
    res.status(503).json({ error: "YuMoney not configured" });
    return;
  }

  const orderId = randomUUID();
  const returnUrl = process.env.MINI_APP_URL ?? "https://t.me";

  const body = {
    amount: { value: plan.price.toFixed(2), currency: "RUB" },
    confirmation: { type: "redirect", return_url: returnUrl },
    description: `Bot Factory Хостинг — ${plan.name} (${plan.bots} ${plan.bots === 1 ? "бот" : "ботов"}/мес)`,
    metadata: { userId: req.userId!, type: "hosting", planId, orderId },
    capture: true,
  };

  try {
    const resp = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
        "Idempotence-Key": orderId,
      },
      body: JSON.stringify(body),
    });

    const data = (await resp.json()) as { id?: string; confirmation?: { confirmation_url?: string } };

    if (!resp.ok) {
      res.status(502).json({ error: "YuMoney API error" });
      return;
    }

    res.json({
      paymentId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url,
      plan: { id: planId, ...plan },
    });
  } catch {
    res.status(502).json({ error: "Payment service unavailable" });
  }
});

// ── Code Purchase ──────────────────────────────────────────────────────────

router.post("/payments/code/purchase", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { botId } = req.body as { botId?: string };

  if (!botId) {
    res.status(400).json({ error: "botId is required" });
    return;
  }

  const shopId = process.env.YUMONEY_SHOP_ID;
  const secretKey = process.env.YUMONEY_SECRET_KEY;

  if (!shopId || !secretKey) {
    res.status(503).json({ error: "YuMoney not configured" });
    return;
  }

  const orderId = randomUUID();
  const returnUrl = process.env.MINI_APP_URL ?? "https://t.me";

  const body = {
    amount: { value: "2990.00", currency: "RUB" },
    confirmation: { type: "redirect", return_url: returnUrl },
    description: "Bot Factory — Выкуп исходного кода бота",
    metadata: { userId: req.userId!, type: "code_purchase", botId, orderId },
    capture: true,
  };

  try {
    const resp = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64"),
        "Idempotence-Key": orderId,
      },
      body: JSON.stringify(body),
    });

    const data = (await resp.json()) as { id?: string; confirmation?: { confirmation_url?: string } };

    if (!resp.ok) {
      res.status(502).json({ error: "YuMoney API error" });
      return;
    }

    res.json({
      paymentId: data.id,
      confirmationUrl: data.confirmation?.confirmation_url,
    });
  } catch {
    res.status(502).json({ error: "Payment service unavailable" });
  }
});

export default router;
