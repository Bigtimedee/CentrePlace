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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A0F28]/80 backdrop-blur-sm">
        <div className="w-full max-w-sm mx-4 rounded-2xl border border-[#4A3257] bg-[#2D1B3D] p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-[#E8D5B0] mb-1">Welcome — one last step</h2>
          <p className="text-[#7A6B82] text-sm mb-6">
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
              className="w-full rounded-lg border border-[#4A3257] bg-[#1E1230] px-3.5 py-2.5 text-sm text-[#E8D5B0] placeholder-[#7A6B82] focus:border-[#C8A45A] focus:outline-none"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={setUsername.isPending || value.trim().length < 2}
              className="w-full rounded-lg bg-[#C8A45A] px-4 py-2.5 text-sm font-medium text-[#1A0F28] hover:bg-[#D4A574] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
