"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Toggle } from "@/components/ui/toggle";
import { Pencil, Trash2, PlusCircle, X, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CURRENT_YEAR, QUARTERS } from "@/lib/constants";

type PropertyType = "primary_residence" | "rental" | "vacation" | "commercial" | "llc_held";

const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  primary_residence: "Primary Residence",
  rental: "Rental Property",
  vacation: "Vacation Home",
  commercial: "Commercial",
  llc_held: "LLC-Held",
};

type PropertyForm = {
  propertyName: string;
  propertyType: PropertyType;
  currentValue: number;
  purchasePrice: number;
  purchaseYear: number;
  appreciationRate: number;       // displayed as %
  ownershipPct: number;           // displayed as %
  llcValuationDiscountPct: number;// displayed as %
  annualRentalIncome: number;
  annualOperatingExpenses: number;
  personalUseDaysPerYear: number;
  projectedSaleYear: number | "";
  projectedSaleQuarter: "Q1" | "Q2" | "Q3" | "Q4";
  is1031Exchange: boolean;
  // mortgage
  hasMortgage: boolean;
  mortgageBalance: number;
  mortgageRate: number;           // displayed as %
  mortgageTermMonths: number;
  mortgageLoanType: "fixed" | "arm";
};

const EMPTY: PropertyForm = {
  propertyName: "",
  propertyType: "primary_residence",
  currentValue: 0,
  purchasePrice: 0,
  purchaseYear: CURRENT_YEAR - 5,
  appreciationRate: 4,
  ownershipPct: 100,
  llcValuationDiscountPct: 0,
  annualRentalIncome: 0,
  annualOperatingExpenses: 0,
  personalUseDaysPerYear: 0,
  projectedSaleYear: "",
  projectedSaleQuarter: "Q3",
  is1031Exchange: false,
  hasMortgage: false,
  mortgageBalance: 0,
  mortgageRate: 7,
  mortgageTermMonths: 360,
  mortgageLoanType: "fixed",
};

