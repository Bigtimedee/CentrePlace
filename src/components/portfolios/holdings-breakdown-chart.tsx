"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { EmptyState } from "@/components/ui/empty-state";

interface Props {
  holdings: { assetClass: string; marketValue: number }[];
}

const COLORS: Record<string, string> = {
  equity: "#3b82f6",
  bond: "#22c55e",
  alt: "#a855f7",
  cash: "#9ca3af",
};

const LABELS: Record<string, string> = {
  equity: "Equity",
  bond: "Bonds",
  alt: "Alternatives",
  cash: "Cash",
};

export function HoldingsBreakdownChart({ holdings }: Props) {
  const totals: Record<string, number> = {};
  for (const h of holdings) {
    totals[h.assetClass] = (totals[h.assetClass] ?? 0) + h.marketValue;
  }

  const data = Object.entries(totals).map(([assetClass, value]) => ({
    name: LABELS[assetClass] ?? assetClass,
    assetClass,
    value,
  }));

  const total = data.reduce((s, d) => s + d.value, 0);

  if (data.length === 0) return <EmptyState message="Add portfolio holdings to see the breakdown." />;

  return (
    <div className="flex flex-col items-center gap-4">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={95}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.assetClass} fill={COLORS[entry.assetClass] ?? "#e5e7eb"} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | string | undefined) => {
              const v = value == null ? 0 : typeof value === "number" ? value : parseFloat(String(value));
              return [`$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${((v / total) * 100).toFixed(1)}%)`] as [string];
            }}
          />
          <Legend
            formatter={(value) => <span className="text-sm text-gray-700">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
