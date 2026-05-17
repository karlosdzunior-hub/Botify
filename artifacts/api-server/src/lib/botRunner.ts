import { spawn, ChildProcess, execSync } from "child_process";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { logger } from "./logger";

const execAsync = promisify(exec);

const BOTS_DIR = process.env.BOTS_DIR ?? path.join(process.cwd(), "data", "bots");
const MAX_LOG_LINES = 1000;

interface RunningBot {
  process: ChildProcess;
  logPath: string;
  startedAt: Date;
}

const processes = new Map<string, RunningBot>();

export function getBotDir(botId: string): string {
  return path.join(BOTS_DIR, botId);
}

function getLogPath(botId: string): string {
  return path.join(getBotDir(botId), "bot.log");
}

function findPython(): string {
  for (const cmd of ["python3", "python"]) {
    try {
      execSync(`which ${cmd}`, { stdio: "pipe" });
      return cmd;
    } catch {
      continue;
    }
  }
  throw new Error("Python не найден. Установите python3 на сервере.");
}

async function installDeps(botDir: string, code: string): Promise<void> {
  const packages = new Set(["aiogram", "python-dotenv"]);
  const reqMatch = code.match(/# requirements?:\s*(.+)/i);
  if (reqMatch) {
    reqMatch[1].split(",").forEach((p) => {
      const pkg = p.trim();
      if (pkg) packages.add(pkg);
    });
  }

  const reqPath = path.join(botDir, "requirements.txt");
  fs.writeFileSync(reqPath, [...packages].join("\n") + "\n", "utf8");

  const python = findPython();
  await execAsync(
    `${python} -m pip install -r "${reqPath}" --quiet --no-warn-script-location`,
    { timeout: 120_000 },
  );
}

function startProcess(botId: string, botDir: string): number {
  stopBot(botId);

  const logPath = getLogPath(botId);
  const codePath = path.join(botDir, "bot.py");
  const logStream = fs.createWriteStream(logPath, { flags: "a" });

  const python = findPython();
  const child = spawn(python, [codePath], {
    cwd: botDir,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const ts = () => new Date().toISOString();

  child.stdout?.on("data", (data: Buffer) => {
    data
      .toString()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        logStream.write(`[${ts()}] INFO  ${line}\n`);
      });
  });

  child.stderr?.on("data", (data: Buffer) => {
    data
      .toString()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        logStream.write(`[${ts()}] ERROR ${line}\n`);
      });
  });

  child.on("exit", (code, signal) => {
    logStream.write(`[${ts()}] INFO  Процесс завершён (код: ${code ?? signal})\n`);
    logStream.end();
    processes.delete(botId);
  });

  child.on("error", (err) => {
    logStream.write(`[${ts()}] ERROR Ошибка запуска: ${err.message}\n`);
    logStream.end();
    processes.delete(botId);
  });

  processes.set(botId, { process: child, logPath, startedAt: new Date() });
  logStream.write(`[${ts()}] INFO  Бот запущен (PID: ${child.pid})\n`);

  logger.info({ botId, pid: child.pid, botDir }, "Bot process started");
  return child.pid!;
}

export async function deployBot(
  botId: string,
  code: string,
  botToken: string,
): Promise<{ pid: number; dirPath: string }> {
  const botDir = getBotDir(botId);
  fs.mkdirSync(botDir, { recursive: true });

  fs.writeFileSync(path.join(botDir, "bot.py"), code, "utf8");
  fs.writeFileSync(path.join(botDir, ".env"), `BOT_TOKEN=${botToken}\n`, "utf8");

  await installDeps(botDir, code);

  const pid = startProcess(botId, botDir);
  return { pid, dirPath: botDir };
}

export async function redeployBot(
  botId: string,
  code: string,
  dirPath: string,
): Promise<{ pid: number }> {
  stopBot(botId);
  fs.writeFileSync(path.join(dirPath, "bot.py"), code, "utf8");
  await installDeps(dirPath, code);
  const pid = startProcess(botId, dirPath);
  return { pid };
}

export function startBot(botId: string, dirPath: string): number {
  return startProcess(botId, dirPath);
}

export function stopBot(botId: string): void {
  const entry = processes.get(botId);
  if (!entry) return;

  try {
    entry.process.kill("SIGTERM");
    const t = setTimeout(() => {
      if (!entry.process.killed) entry.process.kill("SIGKILL");
    }, 5000);
    if (typeof t === "object" && "unref" in t) (t as any).unref();
  } catch {
    // process may already be dead
  }

  processes.delete(botId);
  logger.info({ botId }, "Bot process stopped");
}

export function restartBot(botId: string, dirPath: string): number {
  stopBot(botId);
  return startProcess(botId, dirPath);
}

export function getLogs(botId: string, lines = 150): string[] {
  const logPath = getLogPath(botId);
  if (!fs.existsSync(logPath)) {
    return [`[${new Date().toISOString()}] INFO  Логи пока отсутствуют`];
  }
  const content = fs.readFileSync(logPath, "utf8");
  const all = content.split("\n").filter(Boolean);
  return all.slice(-Math.min(lines, MAX_LOG_LINES));
}

export function isRunning(botId: string): boolean {
  const entry = processes.get(botId);
  if (!entry) return false;
  return !entry.process.killed && entry.process.exitCode === null;
}

export function cleanupBot(botId: string): void {
  stopBot(botId);
  const botDir = getBotDir(botId);
  if (fs.existsSync(botDir)) {
    fs.rmSync(botDir, { recursive: true, force: true });
  }
}

export async function recoverRunningBots(
  bots: Array<{ id: string; dirPath: string | null; status: string }>,
): Promise<void> {
  for (const bot of bots) {
    if (bot.status === "running" && bot.dirPath) {
      const codePath = path.join(bot.dirPath, "bot.py");
      if (fs.existsSync(codePath)) {
        try {
          startProcess(bot.id, bot.dirPath);
          logger.info({ botId: bot.id }, "Bot recovered after server restart");
        } catch (err) {
          logger.error({ err, botId: bot.id }, "Failed to recover bot");
        }
      }
    }
  }
}
