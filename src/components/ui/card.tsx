"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface CardProps {
  className?: string;
  children: ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <div className={cn("rounded-xl bg-white border border-slate-200", className)}>
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function CardHeader({ title, description, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between px-6 py-4 border-b border-[#D4B896] bg-[#F0E4C8]">
      <div>
        <h3 className="text-sm font-semibold" style={{ color: "#1A1612" }}>{title}</h3>
        {description && <p className="text-xs mt-0.5" style={{ color: "#9B9188" }}>{description}</p>}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, children }: CardProps) {
  return <div className={cn("p-6", className)}>{children}</div>;
}
