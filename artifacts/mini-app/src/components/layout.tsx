import { Link, useLocation } from "wouter";
import { ReactNode, useState } from "react";
import { 
  Menu, X, MessageSquare, Bot, Store, 
  CreditCard, Users, Settings, LifeBuoy, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useGetMe } from "@workspace/api-client-react";

export function Layout({ children, title = "Bot Factory" }: { children: ReactNode, title?: string }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: user } = useGetMe();

  const isAdmin = user?.telegramId === "12345" || user?.telegramId === "admin"; // Using 12345 as fallback for web preview mock

  const navItems = [
    { label: "New Chat", href: "/", icon: MessageSquare },
    { label: "My Bots", href: "/my-bots", icon: Bot },
    { label: "Marketplace", href: "/marketplace", icon: Store },
    { label: "Balance & Credits", href: "/balance", icon: CreditCard },
    { label: "Referral Program", href: "/referral", icon: Users },
  ];

  const bottomItems = [
    { label: "Settings", href: "/settings", icon: Settings },
    { label: "Support", href: "/support", icon: LifeBuoy },
    ...(isAdmin ? [{ label: "Admin Panel", href: "/admin", icon: ShieldAlert }] : [])
  ];

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-foreground hover:bg-secondary">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 border-r-border/50 flex flex-col bg-card">
              <div className="p-4 border-b border-border/50 flex items-center justify-between">
                <span className="font-semibold text-lg text-foreground">Bot Factory</span>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="flex-1 overflow-y-auto py-2">
                <nav className="flex flex-col gap-1 px-2">
                  {navItems.map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${location === item.href ? 'bg-primary/20 text-primary' : 'text-foreground/80 hover:bg-secondary hover:text-foreground'}`}>
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                    </Link>
                  ))}
                </nav>
              </div>

              <div className="p-2 border-t border-border/50 mt-auto">
                <nav className="flex flex-col gap-1">
                  {bottomItems.map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setOpen(false)}>
                      <div className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${location === item.href ? 'bg-primary/20 text-primary' : 'text-foreground/80 hover:bg-secondary hover:text-foreground'}`}>
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                    </Link>
                  ))}
                </nav>
                {user && (
                  <div className="mt-4 px-3 py-3 bg-secondary/50 rounded-lg flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {(user.firstName?.[0] || user.username?.[0] || 'U').toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{user.firstName || user.username || 'User'}</span>
                      <span className="text-xs text-muted-foreground">{user.credits} credits</span>
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
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-sm font-medium text-secondary-foreground cursor-pointer hover:bg-secondary/80 transition-colors">
              <CreditCard className="w-4 h-4 text-primary" />
              <span>{user.credits}</span>
            </div>
          </Link>
        )}
      </header>

      <main className="flex-1 overflow-y-auto relative">
        {children}
      </main>
    </div>
  );
}
