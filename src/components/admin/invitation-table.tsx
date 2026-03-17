"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface InvitationRow {
  id: string;
  email: string;
  createdAt: number;
}

export function InvitationTable({ invitations }: { invitations: InvitationRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const revoke = async (inviteId: string, email: string) => {
    if (!confirm(`Revoke invitation for ${email}?`)) return;
    setPending(inviteId);
    try {
      await fetch(`/api/admin/invite/${inviteId}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setPending(null);
    }
  };

  if (invitations.length === 0) {
    return <p className="text-slate-500 text-sm">No pending invitations.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900">
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Email</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Invited</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
            <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invitations.map((inv, i) => {
            const invited = new Date(inv.createdAt).toLocaleDateString("en-US", {
              year: "numeric", month: "short", day: "numeric",
            });
            const isLoading = pending === inv.id;

            return (
              <tr
                key={inv.id}
                className={`border-b border-slate-800 ${i % 2 === 0 ? "bg-slate-950" : "bg-slate-900/50"}`}
              >
                <td className="px-4 py-3 text-slate-100">{inv.email}</td>
                <td className="px-4 py-3 text-slate-400">{invited}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-900/30 text-yellow-400 border border-yellow-800/40">
                    Pending
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => revoke(inv.id, inv.email)}
                      disabled={isLoading}
                      className="px-2.5 py-1 rounded text-xs font-medium text-red-400 border border-red-900/50 hover:border-red-700 hover:text-red-300 disabled:opacity-40 transition-colors"
                    >
                      {isLoading ? "…" : "Revoke"}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