function PropertyFormPanel({
  initial,
  onSave,
  onCancel,
  isPending,
}: {
  initial: PropertyForm;
  onSave: (f: PropertyForm) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<PropertyForm>(initial);
  const set = (patch: Partial<PropertyForm>) => setForm(f => ({ ...f, ...patch }));

  const isRental = form.propertyType === "rental" || form.propertyType === "commercial";
  const isLlc = form.propertyType === "llc_held";
  const isVacation = form.propertyType === "vacation";

  const annualMortgagePayment = form.hasMortgage && form.mortgageBalance > 0
    ? (() => {
        const r = (form.mortgageRate / 100) / 12;
        const n = form.mortgageTermMonths;
        if (r === 0) return form.mortgageBalance / n * 12;
        return (form.mortgageBalance * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) * 12;
      })()
    : 0;

  return (
    <div className="space-y-6 py-2">
      {/* Basic info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Property Name" required className="md:col-span-2">
          <Input value={form.propertyName} onChange={e => set({ propertyName: e.target.value })} placeholder="123 Main St or 'Ski Condo'" />
        </FormField>
        <FormField label="Property Type" required>
          <Select value={form.propertyType} onChange={e => set({ propertyType: e.target.value as PropertyType })}>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        </FormField>

        <FormField label="Current Market Value">
          <Input type="number" min={0} prefix="$" value={form.currentValue} onChange={e => set({ currentValue: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Original Purchase Price" hint="Used for capital gains calculation">
          <Input type="number" min={0} prefix="$" value={form.purchasePrice} onChange={e => set({ purchasePrice: parseFloat(e.target.value) || 0 })} />
        </FormField>
        <FormField label="Purchase Year">
          <Input type="number" min={1970} max={CURRENT_YEAR} value={form.purchaseYear} onChange={e => set({ purchaseYear: parseInt(e.target.value) || form.purchaseYear })} />
        </FormField>

        <FormField label="Appreciation Rate" hint="Annual appreciation assumption">
          <Input type="number" min={0} max={30} step={0.5} suffix="%" value={form.appreciationRate} onChange={e => set({ appreciationRate: parseFloat(e.target.value) || 0 })} />
        </FormField>

        {isLlc && (
          <>
            <FormField label="Ownership %" hint="Your % of LLC">
              <Input type="number" min={1} max={100} suffix="%" value={form.ownershipPct} onChange={e => set({ ownershipPct: parseFloat(e.target.value) || 100 })} />
            </FormField>
            <FormField label="Valuation Discount" hint="Typical 15–35% for minority/marketability discount">
              <Input type="number" min={0} max={50} suffix="%" value={form.llcValuationDiscountPct} onChange={e => set({ llcValuationDiscountPct: parseFloat(e.target.value) || 0 })} />
            </FormField>
          </>
        )}

        {(isRental || isVacation) && (
          <>
            <FormField label="Annual Rental Income">
              <Input type="number" min={0} prefix="$" value={form.annualRentalIncome} onChange={e => set({ annualRentalIncome: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Annual Operating Expenses" hint="Taxes, insurance, maintenance, HOA">
              <Input type="number" min={0} prefix="$" value={form.annualOperatingExpenses} onChange={e => set({ annualOperatingExpenses: parseFloat(e.target.value) || 0 })} />
            </FormField>
            {isVacation && (
              <FormField label="Personal Use Days / Year">
                <Input type="number" min={0} max={365} value={form.personalUseDaysPerYear} onChange={e => set({ personalUseDaysPerYear: parseInt(e.target.value) || 0 })} />
              </FormField>
            )}
          </>
        )}
      </div>

      {/* Future sale */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 mb-3">Future Sale (Optional)</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Projected Sale Year">
            <Input
              type="number"
              min={CURRENT_YEAR}
              max={2070}
              value={form.projectedSaleYear}
              placeholder="Leave blank if not planning to sell"
              onChange={e => set({ projectedSaleYear: e.target.value ? parseInt(e.target.value) : "" })}
            />
          </FormField>
          {form.projectedSaleYear && (
            <FormField label="Projected Sale Quarter">
              <Select value={form.projectedSaleQuarter} onChange={e => set({ projectedSaleQuarter: e.target.value as "Q1"|"Q2"|"Q3"|"Q4" })}>
                {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
              </Select>
            </FormField>
          )}
          {form.projectedSaleYear && (
            <FormField label="1031 Exchange">
              <Toggle
                checked={form.is1031Exchange}
                onChange={v => set({ is1031Exchange: v })}
                label="Proceeds roll into 1031 exchange"
              />
            </FormField>
          )}
        </div>
      </div>

      {/* Mortgage */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h4 className="text-sm font-medium text-slate-700">Mortgage</h4>
          <Toggle
            checked={form.hasMortgage}
            onChange={v => set({ hasMortgage: v })}
            label="Property has a mortgage"
          />
        </div>

        {form.hasMortgage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Outstanding Balance">
              <Input type="number" min={0} prefix="$" value={form.mortgageBalance} onChange={e => set({ mortgageBalance: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Interest Rate">
              <Input type="number" min={0} max={30} step={0.125} suffix="%" value={form.mortgageRate} onChange={e => set({ mortgageRate: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Remaining Term">
              <Select value={form.mortgageTermMonths} onChange={e => set({ mortgageTermMonths: parseInt(e.target.value) })}>
                <option value={360}>30 years (360 mo)</option>
                <option value={300}>25 years (300 mo)</option>
                <option value={240}>20 years (240 mo)</option>
                <option value={180}>15 years (180 mo)</option>
                <option value={120}>10 years (120 mo)</option>
                <option value={60}>5 years (60 mo)</option>
              </Select>
            </FormField>
            <FormField label="Loan Type">
              <Select value={form.mortgageLoanType} onChange={e => set({ mortgageLoanType: e.target.value as "fixed" | "arm" })}>
                <option value="fixed">Fixed Rate</option>
                <option value="arm">Adjustable Rate (ARM)</option>
              </Select>
            </FormField>
            {annualMortgagePayment > 0 && (
              <FormField label="Est. Annual Payment">
                <div className="flex items-center h-9 px-3 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-600">
                  {formatCurrency(annualMortgagePayment)}
                </div>
              </FormField>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5" /> Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={!form.propertyName} loading={isPending}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving…" : "Save Property"}
        </Button>
      </div>
    </div>
  );
}

export function RealEstateForm() {
  const { data = [], isLoading, refetch } = trpc.realEstate.list.useQuery();
  const addProperty = trpc.realEstate.addProperty.useMutation({ onSuccess: () => { refetch(); setAdding(false); } });
  const upsertMortgage = trpc.realEstate.upsertMortgage.useMutation();
  const updateProperty = trpc.realEstate.updateProperty.useMutation({ onSuccess: () => { refetch(); setEditingId(null); } });
  const deleteProperty = trpc.realEstate.deleteProperty.useMutation({ onSuccess: () => refetch() });

  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) return <div className="text-slate-600 text-sm p-8">Loading...</div>;

  async function handleAdd(f: PropertyForm) {
    const [result] = await addProperty.mutateAsync({
      propertyName: f.propertyName,
      propertyType: f.propertyType,
      currentValue: f.currentValue,
      purchasePrice: f.purchasePrice,
      purchaseYear: f.purchaseYear,
      appreciationRate: f.appreciationRate / 100,
      ownershipPct: f.ownershipPct / 100,
      llcValuationDiscountPct: f.llcValuationDiscountPct / 100,
      annualRentalIncome: f.annualRentalIncome,
      annualOperatingExpenses: f.annualOperatingExpenses,
      personalUseDaysPerYear: f.personalUseDaysPerYear,
      projectedSaleYear: f.projectedSaleYear ? f.projectedSaleYear as number : undefined,
      projectedSaleQuarter: f.projectedSaleYear ? f.projectedSaleQuarter : undefined,
      is1031Exchange: f.is1031Exchange,
    });
    if (f.hasMortgage && result) {
      try {
        await upsertMortgage.mutateAsync({
          propertyId: result.id,
          outstandingBalance: f.mortgageBalance,
          interestRate: f.mortgageRate / 100,
          remainingTermMonths: f.mortgageTermMonths,
          loanType: f.mortgageLoanType,
        });
      } catch (err) {
        console.error("Failed to save mortgage:", err);
        alert("Property was saved but the mortgage could not be saved. Please edit the property and try again.");
      }
    }
    refetch();
    setAdding(false);
  }

  async function handleUpdate(id: string, f: PropertyForm) {
    await updateProperty.mutateAsync({
      id,
      propertyName: f.propertyName,
      propertyType: f.propertyType,
      currentValue: f.currentValue,
      purchasePrice: f.purchasePrice,
      purchaseYear: f.purchaseYear,
      appreciationRate: f.appreciationRate / 100,
      ownershipPct: f.ownershipPct / 100,
      llcValuationDiscountPct: f.llcValuationDiscountPct / 100,
      annualRentalIncome: f.annualRentalIncome,
      annualOperatingExpenses: f.annualOperatingExpenses,
      personalUseDaysPerYear: f.personalUseDaysPerYear,
      projectedSaleYear: f.projectedSaleYear ? f.projectedSaleYear as number : undefined,
      projectedSaleQuarter: f.projectedSaleYear ? f.projectedSaleQuarter : undefined,
      is1031Exchange: f.is1031Exchange,
    });
    // Upsert mortgage (handles both add and update via ON CONFLICT)
    if (f.hasMortgage) {
      try {
        await upsertMortgage.mutateAsync({
          propertyId: id,
          outstandingBalance: f.mortgageBalance,
          interestRate: f.mortgageRate / 100,
          remainingTermMonths: f.mortgageTermMonths,
          loanType: f.mortgageLoanType,
        });
      } catch (err) {
        console.error("Failed to save mortgage:", err);
        alert("Property was saved but the mortgage could not be saved. Please try saving again.");
      }
    }
    refetch();
    setEditingId(null);
  }

  function toFormState(p: typeof data[0]): PropertyForm {
    return {
      propertyName: p.propertyName,
      propertyType: p.propertyType as PropertyType,
      currentValue: p.currentValue,
      purchasePrice: p.purchasePrice,
      purchaseYear: p.purchaseYear,
      appreciationRate: Math.round(p.appreciationRate * 100 * 10) / 10,
      ownershipPct: Math.round((p.ownershipPct ?? 1) * 100 * 10) / 10,
      llcValuationDiscountPct: Math.round((p.llcValuationDiscountPct ?? 0) * 100 * 10) / 10,
      annualRentalIncome: p.annualRentalIncome ?? 0,
      annualOperatingExpenses: p.annualOperatingExpenses ?? 0,
      personalUseDaysPerYear: p.personalUseDaysPerYear ?? 0,
      projectedSaleYear: p.projectedSaleYear ?? "",
      projectedSaleQuarter: (p.projectedSaleQuarter ?? "Q3") as "Q1"|"Q2"|"Q3"|"Q4",
      is1031Exchange: p.is1031Exchange,
      hasMortgage: !!p.mortgage,
      mortgageBalance: p.mortgage?.outstandingBalance ?? 0,
      mortgageRate: Math.round((p.mortgage?.interestRate ?? 0.07) * 100 * 100) / 100,
      mortgageTermMonths: p.mortgage?.remainingTermMonths ?? 360,
      mortgageLoanType: (p.mortgage?.loanType ?? "fixed") as "fixed" | "arm",
    };
  }

  const totalEquity = data.reduce((s, p) => {
    const equity = p.currentValue - (p.mortgage?.outstandingBalance ?? 0);
    return s + equity * (p.ownershipPct ?? 1);
  }, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Real Estate Properties"
          description="All properties with amortization, rental income, and future sale modeling"
          action={
            !adding && (
              <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                <PlusCircle className="h-3.5 w-3.5" /> Add Property
              </Button>
            )
          }
        />

        {adding && (
          <CardBody className="border-b border-slate-200">
            <PropertyFormPanel
              initial={EMPTY}
              onSave={handleAdd}
              onCancel={() => setAdding(false)}
              isPending={addProperty.isPending}
            />
          </CardBody>
        )}

        {data.length === 0 && !adding ? (
          <CardBody><EmptyState message="No properties added yet." /></CardBody>
        ) : (
          <div className="divide-y divide-slate-200">
            {data.map(prop => (
              <div key={prop.id}>
                {editingId === prop.id ? (
                  <div className="px-6 py-4">
                    <PropertyFormPanel
                      initial={toFormState(prop)}
                      onSave={f => handleUpdate(prop.id, f)}
                      onCancel={() => setEditingId(null)}
                      isPending={updateProperty.isPending}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-6 py-3 hover:bg-slate-100">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="text-sm font-medium text-slate-700">{prop.propertyName}</span>
                        <span className="text-xs text-slate-600">{PROPERTY_TYPE_LABELS[prop.propertyType]}</span>
                        {prop.is1031Exchange && <span className="text-xs text-indigo-600">1031</span>}
                        {prop.mortgage && <span className="text-xs text-slate-600">mortgage</span>}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Purchased {prop.purchaseYear} · {(prop.appreciationRate * 100).toFixed(1)}% appreciation
                        {prop.annualRentalIncome ? ` · ${formatCurrency(prop.annualRentalIncome, true)}/yr rental` : ""}
                        {prop.projectedSaleYear ? ` · Sale ${prop.projectedSaleYear}` : ""}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-slate-700">{formatCurrency(prop.currentValue, true)}</div>
                        <div className="text-xs text-slate-600">
                          {prop.mortgage ? `${formatCurrency(prop.currentValue - prop.mortgage.outstandingBalance, true)} equity` : "no mortgage"}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(prop.id)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="danger" size="sm" onClick={() => deleteProperty.mutate({ id: prop.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {data.length > 0 && (
        <div className="text-right text-sm text-slate-600">
          Total equity: <span className="text-slate-700 font-semibold">{formatCurrency(totalEquity, true)}</span>
        </div>
      )}
    </div>
  );
}
