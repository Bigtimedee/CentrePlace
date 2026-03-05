"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export function InviteUserForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send invitation.");
      setMessage({ type: "success", text: `Invitation sent to ${email}.` });
      setEmail("");
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Unknown error." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 max-w-md">
      <h2 className="text-slate-100 font-medium mb-4 flex items-center gap-2">
        <Mail className="w-4 h-4 text-indigo-400" />
        Invite a new user
      </h2>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Sending…" : "Send invite"}
        </button>
      </form>
      {message && (
        <p className={`mt-3 text-sm ${message.type === "success" ? "text-green-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
