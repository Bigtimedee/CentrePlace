"use client";

import { cn } from "@/lib/utils";
import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  prefix?: string;
  suffix?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, prefix, suffix, error, ...props }, ref) => {
    const base = (
      <input
        ref={ref}
        className={cn(
          "w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm",
          "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-red-500 focus:ring-red-500",
          (prefix || suffix) && "flex-1",
          className
        )}
        {...props}
      />
    );

    if (!prefix && !suffix) return base;

    return (
      <div className="flex">
        {prefix && (
          <span className="flex items-center px-3 bg-slate-700 border border-r-0 border-slate-700 rounded-l-md text-slate-400 text-sm">
            {prefix}
          </span>
        )}
        <div className={cn("flex-1", prefix && "rounded-l-none [&>input]:rounded-l-none", suffix && "rounded-r-none [&>input]:rounded-r-none")}>
          {base}
        </div>
        {suffix && (
          <span className="flex items-center px-3 bg-slate-700 border border-l-0 border-slate-700 rounded-r-md text-slate-400 text-sm">
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
