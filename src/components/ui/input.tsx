"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, prefix, suffix, error, style, ...props }, ref) => {
    const base = (
      <input
        ref={ref}
        className={cn(
          "w-full bg-white rounded-md px-3 py-2 text-sm transition-colors",
          "focus:outline-none focus:ring-2 focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error ? "border-red-600 focus:ring-red-600" : "focus:ring-[#C8A45A]",
          (prefix || suffix) && "flex-1",
          className
        )}
        style={{
          border: error ? "1px solid #DC2626" : "1px solid #D4CECC",
          color: "#1A1612",
          ...style,
        }}
        {...props}
      />
    );

    if (!prefix && !suffix) return base;

    return (
      <div className="flex">
        {prefix && (
          <span className="flex items-center px-3 rounded-l-md text-sm" style={{ background: "#F5F3EE", border: "1px solid #D4CECC", borderRight: "none", color: "#6B6459" }}>
            {prefix}
          </span>
        )}
        <div className={cn("flex-1", prefix && "rounded-l-none [&>input]:rounded-l-none", suffix && "rounded-r-none [&>input]:rounded-r-none")}>
          {base}
        </div>
        {suffix && (
          <span className="flex items-center px-3 rounded-r-md text-sm" style={{ background: "#F5F3EE", border: "1px solid #D4CECC", borderLeft: "none", color: "#6B6459" }}>
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
