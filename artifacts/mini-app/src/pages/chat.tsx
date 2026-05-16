import { useEffect, useRef, useState } from "react";
import { Send, Bot, User as UserIcon, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
  useGetChatHistory, 
  useSendChatMessage, 
  useGetGeneration,
  ChatMessage 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";

function GenerationProgress({ generationId }: { generationId: string }) {
  const { data: gen } = useGetGeneration(generationId, { 
    query: { refetchInterval: (data) => (data?.status === 'in_progress' || data?.status === 'pending') ? 2000 : false } 
  });

  if (!gen) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;

  return (
    <div className="mt-3 p-4 rounded-lg bg-card border border-border/50 max-w-sm w-full space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">Generation Progress</span>
        {gen.status === 'in_progress' && <span className="text-xs text-primary animate-pulse">Running...</span>}
      </div>
      
      <div className="space-y-2">
        {gen.steps?.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            {step.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground" />}
            {step.status === 'in_progress' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
            {step.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            {step.status === 'error' && <XCircle className="w-4 h-4 text-destructive" />}
            <span className={step.status === 'pending' ? 'text-muted-foreground' : 'text-foreground'}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {gen.status === 'done' && (
        <div className="pt-3 flex justify-end">
          <Link href="/my-bots">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              View Bot
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { data: history = [], isLoading } = useGetChatHistory();
  const sendMsg = useSendChatMessage();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSend = () => {
    if (!input.trim() || sendMsg.isPending) return;
    
    const content = input.trim();
    setInput("");
    
    // Optimistic update
    const optimisticMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      createdAt: new Date().toISOString()
    };
    
    queryClient.setQueryData(['/api/chat/history'], (old: ChatMessage[] = []) => [...old, optimisticMsg]);
    
    sendMsg.mutate({ data: { content } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/chat/history'] });
      },
      onError: () => {
        // Revert optimistic update ideally, but full invalidate works
        queryClient.invalidateQueries({ queryKey: ['/api/chat/history'] });
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Layout title="Bot Factory AI">
      <div className="flex flex-col h-full relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4">
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">Welcome to Bot Factory</h2>
                <p className="text-sm text-muted-foreground max-w-[280px]">
                  Describe the Telegram bot you want to create, and I'll build it for you in seconds.
                </p>
              </div>
            </div>
          ) : (
            history.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 shrink-0 flex items-center justify-center mt-1">
                    <Bot className="w-5 h-5 text-primary" />
                  </div>
                )}
                
                <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`p-3 rounded-2xl text-sm whitespace-pre-wrap break-words
                      ${msg.role === 'user' 
                        ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                        : 'bg-secondary text-secondary-foreground rounded-tl-sm'
                      }`}
                  >
                    {msg.content}
                  </div>
                  {msg.generationId && (
                    <GenerationProgress generationId={msg.generationId} />
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-secondary shrink-0 flex items-center justify-center mt-1">
                    <UserIcon className="w-5 h-5 text-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          
          {sendMsg.isPending && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/20 shrink-0 flex items-center justify-center mt-1">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="p-3 rounded-2xl bg-secondary text-secondary-foreground rounded-tl-sm flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-background via-background to-transparent">
          <div className="relative flex items-end gap-2 bg-secondary/50 p-1.5 rounded-3xl border border-border/50 backdrop-blur-md">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your bot..."
              className="min-h-[44px] max-h-32 bg-transparent border-0 focus-visible:ring-0 resize-none py-3 px-3 text-sm"
              rows={1}
            />
            <Button 
              size="icon" 
              className="shrink-0 h-10 w-10 rounded-full mb-0.5 bg-primary hover:bg-primary/90"
              onClick={handleSend}
              disabled={!input.trim() || sendMsg.isPending}
            >
              <Send className="w-4 h-4 text-primary-foreground" />
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
