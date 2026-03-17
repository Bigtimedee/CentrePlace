import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
      <div className="flex items-center gap-3 mb-6">
        <Image src="/logo.jpeg" alt="GPretire.com" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
        <span className="text-xl font-semibold text-white">GPretire.com</span>
      </div>
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
