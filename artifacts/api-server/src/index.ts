import app from "./app";
import { logger } from "./lib/logger";
import { startTelegramBot, stopTelegramBot } from "./telegram-bot";
import { recoverRunningBots } from "./lib/botRunner";
import { db } from "@workspace/db";
import { botsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startTelegramBot();

  // Recover bots that were running before server restart
  try {
    const runningBots = await db
      .select({ id: botsTable.id, dirPath: botsTable.dirPath, status: botsTable.status })
      .from(botsTable)
      .where(eq(botsTable.status, "running"));

    if (runningBots.length > 0) {
      logger.info({ count: runningBots.length }, "Recovering running bots...");
      await recoverRunningBots(runningBots);
    }
  } catch (err) {
    logger.error({ err }, "Failed to recover running bots");
  }
});

process.on("SIGTERM", () => {
  stopTelegramBot();
  process.exit(0);
});

process.on("SIGINT", () => {
  stopTelegramBot();
  process.exit(0);
});
