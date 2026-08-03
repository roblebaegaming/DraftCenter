"use client";

import { useEffect, useRef, useState } from "react";

const SCRIPT_ID = "draftcenter-turnstile-script";
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let turnstileScriptPromise;

function loadTurnstile() {
  if (typeof window === "undefined") return Promise.reject(new Error("Turnstile requires a browser."));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const resolveWhenReady = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("The security check did not finish loading."));
    };
    const rejectLoad = () => {
      turnstileScriptPromise = undefined;
      reject(new Error("The security check could not be loaded."));
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", resolveWhenReady, { once: true });
      existing.addEventListener("error", rejectLoad, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", resolveWhenReady, { once: true });
    script.addEventListener("error", rejectLoad, { once: true });
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

export default function TurnstileChallenge({ siteKey, action, resetKey, onTokenChange }) {
  const containerRef = useRef(null);
  const tokenChangeRef = useRef(onTokenChange);
  const [error, setError] = useState("");

  useEffect(() => {
    tokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!siteKey) return undefined;
    let active = true;
    let widgetId;

    setError("");
    tokenChangeRef.current?.("");

    loadTurnstile().then((turnstile) => {
      if (!active || !containerRef.current) return;
      widgetId = turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        theme: "dark",
        size: "flexible",
        callback(token) {
          if (!active) return;
          setError("");
          tokenChangeRef.current?.(token);
        },
        "expired-callback"() {
          if (!active) return;
          tokenChangeRef.current?.("");
          setError("The security check expired. Please complete it again.");
        },
        "timeout-callback"() {
          if (!active) return;
          tokenChangeRef.current?.("");
          setError("The security check timed out. Please try it again.");
        },
        "error-callback"() {
          if (!active) return;
          tokenChangeRef.current?.("");
          setError("The security check could not be completed. Refresh the page and try again.");
          return true;
        },
      });
    }).catch(() => {
      if (!active) return;
      tokenChangeRef.current?.("");
      setError("The security check could not be loaded. Check your connection and refresh the page.");
    });

    return () => {
      active = false;
      if (widgetId !== undefined && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, resetKey, siteKey]);

  if (!siteKey) return null;
  return <div><div ref={containerRef} role="group" aria-label="Security check" />{error && <p className="hub-message" role="alert">{error}</p>}</div>;
}
