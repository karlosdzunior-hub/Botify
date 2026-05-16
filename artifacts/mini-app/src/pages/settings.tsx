import { Layout } from "@/components/layout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useI18n, Locale } from "@/lib/i18n";
import { haptic } from "@/lib/haptic";
import { useState, useEffect } from "react";
import { Globe, Bell, Info, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const NOTIF_KEY = "bf_notifications";

export default function SettingsPage() {
  const { locale, setLocale, t } = useI18n();
  const [notifications, setNotifications] = useState(() => {
    try {
      return localStorage.getItem(NOTIF_KEY) !== "false";
    } catch {
      return true;
    }
  });

  const handleLocaleChange = (newLocale: Locale) => {
    haptic.selection();
    setLocale(newLocale);
    toast.success(newLocale === "ru" ? "Язык изменён на Русский" : "Language changed to English");
  };

  const handleNotificationsChange = (enabled: boolean) => {
    haptic.light();
    setNotifications(enabled);
    try {
      localStorage.setItem(NOTIF_KEY, String(enabled));
    } catch {}
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
  };

  const item = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <Layout title={t("settingsTitle")}>
      <motion.div
        className="p-4 space-y-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Language */}
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("language")}
            </h2>
          </div>
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            {(["ru", "en"] as Locale[]).map((lang, idx) => (
              <button
                key={lang}
                onClick={() => handleLocaleChange(lang)}
                className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors ${
                  idx > 0 ? "border-t border-border/30" : ""
                } ${locale === lang ? "bg-primary/10" : "hover:bg-secondary/50"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{lang === "ru" ? "🇷🇺" : "🇬🇧"}</span>
                  <span className="font-medium">{lang === "ru" ? "Русский" : "English"}</span>
                </div>
                {locale === lang && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("notifications")}
            </h2>
          </div>
          <div className="bg-card border border-border/50 rounded-xl">
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <Label className="text-sm font-medium">{t("notifications")}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t("notificationsDesc")}</p>
              </div>
              <Switch
                checked={notifications}
                onCheckedChange={handleNotificationsChange}
              />
            </div>
          </div>
        </motion.div>

        {/* App Info */}
        <motion.div variants={item}>
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              О приложении
            </h2>
          </div>
          <div className="bg-card border border-border/50 rounded-xl overflow-hidden">
            {[
              { label: "Версия", value: "1.0.0" },
              { label: "Bot Factory", value: "SaaS платформа" },
            ].map((row, idx) => (
              <div
                key={row.label}
                className={`flex items-center justify-between px-4 py-3.5 ${idx > 0 ? "border-t border-border/30" : ""}`}
              >
                <span className="text-sm text-muted-foreground">{row.label}</span>
                <span className="text-sm font-medium">{row.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </Layout>
  );
}
