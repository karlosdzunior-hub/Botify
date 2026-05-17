import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { generateReferralCode } from "./lib/auth";
import { randomUUID } from "crypto";

const BOT_TOKEN = process.env.MAIN_BOT_TOKEN;
const MINI_APP_URL = process.env.MINI_APP_URL ?? "https://t.me";
const ADMIN_USER_ID = process.env.ADMIN_USER_ID ?? "";
const CREDITS_ON_REGISTER = parseInt(process.env.CREDITS_ON_REGISTER ?? "30");

let offset = 0;
let polling = false;

async function tgRequest(method: string, body: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { ok: boolean; result: unknown };
  if (!data.ok) {
    logger.warn({ method, body: data }, "Telegram API error");
  }
  return data;
}

async function sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  return tgRequest("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

async function handleStart(msg: TelegramMessage, referralCode?: string) {
  const telegramId = String(msg.from.id);
  const username = msg.from.username ?? null;
  const firstName = msg.from.first_name ?? "";

  let [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId));

  if (!user) {
    let referredBy: string | null = null;

    if (referralCode) {
      const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode));
      if (referrer && referrer.telegramId !== telegramId) {
        referredBy = referrer.id;
        await db
          .update(usersTable)
          .set({ credits: referrer.credits + 50 })
          .where(eq(usersTable.id, referrer.id));
        await sendMessage(referrer.telegramId as unknown as number, `🎁 По вашей реферальной ссылке зарегистрировался новый пользователь! +50 кредитов на ваш баланс.`);
      }
    }

    [user] = await db
      .insert(usersTable)
      .values({
        id: randomUUID(),
        telegramId,
        username,
        firstName,
        credits: CREDITS_ON_REGISTER,
        referralCode: generateReferralCode(),
        referredBy,
      })
      .returning();

    logger.info({ telegramId, username }, "New user registered via /start");
  }

  await sendMessage(msg.from.id, `👋 Привет, <b>${firstName}</b>!\n\n🤖 <b>Bot Factory</b> — создай своего Telegram-бота без программирования.\n\nНа твоём счету <b>${user.credits} кредитов</b>. Этого хватит для создания первого бота!\n\n<i>Нажми кнопку ниже, чтобы открыть интерфейс:</i>`, {
    reply_markup: {
      inline_keyboard: [[
        {
          text: "🚀 Открыть Bot Factory",
          web_app: { url: MINI_APP_URL },
        },
      ]],
    },
  });
}

async function handleHelp(msg: TelegramMessage) {
  await sendMessage(msg.from.id, `📖 <b>Как пользоваться Bot Factory:</b>\n\n1. Нажми <b>«Открыть Bot Factory»</b>\n2. Опиши своего бота в чате\n3. ИИ задаст уточняющие вопросы\n4. Подтверди план и нажми «Создать»\n5. Через 30–120 секунд бот готов!\n\n<b>Команды:</b>\n/start — главное меню\n/help — эта справка\n/balance — баланс кредитов\n\n<b>Стоимость:</b>\n• Простой бот — 15 кредитов\n• Сложный бот — 35 кредитов\n• Мини-апп — 70 кредитов`, {
    reply_markup: {
      inline_keyboard: [[{ text: "🤖 Открыть Bot Factory", web_app: { url: MINI_APP_URL } }]],
    },
  });
}

async function handleBalance(msg: TelegramMessage) {
  const telegramId = String(msg.from.id);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.telegramId, telegramId));

  if (!user) {
    await sendMessage(msg.from.id, "Сначала запусти /start чтобы зарегистрироваться.");
    return;
  }

  const planName: Record<string, string> = {
    free: "Free",
    basic: "Basic ⚡",
    pro: "Pro 🚀",
    business: "Business 💎",
  };

  await sendMessage(msg.from.id, `💳 <b>Ваш баланс</b>\n\nКредиты: <b>${user.credits} кр</b>\nТариф: <b>${planName[user.plan] ?? user.plan}</b>\n\nПополнить баланс можно в приложении:`, {
    reply_markup: {
      inline_keyboard: [[{ text: "💳 Пополнить баланс", web_app: { url: MINI_APP_URL } }]],
    },
  });
}

export async function notifyUser(telegramId: string, text: string) {
  if (!BOT_TOKEN) return;
  try {
    await sendMessage(parseInt(telegramId), text);
  } catch (err) {
    logger.warn({ err, telegramId }, "Failed to notify user");
  }
}

export async function notifyAdmin(text: string) {
  if (!BOT_TOKEN || !ADMIN_USER_ID) return;
  try {
    await sendMessage(parseInt(ADMIN_USER_ID), `🔧 <b>Admin alert</b>\n\n${text}`);
  } catch (err) {
    logger.warn({ err }, "Failed to notify admin");
  }
}

interface TelegramMessage {
  message_id: number;
  from: { id: number; username?: string; first_name?: string; language_code?: string };
  chat: { id: number; type: string };
  text?: string;
}

async function processUpdate(update: { update_id: number; message?: TelegramMessage }) {
  const msg = update.message;
  if (!msg?.text) return;

  const text = msg.text.trim();

  if (text.startsWith("/start")) {
    const parts = text.split(" ");
    const refCode = parts[1] ?? undefined;
    await handleStart(msg, refCode);
  } else if (text.startsWith("/help")) {
    await handleHelp(msg);
  } else if (text.startsWith("/balance")) {
    await handleBalance(msg);
  } else {
    await sendMessage(msg.from.id, "Используй кнопку ниже чтобы открыть Bot Factory 👇", {
      reply_markup: {
        inline_keyboard: [[{ text: "🤖 Открыть Bot Factory", web_app: { url: MINI_APP_URL } }]],
      },
    });
  }
}

async function pollUpdates() {
  if (!BOT_TOKEN) return;

  while (polling) {
    try {
      const data = (await tgRequest("getUpdates", {
        offset,
        timeout: 30,
        allowed_updates: ["message"],
      })) as { ok: boolean; result: { update_id: number; message?: TelegramMessage }[] };

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          processUpdate(update).catch((err) => logger.error({ err, update_id: update.update_id }, "Error processing update"));
        }
      }
    } catch (err) {
      logger.warn({ err }, "Polling error, retrying in 5s");
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

export function startTelegramBot() {
  if (!BOT_TOKEN) {
    logger.warn("MAIN_BOT_TOKEN not set — Telegram bot disabled");
    return;
  }

  polling = true;
  pollUpdates().catch((err) => logger.error({ err }, "Polling crashed"));
  logger.info("Telegram bot started (long polling)");
}

export function stopTelegramBot() {
  polling = false;
}
