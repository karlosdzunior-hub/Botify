import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { botsTable, generationsTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { encryptToken, decryptToken, isEncrypted } from "../lib/crypto";

const router: IRouter = Router();

const CREDIT_COSTS = {
  simple: 15,
  complex: 35,
  miniapp: 70,
};

const IMPROVE_COST = 12;

function maskToken(token: string): string {
  if (!token || token.length < 8) return "****";
  const raw = isEncrypted(token) ? decryptToken(token) : token;
  return "****" + raw.slice(-4);
}

function botToResponse(bot: typeof botsTable.$inferSelect) {
  return {
    id: bot.id,
    userId: bot.userId,
    name: bot.name,
    description: bot.description,
    botToken: bot.botToken ? maskToken(bot.botToken) : null,
    botUsername: bot.botUsername,
    status: bot.status,
    botType: bot.botType,
    generationId: bot.generationId,
    lastActiveAt: bot.lastActiveAt,
    createdAt: bot.createdAt,
  };
}

router.get("/bots", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const bots = await db
    .select()
    .from(botsTable)
    .where(eq(botsTable.userId, req.userId!))
    .orderBy(desc(botsTable.createdAt));
  res.json(bots.map(botToResponse));
});

router.post("/bots", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { name, description, botToken } = req.body as {
    name?: string;
    description?: string;
    botToken?: string;
  };

  if (!name || !description) {
    res.status(400).json({ error: "name and description are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const botType =
    description.toLowerCase().includes("miniapp") || description.toLowerCase().includes("мини-апп")
      ? "miniapp"
      : description.length > 200
        ? "complex"
        : "simple";

  const cost = CREDIT_COSTS[botType];

  if (user.credits < cost) {
    res.status(402).json({ error: `Insufficient credits. Need ${cost}, have ${user.credits}` });
    return;
  }

  // Validate and encrypt bot token if provided
  let encryptedToken: string | null = null;
  if (botToken && botToken.trim()) {
    const trimmed = botToken.trim();
    // Basic Telegram bot token format validation: numbers:alphanumeric
    if (!/^\d+:[A-Za-z0-9_-]{35,}$/.test(trimmed)) {
      res.status(400).json({ error: "Invalid bot token format. Get it from @BotFather" });
      return;
    }
    encryptedToken = encryptToken(trimmed);
  }

  const botId = randomUUID();
  const generationId = randomUUID();

  const initialSteps = [
    { key: "analyze", label: "Анализирую запрос", status: "in_progress" },
    { key: "plan", label: "Составляю план", status: "pending" },
    { key: "token", label: "Проверяю токен", status: "pending" },
    { key: "generate", label: "Генерирую код", status: "pending" },
    { key: "check", label: "Проверяю ошибки", status: "pending" },
    { key: "launch", label: "Запускаю бота", status: "pending" },
  ];

  const [bot] = await db
    .insert(botsTable)
    .values({
      id: botId,
      userId: req.userId!,
      name,
      description,
      botToken: encryptedToken,
      status: "generating",
      botType,
      generationId,
    })
    .returning();

  await db.insert(generationsTable).values({
    id: generationId,
    botId,
    userId: req.userId!,
    status: "in_progress",
    steps: initialSteps,
    creditsUsed: 0,
  });

  await db
    .update(usersTable)
    .set({ credits: user.credits - cost })
    .where(eq(usersTable.id, req.userId!));

  await db.insert(transactionsTable).values({
    id: randomUUID(),
    userId: req.userId!,
    amount: -cost,
    type: "generation",
    description: `Создание бота: ${name} (${botType})`,
  });

  simulateGeneration(generationId, botId, cost, !!encryptedToken).catch(() => {});

  res.status(201).json(botToResponse(bot));
});

async function simulateGeneration(generationId: string, botId: string, cost: number, hasToken: boolean) {
  const steps = [
    { key: "analyze", label: "Анализирую запрос", delay: 3000 },
    { key: "plan", label: "Составляю план", delay: 5000 },
    { key: "token", label: "Проверяю токен", delay: hasToken ? 2000 : 1000 },
    { key: "generate", label: "Генерирую код", delay: 8000 },
    { key: "check", label: "Проверяю ошибки", delay: 5000 },
    { key: "launch", label: "Запускаю бота", delay: 3000 },
  ];

  let elapsed = 0;

  for (let i = 0; i < steps.length; i++) {
    await new Promise((r) => setTimeout(r, steps[i].delay));
    elapsed += Math.round(steps[i].delay / 1000);

    const updatedSteps = steps.map((s, idx) => ({
      key: s.key,
      label: s.label,
      status: idx < i ? "done" : idx === i ? "in_progress" : "pending",
    }));

    if (i === steps.length - 1) {
      updatedSteps[i].status = "done";
    }

    await db
      .update(generationsTable)
      .set({ steps: updatedSteps, elapsedSeconds: elapsed })
      .where(eq(generationsTable.id, generationId));
  }

  const finalSteps = steps.map((s) => ({ key: s.key, label: s.label, status: "done" }));

  await db
    .update(generationsTable)
    .set({ status: "done", steps: finalSteps, creditsUsed: cost, elapsedSeconds: elapsed })
    .where(eq(generationsTable.id, generationId));

  await db
    .update(botsTable)
    .set({ status: "running", lastActiveAt: new Date() })
    .where(eq(botsTable.id, botId));
}

router.get("/bots/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, id), eq(botsTable.userId, req.userId!)));

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  res.json(botToResponse(bot));
});

router.patch("/bots/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { improvement } = req.body as { improvement?: string };

  const [existing] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, id), eq(botsTable.userId, req.userId!)));

  if (!existing) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  // Deduct credits for improvement
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (improvement && user.credits < IMPROVE_COST) {
    res.status(402).json({ error: `Insufficient credits. Need ${IMPROVE_COST}, have ${user.credits}` });
    return;
  }

  if (improvement) {
    await db
      .update(usersTable)
      .set({ credits: user.credits - IMPROVE_COST })
      .where(eq(usersTable.id, req.userId!));

    await db.insert(transactionsTable).values({
      id: randomUUID(),
      userId: req.userId!,
      amount: -IMPROVE_COST,
      type: "generation",
      description: `Улучшение бота: ${existing.name}`,
    });
  }

  const [updated] = await db
    .update(botsTable)
    .set({
      description: improvement ? `${existing.description}\n\nУлучшение: ${improvement}` : existing.description,
      status: improvement ? "generating" : existing.status,
    })
    .where(eq(botsTable.id, id))
    .returning();

  if (improvement) {
    // Simulate re-generation for the improvement
    const genId = randomUUID();
    await db.insert(generationsTable).values({
      id: genId,
      botId: id,
      userId: req.userId!,
      status: "in_progress",
      steps: [
        { key: "analyze", label: "Анализирую изменения", status: "in_progress" },
        { key: "generate", label: "Вношу изменения", status: "pending" },
        { key: "check", label: "Проверяю ошибки", status: "pending" },
        { key: "launch", label: "Перезапускаю бота", status: "pending" },
      ],
      creditsUsed: 0,
    });

    await db.update(botsTable).set({ generationId: genId }).where(eq(botsTable.id, id));

    simulateImprovement(genId, id, IMPROVE_COST).catch(() => {});
  }

  res.json(botToResponse(updated));
});

