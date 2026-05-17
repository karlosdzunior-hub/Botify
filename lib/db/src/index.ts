import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";
import * as schema from "./schema";

// Default: workspace root /data/bot-factory.db (3 dirs up from lib/db/src)
const WORKSPACE_ROOT = path.resolve(__dirname, "..", "..", "..");
const dbPath = process.env.DATABASE_PATH ?? path.join(WORKSPACE_ROOT, "data", "bot-factory.db");

const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const client = createClient({ url: `file:${dbPath}` });

export const db = drizzle(client, { schema });

export * from "./schema";
