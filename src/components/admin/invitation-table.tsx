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
    return <p className="text-slate-600 text-sm">No pending invitations.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-white">
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Email</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Invited</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
            <th className="text-right px-4 py-3 text-slate-500 font-medium">Actions</th>
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
                className={`border-b border-slate-200 ${i % 2 === 0 ? "bg-slate-50" : "bg-white"}`}
              >
                <td className="px-4 py-3 text-slate-900">{inv.email}</td>
                <td className="px-4 py-3 text-slate-500">{invited}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-600 border border-amber-200">
                    Pending
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end">
                    <button
                      onClick={() => revoke(inv.id, inv.email)}
                      disabled={isLoading}
                      className="px-2.5 py-1 rounded text-xs font-medium text-red-600 border border-red-200 hover:border-red-300 hover:text-red-700 disabled:opacity-40 transition-colors"
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
