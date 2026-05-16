import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { 
  useGetMe,
  useListTransactions,
  usePurchaseCredits,
  CreditPurchaseInputPackageId
} from "@workspace/api-client-react";
import { CreditCard, Zap, Shield, Crown, Sparkles, Loader2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

const PACKAGES = [
  { id: CreditPurchaseInputPackageId.starter, name: "Starter", credits: 100, price: "199₽", icon: Zap, color: "text-blue-500" },
  { id: CreditPurchaseInputPackageId.basic, name: "Basic", credits: 300, price: "499₽", icon: Shield, color: "text-green-500" },
  { id: CreditPurchaseInputPackageId.pro, name: "Pro", credits: 800, price: "1190₽", icon: Crown, color: "text-yellow-500", popular: true },
  { id: CreditPurchaseInputPackageId.max, name: "Max", credits: 2000, price: "2490₽", icon: Sparkles, color: "text-purple-500" }
];

export default function BalancePage() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: transactions = [], isLoading: txLoading } = useListTransactions();
  const purchase = usePurchaseCredits();
  const queryClient = useQueryClient();

  const handlePurchase = (packageId: CreditPurchaseInputPackageId) => {
    purchase.mutate({ data: { packageId } }, {
      onSuccess: (res) => {
        toast.success(`Successfully added ${res.creditsAdded} credits!`);
        queryClient.invalidateQueries({ queryKey: ['/api/users/me'] });
        queryClient.invalidateQueries({ queryKey: ['/api/users/transactions'] });
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to purchase credits");
      }
    });
  };

  return (
    <Layout title="Balance & Credits">
      <div className="p-4 space-y-8">
        
        {/* Balance Card */}
        <div className="bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CreditCard className="w-32 h-32" />
          </div>
          <div className="relative z-10 space-y-4">
            <div className="space-y-1">
              <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Current Balance</span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight">{userLoading ? "..." : user?.credits}</span>
                <span className="text-lg text-primary font-medium">Credits</span>
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

        {/* Purchase Packages */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Buy Credits</h2>
          <div className="grid grid-cols-2 gap-4">
            {PACKAGES.map((pkg) => (
              <div key={pkg.id} className={`relative flex flex-col p-4 rounded-xl border ${pkg.popular ? 'border-primary bg-primary/5' : 'border-border/50 bg-card'} gap-3`}>
                {pkg.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Most Popular
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg bg-secondary ${pkg.color}`}>
                    <pkg.icon className="w-4 h-4" />
                  </div>
                  <span className="font-semibold">{pkg.name}</span>
                </div>
                <div>
                  <div className="text-2xl font-bold">{pkg.credits}</div>
                  <div className="text-xs text-muted-foreground">credits</div>
                </div>
                <Button 
                  className="w-full mt-auto" 
                  variant={pkg.popular ? "default" : "secondary"}
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={purchase.isPending}
                >
                  {pkg.price}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Transaction History</h2>
          <div className="space-y-3">
            {txLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No transactions yet
              </div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tx.amount > 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      {tx.amount > 0 ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-sm capitalize">{tx.type}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(tx.createdAt), 'MMM d, HH:mm')}
                      </span>
                    </div>
                  </div>
                  <div className={`font-semibold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
