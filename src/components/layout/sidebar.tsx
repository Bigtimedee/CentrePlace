"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, useUser } from "@clerk/nextjs";
import {
  LayoutDashboard, User, DollarSign, TrendingUp, Building2,
  Briefcase, Home, Shield, CreditCard, Scale, BarChart3, Receipt, Waves, ListChecks, Activity, Settings, Award, RefreshCw, PieChart, Menu, X
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
  { href: "/real-estate",         label: "Real Estate",         icon: Home,        section: "Capital" },
  { href: "/insurance",      label: "Insurance",      icon: Shield,          section: "Capital" },
  { href: "/cashflow",       label: "Liquidity",      icon: Waves,           section: "Capital" },
  { href: "/expenditures",   label: "Expenditures",   icon: CreditCard,      section: "Spending" },
  { href: "/portfolio-analysis",  label: "Portfolio Analysis",  icon: PieChart,   section: "Planning" },
  { href: "/estate",         label: "Estate",         icon: Scale,           section: "Planning" },
  { href: "/scenarios",      label: "Scenarios",      icon: Building2,       section: "Planning" },
  { href: "/forecast",       label: "Probability Forecast", icon: Activity,  section: "Planning" },
  { href: "/tax",            label: "Tax Planning",   icon: Receipt,         section: "Planning" },
  { href: "/plan",               label: "Action Plan",       icon: ListChecks, section: "Planning" },
];

const itemsWithSectionHeader = navItems.map((item, i) => ({
  ...item,
  showHeader: item.section !== null && (i === 0 || item.section !== navItems[i - 1].section),
}));

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();
  const isAdmin = user?.publicMetadata?.role === "admin";

  const close = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile topbar — visible only on small screens */}
      <div
        className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 md:hidden"
        style={{ background: "#1A0F28", borderBottom: "1px solid #2D1B3D" }}
      >
        <div className="flex items-center gap-2.5">
          <Image src="/GPretire.jpeg" alt="GPretire.com" width={28} height={28} className="h-7 w-7 rounded-md flex-shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-white">GPretire.com</span>
        </div>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="p-2 rounded-md text-slate-400 hover:text-white transition-colors"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-purple-950/70 md:hidden"
          onClick={close}
          aria-hidden
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex flex-col transition-transform duration-200 ease-in-out",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
        style={{ background: "#1A0F28", borderRight: "1px solid #2D1B3D" }}
      >
        {/* Logo — desktop only (mobile has topbar) */}
        <div className="h-16 hidden md:flex items-center gap-3 px-4" style={{ borderBottom: "1px solid #2D1B3D" }}>
          <Image src="/GPretire.jpeg" alt="GPretire.com" width={36} height={36} className="h-9 w-9 rounded-lg flex-shrink-0" />
          <span className="text-base font-semibold tracking-tight text-white">GPretire.com</span>
        </div>

        {/* Logo — mobile sidebar header */}
        <div className="h-14 flex md:hidden items-center gap-3 px-4" style={{ borderBottom: "1px solid #2D1B3D" }}>
          <Image src="/GPretire.jpeg" alt="GPretire.com" width={28} height={28} className="h-7 w-7 rounded-md flex-shrink-0" />
          <span className="text-sm font-semibold tracking-tight text-white">GPretire.com</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          {itemsWithSectionHeader.map((item) => (
            <div key={item.href}>
              {item.showHeader && (
                <p className="px-3 py-2 mt-3 text-xs font-medium tracking-widest uppercase" style={{ color: "#7A6B82" }}>
                  {item.section}
                </p>
              )}
              <Link
                href={item.href}
                onClick={close}
                className={cn(
                  "flex items-center gap-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "border-l-[3px] pl-[9px] pr-3"
                    : "px-3 hover:text-amber-200"
                )}
                style={pathname === item.href
                  ? { background: "rgba(200, 164, 90, 0.22)", borderColor: "#C8A45A", color: "#C8A45A" }
                  : { color: "rgba(200,164,90,0.55)" }
                }
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
              onClick={close}
              className={cn(
                "flex items-center gap-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "border-l-[3px] pl-[9px] pr-3"
                  : "px-3 hover:text-amber-200"
              )}
              style={pathname.startsWith("/admin")
                ? { background: "rgba(200, 164, 90, 0.22)", borderColor: "#C8A45A", color: "#C8A45A" }
                : { color: "rgba(200,164,90,0.35)" }
              }
            >
              <Settings className="h-4 w-4 flex-shrink-0" />
              Admin
            </Link>
          </div>
        )}

        {/* User button */}
        <div className="h-16 flex items-center px-6" style={{ borderTop: "1px solid #2D1B3D" }}>
          <UserButton />
        </div>
      </aside>
    </>
  );
}
