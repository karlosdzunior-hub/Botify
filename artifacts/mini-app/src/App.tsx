import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/chat";
import MyBotsPage from "@/pages/my-bots";
import MarketplacePage from "@/pages/marketplace";
import BalancePage from "@/pages/balance";
import ReferralPage from "@/pages/referral";
import AdminPage from "@/pages/admin";
import SettingsPage from "@/pages/settings";
import SupportPage from "@/pages/support";
import HistoryPage from "@/pages/history";
import { useTelegramAuth } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";

const queryClient = new QueryClient();

function Router() {
  const { isAuthenticated, error } = useTelegramAuth();

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg text-center max-w-sm">
          <p className="font-semibold">Authentication Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={ChatPage} />
      <Route path="/my-bots" component={MyBotsPage} />
      <Route path="/marketplace" component={MarketplacePage} />
      <Route path="/balance" component={BalancePage} />
      <Route path="/referral" component={ReferralPage} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/support" component={SupportPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;
