import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetMe,
  useListTransactions,
  usePurchaseCredits,
  CreditPurchaseInputPackageId,
  customFetch,
} from "@workspace/api-client-react";
import { CreditCard, Zap, Shield, Crown, Sparkles, Loader2, ArrowUpRight, ArrowDownRight, Star, Server } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptic";
import { motion } from "framer-motion";
import { useState } from "react";

const PACKAGES = [
  { id: CreditPurchaseInputPackageId.starter, name: "Старт 🌱", credits: 100, bonus: 0, price: 199, icon: Zap, color: "text-blue-500" },
  { id: CreditPurchaseInputPackageId.basic, name: "Базовый ⚡", credits: 300, bonus: 30, price: 499, icon: Shield, color: "text-green-500" },
  { id: CreditPurchaseInputPackageId.pro, name: "Про 🚀", credits: 800, bonus: 100, price: 1190, icon: Crown, color: "text-yellow-500", popular: true },
  { id: CreditPurchaseInputPackageId.max, name: "Макс 💎", credits: 2000, bonus: 300, price: 2490, icon: Sparkles, color: "text-purple-500" },
];

const HOSTING_PLANS = [
  { id: "one", name: "Один бот", price: 149, bots: 1 },
  { id: "three", name: "Три бота", price: 349, bots: 3, popular: true },
  { id: "ten", name: "10 ботов", price: 899, bots: 10 },
  { id: "agency", name: "Агентский", price: 1990, bots: 30 },
];

const TX_TYPE_LABELS: Record<string, string> = {
  purchase: "Пополнение",
  generation: "Генерация",
  hosting: "Хостинг",
  refund: "Возврат",
  referral: "Реферал",
  bonus: "Бонус",
};

