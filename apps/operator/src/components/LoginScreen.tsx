"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { DEPLOYMENT_BRAND } from "@/lib/deploymentBrand";

interface Props {
  onSignIn: (email: string, password: string) => Promise<string | null>;
}

const inputCls =
  "w-full bg-slate-100 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-gold/40 transition-colors";

export default function LoginScreen({ onSignIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  // Email sign-in is the main way in; a password is the alternative.
  const [usePassword, setUsePassword] = useState(false);
  const [linking, setLinking] = useState(false);

  // Emails a reset link (only sent if the address belongs to a team member;
  // the reply is the same either way). See /api/auth/forgot.
  const handleForgot = async () => {
    setError(null);
    setNotice(null);
    const addr = email.trim();
    if (!addr) {
      setError("Enter your email above, then tap Forgot password.");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error ?? "Couldn't send a reset link. Try again.");
      else setNotice(data?.message ?? "If that email belongs to a team member, a reset link is on its way.");
    } catch {
      setError("Couldn't send a reset link. Check your connection and try again.");
    } finally {
      setResetting(false);
    }
  };

  // Emails a one-time sign-in link (only sent to existing team members; same reply either way).
  // See /api/auth/email-link.
  const handleEmailLink = async () => {
    setError(null);
    setNotice(null);
    const addr = email.trim();
    if (!addr) { setError("Enter your email address first."); return; }
    setLinking(true);
    try {
      const res = await fetch("/api/auth/email-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: addr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data?.error ?? "Couldn't send a sign-in link. Try again.");
      else setNotice(data?.message ?? "If that email belongs to a team member, a sign-in link is on its way.");
    } catch {
      setError("Couldn't send a sign-in link. Check your connection and try again.");
    } finally {
      setLinking(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!usePassword) { await handleEmailLink(); return; }
    setSubmitting(true);
    setError(null);
    const err = await onSignIn(email, password);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020813] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <p className="text-white text-2xl font-semibold tracking-wide">{DEPLOYMENT_BRAND.name}</p>
          <p
            className="text-white/50 font-medium uppercase mt-1 tracking-widest"
            style={{ fontSize: "clamp(0.6rem, 1.5vw, 0.7rem)", letterSpacing: "0.22em" }}
          >
            Operator Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white shadow-card p-6 space-y-4">
          <h2 className="text-[#0F1B33] text-xl font-bold">Sign in</h2>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <Mail size={11} className="text-amber-600/80" />
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder={DEPLOYMENT_BRAND.loginPlaceholder}
            />
          </div>

          {usePassword && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <Lock size={11} className="text-amber-600/80" />
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls + " pr-10"}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleForgot} disabled={resetting} className="text-xs text-amber-600 hover:underline transition-colors disabled:opacity-50">
                {resetting ? "Sending…" : "Forgot password?"}
              </button>
            </div>
          </div>
          )}

          {notice && (
            <p role="status" className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {notice}
            </p>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-100 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || linking}
            className="w-full py-3 rounded-2xl text-sm font-semibold bg-gold-gradient text-navy-900 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all"
          >
            {usePassword ? (submitting ? "Signing in…" : "Sign In") : (linking ? "Sending…" : "Email me a sign-in link")}
          </button>

          <p className="text-center text-xs">
            <button type="button" onClick={() => { setUsePassword((v) => !v); setError(null); setNotice(null); }} className="text-amber-600 hover:underline">
              {usePassword ? "Email me a sign-in link instead" : "Use a password instead"}
            </button>
          </p>

          <p className="text-center text-xs text-slate-600">
            Account access is managed by {DEPLOYMENT_BRAND.name}
          </p>
        </form>
      </div>
    </div>
  );
}