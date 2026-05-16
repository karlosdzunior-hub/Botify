import { useEffect, useState } from "react";
import WebApp from "@twa-dev/sdk";
import { setAuthTokenGetter, authTelegram } from "@workspace/api-client-react";

export function useTelegramAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      try {
        if (typeof window !== "undefined" && WebApp) {
          WebApp.ready();
          WebApp.expand();
          
          let initData = WebApp.initData;
          
          // Mock for local dev
          if (!initData) {
            initData = "mock_init_data"; 
          }

          setAuthTokenGetter(() => localStorage.getItem("bot_factory_token"));

          if (!localStorage.getItem("bot_factory_token") || initData !== "mock_init_data") {
             const res = await authTelegram({ data: { initData } });
             localStorage.setItem("bot_factory_token", res.token);
          }
        }
      } catch (err) {
        console.error("Auth error:", err);
        if (mounted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setIsAuthenticated(true);
      }
    };

    init();
    return () => { mounted = false; };
  }, []);

  return { isAuthenticated, error };
}
