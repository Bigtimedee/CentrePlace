"use client";

import { useState } from "react";
import { formatCurrency } from "@/lib/utils";
import type { AnnualTaxProjection } from "@/server/simulation/tax/projection-types";

interface TaxEvent {
  year: number;
  age: number;
  type: "Carry" | "LP Distribution" | "RE Sale";
  source: string;
  grossAmount: number;
  estimatedTax: number;
  taxCharacter?: string;
}

function flattenEvents(projections: AnnualTaxProjection[]): TaxEvent[] {
  const events: TaxEvent[] = [];

  for (const p of projections) {
    for (const e of p.carryEvents) {
      if (e.estimatedTax > 0 || e.netCarryAmount > 0) {
        events.push({
          year: p.year,
          age: p.age,
          type: "Carry",
          source: e.fundName,
          grossAmount: e.netCarryAmount,
          estimatedTax: e.estimatedTax,
          taxCharacter: "LTCG",
        });
      }
    }
    for (const e of p.lpEvents) {
      if (e.taxCharacter !== "return_of_capital" && (e.estimatedTax > 0 || e.amount > 0)) {
        events.push({
          year: p.year,
          age: p.age,
          type: "LP Distribution",
          source: e.fundName,
          grossAmount: e.amount,
          estimatedTax: e.estimatedTax,
          taxCharacter: e.taxCharacter === "ltcg" ? "LTCG" : "Ordinary",
        });
      }
    }
    for (const e of p.reSaleEvents) {
      if (e.gainAmount > 0) {
        events.push({
          year: p.year,
          age: p.age,
          type: "RE Sale",
          source: e.propertyName,
          grossAmount: e.gainAmount,
          estimatedTax: e.estimatedTax,
          taxCharacter: "LTCG",
        });
      }
    }
  }

  return events.sort((a, b) => b.estimatedTax - a.estimatedTax);
}

const TYPE_BADGE: Record<TaxEvent["type"], string> = {
  "Carry":          "bg-amber-50 text-amber-600 border-amber-200",
  "LP Distribution":"bg-[#FFF3D8] text-[#C8A45A] border-[#D4B896]",
  "RE Sale":        "bg-emerald-50 text-emerald-600 border-emerald-200",
};

interface Props {
  projections: AnnualTaxProjection[];
}

export function TaxEventTable({ projections }: Props) {
  const [showAll, setShowAll] = useState(false);

  const allEvents = flattenEvents(projections);
  const displayed = showAll ? allEvents : allEvents.slice(0, 10);
  const totalEventTax = allEvents.reduce((s, e) => s + e.estimatedTax, 0);

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Discrete Tax Events</h3>
          <p className="text-xs text-slate-600 mt-0.5">
            {allEvents.length} event{allEvents.length !== 1 ? "s" : ""} across carry, LP, and real estate realizations
            {totalEventTax > 0 && ` · ~${formatCurrency(totalEventTax, true)} total estimated tax`}
          </p>
        </div>
      </div>

      {allEvents.length === 0 ? (
        <p className="text-sm text-slate-600 text-center py-6">
          No discrete tax events. Add carry positions, LP distributions, or real estate sales to see them here.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left text-slate-600 font-medium pb-2 pr-3">Year</th>
                  <th className="text-left text-slate-600 font-medium pb-2 pr-3">Age</th>
                  <th className="text-left text-slate-600 font-medium pb-2 pr-3">Type</th>
                  <th className="text-left text-slate-600 font-medium pb-2 pr-3">Source</th>
                  <th className="text-right text-slate-600 font-medium pb-2 pr-3">Character</th>
                  <th className="text-right text-slate-600 font-medium pb-2 pr-3">Amount</th>
                  <th className="text-right text-slate-600 font-medium pb-2">Est. Tax</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((e, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-slate-100" : ""}>
                    <td className="py-1.5 pr-3 text-slate-600 font-medium">{e.year}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{e.age}</td>
                    <td className="py-1.5 pr-3">
                      <span className={`border rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[e.type]}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-500 max-w-[160px] truncate">{e.source}</td>
                    <td className="py-1.5 pr-3 text-right text-slate-600">{e.taxCharacter ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-right text-slate-600 font-mono">
                      {formatCurrency(e.grossAmount, true)}
                    </td>
                    <td className="py-1.5 text-right text-rose-600 font-semibold font-mono">
                      ~{formatCurrency(e.estimatedTax, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {allEvents.length > 10 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="mt-3 text-xs text-[#C8A45A] hover:text-amber-400 transition-colors cursor-pointer"
            >
              {showAll ? "Show fewer" : `Show all ${allEvents.length} events`}
            </button>
          )}
        </>
      )}

      <p className="mt-4 text-xs text-slate-600 leading-relaxed">
        Tax estimates use the marginal LTCG/ordinary rate for the year of realization plus the 3.8% NIIT where applicable.
        Carry and LP LTCG distributions include NIIT; return-of-capital distributions are excluded.
        These are planning estimates — consult a CPA for actual tax liability.
      </p>
    </div>
  );
}
