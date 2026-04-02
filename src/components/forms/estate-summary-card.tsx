"use client";

import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { formatCurrency, formatPct } from "@/lib/utils";
import { AlertCircle } from "lucide-react";
import type { EstateCalculationResult } from "@/server/simulation/estate/calculator";

interface Props {
  data: EstateCalculationResult;
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "rose" | "emerald" | "amber" | "indigo";
}) {
  const colors = {
    rose: "text-rose-600",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    indigo: "text-[#C8A45A]",
  };
  return (
    <div className="bg-slate-50 rounded-lg px-4 py-3">
      <p className="text-xs text-slate-600 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${accent ? colors[accent] : "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
    </div>
  );
}

export function EstateSummaryCard({ data }: Props) {
  const {
    grossEstate,
    ilitDeathBenefit,
    federalEstateTax,
    stateEstateTax,
    totalEstateTax,
    estateAfterTax,
    federalExemption,
    hasStateEstateTax: hasStateTax,
    stateCode,
    stateExemption,
    filingStatus,
  } = data;

  const pctToHeirs = grossEstate > 0 ? estateAfterTax / grossEstate : 1;
  const isTaxable = totalEstateTax > 0;
  const netAboveFederal = Math.max(0, grossEstate - federalExemption);

  return (
    <Card>
      <CardHeader
        title="Estate Summary"
        description={`${filingStatus === "married_filing_jointly" ? "MFJ" : "Single"} · ${stateCode} · ${data.currentYear}`}
        action={
          isTaxable ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-3 py-1">
              <AlertCircle className="h-3 w-3" /> Estate Tax Owed
            </span>
          ) : (
            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
              Below Federal Threshold
            </span>
          )
        }
      />
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Stat
            label="Gross Estate"
            value={formatCurrency(grossEstate, true)}
            sub={ilitDeathBenefit > 0 ? `+${formatCurrency(ilitDeathBenefit, true)} ILIT excluded` : undefined}
            accent="indigo"
          />
          <Stat
            label="Federal Estate Tax"
            value={formatCurrency(federalEstateTax, true)}
            sub={`Above ${formatCurrency(federalExemption, true)} exemption`}
            accent={federalEstateTax > 0 ? "rose" : undefined}
          />
          <Stat
            label={`${stateCode} Estate Tax`}
            value={hasStateTax ? formatCurrency(stateEstateTax, true) : "None"}
            sub={hasStateTax && stateExemption > 0
              ? `${stateCode} exemption: ${formatCurrency(stateExemption, true)}`
              : `${stateCode} has no estate tax`}
            accent={stateEstateTax > 0 ? "rose" : undefined}
          />
          <Stat
            label="Net to Heirs"
            value={formatCurrency(estateAfterTax, true)}
            sub={`${formatPct(pctToHeirs)} of gross estate`}
            accent={pctToHeirs >= 0.9 ? "emerald" : "amber"}
          />
        </div>

        {/* Estate vs exemption bar */}
        <div className="mt-1">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
            <span>Estate vs Federal Exemption ({formatCurrency(federalExemption, true)})</span>
            {netAboveFederal > 0 && (
              <span className="text-rose-600">{formatCurrency(netAboveFederal, true)} above threshold</span>
            )}
          </div>
          <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
            {/* Exempt portion */}
            <div
              className="absolute inset-y-0 left-0 bg-emerald-600/70 rounded-full"
              style={{
                width: `${Math.min(100, (Math.min(grossEstate, federalExemption) / Math.max(grossEstate, federalExemption)) * 100)}%`,
              }}
            />
            {/* Taxable portion */}
            {grossEstate > federalExemption && (
              <div
                className="absolute inset-y-0 bg-rose-600/70"
                style={{
                  left: `${(federalExemption / grossEstate) * 100}%`,
                  right: 0,
                }}
              />
            )}
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-600/70" />
              Exempt ({formatCurrency(Math.min(grossEstate, federalExemption), true)})
            </span>
            {grossEstate > federalExemption && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-600/70" />
                Taxable at 40% ({formatCurrency(netAboveFederal, true)})
              </span>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
