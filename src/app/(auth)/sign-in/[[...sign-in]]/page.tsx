import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
      <SignIn />
      <p className="mt-4 text-sm text-slate-500">
        Forgot your password?{" "}
        <Link href="/forgot-password" className="text-indigo-400 hover:text-indigo-300 transition-colors">
          Reset it here
        </Link>
      </p>
    </div>
  );
}
