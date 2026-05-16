declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: {
          impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
          notificationOccurred(type: "error" | "success" | "warning"): void;
          selectionChanged(): void;
        };
      };
    };
  }
}

function getHaptic() {
  return window.Telegram?.WebApp?.HapticFeedback ?? null;
}

export const haptic = {
  light: () => getHaptic()?.impactOccurred("light"),
  medium: () => getHaptic()?.impactOccurred("medium"),
  heavy: () => getHaptic()?.impactOccurred("heavy"),
  soft: () => getHaptic()?.impactOccurred("soft"),
  success: () => getHaptic()?.notificationOccurred("success"),
  error: () => getHaptic()?.notificationOccurred("error"),
  warning: () => getHaptic()?.notificationOccurred("warning"),
  selection: () => getHaptic()?.selectionChanged(),
};
