import { logger } from "../lib/logger";

export async function notifyUser(telegramId: string, text: string): Promise<void> {
  const botToken = process.env.MAIN_BOT_TOKEN;
  if (!botToken) return;
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: parseInt(telegramId), text, parse_mode: "HTML" }),
    });
  } catch (err) {
    logger.warn({ err, telegramId }, "Failed to notify user");
  }
}
