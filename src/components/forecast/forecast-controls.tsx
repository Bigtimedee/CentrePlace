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
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <span>Return Volatility</span>
        <input
          type="number"
          min={5}
          max={40}
          step={1}
          value={volatility}
          onChange={e => onVolatilityChange(Number(e.target.value))}
          className="w-16 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-center text-sm text-white focus:border-indigo-500 focus:outline-none"
        />
        <span className="text-slate-400">%</span>
      </label>

      <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          checked={varyCarry}
          onChange={e => onVaryCarryChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
        />
        <span>Randomise carry haircut</span>
      </label>

      <button
        onClick={onRun}
        disabled={isLoading}
        className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? "Running…" : "Run Forecast"}
      </button>

      <span className="text-xs text-slate-500">500 simulated paths · log-normal returns</span>
    </div>
  );
}
