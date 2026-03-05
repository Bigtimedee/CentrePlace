import Link from "next/link";

export default function InviteOnlyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="max-w-md w-full mx-auto px-6 text-center">
        <div className="mb-6">
          <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-slate-100 mb-2">Access by invitation only</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            CentrePlace is a private platform. New accounts are created by invitation from an administrator.
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
