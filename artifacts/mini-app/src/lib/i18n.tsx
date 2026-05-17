import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Locale = "ru" | "en";

const STORAGE_KEY = "bf_locale";

const translations = {
  ru: {
    // Nav
    newChat: "Новый чат",
    myBots: "Мои боты",
    marketplace: "Маркетплейс",
    balance: "Баланс",
    referral: "Рефералы",
    history: "История",
    settings: "Настройки",
    support: "Поддержка",
    adminPanel: "Админ панель",
    // Chat
    welcomeTitle: "Добро пожаловать в Botify",
    welcomeSubtitle: "Опиши Telegram-бота, которого хочешь создать, и я соберу его за секунды.",
    describeBot: "Опиши своего бота...",
    generationProgress: "Прогресс генерации",
    running: "В процессе...",
    viewBot: "Открыть бота",
    // My Bots
    searchBots: "Поиск ботов...",
    noBotsTitle: "Нет ботов",
    noBotsDesc: "Ты ещё не создал ни одного бота, или ни один не подходит под поиск.",
    createNewBot: "Создать нового бота",
    start: "Запустить",
    stop: "Остановить",
    restart: "Перезапустить",
    delete: "Удалить",
    improve: "Улучшить",
    downloadCode: "Скачать код",
    deleteConfirm: "Удалить этого бота? Это действие необратимо.",
    improveTitle: "Улучшить бота",
    improveDesc: "Опиши что хочешь изменить или добавить",
    improvePlaceholder: "Например: добавь команду /help с описанием всех функций...",
    improveCost: "Стоимость: 12 кредитов",
    applyImprovement: "Применить",
    cancel: "Отмена",
    // Balance
    currentBalance: "Текущий баланс",
    credits: "Кредитов",
    buyCredits: "Купить кредиты",
    paymentMethod: "Способ оплаты",
    telegramStars: "Telegram Stars",
    yuMoney: "ЮMoney",
    transactionHistory: "История транзакций",
    noTransactions: "Транзакций пока нет",
    payWithStars: "Оплатить Stars",
    payWithYuMoney: "Оплатить ЮMoney",
    hosting: "Хостинг",
    hostingDesc: "Ваши боты работают на нашем сервере",
    buyHosting: "Купить хостинг",
    // Settings
    settingsTitle: "Настройки",
    language: "Язык",
    notifications: "Уведомления",
    notificationsDesc: "Получать уведомления о статусе ботов",
    appearance: "Внешний вид",
    theme: "Тема",
    // History
    historyTitle: "История генераций",
    noHistory: "История пуста",
    noHistoryDesc: "Созданные боты будут отображаться здесь.",
    creditsUsed: "кредитов",
    seconds: "сек",
    // Status
    statusRunning: "Работает",
    statusStopped: "Остановлен",
    statusError: "Ошибка",
    statusGenerating: "Генерируется",
    statusDone: "Завершено",
    statusFailed: "Ошибка",
    // Common
    loading: "Загрузка...",
    save: "Сохранить",
    close: "Закрыть",
    plan: "Тариф",
    free: "Бесплатный",
    basic: "Базовый",
    pro: "Про",
    business: "Бизнес",
    // Upsell
    upsellTitle: "Бот создан! 🎉",
    upsellDesc: "Хотите расширить возможности бота?",
    addPayments: "Подключить Telegram Stars оплату",
    addAnalytics: "Добавить аналитику",
    addSheets: "Интеграция Google Sheets",
    skipUpsell: "Пропустить",
    // Support
    supportTitle: "Поддержка",
    supportDesc: "Свяжитесь с нами любым удобным способом",
    // Admin
    adminTitle: "Административная панель",
    totalUsers: "Всего пользователей",
    activeUsers: "Активных (30д)",
    totalBots: "Ботов создано",
    runningBots: "Запущено",
    totalGenerations: "Генераций",
    totalRevenue: "Доход",
    banUser: "Заблокировать",
    unbanUser: "Разблокировать",
    addCredits: "Начислить кредиты",
    broadcast: "Рассылка",
    broadcastPlaceholder: "Текст сообщения для всех пользователей...",
    send: "Отправить",
  },
  en: {
    // Nav
    newChat: "New Chat",
    myBots: "My Bots",
    marketplace: "Marketplace",
    balance: "Balance",
    referral: "Referrals",
    history: "History",
    settings: "Settings",
    support: "Support",
    adminPanel: "Admin Panel",
    // Chat
    welcomeTitle: "Welcome to Botify",
    welcomeSubtitle: "Describe the Telegram bot you want to create, and I'll build it for you in seconds.",
    describeBot: "Describe your bot...",
    generationProgress: "Generation Progress",
    running: "Running...",
    viewBot: "View Bot",
    // My Bots
    searchBots: "Search bots...",
    noBotsTitle: "No bots found",
    noBotsDesc: "You haven't created any bots yet, or none match your search.",
    createNewBot: "Create New Bot",
    start: "Start",
    stop: "Stop",
    restart: "Restart",
    delete: "Delete",
    improve: "Improve",
    downloadCode: "Download Code",
    deleteConfirm: "Delete this bot? This action is irreversible.",
    improveTitle: "Improve Bot",
    improveDesc: "Describe what you want to change or add",
    improvePlaceholder: "E.g.: add a /help command with descriptions of all features...",
    improveCost: "Cost: 12 credits",
    applyImprovement: "Apply",
    cancel: "Cancel",
    // Balance
    currentBalance: "Current Balance",
    credits: "Credits",
    buyCredits: "Buy Credits",
    paymentMethod: "Payment Method",
    telegramStars: "Telegram Stars",
    yuMoney: "YuMoney",
    transactionHistory: "Transaction History",
    noTransactions: "No transactions yet",
    payWithStars: "Pay with Stars",
    payWithYuMoney: "Pay with YuMoney",
    hosting: "Hosting",
    hostingDesc: "Your bots run on our server",
    buyHosting: "Buy Hosting",
    // Settings
    settingsTitle: "Settings",
    language: "Language",
    notifications: "Notifications",
    notificationsDesc: "Receive notifications about bot status",
    appearance: "Appearance",
    theme: "Theme",
    // History
    historyTitle: "Generation History",
    noHistory: "No history yet",
    noHistoryDesc: "Created bots will appear here.",
    creditsUsed: "credits",
    seconds: "sec",
    // Status
    statusRunning: "Running",
    statusStopped: "Stopped",
    statusError: "Error",
    statusGenerating: "Generating",
    statusDone: "Done",
    statusFailed: "Failed",
    // Common
    loading: "Loading...",
    save: "Save",
    close: "Close",
    plan: "Plan",
    free: "Free",
    basic: "Basic",
    pro: "Pro",
    business: "Business",
    // Upsell
    upsellTitle: "Bot Created! 🎉",
    upsellDesc: "Want to expand your bot's capabilities?",
    addPayments: "Add Telegram Stars payments",
    addAnalytics: "Add analytics",
    addSheets: "Google Sheets integration",
    skipUpsell: "Skip",
    // Support
    supportTitle: "Support",
    supportDesc: "Contact us in any convenient way",
    // Admin
    adminTitle: "Admin Panel",
    totalUsers: "Total Users",
    activeUsers: "Active (30d)",
    totalBots: "Bots Created",
    runningBots: "Running",
    totalGenerations: "Generations",
    totalRevenue: "Revenue",
    banUser: "Ban",
    unbanUser: "Unban",
    addCredits: "Add Credits",
    broadcast: "Broadcast",
    broadcastPlaceholder: "Message text for all users...",
    send: "Send",
  },
} as const;

export type TranslationKey = keyof typeof translations.ru;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: "ru",
  setLocale: () => {},
  t: (key) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ru" || saved === "en") return saved;
      // Auto-detect from Telegram WebApp language
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initDataUnsafe?.user?.language_code === "ru") return "ru";
      return "ru";
    } catch {
      return "ru";
    }
  });

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem(STORAGE_KEY, newLocale);
    } catch {}
  };

  const t = (key: TranslationKey): string => {
    return (translations[locale] as Record<string, string>)[key] ?? (translations.ru as Record<string, string>)[key] ?? key;
  };

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