async function simulateImprovement(generationId: string, botId: string, cost: number) {
  const steps = [
    { key: "analyze", label: "Анализирую изменения", delay: 2000 },
    { key: "generate", label: "Вношу изменения", delay: 6000 },
    { key: "check", label: "Проверяю ошибки", delay: 3000 },
    { key: "launch", label: "Перезапускаю бота", delay: 2000 },
  ];

  let elapsed = 0;
  for (let i = 0; i < steps.length; i++) {
    await new Promise((r) => setTimeout(r, steps[i].delay));
    elapsed += Math.round(steps[i].delay / 1000);

    const updatedSteps = steps.map((s, idx) => ({
      key: s.key,
      label: s.label,
      status: idx < i ? "done" : idx === i ? "in_progress" : "pending",
    }));

    if (i === steps.length - 1) updatedSteps[i].status = "done";

    await db
      .update(generationsTable)
      .set({ steps: updatedSteps, elapsedSeconds: elapsed })
      .where(eq(generationsTable.id, generationId));
  }

  const finalSteps = steps.map((s) => ({ key: s.key, label: s.label, status: "done" }));
  await db
    .update(generationsTable)
    .set({ status: "done", steps: finalSteps, creditsUsed: cost, elapsedSeconds: elapsed })
    .where(eq(generationsTable.id, generationId));

  await db
    .update(botsTable)
    .set({ status: "running", lastActiveAt: new Date() })
    .where(eq(botsTable.id, botId));
}

