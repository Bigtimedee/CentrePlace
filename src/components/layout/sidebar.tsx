"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  LayoutDashboard, User, DollarSign, TrendingUp, Building2,
  Briefcase, Home, Shield, CreditCard, Scale, BarChart3, Receipt, Waves, ListChecks, Activity, Settings, Award, RefreshCw, PieChart
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard",      label: "Dashboard",      icon: LayoutDashboard, section: null },
  { href: "/profile",        label: "Profile",        icon: User,            section: "Setup" },
  { href: "/income",         label: "Income",         icon: DollarSign,      section: "Setup" },
  { href: "/carry",          label: "Carry",          icon: TrendingUp,      section: "Capital" },
  { href: "/lp-investments", label: "LP Investments", icon: Briefcase,       section: "Capital" },
  { href: "/equity-compensation", label: "Equity Comp", icon: Award,           section: "Capital" },
  { href: "/portfolios",          label: "Portfolios",         icon: BarChart3,   section: "Capital" },
  { href: "/reinvestment-policy", label: "Reinvestment Policy", icon: RefreshCw,  section: "Capital" },
  { href: "/portfolio-analysis",  label: "Portfolio Analysis",  icon: PieChart,    section: "Capital" },
  { href: "/real-estate",         label: "Real Estate",         icon: Home,        section: "Capital" },
  { href: "/insurance",      label: "Insurance",      icon: Shield,          section: "Capital" },
  { href: "/cashflow",       label: "Liquidity",      icon: Waves,           section: "Capital" },
  { href: "/expenditures",   label: "Expenditures",   icon: CreditCard,      section: "Spending" },
  { href: "/estate",         label: "Estate",         icon: Scale,           section: "Planning" },
  { href: "/scenarios",      label: "Scenarios",      icon: Building2,       section: "Planning" },
  { href: "/forecast",       label: "Probability Forecast", icon: Activity,  section: "Planning" },
  { href: "/tax",            label: "Tax Planning",   icon: Receipt,         section: "Planning" },
  { href: "/plan",               label: "Action Plan",       icon: ListChecks, section: "Planning" },
];

// Pre-compute which items are the first in their section
const itemsWithSectionHeader = navItems.map((item, i) => ({
  ...item,
  showHeader: item.section !== null && (i === 0 || item.section !== navItems[i - 1].section),
}));

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-60 bg-slate-900 border-r border-slate-800 flex flex-col">
      {/* Logo */}
      <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-800">
        <Image src="/logo.jpeg" alt="GPretire.com" width={36} height={36} className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
        <span className="text-base font-semibold tracking-tight text-white">GPretire.com</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {itemsWithSectionHeader.map((item) => (
          <div key={item.href}>
            {item.showHeader && (
              <p className="px-3 py-2 mt-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {item.section}
              </p>
            )}
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === item.href
                  ? "bg-slate-800 text-white"
                  : "text-slate-300 hover:text-white hover:bg-slate-800/60"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </Link>
          </div>
        ))}
      </nav>

      {/* Admin link */}
      {isAdmin && (
        <div className="px-3 pb-2">
          <Link
            href="/admin"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-slate-800 text-white"
                : "text-slate-500 hover:text-white hover:bg-slate-800/60"
            )}
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            Admin
          </Link>
        </div>
      )}

      {/* User button */}
      <div className="h-16 flex items-center px-6 border-t border-slate-800">
        <UserButton />
      </div>
    </aside>
  );
}
