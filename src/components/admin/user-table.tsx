"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  banned: boolean;
  createdAt: number;
  role: string | null;
}

export function UserTable({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const action = async (userId: string, method: "PATCH" | "DELETE", body?: object) => {
    setPending(userId);
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  };

  if (users.length === 0) {
    return <p className="text-slate-600 text-sm">No users found.</p>;
  }

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700 bg-slate-900">
            <th className="text-left px-4 py-3 text-slate-400 font-medium">User</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Joined</th>
            <th className="text-left px-4 py-3 text-slate-400 font-medium">Status</th>
            <th className="text-right px-4 py-3 text-slate-400 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, i) => {
            const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
            const joined = new Date(user.createdAt).toLocaleDateString("en-US", {
              year: "numeric", month: "short", day: "numeric",
            });
            const isLoading = pending === user.id;

            return (
              <tr
                key={user.id}
                className={`border-b border-slate-800 ${i % 2 === 0 ? "bg-slate-950" : "bg-slate-900/50"}`}
              >
                <td className="px-4 py-3">
                  <div className="text-slate-100 font-medium">{name}</div>
                  <div className="text-slate-600 text-xs">{user.email}</div>
                  {user.role === "admin" && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs bg-indigo-900/50 text-indigo-400 border border-indigo-800/50">
                      admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400">{joined}</td>
                <td className="px-4 py-3">
                  {user.banned ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-900/30 text-red-400 border border-red-800/40">
                      Suspended
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-900/30 text-green-400 border border-green-800/40">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {user.role !== "admin" && (
                      <>
                        <button
                          onClick={() => action(user.id, "PATCH", { banned: !user.banned })}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded text-xs font-medium text-slate-300 border border-slate-700 hover:border-slate-500 hover:text-white disabled:opacity-40 transition-colors"
                        >
                          {isLoading ? "…" : user.banned ? "Unsuspend" : "Suspend"}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ${user.email}? This cannot be undone.`)) {
                              action(user.id, "DELETE");
                            }
                          }}
                          disabled={isLoading}
                          className="px-2.5 py-1 rounded text-xs font-medium text-red-400 border border-red-900/50 hover:border-red-700 hover:text-red-300 disabled:opacity-40 transition-colors"
                        >
                          Delete
                        </button>
                      </>
                    )}
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