router.delete("/bots/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [existing] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, id), eq(botsTable.userId, req.userId!)));

  if (!existing) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  await db.delete(botsTable).where(eq(botsTable.id, id));
  res.sendStatus(204);
});

router.post("/bots/:id/restart", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, id), eq(botsTable.userId, req.userId!)));

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const [updated] = await db
    .update(botsTable)
    .set({ status: "running", lastActiveAt: new Date() })
    .where(eq(botsTable.id, id))
    .returning();

  res.json(botToResponse(updated));
});

router.post("/bots/:id/stop", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, id), eq(botsTable.userId, req.userId!)));

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const [updated] = await db
    .update(botsTable)
    .set({ status: "stopped" })
    .where(eq(botsTable.id, id))
    .returning();

  res.json(botToResponse(updated));
});

router.post("/bots/:id/start", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, id), eq(botsTable.userId, req.userId!)));

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const [updated] = await db
    .update(botsTable)
    .set({ status: "running", lastActiveAt: new Date() })
    .where(eq(botsTable.id, id))
    .returning();

  res.json(botToResponse(updated));
});

router.get("/bots/:id/logs", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, id), eq(botsTable.userId, req.userId!)));

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const mockLogs = [
    `[${new Date().toISOString()}] INFO  Bot ${bot.name} started`,
    `[${new Date().toISOString()}] INFO  Polling started`,
    `[${new Date().toISOString()}] INFO  Listening for updates...`,
    `[${new Date().toISOString()}] DEBUG Received /start from user 12345`,
    `[${new Date().toISOString()}] INFO  Sent welcome message`,
    `[${new Date().toISOString()}] DEBUG Processed 3 updates in 0.12s`,
    `[${new Date().toISOString()}] INFO  Memory usage: 42MB / 128MB`,
  ];

  res.json({ botId: id, lines: mockLogs });
});

// Download code endpoint
router.get("/bots/:id/download", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [bot] = await db
    .select()
    .from(botsTable)
    .where(and(eq(botsTable.id, id), eq(botsTable.userId, req.userId!)));

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  // Return download info — actual file served after payment confirmation
  res.json({
    botId: id,
    botName: bot.name,
    botType: bot.botType,
    downloadAvailable: false,
    message: "Purchase the code to download. Price: 2990 ₽",
    purchaseEndpoint: "/api/payments/code/purchase",
  });
});

router.get("/generations/:id", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [gen] = await db
    .select()
    .from(generationsTable)
    .where(and(eq(generationsTable.id, id), eq(generationsTable.userId, req.userId!)));

  if (!gen) {
    res.status(404).json({ error: "Generation not found" });
    return;
  }

  res.json({
    id: gen.id,
    botId: gen.botId,
    status: gen.status,
    steps: gen.steps,
    creditsUsed: gen.creditsUsed,
    elapsedSeconds: gen.elapsedSeconds,
    errorMessage: gen.errorMessage,
    createdAt: gen.createdAt,
  });
});

// History — all user's generations
router.get("/history", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const generations = await db
    .select()
    .from(generationsTable)
    .where(eq(generationsTable.userId, req.userId!))
    .orderBy(desc(generationsTable.createdAt))
    .limit(50);

  // Join bot names
  const botIds = [...new Set(generations.map((g) => g.botId))];
  const bots =
    botIds.length > 0
      ? await db.select({ id: botsTable.id, name: botsTable.name, botType: botsTable.botType }).from(botsTable)
      : [];

  const botMap = new Map(bots.map((b) => [b.id, b]));

  res.json(
    generations.map((g) => ({
      id: g.id,
      botId: g.botId,
      botName: botMap.get(g.botId)?.name ?? "Удалённый бот",
      botType: botMap.get(g.botId)?.botType ?? "simple",
      status: g.status,
      creditsUsed: g.creditsUsed,
      elapsedSeconds: g.elapsedSeconds,
      createdAt: g.createdAt,
    })),
  );
});

export default router;
