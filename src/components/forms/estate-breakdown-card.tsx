"use client";

import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, Home, Shield, Layers, DollarSign, CheckCircle2, XCircle } from "lucide-react";
import type {
  EstateCalculationResult,
  EstateComponent,
  EstateComponentCategory,
} from "@/server/simulation/estate/calculator";

interface Props {
  data: EstateCalculationResult;
}

const CATEGORY_META: Record<
  EstateComponentCategory,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  investment_account: { label: "Investment Accounts", icon: TrendingUp, color: "text-[#C8A45A]" },
  real_estate:        { label: "Real Estate",          icon: Home,       color: "text-emerald-600" },
  insurance_personal: { label: "Insurance (Personal)", icon: Shield,     color: "text-amber-600" },
  insurance_ilit:     { label: "Insurance (ILIT)",     icon: Shield,     color: "text-violet-600" },
  carry:              { label: "Carry Positions",      icon: DollarSign, color: "text-sky-600" },
  lp_investment:      { label: "LP Investments",       icon: Layers,     color: "text-teal-600" },
};

const CATEGORY_ORDER: EstateComponentCategory[] = [
  "investment_account",
  "real_estate",
  "insurance_personal",
  "insurance_ilit",
  "carry",
  "lp_investment",
];

function groupByCategory(components: EstateComponent[]) {
  const groups = new Map<EstateComponentCategory, EstateComponent[]>();
  for (const cat of CATEGORY_ORDER) {
    groups.set(cat, []);
  }
  for (const c of components) {
    groups.get(c.category)?.push(c);
  }
  return groups;
}

export function EstateBreakdownCard({ data }: Props) {
  const { components, grossEstate, ilitDeathBenefit } = data;
  const groups = groupByCategory(components);

  return (
    <Card>
      <CardHeader
        title="Estate Breakdown"
        description="All assets included in or excluded from the taxable estate"
      />
      <CardBody className="p-0">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left text-xs font-medium text-slate-600 px-6 py-3 w-1/2">Asset</th>
              <th className="text-right text-xs font-medium text-slate-600 px-4 py-3">Estate Value</th>
              <th className="text-center text-xs font-medium text-slate-600 px-4 py-3">In Estate</th>
              <th className="text-left text-xs font-medium text-slate-600 px-4 py-3 hidden lg:table-cell">Notes</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORY_ORDER.map((cat) => {
              const items = groups.get(cat)!;
              if (items.length === 0) return null;

              const meta = CATEGORY_META[cat];
              const Icon = meta.icon;
              const subtotal = items.reduce((s, c) => s + c.estateValue, 0);

              return (
                <>
                  {/* Category header row */}
                  <tr key={`${cat}-header`} className="bg-slate-100 border-t border-slate-200">
                    <td colSpan={4} className="px-6 py-2">
                      <span className={`flex items-center gap-2 text-xs font-semibold ${meta.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </td>
                  </tr>

                  {/* Component rows */}
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200 hover:bg-slate-100 transition-colors">
                      <td className="px-6 py-3 text-slate-700 font-medium">{item.name}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        {item.inEstate
                          ? formatCurrency(item.estateValue, true)
                          : <span className="text-slate-600 italic">excluded</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        {item.inEstate
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                          : <XCircle className="h-4 w-4 text-slate-600 mx-auto" />
                        }
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 hidden lg:table-cell max-w-xs">
                        {item.notes}
                      </td>
                    </tr>
                  ))}

                  {/* Subtotal row */}
                  {items.length > 1 && (
                    <tr key={`${cat}-subtotal`} className="border-t border-slate-200 bg-slate-50">
                      <td className="px-6 py-2 text-xs text-slate-600 pl-8">
                        {meta.label} subtotal
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-xs text-slate-500 font-semibold">
                        {formatCurrency(subtotal, true)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>

          {/* Grand total footer */}
          <tfoot>
            <tr className="border-t-2 border-slate-200">
              <td className="px-6 py-3 text-sm font-semibold text-slate-900">Gross Taxable Estate</td>
              <td className="px-4 py-3 text-right font-mono font-bold text-[#C8A45A]">
                {formatCurrency(grossEstate, true)}
              </td>
              <td className="px-4 py-3 text-center">
                <CheckCircle2 className="h-4 w-4 text-[#C8A45A] mx-auto" />
              </td>
              <td className="px-4 py-3 hidden lg:table-cell" />
            </tr>
            {ilitDeathBenefit > 0 && (
              <tr className="border-t border-slate-200">
                <td className="px-6 py-3 text-sm font-semibold text-slate-500">ILIT Death Benefit (excluded)</td>
                <td className="px-4 py-3 text-right font-mono font-bold text-violet-600">
                  +{formatCurrency(ilitDeathBenefit, true)}
                </td>
                <td className="px-4 py-3 text-center">
                  <XCircle className="h-4 w-4 text-slate-600 mx-auto" />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-slate-600">
                  Held in ILIT trust — outside taxable estate
                </td>
              </tr>
            )}
          </tfoot>
        </table>
        </div>
      </CardBody>
    </Card>
  );
}
