interface LegislationAlertBadgeProps {
  count?: number;
}

export function LegislationAlertBadge({ count }: LegislationAlertBadgeProps) {
  return (
    <a
      href="#legislation-panel"
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors cursor-pointer"
    >
      <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
      {count != null ? `${count} pending bill${count === 1 ? "" : "s"}` : "Pending legislation"}
    </a>
  );
}
