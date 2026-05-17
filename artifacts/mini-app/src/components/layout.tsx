import { Link, useLocation } from "wouter";
import { ReactNode, useState } from "react";
import {
  Menu, X, MessageSquare, Bot, Store,
  CreditCard, Users, Settings, LifeBuoy, ShieldAlert, History, Download
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useGetMe } from "@workspace/api-client-react";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptic";
import { motion } from "framer-motion";

export function Layout({ children, title = "Botify" }: { children: ReactNode; title?: string }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: user } = useGetMe();
  const { t } = useI18n();

  const ADMIN_TELEGRAM_IDS = ["12345", "admin"];
  const isAdmin = user?.telegramId ? ADMIN_TELEGRAM_IDS.includes(user.telegramId) : false;

  const navItems = [
    { label: t("newChat"), href: "/", icon: MessageSquare },
    { label: t("myBots"), href: "/my-bots", icon: Bot },
    { label: t("marketplace"), href: "/marketplace", icon: Store },
    { label: t("history"), href: "/history", icon: History },
    { label: t("balance"), href: "/balance", icon: CreditCard },
    { label: t("referral"), href: "/referral", icon: Users },
  ];

  const bottomItems = [
    { label: t("settings"), href: "/settings", icon: Settings },
    { label: t("support"), href: "/support", icon: LifeBuoy },
    ...(isAdmin ? [{ label: t("adminPanel"), href: "/admin", icon: ShieldAlert }] : []),
  ];

  const handleNav = () => {
    haptic.selection();
    setOpen(false);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-foreground hover:bg-secondary"
                onClick={() => haptic.light()}
              >
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 border-r-border/50 flex flex-col bg-card">
              <div className="p-4 border-b border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-bold text-lg">Botify</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto py-2">
                <nav className="flex flex-col gap-0.5 px-2">
                  {navItems.map((item) => {
                    const active = location === item.href;
                    return (
                      <Link key={item.href} href={item.href} onClick={handleNav}>
                        <motion.div
                          whileTap={{ scale: 0.97 }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                            active
                              ? "bg-primary/15 text-primary"
                              : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          <item.icon className={`w-5 h-5 ${active ? "text-primary" : ""}`} />
                          <span className="font-medium">{item.label}</span>
                          {active && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </motion.div>
                      </Link>
                    );
                  })}
                </nav>

                <div className="mx-4 my-2 border-t border-border/30" />

                {/* Code Purchase */}
                <div className="px-2">
                  <Link href="/balance" onClick={handleNav}>
                    <motion.div
                      whileTap={{ scale: 0.97 }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer text-foreground/80 hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      <Download className="w-5 h-5" />
                      <span className="font-medium">Выкуп кода</span>
                      <span className="ml-auto text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">2990₽</span>
                    </motion.div>
                  </Link>
                </div>
              </div>

              <div className="p-2 border-t border-border/50 mt-auto">
                <nav className="flex flex-col gap-0.5">
                  {bottomItems.map((item) => {
                    const active = location === item.href;
                    return (
                      <Link key={item.href} href={item.href} onClick={handleNav}>
                        <motion.div
                          whileTap={{ scale: 0.97 }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                            active
                              ? "bg-primary/15 text-primary"
                              : "text-foreground/80 hover:bg-secondary hover:text-foreground"
                          }`}
                        >
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </motion.div>
                      </Link>
                    );
                  })}
                </nav>

                {user && (
                  <div className="mt-3 px-3 py-3 bg-secondary/50 rounded-xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold shrink-0">
                      {(user.firstName?.[0] || user.username?.[0] || "U").toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold truncate">
                        {user.firstName || user.username || "User"}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">{user.plan} • {user.credits} кр.</span>
                    </div>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-base">{title}</span>
        </div>

        {user && (
          <Link href="/balance">
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-sm font-medium text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors"
              onClick={() => haptic.light()}
            >
              <CreditCard className="w-4 h-4 text-primary" />
              <span>{user.credits}</span>
            </motion.div>
          </Link>
        )}
      </header>

      <main className="flex-1 overflow-y-auto relative">{children}</main>
    </div>
  );
}
