"use client";

import { useState } from "react";
import type { ActionItem, ActionUrgency, ActionCategory } from "@/server/simulation/plan/types";
import { ActionItemCard } from "./action-item-card";

const URGENCY_SECTIONS: Array<{ urgency: ActionUrgency; heading: string; subheading: string }> = [
  {
    urgency: "do_this_year",
    heading: "Do This Year",
    subheading: "Act before December 31 to capture these opportunities",
  },
  {
    urgency: "plan_now",
    heading: "Plan Now",
    subheading: "Begin planning conversations with advisors this quarter",
  },
  {
    urgency: "monitor",
    heading: "Monitor",
    subheading: "Review annually — no action required immediately",
  },
];

interface ActionItemListProps {
  items: ActionItem[];
  activeCategory: ActionCategory | "all";
}

export function ActionItemList({ items, activeCategory }: ActionItemListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = activeCategory === "all"
    ? items
    : items.filter(i => i.category === activeCategory);

  if (filtered.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-10 text-center text-sm text-slate-400">
        No action items in this category this year.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {URGENCY_SECTIONS.map(({ urgency, heading, subheading }) => {
        const sectionItems = filtered.filter(i => i.urgency === urgency);
        if (sectionItems.length === 0) return null;

        return (
          <section key={urgency}>
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-white">{heading}</h3>
              <p className="text-xs text-slate-600 mt-0.5">{subheading}</p>
            </div>
            <div className="space-y-2">
              {sectionItems.map(item => (
                <ActionItemCard
                  key={item.id}
                  item={item}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId(prev => prev === item.id ? null : item.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
