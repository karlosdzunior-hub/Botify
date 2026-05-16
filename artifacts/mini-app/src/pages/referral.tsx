import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetReferral } from "@workspace/api-client-react";
import { Users, Copy, Gift, Coins, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ReferralPage() {
  const { data, isLoading } = useGetReferral();

  const handleCopy = () => {
    if (data?.referralLink) {
      navigator.clipboard.writeText(data.referralLink);
      toast.success("Referral link copied!");
    }
  };

  return (
    <Layout title="Referral Program">
      <div className="p-4 space-y-6">
        
        <div className="bg-gradient-to-br from-violet-500/20 to-fuchsia-500/5 border border-violet-500/20 rounded-2xl p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8 text-violet-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">Invite Friends, Earn Credits</h2>
            <p className="text-sm text-muted-foreground">
              Get 50 free credits for every friend who joins using your link, and they get 50 credits too!
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Your Referral Link</label>
              <div className="flex gap-2">
                <Input 
                  readOnly 
                  value={data.referralLink} 
                  className="bg-secondary/50 font-mono text-sm"
                />
                <Button size="icon" variant="secondary" onClick={handleCopy} className="shrink-0">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card border border-border/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
                <Users className="w-6 h-6 text-blue-500" />
                <div className="text-2xl font-bold">{data.referralsCount}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Friends Invited</div>
              </div>
              <div className="bg-card border border-border/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2">
                <Coins className="w-6 h-6 text-yellow-500" />
                <div className="text-2xl font-bold">{data.totalEarned}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Credits Earned</div>
              </div>
            </div>
          </div>
        ) : null}

      </div>
    </Layout>
  );
}
