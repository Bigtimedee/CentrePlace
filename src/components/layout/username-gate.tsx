"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

export function UsernameGate({ children }: { children: React.ReactNode }) {
  const { data: profile, isLoading } = trpc.profile.get.useQuery();
  const utils = trpc.useUtils();
  const setUsername = trpc.profile.setUsername.useMutation({
    onSuccess: () => utils.profile.get.invalidate(),
  });

  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  if (isLoading) return null;
  if (profile?.username) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await setUsername.mutateAsync({ username: value.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-slate-100 mb-1">Welcome — one last step</h2>
          <p className="text-slate-400 text-sm mb-6">
            Choose a display name. This is how you'll appear in the app.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              required
              minLength={2}
              maxLength={40}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. Dave M."
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={setUsername.isPending || value.trim().length < 2}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {setUsername.isPending ? "Saving…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
      {/* Render children underneath (blurred/inaccessible behind overlay) */}
      {children}
    </>
  );
}
