import { Router, type IRouter } from "express";
import { createHash } from "crypto";
import { db } from "@workspace/db";
import { transactionsTable, usersTable, botsTable, generationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { notifyUser } from "./telegram-bot-notify";
import { activateHostingSubscription } from "./hosting";

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

// ── ЮМани Quickpay helpers ─────────────────────────────────────────────────

function buildYooMoneyUrl(params: {
  wallet: string;
  amount: number;
  label: string;
  description: string;
  returnUrl: string;
}): string {
  const url = new URL("https://yoomoney.ru/quickpay/confirm.xml");
  url.searchParams.set("receiver", params.wallet);
  url.searchParams.set("quickpay-form", "shop");
  url.searchParams.set("targets", params.description);
  url.searchParams.set("paymentType", "AC");
  url.searchParams.set("sum", params.amount.toFixed(2));
  url.searchParams.set("label", params.label);
  url.searchParams.set("successURL", params.returnUrl);
  return url.toString();
}

function verifyYooMoneyNotification(body: Record<string, string>, secret: string): boolean {
  const fields = [
    body.notification_type,
    body.operation_id,
    body.amount,
    body.currency,
    body.datetime,
    body.sender,
    body.codepro,
    secret,
    body.label,
  ].join("&");
  const expected = createHash("sha1").update(fields).digest("hex");
  return expected === body.sha1_hash;
}

// ── Кредиты — ЮМани ────────────────────────────────────────────────────────

router.post("/payments/yumoney/create", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { packageId } = req.body as { packageId?: string };

  if (!packageId || !(packageId in CREDIT_PACKAGES)) {
    res.status(400).json({ error: "Invalid packageId" });
    return;
  }

  const pkg = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
  const wallet = process.env.YUMONEY_WALLET;

  if (!wallet) {
    res.status(503).json({ error: "ЮМани не настроен — добавьте YUMONEY_WALLET в .env" });
    return;
  }

  const orderId = randomUUID();
  const label = `credits:${req.userId!}:${packageId}:${orderId}`;
  const returnUrl = process.env.MINI_APP_URL ?? "https://t.me";

  const paymentUrl = buildYooMoneyUrl({
    wallet,
    amount: pkg.price,
    label,
    description: `Botify — ${pkg.name} (${pkg.credits + pkg.bonus} кредитов)`,
    returnUrl,
  });

  res.json({ paymentUrl, orderId, label });
});

// Вебхук от ЮМани — приходит когда платёж прошёл
router.post("/payments/yumoney/webhook", async (req, res): Promise<void> => {
  const body = req.body as Record<string, string>;
  const secret = process.env.YUMONEY_NOTIFICATION_SECRET ?? "";

  if (secret && !verifyYooMoneyNotification(body, secret)) {
    res.sendStatus(403);
    return;
  }

  const label = body.label ?? "";
  // label format: "credits:userId:packageId:orderId"
  const parts = label.split(":");

  if (parts[0] === "credits" && parts.length >= 3) {
    const [, userId, packageId] = parts;

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
      description: `ЮМани: ${pkg.name} (${pkg.credits}${pkg.bonus > 0 ? `+${pkg.bonus}` : ""} кредитов)`,
    });

    if (user.telegramId) {
      notifyUser(user.telegramId, `✅ Оплата прошла! Начислено <b>${totalCredits} кредитов</b>.\n\nТекущий баланс: ${user.credits + totalCredits} кр.`).catch(() => {});
    }
  }

  if (parts[0] === "hosting") {
    await activateHostingSubscription(label).catch(() => {});
  }

  if (parts[0] === "code" && parts.length >= 3) {
    const [, userId, botId] = parts;
    if (userId && botId) {
      const [gen] = await db.select().from(generationsTable).where(eq(generationsTable.botId, botId));
      if (gen?.generatedCode) {
        await db.update(botsTable).set({ codePurchased: true } as any).where(eq(botsTable.id, botId));
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
        if (user?.telegramId) {
          notifyUser(user.telegramId, `🎉 Оплата получена! Исходный код бота доступен для скачивания.`).catch(() => {});
        }
      }
    }
  }

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

  // Stars: ~1 Star ≈ 0.013$, 1$ ≈ 90₽ — 199₽ ≈ 17 Stars
  const starsPrice = Math.max(1, Math.round(pkg.price / 12));

  try {
    const resp = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Botify — ${pkg.name}`,
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
      successful_payment?: { invoice_payload?: string };
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

// ── Хостинг — ЮМани ────────────────────────────────────────────────────────

router.post("/payments/hosting/yumoney", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { planId } = req.body as { planId?: string };

  if (!planId || !(planId in HOSTING_PLANS)) {
    res.status(400).json({ error: "Invalid planId. Use: one, three, ten, agency" });
    return;
  }

  const plan = HOSTING_PLANS[planId as keyof typeof HOSTING_PLANS];
  const wallet = process.env.YUMONEY_WALLET;

  if (!wallet) {
    res.status(503).json({ error: "ЮМани не настроен — добавьте YUMONEY_WALLET в .env" });
    return;
  }

  const orderId = randomUUID();
  const label = `hosting:${req.userId!}:${planId}:${orderId}`;
  const returnUrl = process.env.MINI_APP_URL ?? "https://t.me";

  const paymentUrl = buildYooMoneyUrl({
    wallet,
    amount: plan.price,
    label,
    description: `Botify Хостинг — ${plan.name} (${plan.bots} ${plan.bots === 1 ? "бот" : "ботов"}/мес)`,
    returnUrl,
  });

  res.json({ paymentUrl, orderId, plan: { id: planId, ...plan } });
});

// ── Выкуп кода — ЮМани ─────────────────────────────────────────────────────

router.post("/payments/code/purchase", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { botId } = req.body as { botId?: string };

  if (!botId) {
    res.status(400).json({ error: "botId is required" });
    return;
  }

  const wallet = process.env.YUMONEY_WALLET;

  if (!wallet) {
    res.status(503).json({ error: "ЮМани не настроен — добавьте YUMONEY_WALLET в .env" });
    return;
  }

  const orderId = randomUUID();
  const label = `code:${req.userId!}:${botId}:${orderId}`;
  const returnUrl = process.env.MINI_APP_URL ?? "https://t.me";

  const paymentUrl = buildYooMoneyUrl({
    wallet,
    amount: 2990,
    label,
    description: "Botify — Выкуп исходного кода бота",
    returnUrl,
  });

  res.json({ paymentUrl, orderId });
});

export default router;
