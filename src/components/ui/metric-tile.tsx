interface MetricTileProps {
  label: string;
  value: string;
  sub?: string;
  color?: "emerald" | "indigo" | "amber" | "rose" | "slate";
}

const VALUE_COLOR: Record<NonNullable<MetricTileProps["color"]>, string> = {
  emerald: "text-emerald-600",
  indigo:  "text-[#C8A45A]",
  amber:   "text-amber-600",
  rose:    "text-rose-600",
  slate:   "text-slate-500",
};

export function MetricTile({ label, value, sub, color = "slate" }: MetricTileProps) {
  return (
    <div className="flex-1 min-w-[140px] rounded-xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${VALUE_COLOR[color]}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}
