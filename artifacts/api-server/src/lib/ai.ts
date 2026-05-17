import { logger } from "./logger";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function callGroq(messages: AIMessage[], model = "llama-3.3-70b-versatile", maxTokens = 4096): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY not set");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq error: ${res.status} — ${text}`);
  }
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0].message.content;
}

async function callGemini(messages: AIMessage[], maxTokens = 4096): Promise<string> {
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
        generationConfig: { maxOutputTokens: maxTokens },
        ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error: ${res.status} — ${text}`);
  }
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

export async function generateBotCode(
  botName: string,
  description: string,
  botType: "simple" | "complex" | "miniapp",
): Promise<string> {
  const complexityNote =
    botType === "simple"
      ? "Это простой бот: до 10 команд, без базы данных, без сложной логики."
      : botType === "complex"
        ? "Это сложный бот: с FSM состояниями, inline-кнопками, хранением данных через словарь или JSON-файл."
        : "Это бот с богатым функционалом: FSM, inline-кнопки, хранение данных.";

  const systemPrompt = `Ты — опытный Python-разработчик Telegram-ботов. Генерируй полный, рабочий Python-код.

СТРОГИЕ ПРАВИЛА:
1. Используй ТОЛЬКО aiogram 3.x (from aiogram import Bot, Dispatcher, types, F)
2. Токен берётся ТОЛЬКО из переменной окружения: BOT_TOKEN = os.getenv("BOT_TOKEN")
3. Используй polling: asyncio.run(main()) с dp.start_polling(bot)
4. Логирование: import logging; logging.basicConfig(level=logging.INFO)
5. Обработка всех исключений — try/except везде где нужно
6. Код должен быть ПОЛНЫМ — никаких TODO, никаких заглушек, никаких "# add here"
7. Отвечай ТОЛЬКО кодом Python — никакого markdown, никаких \`\`\`, только чистый Python-код
8. В конце добавь комментарий: # requirements: aiogram==3.7.0 python-dotenv==1.0.0`;

  const userPrompt = `Создай Telegram-бота с названием "${botName}".

Описание: ${description}

${complexityNote}

Напиши полный рабочий Python-код бота на aiogram 3.x. Только код, без объяснений.`;

  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  if (GROQ_API_KEY) {
    try {
      return await callGroq(messages, "qwen-2.5-coder-32b", 8192);
    } catch (err) {
      logger.warn({ err }, "Groq Qwen failed for code generation, falling back to Gemini");
    }
  }

  if (GEMINI_API_KEY) {
    try {
      return await callGemini(messages, 8192);
    } catch (err) {
      logger.warn({ err }, "Gemini failed for code generation");
    }
  }

  throw new Error("No AI provider available for code generation");
}

export interface CodeCheckResult {
  hasErrors: boolean;
  errors: string[];
  fixedCode?: string;
}

export async function checkAndFixBotCode(code: string, botName: string): Promise<CodeCheckResult> {
  const systemPrompt = `Ты — эксперт по Python и aiogram 3.x. Твоя задача — найти ошибки в коде и исправить их.

ПРОВЕРЯЙ:
1. Синтаксические ошибки Python
2. Правильность импортов aiogram 3.x (не aiogram 2.x!)
3. Правильность использования FSM (если есть)
4. Отсутствующие обработчики ошибок
5. Неправильные типы данных
6. Недостающие await перед async функциями
7. Правильность структуры диспетчера aiogram 3

ФОРМАТ ОТВЕТА (строго JSON):
{
  "hasErrors": true/false,
  "errors": ["описание ошибки 1", "описание ошибки 2"],
  "fixedCode": "полный исправленный код Python или null если ошибок нет"
}

Если ошибок нет — верни hasErrors: false, errors: [], fixedCode: null`;

  const userPrompt = `Проверь этот код Telegram-бота "${botName}" на ошибки и исправь их:

${code}`;

  const messages: AIMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let response: string;

  if (GROQ_API_KEY) {
    try {
      response = await callGroq(messages, "qwen-2.5-coder-32b", 8192);
    } catch {
      if (GEMINI_API_KEY) {
        response = await callGemini(messages, 8192);
      } else {
        throw new Error("No AI provider available");
      }
    }
  } else if (GEMINI_API_KEY) {
    response = await callGemini(messages, 8192);
  } else {
    throw new Error("No AI provider available");
  }

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");
    const parsed = JSON.parse(jsonMatch[0]) as {
      hasErrors: boolean;
      errors: string[];
      fixedCode: string | null;
    };
    return {
      hasErrors: parsed.hasErrors,
      errors: parsed.errors ?? [],
      fixedCode: parsed.fixedCode ?? undefined,
    };
  } catch {
    logger.warn({ response }, "Failed to parse AI check response as JSON");
    return { hasErrors: false, errors: [] };
  }
}

export async function classifyBotType(description: string): Promise<"simple" | "complex" | "miniapp"> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: `Классифицируй описание Telegram-бота. Ответь ОДНИМ словом:
- simple — простой бот до 10 команд, без базы данных
- complex — бот с FSM, хранением данных, интеграциями с API, inline-кнопками
- miniapp — нужен веб-интерфейс или сложная визуализация

Только одно слово: simple, complex или miniapp`,
    },
    { role: "user", content: description },
  ];

  try {
    const result = await chat(messages);
    const clean = result.trim().toLowerCase();
    if (clean.includes("miniapp") || clean.includes("мини")) return "miniapp";
    if (clean.includes("complex") || clean.includes("сложн")) return "complex";
    return "simple";
  } catch {
    return description.length > 200 ? "complex" : "simple";
  }
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
