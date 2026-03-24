"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FormField } from "@/components/ui/form-field";
import { Pencil, Trash2, PlusCircle, X, Check, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { CURRENT_YEAR, QUARTERS } from "@/lib/constants";

// ── Types ─────────────────────────────────────────────────────────────────────

const GRANT_TYPES = ["rsu", "iso", "nso", "warrant", "rsa"] as const;
type GrantType = typeof GRANT_TYPES[number];

const GRANT_TYPE_LABELS: Record<GrantType, string> = {
  rsu: "RSU",
  iso: "ISO",
  nso: "NSO",
  warrant: "Warrant",
  rsa: "RSA",
};

const GRANT_TYPE_COLORS: Record<GrantType, string> = {
  rsu: "bg-blue-50 text-blue-700",
  iso: "bg-emerald-50 text-emerald-700",
  nso: "bg-amber-50 text-amber-700",
  warrant: "bg-purple-50 text-purple-700",
  rsa: "bg-orange-50 text-orange-700",
};

const NEEDS_STRIKE: GrantType[] = ["iso", "nso", "warrant"];
const IS_ISO: GrantType[] = ["iso"];

type GrantFormState = {
  companyName: string;
  grantType: GrantType;
  grantDate: string;
  totalShares: number;
  strikePrice: number | null;
  currentFmv: number;
  fmvGrowthRate: number; // stored as pct (8 = 8%)
  expirationDate: string;
  notes: string;
};

type VestingEventFormState = {
  year: number;
  quarter: "Q1" | "Q2" | "Q3" | "Q4";
  shares: number;
  projectedFmvAtEvent: number | null;
};

type ShareLotFormState = {
  shares: number;
  costBasisPerShare: number;
  acquiredDate: string;
  projectedSaleYear: number | null;
  projectedSaleQuarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  isIsoQualifying: boolean;
};

const EMPTY_GRANT: GrantFormState = {
  companyName: "",
  grantType: "rsu",
  grantDate: `${CURRENT_YEAR}-01-01`,
  totalShares: 0,
  strikePrice: null,
  currentFmv: 0,
  fmvGrowthRate: 8,
  expirationDate: "",
  notes: "",
};

const EMPTY_VESTING: VestingEventFormState = {
  year: CURRENT_YEAR + 1,
  quarter: "Q1",
  shares: 0,
  projectedFmvAtEvent: null,
};

const EMPTY_LOT: ShareLotFormState = {
  shares: 0,
  costBasisPerShare: 0,
  acquiredDate: `${CURRENT_YEAR}-01-01`,
  projectedSaleYear: null,
  projectedSaleQuarter: null,
  isIsoQualifying: false,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function grantToMutation(f: GrantFormState) {
  return {
    ...f,
    fmvGrowthRate: f.fmvGrowthRate / 100,
    strikePrice: NEEDS_STRIKE.includes(f.grantType) ? (f.strikePrice ?? 0) : null,
    expirationDate: f.expirationDate || null,
    notes: f.notes || null,
  };
}

function grantFromRecord(r: {
  companyName: string;
  grantType: string;
  grantDate: string;
  totalShares: number;
  strikePrice: number | null;
  currentFmv: number;
  fmvGrowthRate: number;
  expirationDate: string | null;
  notes: string | null;
}): GrantFormState {
  return {
    companyName: r.companyName,
    grantType: r.grantType as GrantType,
    grantDate: r.grantDate,
    totalShares: r.totalShares,
    strikePrice: r.strikePrice ?? null,
    currentFmv: r.currentFmv,
    fmvGrowthRate: Math.round(r.fmvGrowthRate * 100 * 10) / 10,
    expirationDate: r.expirationDate ?? "",
    notes: r.notes ?? "",
  };
}

// ── Grant Form ────────────────────────────────────────────────────────────────

function GrantForm({
  initial,
  onSave,
  onCancel,
  isPending,
  serverError,
}: {
  initial: GrantFormState;
  onSave: (f: GrantFormState) => void;
  onCancel: () => void;
  isPending: boolean;
  serverError?: string;
}) {
  const [form, setForm] = useState<GrantFormState>(initial);
  const set = (patch: Partial<GrantFormState>) => setForm((f) => ({ ...f, ...patch }));
  const needsStrike = NEEDS_STRIKE.includes(form.grantType);

  return (
    <div className="space-y-5 py-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField label="Company Name" required className="md:col-span-2">
          <Input
            value={form.companyName}
            onChange={(e) => set({ companyName: e.target.value })}
            placeholder="Acme Inc."
          />
        </FormField>
        <FormField label="Grant Type" required>
          <Select
            value={form.grantType}
            onChange={(e) => set({ grantType: e.target.value as GrantType })}
          >
            {GRANT_TYPES.map((t) => (
              <option key={t} value={t}>{GRANT_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Grant Date" required>
          <Input
            type="date"
            value={form.grantDate}
            onChange={(e) => set({ grantDate: e.target.value })}
          />
        </FormField>
        <FormField label="Total Shares" required>
          <Input
            type="number"
            min={1}
            value={form.totalShares}
            onChange={(e) => set({ totalShares: parseInt(e.target.value) || 0 })}
          />
        </FormField>
        <FormField label="Current FMV / Share" required>
          <Input
            type="number"
            min={0}
            step={0.01}
            prefix="$"
            value={form.currentFmv}
            onChange={(e) => set({ currentFmv: parseFloat(e.target.value) || 0 })}
          />
        </FormField>

        {needsStrike && (
          <FormField label="Strike Price / Share" required hint="Exercise price per share">
            <Input
              type="number"
              min={0}
              step={0.01}
              prefix="$"
              value={form.strikePrice ?? 0}
              onChange={(e) => set({ strikePrice: parseFloat(e.target.value) || 0 })}
            />
          </FormField>
        )}

        <FormField label="FMV Growth Rate" hint="Annual appreciation assumption">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            suffix="%"
            value={form.fmvGrowthRate}
            onChange={(e) => set({ fmvGrowthRate: parseFloat(e.target.value) || 0 })}
          />
        </FormField>
        <FormField label="Expiration Date" hint="Optional — options only">
          <Input
            type="date"
            value={form.expirationDate}
            onChange={(e) => set({ expirationDate: e.target.value })}
          />
        </FormField>
        <FormField label="Notes" className="md:col-span-3">
          <Input
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Optional"
          />
        </FormField>
      </div>

      {serverError && (
        <p className="text-sm text-red-600">{serverError}</p>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => onSave(form)}
          disabled={isPending || !form.companyName || form.totalShares <= 0 || form.currentFmv <= 0}
        >
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving..." : "Save Grant"}
        </Button>
      </div>
    </div>
  );
}

// ── Vesting Event Form ────────────────────────────────────────────────────────

function VestingEventForm({
  initial,
  onSave,
  onCancel,
  isPending,
  serverError,
}: {
  initial: VestingEventFormState;
  onSave: (f: VestingEventFormState) => void;
  onCancel: () => void;
  isPending: boolean;
  serverError?: string;
}) {
  const [form, setForm] = useState<VestingEventFormState>(initial);
  const set = (patch: Partial<VestingEventFormState>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="flex flex-wrap items-end gap-3 py-2">
      <FormField label="Year">
        <Input
          type="number"
          min={CURRENT_YEAR}
          max={2070}
          value={form.year}
          onChange={(e) => set({ year: parseInt(e.target.value) || form.year })}
          className="w-24"
        />
      </FormField>
      <FormField label="Quarter">
        <Select
          value={form.quarter}
          onChange={(e) => set({ quarter: e.target.value as "Q1" | "Q2" | "Q3" | "Q4" })}
          className="w-24"
        >
          {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
        </Select>
      </FormField>
      <FormField label="Shares">
        <Input
          type="number"
          min={1}
          value={form.shares}
          onChange={(e) => set({ shares: parseInt(e.target.value) || 0 })}
          className="w-28"
        />
      </FormField>
      <FormField label="Projected FMV" hint="Optional override">
        <Input
          type="number"
          min={0}
          step={0.01}
          prefix="$"
          placeholder="Auto"
          value={form.projectedFmvAtEvent ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed = parseFloat(raw);
            set({ projectedFmvAtEvent: raw === "" || isNaN(parsed) ? null : parsed });
          }}
          className="w-32"
        />
      </FormField>
      {serverError && (
        <p className="text-sm text-red-600 w-full">{serverError}</p>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={isPending || form.shares <= 0}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving..." : "Add"}
        </Button>
      </div>
    </div>
  );
}

// ── Share Lot Form ────────────────────────────────────────────────────────────

function ShareLotForm({
  initial,
  grantType,
  onSave,
  onCancel,
  isPending,
  serverError,
}: {
  initial: ShareLotFormState;
  grantType: GrantType;
  onSave: (f: ShareLotFormState) => void;
  onCancel: () => void;
  isPending: boolean;
  serverError?: string;
}) {
  const [form, setForm] = useState<ShareLotFormState>(initial);
  const set = (patch: Partial<ShareLotFormState>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="flex flex-wrap items-end gap-3 py-2">
      <FormField label="Shares">
        <Input
          type="number"
          min={1}
          value={form.shares}
          onChange={(e) => set({ shares: parseInt(e.target.value) || 0 })}
          className="w-24"
        />
      </FormField>
      <FormField label="Cost Basis / Share">
        <Input
          type="number"
          min={0}
          step={0.01}
          prefix="$"
          value={form.costBasisPerShare}
          onChange={(e) => set({ costBasisPerShare: parseFloat(e.target.value) || 0 })}
          className="w-28"
        />
      </FormField>
      <FormField label="Acquired Date">
        <Input
          type="date"
          value={form.acquiredDate}
          onChange={(e) => set({ acquiredDate: e.target.value })}
          className="w-36"
        />
      </FormField>
      <FormField label="Sale Year" hint="Optional">
        <Input
          type="number"
          min={CURRENT_YEAR}
          max={2070}
          placeholder="—"
          value={form.projectedSaleYear ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            const parsed = parseInt(raw);
            set({ projectedSaleYear: raw === "" || isNaN(parsed) ? null : parsed });
          }}
          className="w-24"
        />
      </FormField>
      {form.projectedSaleYear !== null && (
        <FormField label="Sale Quarter">
          <Select
            value={form.projectedSaleQuarter ?? "Q4"}
            onChange={(e) => set({ projectedSaleQuarter: e.target.value as "Q1" | "Q2" | "Q3" | "Q4" })}
            className="w-24"
          >
            {QUARTERS.map((q) => <option key={q} value={q}>{q}</option>)}
          </Select>
        </FormField>
      )}
      {IS_ISO.includes(grantType) && (
        <FormField label="ISO Qualifying" hint=">2yr from grant, >1yr from exercise">
          <label className="flex items-center gap-2 h-9 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isIsoQualifying}
              onChange={(e) => set({ isIsoQualifying: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 bg-white text-blue-500"
            />
            <span className="text-sm text-slate-700">Qualifying</span>
          </label>
        </FormField>
      )}
      {serverError && (
        <p className="text-sm text-red-600 w-full">{serverError}</p>
      )}
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={isPending || form.shares <= 0}>
          <Check className="h-3.5 w-3.5" /> {isPending ? "Saving..." : "Add Lot"}
        </Button>
      </div>
    </div>
  );
}

// ── Grant Detail Panel (vesting + lots) ───────────────────────────────────────

function GrantDetailPanel({
  grant,
}: {
  grant: {
    id: string;
    grantType: string;
    totalShares: number;
    vestingEvents: { id: string; year: number; quarter: string; shares: number; projectedFmvAtEvent: number | null }[];
    shareLots: { id: string; shares: number; costBasisPerShare: number; acquiredDate: string; projectedSaleYear: number | null; projectedSaleQuarter: string | null; isIsoQualifying: number }[];
  };
}) {
  const utils = trpc.useUtils();
  const [addingVest, setAddingVest] = useState(false);
  const [addingLot, setAddingLot] = useState(false);
  const [vestError, setVestError] = useState<string | undefined>();
  const [lotError, setLotError] = useState<string | undefined>();

  const addVest = trpc.equityCompensation.addVestingEvent.useMutation({
    onSuccess: () => { utils.equityCompensation.list.invalidate(); setAddingVest(false); setVestError(undefined); },
    onError: (e) => setVestError(e.message),
  });
  const delVest = trpc.equityCompensation.deleteVestingEvent.useMutation({
    onSuccess: () => utils.equityCompensation.list.invalidate(),
  });
  const addLot = trpc.equityCompensation.addShareLot.useMutation({
    onSuccess: () => { utils.equityCompensation.list.invalidate(); setAddingLot(false); setLotError(undefined); },
    onError: (e) => setLotError(e.message),
  });
  const delLot = trpc.equityCompensation.deleteShareLot.useMutation({
    onSuccess: () => utils.equityCompensation.list.invalidate(),
  });

  const totalVested = grant.vestingEvents.reduce((s, v) => s + v.shares, 0);

  return (
    <div className="px-6 pb-4 space-y-5 border-t border-slate-200 pt-4">
      {/* Vesting Schedule */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Vesting Schedule
            <span className="ml-2 text-slate-600 font-normal normal-case">
              {totalVested}/{grant.totalShares} shares scheduled
            </span>
          </span>
          {!addingVest && (
            <Button variant="ghost" size="sm" onClick={() => setAddingVest(true)}>
              <PlusCircle className="h-3.5 w-3.5" /> Add Event
            </Button>
          )}
        </div>

        {addingVest && (
          <VestingEventForm
            initial={{ ...EMPTY_VESTING }}
            onSave={(f) =>
              addVest.mutate({
                grantId: grant.id,
                year: f.year,
                quarter: f.quarter,
                shares: f.shares,
                projectedFmvAtEvent: f.projectedFmvAtEvent,
              })
            }
            onCancel={() => { setAddingVest(false); setVestError(undefined); }}
            isPending={addVest.isPending}
            serverError={vestError}
          />
        )}

        {grant.vestingEvents.length === 0 && !addingVest ? (
          <p className="text-xs text-slate-600 italic">No vesting events added yet.</p>
        ) : (
          <div className="space-y-1">
            {grant.vestingEvents
              .slice()
              .sort((a, b) => a.year - b.year || a.quarter.localeCompare(b.quarter))
              .map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs text-slate-700 py-1 px-2 rounded hover:bg-slate-100">
                  <span>{v.year} {v.quarter}</span>
                  <span>{v.shares.toLocaleString()} shares</span>
                  {v.projectedFmvAtEvent !== null && (
                    <span className="text-slate-500">{formatCurrency(v.projectedFmvAtEvent)} FMV</span>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => delVest.mutate({ id: v.id })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Share Lots */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Share Lots
            <span className="ml-2 text-slate-600 font-normal normal-case">
              {grant.shareLots.reduce((s, l) => s + l.shares, 0).toLocaleString()} shares tracked
            </span>
          </span>
          {!addingLot && (
            <Button variant="ghost" size="sm" onClick={() => setAddingLot(true)}>
              <PlusCircle className="h-3.5 w-3.5" /> Add Lot
            </Button>
          )}
        </div>

        {addingLot && (
          <ShareLotForm
            initial={{ ...EMPTY_LOT }}
            grantType={grant.grantType as GrantType}
            onSave={(f) =>
              addLot.mutate({
                grantId: grant.id,
                shares: f.shares,
                costBasisPerShare: f.costBasisPerShare,
                acquiredDate: f.acquiredDate,
                projectedSaleYear: f.projectedSaleYear,
                projectedSaleQuarter: f.projectedSaleQuarter,
                isIsoQualifying: f.isIsoQualifying,
              })
            }
            onCancel={() => { setAddingLot(false); setLotError(undefined); }}
            isPending={addLot.isPending}
            serverError={lotError}
          />
        )}

        {grant.shareLots.length === 0 && !addingLot ? (
          <p className="text-xs text-slate-600 italic">No share lots added yet.</p>
        ) : (
          <div className="space-y-1">
            {grant.shareLots
              .slice()
              .sort((a, b) => a.acquiredDate.localeCompare(b.acquiredDate))
              .map((l) => (
                <div key={l.id} className="flex items-center justify-between text-xs text-slate-700 py-1 px-2 rounded hover:bg-slate-100">
                  <span>{l.shares.toLocaleString()} shares</span>
                  <span>{formatCurrency(l.costBasisPerShare)} basis</span>
                  <span className="text-slate-500">Acquired {l.acquiredDate}</span>
                  {l.projectedSaleYear !== null && (
                    <span className="text-slate-500">Sale: {l.projectedSaleYear} {l.projectedSaleQuarter}</span>
                  )}
                  {l.isIsoQualifying === 1 && (
                    <span className="text-emerald-600">ISO qualifying</span>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => delLot.mutate({ id: l.id })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function EquityCompensationForm() {
  const utils = trpc.useUtils();
  const { data = [], isLoading } = trpc.equityCompensation.list.useQuery();

  const addGrant = trpc.equityCompensation.add.useMutation({
    onSuccess: () => { utils.equityCompensation.list.invalidate(); setAdding(false); setAddError(undefined); },
    onError: (e) => setAddError(e.message),
  });
  const updateGrant = trpc.equityCompensation.update.useMutation({
    onSuccess: () => { utils.equityCompensation.list.invalidate(); setEditingId(null); setEditError(undefined); },
    onError: (e) => setEditError(e.message),
  });
  const delGrant = trpc.equityCompensation.delete.useMutation({
    onSuccess: () => utils.equityCompensation.list.invalidate(),
  });

  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | undefined>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) return <div className="text-slate-600 text-sm p-8">Loading...</div>;

  const totalProjectedValue = data.reduce((sum, g) => {
    return sum + g.totalShares * g.currentFmv;
  }, 0);

  const description =
    data.length === 0
      ? "Track RSUs, ISOs, NSOs, warrants, and stock grants"
      : `${data.length} grant${data.length !== 1 ? "s" : ""} · ${formatCurrency(totalProjectedValue, true)} projected value at current FMV`;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Equity Compensation"
          description={description}
          action={
            !adding && (
              <Button variant="secondary" size="sm" onClick={() => { setAdding(true); setAddError(undefined); }}>
                <PlusCircle className="h-3.5 w-3.5" /> Add Grant
              </Button>
            )
          }
        />

        {adding && (
          <CardBody className="border-b border-slate-200">
            <GrantForm
              initial={{ ...EMPTY_GRANT }}
              onSave={(f) => addGrant.mutate(grantToMutation(f))}
              onCancel={() => { setAdding(false); setAddError(undefined); }}
              isPending={addGrant.isPending}
              serverError={addError}
            />
          </CardBody>
        )}

        {data.length === 0 && !adding ? (
          <CardBody>
            <p className="text-sm text-slate-600">No equity grants added yet.</p>
          </CardBody>
        ) : (
          <div className="divide-y divide-slate-200">
            {data.map((grant) => {
              const isExpanded = expandedIds.has(grant.id);
              const isEditing = editingId === grant.id;
              const grantType = grant.grantType as GrantType;
              const spreadPerShare = NEEDS_STRIKE.includes(grantType)
                ? Math.max(0, grant.currentFmv - (grant.strikePrice ?? 0))
                : grant.currentFmv;
              const intrinsicValue = grant.totalShares * spreadPerShare;

              return (
                <div key={grant.id}>
                  {isEditing ? (
                    <div className="px-6 py-4">
                      <GrantForm
                        initial={grantFromRecord(grant)}
                        onSave={(f) => updateGrant.mutate({ id: grant.id, ...grantToMutation(f) })}
                        onCancel={() => { setEditingId(null); setEditError(undefined); }}
                        isPending={updateGrant.isPending}
                        serverError={editError}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between px-6 py-3 hover:bg-slate-100">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(grant.id)}
                            className="text-slate-600 hover:text-slate-700 transition-colors flex-shrink-0"
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-slate-700">
                                {grant.companyName}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${GRANT_TYPE_COLORS[grantType]}`}>
                                {GRANT_TYPE_LABELS[grantType]}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              {grant.totalShares.toLocaleString()} shares · FMV {formatCurrency(grant.currentFmv)} · Growth {Math.round(grant.fmvGrowthRate * 100 * 10) / 10}%/yr
                              {grant.strikePrice !== null && (
                                <> · Strike {formatCurrency(grant.strikePrice)}</>
                              )}
                              {grant.vestingEvents.length > 0 && (
                                <> · {grant.vestingEvents.length} vesting event{grant.vestingEvents.length !== 1 ? "s" : ""}</>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="ml-4 flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-emerald-600">
                              {formatCurrency(intrinsicValue, true)}
                            </div>
                            <div className="text-xs text-slate-600">intrinsic value</div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setEditingId(grant.id); setEditError(undefined); }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => delGrant.mutate({ id: grant.id })}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {isExpanded && <GrantDetailPanel grant={grant} />}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
