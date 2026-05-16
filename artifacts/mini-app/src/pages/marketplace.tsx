import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { 
  useListMarketplace,
  useDeployTemplate,
  MarketplaceTemplate
} from "@workspace/api-client-react";
import { Store, Download, Star, Loader2, Bot, Coins } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";

function TemplateCard({ template }: { template: MarketplaceTemplate }) {
  const [deployOpen, setDeployOpen] = useState(false);
  const [botToken, setBotToken] = useState("");
  const deploy = useDeployTemplate();
  const [, setLocation] = useLocation();

  const handleDeploy = () => {
    deploy.mutate({ id: template.id, data: { botToken } }, {
      onSuccess: () => {
        toast.success("Template deployed successfully!");
        setDeployOpen(false);
        setLocation("/my-bots");
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to deploy template");
      }
    });
  };

  return (
    <>
      <div className="bg-card border border-border/50 rounded-xl p-4 flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <Store className="w-6 h-6 text-primary" />
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="font-semibold text-lg text-foreground truncate">{template.name}</span>
            {template.authorUsername && (
              <span className="text-xs text-muted-foreground">by @{template.authorUsername}</span>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
          {template.description}
        </p>

        <div className="flex items-center gap-4 text-xs font-medium text-foreground">
          <div className="flex items-center gap-1">
            <Download className="w-4 h-4 text-muted-foreground" />
            <span>{template.deployCount}</span>
          </div>
          {template.rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span>{template.rating.toFixed(1)}</span>
            </div>
          )}
          <div className="flex items-center gap-1 ml-auto text-primary">
            <Coins className="w-4 h-4" />
            <span>{template.price === 0 ? "Free" : template.price}</span>
          </div>
        </div>

        <Button 
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => setDeployOpen(true)}
        >
          Deploy Template
        </Button>
      </div>

      <Dialog open={deployOpen} onOpenChange={setDeployOpen}>
        <DialogContent className="sm:max-w-[425px] bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Deploy {template.name}</DialogTitle>
            <DialogDescription>
              Deploying this template will cost {template.price} credits.
              Provide a bot token from @BotFather, or leave empty to create a new one automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bot Token (Optional)</label>
              <Input 
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                className="bg-secondary/50 border-border/50"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeployOpen(false)}>Cancel</Button>
            <Button onClick={handleDeploy} disabled={deploy.isPending}>
              {deploy.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Bot className="w-4 h-4 mr-2" />}
              Deploy ({template.price} credits)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MarketplacePage() {
  const { data: templates = [], isLoading } = useListMarketplace();

  return (
    <Layout title="Marketplace">
      <div className="p-4 space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Discover Templates</h1>
          <p className="text-sm text-muted-foreground">Start instantly with pre-built bot templates.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No templates available yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <TemplateCard key={template.id} template={template} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
