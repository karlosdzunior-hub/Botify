import { logger } from "./logger";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function callGroq(messages: AIMessage[], model = "llama-3.3-70b-versatile"): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 2048 }),
  });

  if (!res.ok) throw new Error(`Groq error: ${res.status}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}

async function callGemini(messages: AIMessage[]): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not set");

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));

  const systemInstruction = messages.find((m) => m.role === "system")?.content;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
      }),
    },
  );

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = (await res.json()) as { candidates: { content: { parts: { text: string }[] } }[] };
  return data.candidates[0].content.parts[0].text;
}

export async function chat(messages: AIMessage[], preferFast = true): Promise<string> {
  if (preferFast && GROQ_API_KEY) {
    try {
      return await callGroq(messages);
    } catch (err) {
      logger.warn({ err }, "Groq failed, falling back to Gemini");
    }
  }

  if (GEMINI_API_KEY) {
    try {
      return await callGemini(messages);
    } catch (err) {
      logger.warn({ err }, "Gemini failed");
    }
  }

  return mockAIResponse(messages);
}

function mockAIResponse(messages: AIMessage[]): string {
  const last = messages[messages.length - 1];
  const content = last?.content?.toLowerCase() ?? "";

  if (content.includes("бот") || content.includes("bot")) {
    return "Отличная идея! Я помогу вам создать бота. Уточните несколько деталей:\n1. Что должен делать бот?\n2. Нужна ли авторизация пользователей?\n3. Будет ли бот хранить данные?\n4. Нужны ли inline-кнопки?";
  }

  return "Привет! Я Bot Factory — ваш AI-помощник для создания Telegram-ботов. Опишите, какого бота вы хотите создать, и я помогу воплотить идею в жизнь!";
}

export const BOT_FACTORY_SYSTEM_PROMPT = `Ты — Bot Factory AI, умный помощник для создания Telegram-ботов.
Ты помогаешь пользователям:
1. Описать идею бота
2. Задать уточняющие вопросы (3-4 конкретных вопроса)
3. Составить план с функциями и командами
4. Оценить стоимость в кредитах

Стоимость: простой бот — 15 кредитов, сложный — 35 кредитов, мини-апп — 70 кредитов.
Отвечай по-русски, если пользователь пишет по-русски.
Будь конкретным и профессиональным. Не используй эмодзи.`;
