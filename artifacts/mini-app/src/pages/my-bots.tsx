import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  useListBots,
  useRestartBot,
  useStartBot,
  useStopBot,
  useDeleteBot,
  useGetBotLogs,
  useUpdateBot,
  customFetch,
  Bot,
} from "@workspace/api-client-react";
import {
  Play, Square, RotateCw, Trash2, Terminal, Bot as BotIcon,
  Loader2, Search, Plus, Wand2, Rocket, Clock, Server,
  CheckCircle2, ChevronRight, Cpu, HardDrive,
} from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptic";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ─── Hosting plans ─────────────────────────────────────────────────────────────

interface HostingPlan {
  id: string;
  name: string;
  ramGb: number;
  storageGb: number;
  maxBots: number;
  priceRub: number;
  description: string;
  emoji: string;
  popular?: boolean;
}

const TRIAL_PLAN = {
  id: "trial",
  name: "Пробный",
  emoji: "⏱",
  description: "30 минут бесплатно",
  priceRub: 0,
};

// ─── Publish modal ─────────────────────────────────────────────────────────────

function PublishModal({
  bot,
  open,
  onClose,
  onSuccess,
}: {
  bot: Bot;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [plans, setPlans] = useState<HostingPlan[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);

  const loadPlans = async () => {
    if (plansLoaded) return;
    try {
      const data = await customFetch<HostingPlan[]>("/api/hosting/plans");
      setPlans(data);
      setPlansLoaded(true);
    } catch {
      toast.error("Не удалось загрузить тарифы");
    }
  };

  const handlePublish = async (planId: string) => {
    haptic.medium();
    setPublishing(planId);
    try {
      const result = await customFetch<{
        success?: boolean;
        requiresPayment?: boolean;
        paymentUrl?: string;
        trialEndsAt?: string;
        error?: string;
      }>(`/api/bots/${bot.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ plan: planId }),
      });

      if (result.requiresPayment && result.paymentUrl) {
        window.open(result.paymentUrl, "_blank");
        toast.success("Страница оплаты открыта. После оплаты бот запустится автоматически.");
        onClose();
      } else if (result.success) {
        if (planId === "trial") {
          toast.success("Пробный период активирован! Бот запущен на 30 минут.");
        } else {
          toast.success("Бот успешно опубликован и запущен!");
        }
        onSuccess();
        onClose();
      } else if (result.error) {
        toast.error(result.error);
        haptic.error();
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ошибка публикации");
      haptic.error();
    } finally {
      setPublishing(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
        else loadPlans();
      }}
    >
      <DialogContent className="bg-card border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Опубликовать бота
          </DialogTitle>
          <DialogDescription>
            Выбери тариф — бот запустится на нашем сервере и будет работать 24/7
          </DialogDescription>
        </DialogHeader>

        {!bot.botToken && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-sm text-yellow-400">
            ⚠️ Укажи токен бота при создании. Получи его у @BotFather.
          </div>
        )}

        <div className="space-y-3 pt-1">
          {/* Free trial */}
          {!(bot as any).trialEndsAt && (
            <motion.div
              whileTap={{ scale: 0.985 }}
              className="relative flex items-center gap-4 p-4 rounded-2xl border border-primary/40 bg-primary/5 cursor-pointer"
              onClick={() => !publishing && handlePublish("trial")}
            >
              <div className="absolute -top-3 left-4 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                Бесплатно
              </div>
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-2xl shrink-0">
                ⏱
              </div>
              <div className="flex-1">
                <div className="font-bold">Пробный период</div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                  <Clock className="w-3.5 h-3.5" />
                  30 минут — проверь что всё работает
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0"
                disabled={publishing === "trial" || !bot.botToken}
              >
                {publishing === "trial" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Запустить"
                )}
              </Button>
            </motion.div>
          )}

          {(bot as any).trialEndsAt && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              Пробный период уже использован для этого бота
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-2 py-1">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-xs text-muted-foreground">Платные тарифы</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          {/* Paid plans */}
          {!plansLoaded ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            plans.map((plan) => (
              <motion.div
                key={plan.id}
                whileTap={{ scale: 0.985 }}
                className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${
                  plan.popular
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/50 bg-card"
                }`}
                onClick={() => !publishing && handlePublish(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-4 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Популярный
                  </div>
                )}
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-xl shrink-0">
                  {plan.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{plan.name}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{plan.ramGb}GB</span>
                    <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{plan.storageGb}GB</span>
                    <span className="flex items-center gap-1"><BotIcon className="w-3 h-3" />{plan.maxBots} {plan.maxBots === 1 ? "бот" : "ботов"}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span className="font-bold">{plan.priceRub}₽<span className="text-xs font-normal text-muted-foreground">/мес</span></span>
                  <Button
                    size="sm"
                    variant={plan.popular ? "default" : "secondary"}
                    className="h-7 px-2.5 text-xs"
                    disabled={publishing === plan.id || !bot.botToken}
                  >
                    {publishing === plan.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <span className="flex items-center gap-1">Купить <ChevronRight className="w-3 h-3" /></span>
                    )}
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bot card ──────────────────────────────────────────────────────────────────

function BotCard({ bot }: { bot: Bot }) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [improveOpen, setImproveOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [improvement, setImprovement] = useState("");
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const restart = useRestartBot();
  const start = useStartBot();
  const stop = useStopBot();
  const deleteBot = useDeleteBot();
  const updateBot = useUpdateBot();

  const isPublished = !!(bot as any).publishedAt;
  const trialEndsAt: string | null = (bot as any).trialEndsAt ?? null;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/bots"] });

  const handleAction = (action: any, id: string) => {
    haptic.light();
    action.mutate({ id }, {
      onSuccess: () => { haptic.success(); invalidate(); },
      onError: () => haptic.error(),
    });
  };

  const handleImprove = () => {
    if (!improvement.trim()) return;
    haptic.medium();
    updateBot.mutate(
      { id: bot.id, data: { improvement: improvement.trim() } },
      {
        onSuccess: () => {
          haptic.success();
          toast.success("Улучшение запущено!");
          invalidate();
          setImproveOpen(false);
          setImprovement("");
        },
        onError: (err: any) => {
          haptic.error();
          toast.error(err?.message ?? "Ошибка при улучшении");
        },
      },
    );
  };

  const handleDelete = () => {
    if (!confirm(t("deleteConfirm"))) return;
    haptic.heavy();
    handleAction(deleteBot, bot.id);
  };

  const statusColors = {
    running: "bg-green-500",
    stopped: "bg-muted-foreground",
    error: "bg-destructive",
    generating: "bg-primary animate-pulse",
  };

  const statusLabels = {
    running: t("statusRunning"),
    stopped: isPublished ? t("statusStopped") : "Не опубликован",
    error: t("statusError"),
    generating: t("statusGenerating"),
  };

  const trialActive = trialEndsAt && new Date(trialEndsAt) > new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card border border-border/50 rounded-xl p-4 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <BotIcon className="w-6 h-6 text-primary" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate">{bot.name}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{bot.botType}</span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${statusColors[bot.status]}`} />
                <span>{statusLabels[bot.status]}</span>
              </span>
            </div>
          </div>
        </div>
        {bot.botUsername && (
          <a
            href={`https://t.me/${bot.botUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary"
            onClick={() => haptic.light()}
          >
            <Server className="w-4 h-4" />
          </a>
        )}
      </div>

      {bot.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{bot.description}</p>
      )}

      {/* Trial badge */}
      {trialActive && (
        <div className="flex items-center gap-1.5 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2.5 py-1.5 w-fit">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          Пробный период до {new Date(trialEndsAt!).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">

        {/* Not published → show Publish button */}
        {!isPublished && bot.status !== "generating" && (
          <Button
            className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
            size="sm"
            onClick={() => { haptic.medium(); setPublishOpen(true); }}
          >
            <Rocket className="w-4 h-4 mr-2" />
            Опубликовать
          </Button>
        )}

        {/* Published → show Start / Stop */}
        {isPublished && bot.status !== "generating" && (
          <>
            {bot.status === "running" ? (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 bg-secondary/50 border-border/50"
                onClick={() => handleAction(stop, bot.id)}
                disabled={stop.isPending}
              >
                {stop.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
                {t("stop")}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 bg-secondary/50 border-border/50"
                onClick={() => handleAction(start, bot.id)}
                disabled={start.isPending}
              >
                {start.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                {t("start")}
              </Button>
            )}

            <Button
              variant="outline"
              size="icon"
              className="bg-secondary/50 border-border/50 shrink-0"
              onClick={() => handleAction(restart, bot.id)}
              disabled={restart.isPending}
              title={t("restart")}
            >
              {restart.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
            </Button>
          </>
        )}

        {/* Generating placeholder */}
        {bot.status === "generating" && (
          <div className="flex-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Генерация...
          </div>
        )}

        {/* Logs, Improve, Delete — always shown */}
        <Button
          variant="outline"
          size="icon"
          className="bg-secondary/50 border-border/50 shrink-0"
          onClick={() => { haptic.light(); setLogsOpen(true); }}
          title="Логи"
        >
          <Terminal className="w-4 h-4" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="bg-secondary/50 border-border/50 shrink-0"
          onClick={() => { haptic.light(); setImproveOpen(true); }}
          disabled={bot.status === "generating"}
          title={t("improve")}
        >
          <Wand2 className="w-4 h-4 text-primary" />
        </Button>

        <Button
          variant="outline"
          size="icon"
          className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive hover:text-destructive-foreground shrink-0"
          onClick={handleDelete}
          disabled={deleteBot.isPending}
          title={t("delete")}
        >
          {deleteBot.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </Button>
      </div>

      {/* Publish Modal */}
      <PublishModal
        bot={bot}
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onSuccess={invalidate}
      />

      {/* Logs Dialog */}
      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Логи: {bot.name}
            </DialogTitle>
          </DialogHeader>
          <BotLogsView botId={bot.id} />
        </DialogContent>
      </Dialog>

      {/* Improve Dialog */}
      <Dialog open={improveOpen} onOpenChange={setImproveOpen}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              {t("improveTitle")}: {bot.name}
            </DialogTitle>
            <DialogDescription>{t("improveDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              value={improvement}
              onChange={(e) => setImprovement(e.target.value)}
              placeholder={t("improvePlaceholder")}
              className="min-h-[120px] bg-secondary/30 border-border/50 resize-none"
            />
            <p className="text-xs text-muted-foreground">{t("improveCost")}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { haptic.light(); setImproveOpen(false); }}
              >
                {t("cancel")}
              </Button>
              <Button
                className="flex-1"
                onClick={handleImprove}
                disabled={!improvement.trim() || updateBot.isPending}
              >
                {updateBot.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-2" />
                )}
                {t("applyImprovement")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ─── Logs view ─────────────────────────────────────────────────────────────────

function BotLogsView({ botId }: { botId: string }) {
  const { data, isLoading } = useGetBotLogs(botId);

  if (isLoading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="flex-1 bg-black/50 rounded-md p-4 overflow-y-auto font-mono text-xs text-green-400 space-y-1">
      {!data?.lines?.length ? (
        <span className="text-muted-foreground">Нет логов. Опубликуй бота чтобы он начал работать.</span>
      ) : (
        data.lines.map((line, i) => <div key={i}>{line}</div>)
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function MyBotsPage() {
  const { data: bots = [], isLoading } = useListBots();
  const [search, setSearch] = useState("");
  const { t } = useI18n();

  const filteredBots = bots.filter((bot) =>
    bot.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Layout title={t("myBots")}>
      <div className="p-4 space-y-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchBots")}
              className="pl-9 bg-secondary/50 border-border/50"
            />
          </div>
          <Link href="/">
            <Button
              size="icon"
              className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => haptic.medium()}
            >
              <Plus className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <BotIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium">{t("noBotsTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("noBotsDesc")}</p>
            <Link href="/">
              <Button
                className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => haptic.medium()}
              >
                {t("createNewBot")}
              </Button>
            </Link>
          </div>
        ) : (
          <AnimatePresence>
            <div className="grid grid-cols-1 gap-4">
              {filteredBots.map((bot) => (
                <BotCard key={bot.id} bot={bot} />
              ))}
            </div>
          </AnimatePresence>
        )}
      </div>
    </Layout>
  );
}
