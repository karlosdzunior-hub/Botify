import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { botsTable, generationsTable, transactionsTable, usersTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { encryptToken, decryptToken, isEncrypted } from "../lib/crypto";
import { generateBotCode, checkAndFixBotCode, classifyBotType } from "../lib/ai";
import { logger } from "../lib/logger";

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

  runGeneration(generationId, botId, name, description, botType, cost, !!encryptedToken).catch((err) => {
    logger.error({ err, generationId }, "Generation pipeline crashed");
  });

  res.status(201).json(botToResponse(bot));
});

type StepKey = "analyze" | "plan" | "token" | "generate" | "check" | "launch";

async function updateStep(
  generationId: string,
  allSteps: { key: StepKey; label: string }[],
  currentKey: StepKey,
  status: "in_progress" | "done" | "error",
  elapsed: number,
) {
  const updatedSteps = allSteps.map((s) => {
    const prevDone = allSteps.indexOf(s) < allSteps.findIndex((x) => x.key === currentKey);
    if (prevDone) return { key: s.key, label: s.label, status: "done" };
    if (s.key === currentKey) return { key: s.key, label: s.label, status };
    return { key: s.key, label: s.label, status: "pending" };
  });
  await db
    .update(generationsTable)
    .set({ steps: updatedSteps, elapsedSeconds: elapsed })
    .where(eq(generationsTable.id, generationId));
}

async function runGeneration(
  generationId: string,
  botId: string,
  botName: string,
  description: string,
  botType: "simple" | "complex" | "miniapp",
  cost: number,
  hasToken: boolean,
) {
  const start = Date.now();
  const elapsed = () => Math.round((Date.now() - start) / 1000);

  const STEPS: { key: StepKey; label: string }[] = [
    { key: "analyze", label: "Анализирую запрос" },
    { key: "plan", label: "Уточняю тип бота" },
    { key: "token", label: "Проверяю токен" },
    { key: "generate", label: "Генерирую код" },
    { key: "check", label: "Проверяю и исправляю ошибки" },
    { key: "launch", label: "Бот готов" },
  ];

  try {
    // Step 1 — Analyze
    await updateStep(generationId, STEPS, "analyze", "in_progress", elapsed());
    const detectedType = await classifyBotType(description);
    const finalType = detectedType !== botType ? detectedType : botType;
    await updateStep(generationId, STEPS, "analyze", "done", elapsed());

    // Step 2 — Plan (classify & confirm)
    await updateStep(generationId, STEPS, "plan", "in_progress", elapsed());
    await new Promise((r) => setTimeout(r, 500));
    await updateStep(generationId, STEPS, "plan", "done", elapsed());

    // Step 3 — Token check
    await updateStep(generationId, STEPS, "token", "in_progress", elapsed());
    if (hasToken) {
      await new Promise((r) => setTimeout(r, 800));
    }
    await updateStep(generationId, STEPS, "token", "done", elapsed());

    // Step 4 — Generate code
    await updateStep(generationId, STEPS, "generate", "in_progress", elapsed());
    let generatedCode = await generateBotCode(botName, description, finalType);

    // Strip markdown code blocks if AI wrapped the code
    generatedCode = generatedCode
      .replace(/^```python\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    await db
      .update(generationsTable)
      .set({ generatedCode, elapsedSeconds: elapsed() })
      .where(eq(generationsTable.id, generationId));
    await updateStep(generationId, STEPS, "generate", "done", elapsed());

    // Step 5 — Check & fix errors (up to 3 iterations)
    await updateStep(generationId, STEPS, "check", "in_progress", elapsed());

    const MAX_FIX_ATTEMPTS = 3;
    let fixAttempts = 0;
    let currentCode = generatedCode;

    for (let attempt = 0; attempt < MAX_FIX_ATTEMPTS; attempt++) {
      const checkResult = await checkAndFixBotCode(currentCode, botName);

      if (!checkResult.hasErrors || checkResult.errors.length === 0) {
        logger.info({ generationId, attempt }, "Code passed checks");
        break;
      }

      fixAttempts++;
      logger.info({ generationId, attempt, errors: checkResult.errors }, "Fixing errors");

      if (checkResult.fixedCode) {
        currentCode = checkResult.fixedCode
          .replace(/^```python\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();

        await db
          .update(generationsTable)
          .set({ generatedCode: currentCode, fixAttempts, elapsedSeconds: elapsed() })
          .where(eq(generationsTable.id, generationId));
      } else {
        break;
      }
    }

    await updateStep(generationId, STEPS, "check", "done", elapsed());

    // Step 6 — Done
    await updateStep(generationId, STEPS, "launch", "in_progress", elapsed());
    await new Promise((r) => setTimeout(r, 500));

    const finalSteps = STEPS.map((s) => ({ key: s.key, label: s.label, status: "done" }));
    await db
      .update(generationsTable)
      .set({
        status: "done",
        steps: finalSteps,
        creditsUsed: cost,
        elapsedSeconds: elapsed(),
        generatedCode: currentCode,
        fixAttempts,
      })
      .where(eq(generationsTable.id, generationId));

    await db
      .update(botsTable)
      .set({ status: "running", lastActiveAt: new Date() })
      .where(eq(botsTable.id, botId));

    logger.info({ generationId, botId, elapsed: elapsed(), fixAttempts }, "Generation complete");
  } catch (err) {
    logger.error({ err, generationId }, "Generation failed");

    const failedSteps = STEPS.map((s, idx) => ({
      key: s.key,
      label: s.label,
      status: idx < STEPS.length - 1 ? "done" : "error",
    }));

    await db
      .update(generationsTable)
      .set({
        status: "failed",
        steps: failedSteps,
        errorMessage: err instanceof Error ? err.message : String(err),
        elapsedSeconds: elapsed(),
      })
      .where(eq(generationsTable.id, generationId));

    await db
      .update(botsTable)
      .set({ status: "error" })
      .where(eq(botsTable.id, botId));
  }
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

    runImprovement(genId, id, existing.name, existing.description ?? "", improvement, IMPROVE_COST).catch((err) => {
      logger.error({ err, genId }, "Improvement pipeline crashed");
    });
  }

  res.json(botToResponse(updated));
});

