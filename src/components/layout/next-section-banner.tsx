"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface NextSectionBannerProps {
  href: string;
  label: string;
  description: string;
}

export function NextSectionBanner({ href, label, description }: NextSectionBannerProps) {
  return (
    <Link
      href={href}
      className="group mt-10 flex items-center justify-between rounded-xl border bg-white px-6 py-5 transition-all hover:bg-[#F5F3EE]"
      style={{ borderColor: "#E5E0D8" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "#1B3A6B")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "#E5E0D8")}
    >
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-600">
          Up next
        </p>
        <p className="text-base font-semibold text-slate-900 group-hover:text-[#1B3A6B] transition-colors">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-slate-600">{description}</p>
      </div>
      <ChevronRight className="ml-4 h-5 w-5 shrink-0 text-slate-400 group-hover:text-[#C8A45A] transition-colors" />
    </Link>
  );
}
