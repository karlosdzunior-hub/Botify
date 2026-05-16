import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { chatMessagesTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth, type AuthedRequest } from "../middlewares/requireAuth";
import { chat, BOT_FACTORY_SYSTEM_PROMPT, type AIMessage } from "../lib/ai";

const router: IRouter = Router();

const SESSION_KEY = "default";

router.get("/chat/history", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(and(eq(chatMessagesTable.userId, req.userId!), eq(chatMessagesTable.sessionId, SESSION_KEY)))
    .orderBy(asc(chatMessagesTable.createdAt))
    .limit(50);

  if (messages.length === 0) {
    const welcome = {
      id: "welcome",
      role: "assistant" as const,
      content:
        "Добро пожаловать в Bot Factory! Опишите, какого Telegram-бота вы хотите создать, и я помогу воплотить идею в реальность. Можете начать с простого описания, например: «Хочу бота для записи клиентов в кафе».",
      generationId: null,
      createdAt: new Date().toISOString(),
    };
    res.json([welcome]);
    return;
  }

  res.json(
    messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      generationId: m.generationId,
      createdAt: m.createdAt,
    })),
  );
});

router.post("/chat/message", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  const { content, sessionId } = req.body as { content?: string; sessionId?: string };

  if (!content || content.trim().length === 0) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const session = sessionId ?? SESSION_KEY;
  const userId = req.userId!;

  const userMsgId = randomUUID();
  await db.insert(chatMessagesTable).values({
    id: userMsgId,
    userId,
    sessionId: session,
    role: "user",
    content: content.trim(),
  });

  const history = await db
    .select()
    .from(chatMessagesTable)
    .where(and(eq(chatMessagesTable.userId, userId), eq(chatMessagesTable.sessionId, session)))
    .orderBy(asc(chatMessagesTable.createdAt))
    .limit(20);

  const aiMessages: AIMessage[] = [
    { role: "system", content: BOT_FACTORY_SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  let reply: string;
  try {
    reply = await chat(aiMessages);
  } catch {
    reply =
      "Извините, произошла ошибка при обращении к ИИ. Пожалуйста, попробуйте ещё раз или проверьте настройки API-ключей.";
  }

  const assistantMsgId = randomUUID();
  const [saved] = await db
    .insert(chatMessagesTable)
    .values({
      id: assistantMsgId,
      userId,
      sessionId: session,
      role: "assistant",
      content: reply,
    })
    .returning();

  res.json({
    id: saved.id,
    role: saved.role,
    content: saved.content,
    generationId: saved.generationId,
    createdAt: saved.createdAt,
  });
});

router.post("/chat/reset", requireAuth, async (req: AuthedRequest, res): Promise<void> => {
  await db
    .delete(chatMessagesTable)
    .where(and(eq(chatMessagesTable.userId, req.userId!), eq(chatMessagesTable.sessionId, SESSION_KEY)));

  res.json({ success: true, message: "Chat reset" });
});

export default router;