async function runImprovement(
  generationId: string,
  botId: string,
  botName: string,
  originalDescription: string,
  improvement: string,
  cost: number,
) {
  const start = Date.now();
  const elapsed = () => Math.round((Date.now() - start) / 1000);

  const STEPS = [
    { key: "analyze", label: "Анализирую изменения" },
    { key: "generate", label: "Вношу изменения в код" },
    { key: "check", label: "Проверяю и исправляю ошибки" },
    { key: "launch", label: "Обновление готово" },
  ] as const;

  type ImpStepKey = (typeof STEPS)[number]["key"];

  const updateImpStep = async (key: ImpStepKey, status: "in_progress" | "done" | "error") => {
    const updatedSteps = STEPS.map((s) => {
      const prevDone = STEPS.indexOf(s) < STEPS.findIndex((x) => x.key === key);
      if (prevDone) return { key: s.key, label: s.label, status: "done" };
      if (s.key === key) return { key: s.key, label: s.label, status };
      return { key: s.key, label: s.label, status: "pending" };
    });
    await db
      .update(generationsTable)
      .set({ steps: updatedSteps, elapsedSeconds: elapsed() })
      .where(eq(generationsTable.id, generationId));
  };

  try {
    await updateImpStep("analyze", "in_progress");
    await new Promise((r) => setTimeout(r, 500));
    await updateImpStep("analyze", "done");

    await updateImpStep("generate", "in_progress");
    const fullDescription = `${originalDescription}\n\nДобавить функцию: ${improvement}`;
    let newCode = await generateBotCode(botName, fullDescription, "complex");
    newCode = newCode
      .replace(/^```python\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    await updateImpStep("generate", "done");

    await updateImpStep("check", "in_progress");
    let fixAttempts = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const checkResult = await checkAndFixBotCode(newCode, botName);
      if (!checkResult.hasErrors) break;
      fixAttempts++;
      if (checkResult.fixedCode) {
        newCode = checkResult.fixedCode
          .replace(/^```python\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
      } else break;
    }
    await updateImpStep("check", "done");

    await updateImpStep("launch", "in_progress");
    await new Promise((r) => setTimeout(r, 300));

    const finalSteps = STEPS.map((s) => ({ key: s.key, label: s.label, status: "done" }));
    await db
      .update(generationsTable)
      .set({ status: "done", steps: finalSteps, creditsUsed: cost, elapsedSeconds: elapsed(), generatedCode: newCode, fixAttempts })
      .where(eq(generationsTable.id, generationId));

    await db
      .update(botsTable)
      .set({ status: "running", lastActiveAt: new Date(), generationId })
      .where(eq(botsTable.id, botId));
  } catch (err) {
    logger.error({ err, generationId }, "Improvement failed");
    await db
      .update(generationsTable)
      .set({ status: "failed", errorMessage: err instanceof Error ? err.message : String(err), elapsedSeconds: elapsed() })
      .where(eq(generationsTable.id, generationId));
    await db.update(botsTable).set({ status: "error" }).where(eq(botsTable.id, botId));
  }
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
