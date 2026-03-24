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
      className="group mt-10 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-6 py-5 transition-all hover:border-indigo-400 hover:bg-slate-50"
    >
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-slate-600">
          Up next
        </p>
        <p className="text-base font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-slate-600">{description}</p>
      </div>
      <ChevronRight className="ml-4 h-5 w-5 shrink-0 text-slate-400 group-hover:text-indigo-500 transition-colors" />
    </Link>
  );
}