export default function BalancePage() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: transactions = [], isLoading: txLoading } = useListTransactions();
  const purchase = usePurchaseCredits();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const [paymentMethod, setPaymentMethod] = useState<"yumoney" | "stars">("yumoney");
  const [loadingPkg, setLoadingPkg] = useState<string | null>(null);
  const [loadingHosting, setLoadingHosting] = useState<string | null>(null);

  const handlePurchaseYuMoney = async (pkg: typeof PACKAGES[0]) => {
    haptic.medium();
    setLoadingPkg(pkg.id);
    try {
      const result = await customFetch<{ confirmationUrl?: string }>("/api/payments/yumoney/create", {
        method: "POST",
        body: JSON.stringify({ packageId: pkg.id }),
      });
      if (result.confirmationUrl) {
        window.open(result.confirmationUrl, "_blank");
      } else {
        toast.error("Не удалось создать платёж");
        haptic.error();
      }
    } catch {
      // Fallback to mock purchase in dev
      purchase.mutate({ data: { packageId: pkg.id as any } }, {
        onSuccess: (res) => {
          haptic.success();
          toast.success(`Добавлено ${res.creditsAdded} кредитов!`);
          queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
          queryClient.invalidateQueries({ queryKey: ["/api/users/transactions"] });
        },
        onError: () => {
          haptic.error();
          toast.error("Ошибка при пополнении");
        },
      });
    } finally {
      setLoadingPkg(null);
    }
  };

  const handlePurchaseStars = async (pkg: typeof PACKAGES[0]) => {
    haptic.medium();
    setLoadingPkg(pkg.id);
    try {
      const result = await customFetch<{ invoiceLink?: string; starsPrice?: number }>("/api/payments/stars/invoice", {
        method: "POST",
        body: JSON.stringify({ packageId: pkg.id }),
      });
      if (result.invoiceLink) {
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openInvoice) {
          tg.openInvoice(result.invoiceLink, (status: string) => {
            if (status === "paid") {
              haptic.success();
              toast.success(`Оплачено! Кредиты начислятся в течение минуты.`);
              queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
            }
          });
        } else {
          window.open(result.invoiceLink, "_blank");
        }
      } else {
        toast.error("Не удалось создать счёт");
        haptic.error();
      }
    } catch {
      haptic.error();
      toast.error("Telegram Stars недоступны");
    } finally {
      setLoadingPkg(null);
    }
  };

  const handleHosting = async (planId: string) => {
    haptic.medium();
    setLoadingHosting(planId);
    try {
      const result = await customFetch<{ confirmationUrl?: string }>("/api/payments/hosting/yumoney", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      if (result.confirmationUrl) {
        window.open(result.confirmationUrl, "_blank");
      } else {
        toast.error("Не удалось создать платёж");
        haptic.error();
      }
    } catch {
      toast.info("Хостинг: настройте YuMoney в .env файле");
    } finally {
      setLoadingHosting(null);
    }
  };

  const handlePurchase = (pkg: typeof PACKAGES[0]) => {
    if (paymentMethod === "yumoney") handlePurchaseYuMoney(pkg);
    else handlePurchaseStars(pkg);
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

  return (
    <Layout title={t("balance")}>
      <motion.div className="p-4 space-y-6" variants={container} initial="hidden" animate="show">

        {/* Balance Card */}
        <motion.div variants={item}>
          <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <CreditCard className="w-32 h-32" />
            </div>
            <div className="relative z-10 space-y-4">
              <div className="space-y-1">
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {t("currentBalance")}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold tracking-tight">
                    {userLoading ? "..." : user?.credits}
                  </span>
                  <span className="text-lg text-primary font-medium">{t("credits")}</span>
                </div>
              </div>
              {user?.plan && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-background/50 backdrop-blur border border-border/50 text-sm font-medium">
                  <Crown className="w-4 h-4 text-yellow-500" />
                  <span className="capitalize">{user.plan} Plan</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Buy Credits */}
        <motion.div variants={item} className="space-y-4">
          <h2 className="text-lg font-semibold">{t("buyCredits")}</h2>

          {/* Payment Method Toggle */}
          <div className="flex items-center gap-2 p-1 bg-secondary/50 rounded-xl border border-border/30">
            <button
              onClick={() => { haptic.selection(); setPaymentMethod("yumoney"); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${paymentMethod === "yumoney" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <span>💳</span>
              <span>{t("yuMoney")}</span>
            </button>
            <button
              onClick={() => { haptic.selection(); setPaymentMethod("stars"); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${paymentMethod === "stars" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <Star className="w-4 h-4 text-yellow-500" />
              <span>{t("telegramStars")}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {PACKAGES.map((pkg) => (
              <motion.div
                key={pkg.id}
                whileTap={{ scale: 0.97 }}
                className={`relative flex flex-col p-4 rounded-xl border gap-3 ${pkg.popular ? "border-primary bg-primary/5" : "border-border/50 bg-card"}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Popular
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg bg-secondary ${pkg.color}`}>
                    <pkg.icon className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-sm">{pkg.name}</span>
                </div>
                <div>
                  <div className="text-2xl font-bold">{pkg.credits + pkg.bonus}</div>
                  <div className="text-xs text-muted-foreground">
                    {pkg.bonus > 0 ? `${pkg.credits}+${pkg.bonus} бонус` : "кредитов"}
                  </div>
                </div>
                <Button
                  className="w-full mt-auto"
                  variant={pkg.popular ? "default" : "secondary"}
                  size="sm"
                  onClick={() => handlePurchase(pkg)}
                  disabled={loadingPkg === pkg.id}
                >
                  {loadingPkg === pkg.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : paymentMethod === "stars" ? (
                    <span className="flex items-center gap-1"><Star className="w-3 h-3" /> Stars</span>
                  ) : (
                    `${pkg.price}₽`
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Hosting */}
        <motion.div variants={item} className="space-y-4">
          <div className="flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">{t("hosting")}</h2>
          </div>
          <p className="text-sm text-muted-foreground -mt-2">{t("hostingDesc")}</p>
          <div className="grid grid-cols-2 gap-3">
            {HOSTING_PLANS.map((plan) => (
              <motion.div
                key={plan.id}
                whileTap={{ scale: 0.97 }}
                className={`relative flex flex-col p-4 rounded-xl border gap-2 ${plan.popular ? "border-primary bg-primary/5" : "border-border/50 bg-card"}`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Popular
                  </div>
                )}
                <span className="font-semibold text-sm">{plan.name}</span>
                <div>
                  <span className="text-xl font-bold">{plan.price}₽</span>
                  <span className="text-xs text-muted-foreground">/мес</span>
                </div>
                <span className="text-xs text-muted-foreground">до {plan.bots} {plan.bots === 1 ? "бота" : "ботов"}</span>
                <Button
                  size="sm"
                  variant={plan.popular ? "default" : "secondary"}
                  className="w-full mt-1"
                  onClick={() => handleHosting(plan.id)}
                  disabled={loadingHosting === plan.id}
                >
                  {loadingHosting === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : t("buyHosting")}
                </Button>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Transactions */}
        <motion.div variants={item} className="space-y-4">
          <h2 className="text-lg font-semibold">{t("transactionHistory")}</h2>
          <div className="space-y-2">
            {txLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {t("noTransactions")}
              </div>
            ) : (
              transactions.map((tx) => (
                <motion.div
                  key={tx.id}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${tx.amount > 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                      {tx.amount > 0 ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm">{TX_TYPE_LABELS[tx.type] ?? tx.type}</span>
                      {tx.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]">{tx.description}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(tx.createdAt), "d MMM, HH:mm", { locale: ru })}
                      </span>
                    </div>
                  </div>
                  <div className={`font-semibold text-sm ${tx.amount > 0 ? "text-green-500" : "text-red-500"}`}>
                    {tx.amount > 0 ? "+" : ""}{tx.amount}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </Layout>
  );
}
