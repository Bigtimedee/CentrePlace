import Link from "next/link";

export default function InviteOnlyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="max-w-md w-full mx-auto px-6 text-center">
        <div className="mb-6">
          <img src="/logo.jpeg" alt="GPretire.com" className="w-20 h-20 rounded-full object-cover mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-slate-100 mb-2">Access by invitation only</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            GPretire.com is a private platform. New accounts are created by invitation from an administrator.
            If you believe you should have access, contact your administrator.
          </p>
        </div>

        <Link
          href="/sign-in"
          className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          Sign in to existing account
        </Link>
      </div>
    </div>
  );
}
