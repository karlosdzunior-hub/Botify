import { defineConfig } from "drizzle-kit";
import path from "path";

const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "bot-factory.db");

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "turso",
  dbCredentials: {
    url: `file:${dbPath}`,
  },
});
