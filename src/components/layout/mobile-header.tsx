"use client";

import Image from "next/image";
import { UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";

interface MobileHeaderProps {
  open: boolean;
  onToggle: () => void;
}

export function MobileHeader({ open, onToggle }: MobileHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-30 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 lg:hidden">
      <button
        onClick={onToggle}
        className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Toggle navigation"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>
      <div className="flex items-center gap-2">
        <Image src="/logo.jpeg" alt="GPretire.com" width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
        <span className="text-sm font-semibold text-white">GPretire</span>
      </div>
      <div className="flex items-center min-h-[44px] min-w-[44px] justify-center">
        <UserButton />
      </div>
    </header>
  );
}
