import crypto from "crypto";

const BOT_TOKEN = process.env.MAIN_BOT_TOKEN ?? "mock_token";

export function verifyTelegramInitData(initData: string): Record<string, string> | null {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return null;

    params.delete("hash");
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

    const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

    if (expectedHash !== hash) return null;

    const user = params.get("user");
    if (!user) return null;
    return JSON.parse(user);
  } catch {
    return null;
  }
}

export function generateToken(userId: string): string {
  const secret = process.env.SESSION_SECRET ?? "dev_secret_key_32chars_minimum!!";
  return crypto.createHmac("sha256", secret).update(userId).digest("hex") + "." + userId;
}

export function verifyToken(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [, userId] = parts;
    const expected = generateToken(userId);
    if (expected !== token) return null;
    return userId;
  } catch {
    return null;
  }
}

export function generateReferralCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}
