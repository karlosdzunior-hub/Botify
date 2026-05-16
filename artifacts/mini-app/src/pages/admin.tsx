import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useGetAdminStats,
  useListAdminUsers,
  useAdminAddCredits,
  customFetch,
} from "@workspace/api-client-react";
import { Users, Bot, Zap, TrendingUp, Loader2, Ban, SendHorizonal, CreditCard } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptic";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AdminUser {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  credits: number;
  plan: string;
  isBanned: boolean;
}

export default function AdminPage() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: users = [], isLoading: usersLoading } = useListAdminUsers();
  const addCredits = useAdminAddCredits();
  const queryClient = useQueryClient();
  const { t } = useI18n();

  const [creditsDialog, setCreditsDialog] = useState<AdminUser | null>(null);
  const [creditsAmount, setCreditsAmount] = useState("");
  const [creditsReason, setCreditsReason] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [banning, setBanning] = useState<string | null>(null);

  const statItems = [
    { label: t("totalUsers"), value: stats?.totalUsers, icon: Users, color: "text-blue-500" },
    { label: t("activeUsers"), value: stats?.activeUsers, icon: TrendingUp, color: "text-green-500" },
    { label: t("totalBots"), value: stats?.totalBots, icon: Bot, color: "text-purple-500" },
    { label: t("runningBots"), value: stats?.runningBots, icon: Zap, color: "text-yellow-500" },
    { label: t("totalGenerations"), value: stats?.totalGenerations, icon: Zap, color: "text-orange-500" },
    { label: t("totalRevenue"), value: stats?.totalRevenue ? `${stats.totalRevenue}₽` : "0₽", icon: CreditCard, color: "text-green-400" },
  ];

  const handleAddCredits = () => {
    if (!creditsDialog || !creditsAmount) return;
    haptic.medium();
    addCredits.mutate(
      { data: { userId: creditsDialog.id, amount: parseInt(creditsAmount), reason: creditsReason || undefined } },
      {
        onSuccess: () => {
          haptic.success();
          toast.success("Кредиты начислены");
          queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
          setCreditsDialog(null);
          setCreditsAmount("");
          setCreditsReason("");
        },
        onError: () => {
          haptic.error();
          toast.error("Ошибка начисления");
        },
      },
    );
  };

  const handleBan = async (user: AdminUser) => {
    haptic.heavy();
    setBanning(user.id);
    try {
      await customFetch("/api/admin/ban", {
        method: "POST",
        body: JSON.stringify({ userId: user.id, banned: !user.isBanned }),
      });
      haptic.success();
      toast.success(user.isBanned ? "Пользователь разблокирован" : "Пользователь заблокирован");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    } catch {
      haptic.error();
      toast.error("Ошибка");
    } finally {
      setBanning(null);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    haptic.medium();
    setBroadcasting(true);
    try {
      const result = await customFetch<{ sent?: number; failed?: number }>("/api/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({ message: broadcastMsg.trim() }),
      });
      haptic.success();
      toast.success(`Отправлено: ${result.sent ?? 0}, ошибок: ${result.failed ?? 0}`);
      setBroadcastMsg("");
    } catch {
      haptic.error();
      toast.error("Ошибка рассылки");
    } finally {
      setBroadcasting(false);
    }
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <Layout title={t("adminTitle")}>
      <motion.div className="p-4 space-y-6" variants={container} initial="hidden" animate="show">

        {/* Stats */}
        <motion.div variants={item}>
          {statsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {statItems.map((s) => (
                <div key={s.label} className="bg-card border border-border/50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <s.icon className={`w-4 h-4 ${s.color}`} />
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                  <span className="text-2xl font-bold">{s.value ?? "—"}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Broadcast */}
        <motion.div variants={item} className="space-y-3">
          <div className="flex items-center gap-2">
            <SendHorizonal className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("broadcast")}
            </h2>
          </div>
          <div className="bg-card border border-border/50 rounded-xl p-4 space-y-3">
            <Textarea
              value={broadcastMsg}
              onChange={(e) => setBroadcastMsg(e.target.value)}
              placeholder={t("broadcastPlaceholder")}
              className="min-h-[80px] bg-secondary/30 border-border/50 resize-none text-sm"
            />
            <Button
              className="w-full"
              onClick={handleBroadcast}
              disabled={!broadcastMsg.trim() || broadcasting}
            >
              {broadcasting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <SendHorizonal className="w-4 h-4 mr-2" />}
              {t("send")}
            </Button>
          </div>
        </motion.div>

        {/* Users */}
        <motion.div variants={item} className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Пользователи ({(users as AdminUser[]).length})
            </h2>
          </div>

          {usersLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {(users as AdminUser[]).map((u) => (
                <div
                  key={u.id}
                  className={`bg-card border rounded-xl p-3 flex items-center gap-3 ${u.isBanned ? "border-destructive/30 opacity-60" : "border-border/50"}`}
                >
                  <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-sm font-bold shrink-0">
                    {(u.firstName?.[0] || u.username?.[0] || "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">
                        {u.firstName || u.username || `id:${u.telegramId}`}
                      </span>
                      {u.isBanned && <Ban className="w-3 h-3 text-destructive shrink-0" />}
                    </div>
                    <span className="text-xs text-muted-foreground">{u.credits} кр. • {u.plan}</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-primary hover:bg-primary/10"
                      onClick={() => { haptic.light(); setCreditsDialog(u); }}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`h-8 px-2 ${u.isBanned ? "text-green-500 hover:bg-green-500/10" : "text-destructive hover:bg-destructive/10"}`}
                      onClick={() => handleBan(u)}
                      disabled={banning === u.id}
                    >
                      {banning === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* Add Credits Dialog */}
      <Dialog open={!!creditsDialog} onOpenChange={() => setCreditsDialog(null)}>
        <DialogContent className="bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>
              Начислить кредиты: {creditsDialog?.firstName || creditsDialog?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              type="number"
              value={creditsAmount}
              onChange={(e) => setCreditsAmount(e.target.value)}
              placeholder="Количество кредитов"
              className="bg-secondary/50 border-border/50"
            />
            <Input
              value={creditsReason}
              onChange={(e) => setCreditsReason(e.target.value)}
              placeholder="Причина (необязательно)"
              className="bg-secondary/50 border-border/50"
            />
            <Button
              className="w-full"
              onClick={handleAddCredits}
              disabled={!creditsAmount || addCredits.isPending}
            >
              {addCredits.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t("addCredits")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
