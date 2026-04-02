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
    colorPrimary: "#C8A45A",
    colorDanger: "#F87171",
    borderRadius: "0.5rem",
    fontFamily: "inherit",
  },
  elements: {
    card: "shadow-none border border-slate-700 bg-slate-900",
    headerTitle: "text-slate-100",
    headerSubtitle: "text-slate-400",
    formButtonPrimary: "bg-[#C8A45A] hover:bg-[#D4A574] text-[#1A0F28]",
    formFieldInput: "border-slate-700 bg-slate-800 text-slate-100 placeholder-slate-500 focus:border-[#C8A45A]",
    formFieldLabel: "text-slate-300",
    footerActionLink: "text-[#C8A45A] hover:text-amber-300",
    dividerLine: "bg-slate-700",
    dividerText: "text-slate-600",
    socialButtonsBlockButton: "border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700",
    identityPreviewText: "text-slate-200",
    identityPreviewEditButton: "text-[#C8A45A]",
    alertText: "text-red-400",
  },
};

export default function SignInPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
      <div className="flex items-center gap-3 mb-6">
        <Image src="/GPretire.jpeg" alt="GPretire.com" width={48} height={48} className="h-12 w-12 rounded-lg" />
        <span className="text-xl font-semibold text-white">GPretire.com</span>
      </div>
      <SignIn appearance={clerkAppearance} />
      <p className="mt-4 text-sm text-slate-600">
        Forgot your password?{" "}
        <Link href="/forgot-password" className="text-[#C8A45A] hover:text-amber-300 transition-colors">
          Reset it here
        </Link>
      </p>
    </div>
  );
}
