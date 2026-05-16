import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { marketplaceTable, botsTable, usersTable, transactionsTable, generationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/marketplace", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const templates = await db
    .select()
    .from(marketplaceTable)
    .orderBy(desc(marketplaceTable.deployCount))
    .limit(20);

  res.json(
    templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      botType: t.botType,
      price: t.price,
      authorUsername: t.authorUsername,
      deployCount: t.deployCount,
      rating: t.rating,
      createdAt: t.createdAt,
    })),
  );
});

router.post("/marketplace/:id/deploy", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { botToken } = req.body as { botToken?: string };

  if (!botToken) {
    res.status(400).json({ error: "botToken is required" });
    return;
  }

  const [template] = await db.select().from(marketplaceTable).where(eq(marketplaceTable.id, id));
  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.credits < template.price) {
    res.status(402).json({ error: `Insufficient credits. Need ${template.price}` });
    return;
  }

  const botId = randomUUID();
  const generationId = randomUUID();

  const [bot] = await db
    .insert(botsTable)
    .values({
      id: botId,
      userId: req.userId!,
      name: template.name,
      description: template.description,
      botToken,
      status: "running",
      botType: template.botType,
      generationId,
    })
    .returning();

  await db.insert(generationsTable).values({
    id: generationId,
    botId,
    userId: req.userId!,
    status: "done",
    steps: [
      { key: "deploy", label: "Развертывание шаблона", status: "done" },
      { key: "launch", label: "Запуск бота", status: "done" },
    ],
    creditsUsed: template.price,
  });

  await db
    .update(usersTable)
    .set({ credits: user.credits - template.price })
    .where(eq(usersTable.id, req.userId!));

  await db.insert(transactionsTable).values({
    id: randomUUID(),
    userId: req.userId!,
    amount: -template.price,
    type: "purchase",
    description: `Шаблон из маркетплейса: ${template.name}`,
  });

  await db
    .update(marketplaceTable)
    .set({ deployCount: template.deployCount + 1 })
    .where(eq(marketplaceTable.id, id));

  res.status(201).json({
    id: bot.id,
    userId: bot.userId,
    name: bot.name,
    description: bot.description,
    botToken: null,
    botUsername: null,
    status: bot.status,
    botType: bot.botType,
    generationId: bot.generationId,
    lastActiveAt: bot.lastActiveAt,
    createdAt: bot.createdAt,
  });
});

export default router;
