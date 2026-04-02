import { auth } from "@clerk/nextjs/server";
import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TrendingUp, BarChart3, Receipt, Activity } from "lucide-react";

export default async function RootPage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#1A0F28] text-[#E8D5B0] flex flex-col">

      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5 border-b border-[#2D1B3D]/60">
        <div className="flex items-center gap-3">
          <Image src="/GPRetire.jpeg" alt="GPretire.com" width={36} height={36} className="h-9 w-9 rounded-full object-cover" />
          <span className="text-base font-semibold tracking-tight">GPretire.com</span>
        </div>
        <Link
          href="/sign-in"
          className="rounded-lg bg-[#C8A45A] px-4 py-2 text-sm font-medium text-[#1A0F28] hover:bg-[#D4A574] transition-colors"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20">
        <Image
          src="/GPRetire.jpeg"
          alt="GPretire.com"
          width={112}
          height={112}
          className="w-28 h-28 rounded-full object-cover mb-8 ring-4 ring-[#2D1B3D]"
        />
        <h1 className="text-5xl font-bold tracking-tight text-white mb-4 max-w-2xl leading-tight">
          Know exactly when you can retire.
        </h1>
        <p className="text-lg text-[#7A6B82] max-w-xl leading-relaxed mb-10">
          GPretire.com is the financial independence platform built for GP and LP investors.
          Model your carry, portfolio, and real estate to find your FI date — with certainty.
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/sign-in"
            className="rounded-lg bg-[#C8A45A] px-6 py-3 text-sm font-semibold text-[#1A0F28] hover:bg-[#D4A574] transition-colors"
          >
            Sign in to your account
          </Link>
          <span className="text-sm text-[#7A6B82]">Access by invitation only</span>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto w-full px-6 pb-24 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FeatureCard
          icon={<TrendingUp className="w-5 h-5 text-[#C8A45A]" />}
          title="Carry & LP Modeling"
          description="Map every fund, tranche, and vesting schedule. See exactly when carry and LP distributions hit your bank account — and how much after taxes."
        />
        <FeatureCard
          icon={<Activity className="w-5 h-5 text-violet-400" />}
          title="Probability Forecasting"
          description="500-path Monte Carlo simulations show your financial independence date across bull, base, and bear market scenarios with real probability weights."
        />
        <FeatureCard
          icon={<Receipt className="w-5 h-5 text-amber-400" />}
          title="Tax-Aware Planning"
          description="LTCG harvesting, Roth conversion ladders, and carry realization timing are built into every projection — not bolted on as an afterthought."
        />
        <FeatureCard
          icon={<BarChart3 className="w-5 h-5 text-emerald-400" />}
          title="Unified Net Worth Picture"
          description="Portfolios, real estate equity, insurance cash value, and illiquid fund positions combined into a single, honest capital view."
        />
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-[#2D1B3D]/60 py-6 text-center text-xs text-[#7A6B82]">
        © {new Date().getFullYear()} GPretire.com — Private platform, access by invitation only.
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-[#2D1B3D] bg-[#2D1B3D]/60 p-6">
      <div className="w-10 h-10 rounded-lg bg-[#1E1230] flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-[#E8D5B0] font-semibold mb-2">{title}</h3>
      <p className="text-[#7A6B82] text-sm leading-relaxed">{description}</p>
    </div>
  );
}
