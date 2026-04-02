"use client";

import { useSignIn } from "@clerk/nextjs";
import Image from "next/image";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const { signIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signIn || loading) return;
    setError("");
    setLoading(true);
    try {
      const { error: createError } = await signIn.create({ identifier: email });
      if (createError) throw createError;
      const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendError) throw sendError;
      setSent(true);
    } catch {
      setError("Unable to send a reset email. Check that the address is correct.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="mb-8 text-center">
          <Image src="/logo.jpeg" alt="GPretire.com" width={64} height={64} className="w-16 h-16 rounded-full object-cover mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-slate-100 mb-1">Reset your password</h1>
          <p className="text-slate-400 text-sm">
            Enter your email and we will send a reset code.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-slate-700 bg-slate-900 px-6 py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-green-900/40 border border-green-700/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-slate-300 text-sm mb-1">Reset code sent</p>
            <p className="text-slate-600 text-xs mb-6">Check your inbox at <strong className="text-slate-400">{email}</strong></p>
            <Link
              href="/reset-password"
              className="inline-block rounded-lg bg-[#C8A45A] px-5 py-2.5 text-sm font-medium text-[#1A0F28] hover:bg-[#D4A574] transition-colors"
            >
              Enter reset code →
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-[#C8A45A] focus:outline-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#C8A45A] px-4 py-2.5 text-sm font-medium text-[#1A0F28] hover:bg-[#D4A574] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Sending…" : "Send reset code"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Remember your password?{" "}
          <Link href="/sign-in" className="text-[#C8A45A] hover:text-amber-300 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
