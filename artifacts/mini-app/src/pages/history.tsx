import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { Loader2, Bot, CheckCircle2, XCircle, Clock, History as HistoryIcon, Zap } from "lucide-react";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

interface HistoryItem {
  id: string;
  botId: string;
  botName: string;
  botType: "simple" | "complex" | "miniapp";
  status: "pending" | "in_progress" | "done" | "failed";
  creditsUsed: number;
  elapsedSeconds: number | null;
  createdAt: string;
}

function useHistory() {
  return useQuery<HistoryItem[]>({
    queryKey: ["/api/history"],
    queryFn: () => customFetch<HistoryItem[]>("/api/history"),
  });
}

const statusConfig = {
  done: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  in_progress: { icon: Loader2, color: "text-primary", bg: "bg-primary/10" },
  pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-secondary" },
} as const;

const botTypeLabels = {
  simple: "Simple",
  complex: "Complex",
  miniapp: "Mini App",
};

const botTypeColors = {
  simple: "text-blue-400",
  complex: "text-orange-400",
  miniapp: "text-purple-400",
};

export default function HistoryPage() {
  const { t, locale } = useI18n();
  const { data: history = [], isLoading } = useHistory();

  const dateLocale = locale === "ru" ? ru : enUS;

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };

  const item = {
    hidden: { opacity: 0, x: -16 },
    show: { opacity: 1, x: 0 },
  };

  return (
    <Layout title={t("historyTitle")}>
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3 text-center">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <HistoryIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium">{t("noHistory")}</p>
            <p className="text-sm text-muted-foreground max-w-[260px]">{t("noHistoryDesc")}</p>
          </div>
        ) : (
          <motion.div
            className="space-y-3"
            variants={container}
            initial="hidden"
            animate="show"
          >
            {history.map((entry) => {
              const config = statusConfig[entry.status] ?? statusConfig.pending;
              const Icon = config.icon;
              const isRunning = entry.status === "in_progress";

              return (
                <motion.div
                  key={entry.id}
                  variants={item}
                  className="bg-card border border-border/50 rounded-xl p-4 flex items-center gap-4"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}>
                    <Icon className={`w-5 h-5 ${config.color} ${isRunning ? "animate-spin" : ""}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{entry.botName}</span>
                      <span className={`text-xs font-medium ${botTypeColors[entry.botType]}`}>
                        {botTypeLabels[entry.botType]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(entry.createdAt), "d MMM, HH:mm", { locale: dateLocale })}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {entry.creditsUsed > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Zap className="w-3 h-3" />
                        <span>{entry.creditsUsed} {t("creditsUsed")}</span>
                      </div>
                    )}
                    {entry.elapsedSeconds != null && (
                      <span className="text-xs text-muted-foreground">
                        {entry.elapsedSeconds}{t("seconds")}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
