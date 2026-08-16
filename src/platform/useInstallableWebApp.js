"use client";

import { useEffect, useState } from "react";

export function useInstallableWebApp({ serviceWorkerUrl, scope }) {
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    function rememberInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    window.addEventListener("beforeinstallprompt", rememberInstallPrompt);
    if (serviceWorkerUrl && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(serviceWorkerUrl, scope ? { scope } : undefined).catch(() => {});
    }
    return () => window.removeEventListener("beforeinstallprompt", rememberInstallPrompt);
  }, [scope, serviceWorkerUrl]);

  async function promptInstall() {
    if (!installPrompt) return { outcome: "unavailable" };
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    return { outcome: choice?.outcome === "accepted" ? "accepted" : "dismissed" };
  }

  return { canPromptInstall: Boolean(installPrompt), promptInstall };
}
