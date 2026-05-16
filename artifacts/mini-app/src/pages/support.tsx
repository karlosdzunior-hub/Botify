import { Layout } from "@/components/layout";
import { LifeBuoy, Mail, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SupportPage() {
  return (
    <Layout title="Support">
      <div className="p-4 space-y-6">
        <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/5 border border-blue-500/20 rounded-2xl p-6 text-center space-y-4">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto">
            <LifeBuoy className="w-8 h-8 text-blue-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-2">How can we help?</h2>
            <p className="text-sm text-muted-foreground">
              We're here to help you build the best Telegram bots.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button variant="outline" className="w-full justify-start h-14 bg-card border-border/50">
            <MessageCircle className="w-5 h-5 mr-3 text-primary" />
            <div className="flex flex-col items-start">
              <span className="font-medium">Telegram Support</span>
              <span className="text-xs text-muted-foreground">@botfactory_support</span>
            </div>
          </Button>
          
          <Button variant="outline" className="w-full justify-start h-14 bg-card border-border/50">
            <Mail className="w-5 h-5 mr-3 text-primary" />
            <div className="flex flex-col items-start">
              <span className="font-medium">Email Support</span>
              <span className="text-xs text-muted-foreground">support@botfactory.app</span>
            </div>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
