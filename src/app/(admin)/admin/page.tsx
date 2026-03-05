import Link from "next/link";
import { Users, Mail } from "lucide-react";

export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-100 mb-1">Admin</h1>
      <p className="text-slate-400 text-sm mb-8">Manage users and platform settings.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
        <Link
          href="/admin/users"
          className="rounded-xl border border-slate-700 bg-slate-900 p-6 hover:border-slate-600 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-indigo-900/40 border border-indigo-700/50 flex items-center justify-center mb-4">
            <Users className="w-5 h-5 text-indigo-400" />
          </div>
          <h2 className="text-slate-100 font-medium mb-1 group-hover:text-white">User Management</h2>
          <p className="text-slate-500 text-sm">View, invite, suspend, and remove users.</p>
        </Link>

        <Link
          href="/admin/users?invite=1"
          className="rounded-xl border border-slate-700 bg-slate-900 p-6 hover:border-slate-600 transition-colors group"
        >
          <div className="w-10 h-10 rounded-lg bg-green-900/40 border border-green-700/50 flex items-center justify-center mb-4">
            <Mail className="w-5 h-5 text-green-400" />
          </div>
          <h2 className="text-slate-100 font-medium mb-1 group-hover:text-white">Invite User</h2>
          <p className="text-slate-500 text-sm">Send an email invitation to a new user.</p>
        </Link>
      </div>
    </div>
  );
}
