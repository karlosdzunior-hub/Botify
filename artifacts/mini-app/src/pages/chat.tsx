import { useEffect, useRef, useState } from "react";
import { Send, Bot, User as UserIcon, Loader2, CheckCircle2, XCircle, Clock, Key } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  useGetChatHistory,
  useSendChatMessage,
  useGetGeneration,
  ChatMessage,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { haptic } from "@/lib/haptic";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

function GenerationProgress({ generationId }: { generationId: string }) {
  const { t } = useI18n();
  const { data: gen } = useGetGeneration(generationId, {
    query: { refetchInterval: (data) => (data?.status === "in_progress" || data?.status === "pending" ? 2000 : false) },
  });

  if (!gen) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-4 rounded-xl bg-card border border-border/50 max-w-sm w-full space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("generationProgress")}</span>
        {gen.status === "in_progress" && (
          <span className="text-xs text-primary animate-pulse">{t("running")}</span>
        )}
        {gen.elapsedSeconds != null && gen.elapsedSeconds > 0 && (
          <span className="text-xs text-muted-foreground">⏱ {gen.elapsedSeconds}{t("seconds")}</span>
        )}
      </div>

      <div className="space-y-2">
        {gen.steps?.map((step, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="flex items-center gap-2.5 text-sm"
          >
            {step.status === "pending" && <Clock className="w-4 h-4 text-muted-foreground shrink-0" />}
            {step.status === "in_progress" && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
            {step.status === "done" && <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />}
            {step.status === "error" && <XCircle className="w-4 h-4 text-destructive shrink-0" />}
            <span className={step.status === "pending" ? "text-muted-foreground" : "text-foreground"}>
              {step.label}
            </span>
          </motion.div>
        ))}
      </div>

      {gen.creditsUsed > 0 && (
        <div className="text-xs text-muted-foreground">💳 -{gen.creditsUsed} кредитов</div>
      )}

      {gen.status === "done" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 flex justify-end">
          <Link href="/my-bots">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground" onClick={() => haptic.success()}>
              {t("viewBot")}
            </Button>
          </Link>
        </motion.div>
      )}
    </motion.div>
  );
}

// Token input prompt shown when bot needs a token
function TokenPrompt({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [token, setToken] = useState("");
  const { t } = useI18n();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-4 rounded-xl bg-card border border-border/50 max-w-sm w-full space-y-3"
    >
      <div className="flex items-center gap-2">
        <Key className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Введите токен бота</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Получите токен у <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-primary underline">@BotFather</a> и вставьте его сюда.
      </p>
      <Input
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="1234567890:ABCDEFGabcdefg..."
        className="bg-secondary/50 border-border/50 font-mono text-sm"
      />
      <Button
        size="sm"
        className="w-full"
        onClick={() => token.trim() && onSubmit(token.trim())}
        disabled={!token.trim()}
      >
        Подтвердить токен
      </Button>
    </motion.div>
  );
}

export default function ChatPage() {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

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
    haptic.light();
    const content = input.trim();
    setInput("");

    const optimisticMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    queryClient.setQueryData(["/api/chat/history"], (old: ChatMessage[] = []) => [...old, optimisticMsg]);

    sendMsg.mutate(
      { data: { content } },
      {
        onSuccess: () => {
          haptic.success();
          queryClient.invalidateQueries({ queryKey: ["/api/chat/history"] });
        },
        onError: () => {
          haptic.error();
          queryClient.invalidateQueries({ queryKey: ["/api/chat/history"] });
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Layout title="Bot Factory AI">
      <div className="flex flex-col h-full relative">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 pb-28">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center h-full text-center space-y-4 px-4 py-16"
            >
              <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{t("welcomeTitle")}</h2>
                <p className="text-sm text-muted-foreground max-w-[280px]">{t("welcomeSubtitle")}</p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-[280px]">
                {[
                  "Бот для онлайн-записи в кафе",
                  "Бот-магазин с каталогом товаров",
                  "Бот для рассылки новостей",
                ].map((example) => (
                  <button
                    key={example}
                    onClick={() => { haptic.light(); setInput(example); }}
                    className="text-left text-sm px-3 py-2.5 rounded-lg bg-secondary/60 hover:bg-secondary text-foreground/80 transition-colors border border-border/30"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              {history.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role !== "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary/20 shrink-0 flex items-center justify-center mt-1">
                      <Bot className="w-5 h-5 text-primary" />
                    </div>
                  )}

                  <div className={`flex flex-col max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`p-3 rounded-2xl text-sm whitespace-pre-wrap break-words
                        ${msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-secondary text-secondary-foreground rounded-tl-sm"
                        }`}
                    >
                      {msg.content}
                    </div>
                    {msg.generationId && <GenerationProgress generationId={msg.generationId} />}
                  </div>

                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-secondary shrink-0 flex items-center justify-center mt-1">
                      <UserIcon className="w-5 h-5 text-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}

          {sendMsg.isPending && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/20 shrink-0 flex items-center justify-center mt-1">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="p-3 rounded-2xl bg-secondary text-secondary-foreground rounded-tl-sm flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
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
              placeholder={t("describeBot")}
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
