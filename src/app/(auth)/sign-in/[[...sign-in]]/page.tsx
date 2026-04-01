import { SignIn } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";

const clerkAppearance = {
  variables: {
    colorBackground: "#0F172A",
    colorInputBackground: "#1E293B",
    colorInputText: "#F1F5F9",
    colorText: "#F1F5F9",
    colorTextSecondary: "#94A3B8",
    colorPrimary: "#6366F1",
    colorDanger: "#F87171",
    borderRadius: "0.5rem",
    fontFamily: "inherit",
  },
  elements: {
    card: "shadow-none border border-slate-700 bg-slate-900",
    headerTitle: "text-slate-100",
    headerSubtitle: "text-slate-400",
    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-500",
    formFieldInput: "border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-indigo-500",
    formFieldLabel: "text-slate-300",
    footerActionLink: "text-indigo-400 hover:text-indigo-300",
    dividerLine: "bg-slate-700",
    dividerText: "text-slate-600",
    socialButtonsBlockButton: "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700",
    identityPreviewText: "text-slate-200",
    identityPreviewEditButton: "text-indigo-400",
    alertText: "text-red-400",
  },
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
      <div className="flex items-center gap-3 mb-6">
        <Image src="/logo.svg" alt="GPretire.com" width={48} height={48} className="h-12 w-12 rounded-lg" />
        <span className="text-xl font-semibold text-white">GPretire.com</span>
      </div>
      <SignIn appearance={clerkAppearance} />
      <p className="mt-4 text-sm text-slate-600">
        Forgot your password?{" "}
        <Link href="/forgot-password" className="text-indigo-400 hover:text-indigo-300 transition-colors">
          Reset it here
        </Link>
      </p>
    </div>
  );
}
