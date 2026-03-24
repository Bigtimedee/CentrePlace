"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X, Plus } from "lucide-react";

import type { ScenarioDefinition, ScenarioOverride } from "@/server/simulation/engine/scenario-types";
import type { SimulationInput } from "@/server/simulation/engine/types";
import { SCENARIO_COLORS } from "@/server/simulation/engine/scenario-types";

interface Props {
  scenario: ScenarioDefinition;
  isBase: boolean;
  baseInput: SimulationInput | null;
  onChange: (updated: ScenarioDefinition) => void;
  onRemove: () => void;
  /** Used by parent to show "Add Scenario" ghost card */
  isAddButton?: false;
}

interface AddButtonProps {
  isAddButton: true;
  onAdd: () => void;
}

// ── Lever field helpers ────────────────────────────────────────────────────────

function PctField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | undefined;
  placeholder: number;
  onChange: (v: number | undefined) => void;
}) {
  const display = value !== undefined ? (value * 100).toFixed(1) : "";
  return (
    <div>
      <label className="block text-xs text-slate-600 mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={display}
          placeholder={`${(placeholder * 100).toFixed(1)}`}
          onChange={e => {
            const raw = e.target.value;
            if (raw === "") { onChange(undefined); return; }
            const n = parseFloat(raw);
            if (!isNaN(n)) onChange(n / 100);
          }}
          className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-700 placeholder-slate-600 focus:outline-none focus:border-indigo-500 pr-7"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-600">%</span>
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── Override summary badges ────────────────────────────────────────────────────

function overrideSummary(overrides: ScenarioOverride): string[] {
  const tags: string[] = [];
  if (overrides.assumedReturnRate !== undefined)
    tags.push(`${(overrides.assumedReturnRate * 100).toFixed(0)}% return`);
  if (overrides.targetAge !== undefined)
    tags.push(`age ${overrides.targetAge} target`);
  if (overrides.recurringSpendingMultiplier !== undefined)
    tags.push(`${Math.round(overrides.recurringSpendingMultiplier * 100)}% spending`);
  if (overrides.carryHaircutMultiplier !== undefined)
    tags.push(`${overrides.carryHaircutMultiplier}× haircut`);
  if (overrides.forceInsuranceOwnership)
    tags.push(overrides.forceInsuranceOwnership.toUpperCase());
  return tags;
}

// ── Main card ─────────────────────────────────────────────────────────────────

export function ScenarioCard(props: Props | AddButtonProps) {
  const [expanded, setExpanded] = useState(false);

  if (props.isAddButton) {
    return (
      <button
        onClick={props.onAdd}
        className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600 hover:border-slate-300 hover:text-slate-700 transition-colors min-w-[200px]"
      >
        <Plus className="h-4 w-4" />
        Add Scenario
      </button>
    );
  }

  const { scenario, isBase, baseInput, onChange, onRemove } = props;

  const overrides = scenario.overrides;
  const baseReturnRate = baseInput?.profile.assumedReturnRate ?? 0.07;
  const baseTargetAge = baseInput?.profile.targetAge ?? 90;

  function updateOverride(patch: Partial<ScenarioOverride>) {
    onChange({ ...scenario, overrides: { ...overrides, ...patch } });
  }

  const tags = overrideSummary(overrides);

  return (
    <div
      className="rounded-xl border bg-white min-w-[220px] max-w-[280px] flex-1"
      style={{ borderColor: scenario.color + "40" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200">
        {/* Color dot (click to cycle) */}
        <button
          onClick={() => {
            if (isBase) return;
            const idx = SCENARIO_COLORS.indexOf(scenario.color);
            const next = SCENARIO_COLORS[(idx + 1) % SCENARIO_COLORS.length];
            onChange({ ...scenario, color: next });
          }}
          className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-white transition-transform hover:scale-110"
          style={{ backgroundColor: scenario.color }}
          title={isBase ? undefined : "Click to change color"}
        />

        {/* Name (editable unless base) */}
        {isBase ? (
          <span className="text-sm font-semibold text-slate-700 flex-1">{scenario.name}</span>
        ) : (
          <input
            value={scenario.name}
            onChange={e => onChange({ ...scenario, name: e.target.value })}
            className="flex-1 bg-transparent text-sm font-semibold text-slate-700 focus:outline-none focus:border-b focus:border-slate-200 min-w-0"
            maxLength={40}
          />
        )}

        {/* Controls */}
        {!isBase && (
          <button
            onClick={onRemove}
            className="text-slate-600 hover:text-slate-500 transition-colors ml-auto flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-slate-600 hover:text-slate-500 transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Override summary badges */}
      {!expanded && (
        <div className="px-4 py-2 flex flex-wrap gap-1.5 min-h-[36px]">
          {isBase || tags.length === 0 ? (
            <span className="text-xs text-slate-600">
              {isBase ? "Live data — no overrides" : "No overrides"}
            </span>
          ) : (
            tags.map(tag => (
              <span
                key={tag}
                className="text-xs rounded-full px-2 py-0.5 border"
                style={{ color: scenario.color, borderColor: scenario.color + "40", backgroundColor: scenario.color + "15" }}
              >
                {tag}
              </span>
            ))
          )}
        </div>
      )}

      {/* Lever editor (expanded) */}
      {expanded && (
        <div className="px-4 py-3 space-y-3 border-t border-slate-200">
          <PctField
            label="Return Rate"
            value={overrides.assumedReturnRate}
            placeholder={baseReturnRate}
            onChange={v => updateOverride({ assumedReturnRate: v })}
          />

          <div>
            <label className="block text-xs text-slate-600 mb-1">Target Age</label>
            <input
              type="number"
              min={70}
              max={100}
              value={overrides.targetAge ?? ""}
              placeholder={String(baseTargetAge)}
              onChange={e => {
                const raw = e.target.value;
                updateOverride({ targetAge: raw === "" ? undefined : parseInt(raw, 10) });
              }}
              className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs text-slate-700 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <SelectField
            label="Spending Level"
            value={
              overrides.recurringSpendingMultiplier === undefined ? "base"
              : overrides.recurringSpendingMultiplier <= 0.75 ? "lean"
              : overrides.recurringSpendingMultiplier <= 0.90 ? "frugal"
              : overrides.recurringSpendingMultiplier >= 1.30 ? "rich"
              : overrides.recurringSpendingMultiplier >= 1.15 ? "fat"
              : "base"
            }
            options={[
              { value: "lean",   label: "Lean FIRE (−25%)" },
              { value: "frugal", label: "Frugal (−10%)" },
              { value: "base",   label: "Base (as entered)" },
              { value: "fat",    label: "Fat FIRE (+15%)" },
              { value: "rich",   label: "Rich (+30%)" },
            ]}
            onChange={v => {
              const map: Record<string, number | undefined> = {
                lean: 0.75, frugal: 0.90, base: undefined, fat: 1.15, rich: 1.30,
              };
              updateOverride({ recurringSpendingMultiplier: map[v] });
            }}
          />

          <SelectField
            label="Carry Haircut"
            value={
              overrides.carryHaircutMultiplier === undefined ? "base"
              : overrides.carryHaircutMultiplier <= 0.5 ? "optimistic"
              : overrides.carryHaircutMultiplier >= 1.5 ? "pessimistic"
              : "base"
            }
            options={[
              { value: "optimistic",  label: "Optimistic (½ haircut)" },
              { value: "base",        label: "Base (as entered)" },
              { value: "pessimistic", label: "Pessimistic (1.5× haircut)" },
            ]}
            onChange={v => {
              const map: Record<string, number | undefined> = {
                optimistic: 0.5, base: undefined, pessimistic: 1.5,
              };
              updateOverride({ carryHaircutMultiplier: map[v] });
            }}
          />

          <SelectField
            label="Insurance Ownership"
            value={overrides.forceInsuranceOwnership ?? "as_entered"}
            options={[
              { value: "as_entered", label: "As entered" },
              { value: "ilit",       label: "Force ILIT" },
              { value: "personal",   label: "Force Personal" },
            ]}
            onChange={v => {
              updateOverride({
                forceInsuranceOwnership: v === "as_entered" ? null : (v as "ilit" | "personal"),
              });
            }}
          />

          {!isBase && (
            <button
              onClick={() => onChange({ ...scenario, overrides: {} })}
              className="w-full text-xs text-slate-600 hover:text-slate-500 text-center pt-1 transition-colors"
            >
              Reset to base
            </button>
          )}
        </div>
      )}
    </div>
  );
}
