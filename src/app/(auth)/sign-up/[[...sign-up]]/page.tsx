"use client";

import { useSignUp } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

type Phase = "choose" | "password" | "no-ticket";

function SignUpInner() {
  const { signUp, fetchStatus } = useSignUp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketApplied = useRef<boolean>(false);

  const ticket = searchParams.get("__clerk_ticket");

  const [phase, setPhase] = useState<Phase>(ticket ? "choose" : "no-ticket");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    if (!signUp || fetchStatus === "fetching") return;
    if (!ticket) { setError("Invalid invitation link."); return; }
    setError("");
    setLoading(true);
    try {
      if (!ticketApplied.current) {
        const ticketResult = await signUp.ticket({ ticket });
        if (ticketResult.error) throw ticketResult.error;
        ticketApplied.current = true;
      }
      const ssoResult = await signUp.sso({
        strategy: "oauth_google",
        redirectUrl: `${window.location.origin}/sign-up/sso-callback`,
        redirectCallbackUrl: "/dashboard",
      });
      if (ssoResult.error) throw ssoResult.error;
    } catch {
      setError("Unable to connect with Google. Try again or use a password.");
      setLoading(false);
    }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) { setError("Invalid invitation link."); return; }
    if (!signUp || fetchStatus === "fetching" || loading) return;
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setError("");
    setLoading(true);
    try {
      if (!ticketApplied.current) {
        const ticketResult = await signUp.ticket({ ticket });
        if (ticketResult.error) {
          const msg = ticketResult.error.message ?? "";
          if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
            setError("An account with this email already exists. Try signing in.");
          } else if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("invalid")) {
            setError("This invitation link has expired. Contact your administrator for a new one.");
          } else {
            setError("Something went wrong. Please try again.");
          }
          return;
        }
        ticketApplied.current = true;
      }
      const pwResult = await signUp.password({ firstName, lastName, password });
      if (pwResult.error) {
        const msg = pwResult.error.message ?? "";
        if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
          setError("An account with this email already exists. Try signing in.");
        } else if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("invalid")) {
          setError("This invitation link has expired. Contact your administrator for a new one.");
        } else {
          setError("Something went wrong. Please try again.");
        }
        return;
      }
      const finalizeResult = await signUp.finalize();
      if (finalizeResult.error) {
        setError("Sign-up could not be completed. Contact your administrator.");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (fetchStatus === "fetching" && phase !== "no-ticket") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm mx-auto px-6">

        <div className="mb-8 text-center">
          <Image
            src="/logo.svg"
            alt="GPretire.com"
            width={64}
            height={64}
            className="w-16 h-16 rounded-xl mx-auto mb-4"
          />
          <h1 className="text-2xl font-semibold text-slate-100 mb-1">
            {phase === "no-ticket" ? "Invalid invitation" : "Create your account"}
          </h1>
          <p className="text-slate-400 text-sm">
            {phase === "no-ticket"
              ? "This invitation link is invalid or has expired."
              : "You've been invited to GPretire.com. Set up your account to get started."}
          </p>
        </div>

        {phase === "no-ticket" && (
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-8 text-center">
            <p className="text-slate-400 text-sm mb-4">
              Contact your administrator for a new invitation.
            </p>
            <Link
              href="/sign-in"
              className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm"
            >
              Sign in instead →
            </Link>
          </div>
        )}

        {phase === "choose" && (
          <div className="space-y-3">
            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? "Connecting…" : "Continue with Google"}
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-slate-700" />
              <span className="text-xs text-slate-600">or</span>
              <div className="flex-1 border-t border-slate-700" />
            </div>

            <button
              onClick={() => setPhase("password")}
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              Create account with password
            </button>

            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
          </div>
        )}

        {phase === "password" && (
          <form onSubmit={handlePassword} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">First name</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">Last name</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  placeholder="Smith"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Create a password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Confirm password</label>
              <input
                type="password"
                required
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat your password"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating account…" : "Create account"}
            </button>

            <button
              type="button"
              onClick={() => { setPhase("choose"); setError(""); }}
              className="w-full text-sm text-slate-600 hover:text-slate-400 transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        {phase !== "no-ticket" && (
          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/sign-in" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Sign in
            </Link>
          </p>
        )}

      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950"><div className="text-slate-400 text-sm">Loading…</div></div>}>
      <SignUpInner />
    </Suspense>
  );
}
