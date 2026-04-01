"use client";

import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatCurrency, formatPct } from "@/lib/utils";
import { TrendingDown, Info, Users } from "lucide-react";
import type { EstateCalculationResult } from "@/server/simulation/estate/calculator";

interface Props {
  data: EstateCalculationResult;
}

export function EstatePlanningCard({ data }: Props) {
  const { planningMetrics, beneficiaries, estateAfterTax } = data;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Planning Metrics */}
      <Card>
        <CardHeader
          title="Planning Opportunities"
          description="Tax reduction strategies and exemption utilization"
        />
        <CardBody>
          <div className="space-y-3">
            {planningMetrics.map((metric) => (
              <div
                key={metric.label}
                className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200"
              >
                <div className={`mt-0.5 flex-shrink-0 ${metric.isSavings ? "text-emerald-600" : "text-slate-600"}`}>
                  {metric.isSavings
                    ? <TrendingDown className="h-4 w-4" />
                    : <Info className="h-4 w-4" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-700">{metric.label}</span>
                    <span className={`text-sm font-semibold font-mono flex-shrink-0 ${
                      metric.isSavings ? "text-emerald-600" : "text-slate-700"
                    }`}>
                      {metric.isSavings ? "-" : ""}{formatCurrency(metric.value, true)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{metric.description}</p>
                </div>
              </div>
            ))}
            {planningMetrics.length === 0 && (
              <p className="text-sm text-slate-600 text-center py-4">No planning metrics available.</p>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Beneficiary Allocations */}
      <Card>
        <CardHeader
          title="Beneficiary Allocations"
          description={`Net estate to distribute: ${formatCurrency(estateAfterTax, true)}`}
          action={
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <Users className="h-3.5 w-3.5" />
              {beneficiaries.filter(b => b.birthYear > 0).length} beneficiaries
            </span>
          }
        />
        <CardBody className="p-0">
          {beneficiaries.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-600">
              No beneficiaries configured. Add children in the Profile section.
            </div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-xs font-medium text-slate-600 px-6 py-3">Beneficiary</th>
                  <th className="text-center text-xs font-medium text-slate-600 px-4 py-3">Age</th>
                  <th className="text-right text-xs font-medium text-slate-600 px-4 py-3">Share</th>
                  <th className="text-right text-xs font-medium text-slate-600 px-6 py-3">Est. Inheritance</th>
                </tr>
              </thead>
              <tbody>
                {beneficiaries.map((b, i) => {
                  const isUnallocated = b.birthYear === 0;
                  return (
                    <tr
                      key={i}
                      className={`border-t border-slate-200 hover:bg-slate-100 transition-colors ${
                        isUnallocated ? "opacity-60" : ""
                      }`}
                    >
                      <td className="px-6 py-3 font-medium text-slate-700">
                        {b.name}
                        {isUnallocated && (
                          <span className="ml-2 text-xs text-slate-600">(unallocated)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500">
                        {isUnallocated ? "—" : b.currentAge}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden w-16">
                            <div
                              className="h-full bg-indigo-500/70 rounded-full"
                              style={{ width: `${b.inheritancePct * 100}%` }}
                            />
                          </div>
                          <span className="font-mono text-slate-700 w-10 text-right">
                            {formatPct(b.inheritancePct)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-semibold text-slate-700">
                        {formatCurrency(b.estimatedInheritance, true)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="px-6 py-3 text-xs font-semibold text-slate-500" colSpan={2}>
                    Total
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold text-slate-700">
                    {formatPct(beneficiaries.reduce((s, b) => s + b.inheritancePct, 0))}
                  </td>
                  <td className="px-6 py-3 text-right font-mono font-bold text-indigo-600">
                    {formatCurrency(estateAfterTax, true)}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
