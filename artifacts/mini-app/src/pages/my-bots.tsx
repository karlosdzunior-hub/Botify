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
  Bot,
} from "@workspace/api-client-react";
import { Play, Square, RotateCw, Trash2, Terminal, Bot as BotIcon, Loader2, Search, Plus, Wand2, Download, ExternalLink } from "lucide-react";
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

function BotCard({ bot }: { bot: Bot }) {
  const [logsOpen, setLogsOpen] = useState(false);
  const [improveOpen, setImproveOpen] = useState(false);
  const [improvement, setImprovement] = useState("");
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const restart = useRestartBot();
  const start = useStartBot();
  const stop = useStopBot();
  const deleteBot = useDeleteBot();
  const updateBot = useUpdateBot();

  const handleAction = (action: any, id: string) => {
    haptic.light();
    action.mutate({ id }, {
      onSuccess: () => {
        haptic.success();
        queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
      },
      onError: () => {
        haptic.error();
      },
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
          queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
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
    stopped: t("statusStopped"),
    error: t("statusError"),
    generating: t("statusGenerating"),
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card border border-border/50 rounded-xl p-4 flex flex-col gap-4"
    >
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
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      {bot.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">{bot.description}</p>
      )}

      {bot.botUsername && (
        <div className="text-xs bg-secondary/50 px-2 py-1 rounded-md w-fit">@{bot.botUsername}</div>
      )}

      {/* Main actions */}
      <div className="flex items-center gap-2 pt-1">
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
            disabled={start.isPending || bot.status === "generating"}
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
          disabled={restart.isPending || bot.status === "generating"}
          title={t("restart")}
        >
          {restart.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
        </Button>

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
                {updateBot.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wand2 className="w-4 h-4 mr-2" />}
                {t("applyImprovement")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function BotLogsView({ botId }: { botId: string }) {
  const { data, isLoading } = useGetBotLogs(botId, { query: { refetchInterval: 3000 } });

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="flex-1 bg-black/50 rounded-md p-4 overflow-y-auto font-mono text-xs text-green-400 space-y-1">
      {!data?.lines?.length ? (
        <span className="text-muted-foreground">No logs available</span>
      ) : (
        data.lines.map((line, i) => <div key={i}>{line}</div>)
      )}
    </div>
  );
}

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
              <Button className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => haptic.medium()}>
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
