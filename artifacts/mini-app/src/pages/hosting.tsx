import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { customFetch, useGetMe } from "@workspace/api-client-react";
import { Server, Cpu, HardDrive, Bot, CheckCircle2, Loader2, Clock, XCircle, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { haptic } from "@/lib/haptic";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface HostingPlan {
  id: string;
  name: string;
  ramGb: number;
  storageGb: number;
  maxBots: number;
  priceRub: number;
  description: string;
  color: string;
  emoji: string;
  popular?: boolean;
}

interface HostingSubscription {
  id: string;
  plan: string;
  status: "active" | "expired" | "cancelled" | "pending";
  ramGb: number;
  storageGb: number;
  maxBots: number;
  priceRub: number;
  paidUntil: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  active: { label: "Активен", color: "text-green-500", icon: CheckCircle2 },
  pending: { label: "Ожидает оплаты", color: "text-yellow-500", icon: Clock },
  expired: { label: "Истёк", color: "text-red-500", icon: XCircle },
  cancelled: { label: "Отменён", color: "text-muted-foreground", icon: XCircle },
};

export default function HostingPage() {
  const { data: _user } = useGetMe();
  const [plans, setPlans] = useState<HostingPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<HostingSubscription[]>([]);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      customFetch<HostingPlan[]>("/api/hosting/plans"),
      customFetch<HostingSubscription[]>("/api/hosting/my"),
    ]).then(([p, s]) => {
      setPlans(p);
      setSubscriptions(s);
    }).finally(() => setPlansLoading(false));
  }, []);

  const activeSub = subscriptions.find(s => s.status === "active");

  const handleSubscribe = async (plan: HostingPlan) => {
    haptic.medium();
    setLoadingPlan(plan.id);
    try {
      const result = await customFetch<{ paymentUrl?: string }>("/api/hosting/subscribe", {
        method: "POST",
        body: JSON.stringify({ planId: plan.id }),
      });
      if (result.paymentUrl) {
        window.open(result.paymentUrl, "_blank");
        toast.success("Страница оплаты открыта. После оплаты хостинг активируется автоматически.");
      } else {
        toast.error("Не удалось создать ссылку на оплату");
        haptic.error();
      }
    } catch {
      toast.error("Ошибка. Проверьте настройки ЮМани в .env");
      haptic.error();
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleCancel = async (subscriptionId: string) => {
    haptic.medium();
    setCancellingId(subscriptionId);
    try {
      await customFetch("/api/hosting/cancel", {
        method: "POST",
        body: JSON.stringify({ subscriptionId }),
      });
      setSubscriptions(prev => prev.map(s => s.id === subscriptionId ? { ...s, status: "cancelled" as const } : s));
      toast.success("Подписка отменена");
      haptic.success();
    } catch {
      toast.error("Не удалось отменить подписку");
    } finally {
      setCancellingId(null);
    }
  };

  const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } };
  const item = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };

  return (
    <Layout title="Хостинг">
      <motion.div className="p-4 space-y-6" variants={container} initial="hidden" animate="show">

        {/* Hero */}
        <motion.div variants={item}>
          <div className="bg-gradient-to-br from-blue-500/15 to-purple-500/10 border border-blue-500/20 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-400" />
              <h2 className="font-bold text-lg">Хостинг ботов</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Твои боты работают на наших серверах 24/7 — без VPS и настройки. Выбери тариф по нагрузке.
            </p>
            <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Uptime 99.9%</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Автоперезапуск</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-green-500" />Логи в реальном времени</span>
            </div>
          </div>
        </motion.div>

        {/* Активная подписка */}
        {activeSub && (
          <motion.div variants={item}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Текущий тариф</h3>
            <div className="bg-card border border-green-500/30 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center text-lg">
                    {plans.find(p => p.id === activeSub.plan)?.emoji ?? "🖥"}
                  </div>
                  <div>
                    <div className="font-semibold capitalize">{activeSub.plan}</div>
                    <div className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />Активен
                    </div>
                  </div>
                </div>
                <span className="text-lg font-bold">{activeSub.priceRub}₽<span className="text-xs font-normal text-muted-foreground">/мес</span></span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <Cpu className="w-4 h-4 mx-auto mb-1 text-blue-400" />
                  <div className="font-bold text-sm">{activeSub.ramGb} GB</div>
                  <div className="text-xs text-muted-foreground">RAM</div>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <HardDrive className="w-4 h-4 mx-auto mb-1 text-purple-400" />
                  <div className="font-bold text-sm">{activeSub.storageGb} GB</div>
                  <div className="text-xs text-muted-foreground">SSD</div>
                </div>
                <div className="bg-secondary/50 rounded-xl p-3 text-center">
                  <Bot className="w-4 h-4 mx-auto mb-1 text-green-400" />
                  <div className="font-bold text-sm">{activeSub.maxBots}</div>
                  <div className="text-xs text-muted-foreground">{activeSub.maxBots === 1 ? "Бот" : "Ботов"}</div>
                </div>
              </div>
              {activeSub.paidUntil && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Оплачен до</span>
                  <span className="font-medium">{format(new Date(activeSub.paidUntil), "d MMMM yyyy", { locale: ru })}</span>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleSubscribe(plans.find(p => p.id === activeSub.plan)!)}>
                  Продлить
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-500 hover:bg-red-500/10"
                  onClick={() => handleCancel(activeSub.id)}
                  disabled={cancellingId === activeSub.id}
                >
                  {cancellingId === activeSub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Отменить"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Тарифы */}
        <motion.div variants={item} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {activeSub ? "Сменить тариф" : "Выбери тариф"}
          </h3>

          {plansLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {plans.map((plan) => {
                const isActive = activeSub?.plan === plan.id;
                return (
                  <motion.div
                    key={plan.id}
                    whileTap={{ scale: 0.985 }}
                    className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-colors ${
                      isActive
                        ? "border-green-500/40 bg-green-500/5"
                        : plan.popular
                        ? "border-primary/40 bg-primary/5"
                        : "border-border/50 bg-card"
                    }`}
                  >
                    {plan.popular && !isActive && (
                      <div className="absolute -top-3 left-4 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                        Популярный
                      </div>
                    )}

                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-2xl shrink-0`}>
                      {plan.emoji}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{plan.name}</span>
                        {isActive && <span className="text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded-full font-medium">Активен</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Cpu className="w-3 h-3" />{plan.ramGb} GB RAM</span>
                        <span className="flex items-center gap-1"><HardDrive className="w-3 h-3" />{plan.storageGb} GB SSD</span>
                        <span className="flex items-center gap-1"><Bot className="w-3 h-3" />{plan.maxBots} {plan.maxBots === 1 ? "бот" : "ботов"}</span>
                      </div>
                    </div>

                    {/* Price + Button */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <span className="font-bold text-lg">{plan.priceRub}₽</span>
                        <span className="text-xs text-muted-foreground">/мес</span>
                      </div>
                      <Button
                        size="sm"
                        variant={isActive ? "secondary" : plan.popular ? "default" : "secondary"}
                        className="h-8 px-3"
                        onClick={() => handleSubscribe(plan)}
                        disabled={loadingPlan === plan.id}
                      >
                        {loadingPlan === plan.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isActive ? (
                          "Продлить"
                        ) : (
                          <span className="flex items-center gap-1">Купить <ChevronRight className="w-3 h-3" /></span>
                        )}
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* FAQ */}
        <motion.div variants={item} className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Часто спрашивают</h3>
          {[
            { q: "Когда бот начнёт работать?", a: "Сразу после подтверждения оплаты — активация автоматическая." },
            { q: "Что если мне нужно больше ботов?", a: "Выбери тариф с большим лимитом, старый будет заменён." },
            { q: "Можно ли изменить тариф в любое время?", a: "Да, смена тарифа происходит сразу. При переходе на более дорогой — доплачиваешь разницу." },
            { q: "Что происходит с ботами при истечении?", a: "Боты ставятся на паузу. Данные сохраняются 30 дней." },
          ].map((f, i) => (
            <div key={i} className="bg-card border border-border/50 rounded-xl p-3">
              <div className="font-medium text-sm">{f.q}</div>
              <div className="text-xs text-muted-foreground mt-1">{f.a}</div>
            </div>
          ))}
        </motion.div>

      </motion.div>
    </Layout>
  );
}
