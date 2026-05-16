import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { 
  useListBots, 
  useRestartBot, 
  useStartBot, 
  useStopBot, 
  useDeleteBot,
  useGetBotLogs,
  Bot
} from "@workspace/api-client-react";
import { Play, Square, RotateCw, Trash2, Terminal, Bot as BotIcon, Loader2, Search, Plus } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

function BotCard({ bot }: { bot: Bot }) {
  const [logsOpen, setLogsOpen] = useState(false);
  const queryClient = useQueryClient();
  
  const restart = useRestartBot();
  const start = useStartBot();
  const stop = useStopBot();
  const deleteBot = useDeleteBot();

  const handleAction = (action: any, id: string) => {
    action.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/bots'] });
      }
    });
  };

  const statusColors = {
    running: 'bg-green-500',
    stopped: 'bg-muted-foreground',
    error: 'bg-destructive',
    generating: 'bg-primary animate-pulse'
  };

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <BotIcon className="w-6 h-6 text-primary" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-foreground truncate">{bot.name}</span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="capitalize">{bot.botType}</span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${statusColors[bot.status]}`} />
                <span className="capitalize">{bot.status}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {bot.description && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {bot.description}
        </p>
      )}

      {bot.botUsername && (
        <div className="text-xs bg-secondary/50 px-2 py-1 rounded-md w-fit">
          @{bot.botUsername}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 mt-auto">
        {bot.status === 'running' ? (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 bg-secondary/50 border-border/50"
            onClick={() => handleAction(stop, bot.id)}
            disabled={stop.isPending}
          >
            {stop.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 mr-2" />}
            Stop
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 bg-secondary/50 border-border/50"
            onClick={() => handleAction(start, bot.id)}
            disabled={start.isPending || bot.status === 'generating'}
          >
            {start.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Start
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="icon" 
          className="bg-secondary/50 border-border/50 shrink-0"
          onClick={() => handleAction(restart, bot.id)}
          disabled={restart.isPending || bot.status === 'generating'}
        >
          {restart.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
        </Button>

        <Button 
          variant="outline" 
          size="icon" 
          className="bg-secondary/50 border-border/50 shrink-0"
          onClick={() => setLogsOpen(true)}
        >
          <Terminal className="w-4 h-4" />
        </Button>

        <Button 
          variant="outline" 
          size="icon" 
          className="bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive hover:text-destructive-foreground shrink-0"
          onClick={() => {
            if (confirm('Are you sure you want to delete this bot?')) {
              handleAction(deleteBot, bot.id);
            }
          }}
          disabled={deleteBot.isPending}
        >
          {deleteBot.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </Button>
      </div>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Logs: {bot.name}
            </DialogTitle>
          </DialogHeader>
          <BotLogsView botId={bot.id} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BotLogsView({ botId }: { botId: string }) {
  const { data, isLoading } = useGetBotLogs(botId, { query: { refetchInterval: 3000 } });

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex-1 bg-black/50 rounded-md p-4 overflow-y-auto font-mono text-xs text-green-400 space-y-1">
      {data?.lines.length === 0 ? (
        <span className="text-muted-foreground">No logs available</span>
      ) : (
        data?.lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))
      )}
    </div>
  );
}

export default function MyBotsPage() {
  const { data: bots = [], isLoading } = useListBots();
  const [search, setSearch] = useState("");

  const filteredBots = bots.filter(bot => bot.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Layout title="My Bots">
      <div className="p-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bots..." 
              className="pl-9 bg-secondary/50 border-border/50"
            />
          </div>
          <Link href="/">
            <Button size="icon" className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground">
              <Plus className="w-5 h-5" />
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredBots.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
              <BotIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">No bots found</p>
            <p className="text-sm text-muted-foreground">You haven't created any bots yet, or none match your search.</p>
            <Link href="/">
              <Button className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground">
                Create New Bot
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBots.map(bot => (
              <BotCard key={bot.id} bot={bot} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
