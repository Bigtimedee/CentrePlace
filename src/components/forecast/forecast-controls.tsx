"use client";

interface Props {
  volatility: number;
  varyCarry: boolean;
  onVolatilityChange: (v: number) => void;
  onVaryCarryChange: (v: boolean) => void;
  onRun: () => void;
  isLoading: boolean;
}

export function ForecastControls({
  volatility,
  varyCarry,
  onVolatilityChange,
  onVaryCarryChange,
  onRun,
  isLoading,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
      <label className="flex items-center gap-2 text-sm text-slate-600">
        <span>Return Volatility</span>
        <input
          type="number"
          min={5}
          max={40}
          step={1}
          value={volatility}
          onChange={e => onVolatilityChange(Number(e.target.value))}
          className="w-16 rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
        />
        <span className="text-slate-500">%</span>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={varyCarry}
          onChange={e => onVaryCarryChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500"
        />
        <span>Randomise carry haircut</span>
      </label>

      <button
        onClick={onRun}
        disabled={isLoading}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
      >
        {isLoading ? "Running…" : "Run Forecast"}
      </button>

      <span className="text-xs text-slate-600">500 simulated paths · log-normal returns</span>
    </div>
  );
}
