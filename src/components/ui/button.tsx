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
          "inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none",
          size === "sm" ? "px-3 py-1.5 text-xs gap-1.5" : "px-4 py-2 text-sm gap-2",
          variant === "primary" && "bg-[#1B3A6B] text-white hover:bg-[#16305A] focus-visible:ring-[#1B3A6B]",
          variant === "secondary" && "bg-[#F0EDE8] text-[#3A3530] hover:bg-[#E5E0D8] focus-visible:ring-[#C8A45A]",
          variant === "danger" && "bg-red-50 text-red-700 hover:bg-red-100 focus-visible:ring-red-500",
          variant === "ghost" && "text-[#6B6459] hover:text-[#1A1612] hover:bg-[#F0EDE8] focus-visible:ring-[#C8A45A]",
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
