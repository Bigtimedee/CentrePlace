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
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-white">
            <th className="text-left px-4 py-3 text-slate-500 font-medium">User</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Joined</th>
            <th className="text-left px-4 py-3 text-slate-500 font-medium">Status</th>
            <th className="text-right px-4 py-3 text-slate-500 font-medium">Actions</th>
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
                className={`border-b border-slate-200 ${i % 2 === 0 ? "bg-slate-50" : "bg-white"}`}
              >
                <td className="px-4 py-3">
                  <div className="text-slate-900 font-medium">{name}</div>
                  <div className="text-slate-600 text-xs">{user.email}</div>
                  {user.role === "admin" && (
                    <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-xs bg-indigo-50 text-indigo-600 border border-indigo-200">
                      admin
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500">{joined}</td>
                <td className="px-4 py-3">
                  {user.banned ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600 border border-red-200">
                      Suspended
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-600 border border-emerald-200">
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
                          className="px-2.5 py-1 rounded text-xs font-medium text-slate-600 border border-slate-200 hover:border-slate-300 hover:text-slate-900 disabled:opacity-40 transition-colors"
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
                          className="px-2.5 py-1 rounded text-xs font-medium text-red-600 border border-red-200 hover:border-red-300 hover:text-red-700 disabled:opacity-40 transition-colors"
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
