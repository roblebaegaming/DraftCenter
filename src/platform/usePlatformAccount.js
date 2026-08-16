"use client";

import { useEffect, useState } from "react";
import { createPlatformBrowserClient } from "./supabase";

export function usePlatformAccount() {
  const [supabase] = useState(() => createPlatformBrowserClient());
  const [signedIn, setSignedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [username, setUsername] = useState("");

  useEffect(() => {
    let active = true;
    let requestVersion = 0;

    async function updateSession(session) {
      if (!active) return;
      const version = ++requestVersion;
      if (!session) {
        setSignedIn(false);
        setIsOwner(false);
        setUsername("");
        return;
      }

      setSignedIn(true);
      const [profileResult, accessResponse] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle(),
        fetch("/api/operations/access", { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null),
      ]);
      if (!active || version !== requestVersion) return;
      setUsername(profileResult.data?.username || "");
      setIsOwner(Boolean(accessResponse?.ok));
    }

    supabase.auth.getSession().then(({ data }) => { void updateSession(data.session); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { void updateSession(session); });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return {
    accountName: username ? `@${username}` : "Account",
    isOwner,
    signedIn,
    signOut,
    username,
  };
}
