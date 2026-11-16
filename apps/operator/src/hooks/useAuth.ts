"use client";

import { useEffect, useState, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  }, []);

  // The six-digit code from the sign-in email. The session is stored by this app itself, so a
  // Home Screen app on an iPhone is signed in where it is, not in Safari.
  const verifyCode = useCallback(async (email: string, code: string) => {
    const token = code.replace(/\D/g, "");
    if (token.length < 6) return "Enter the 6-digit code from the email.";
    const first = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    if (!first.error) return null;
    const second = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "magiclink" });
    if (!second.error) return null;
    return "That code didn't work. It may have expired or already been used: ask for a new one.";
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { session, loading, signIn, verifyCode, signOut };
}