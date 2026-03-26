"use client";

import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 disabled:opacity-50 disabled:pointer-events-none min-h-[36px]",
          size === "sm" ? "px-3 py-2 text-xs gap-1.5" : "px-4 py-2 text-sm gap-2 min-h-[44px]",
          variant === "primary" && "bg-indigo-600 text-white hover:bg-indigo-500",
          variant === "secondary" && "bg-slate-100 text-slate-700 hover:bg-slate-200",
          variant === "danger" && "bg-red-50 text-red-600 hover:bg-red-100",
          variant === "ghost" && "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
