// ============================================================
// components/ResultCard.tsx
// Displays a single metric (e.g. "Position Size → 42 shares").
//
// This is a "dumb" component — it receives data via props
// and only knows how to display it. No logic, no state.
// ============================================================

interface ResultCardProps {
  label: string;       // e.g. "Position Size"
  value: string;       // e.g. "42 shares" (pre-formatted by parent)
  highlight?: boolean; // optional: makes the card stand out visually
  tooltip?: string;    // optional: explains what this metric means
}

export default function ResultCard({
  label,
  value,
  highlight = false,
  tooltip,
}: ResultCardProps) {
  return (
    <div
      title={tooltip} // native browser tooltip on hover
      className={`
        rounded-xl border p-4 flex flex-col gap-1 transition-all
        ${highlight
          ? "border-blue-500 bg-blue-950/40 shadow-md shadow-blue-900/30"
          : "border-slate-700 bg-slate-800/60"
        }
      `}
    >
      {/* Label row */}
      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
        {label}
      </span>

      {/* Value — large and prominent */}
      <span
        className={`text-2xl font-bold ${
          highlight ? "text-blue-300" : "text-slate-100"
        }`}
      >
        {value}
      </span>

      {/* Tooltip hint icon — only if tooltip text is provided */}
      {tooltip && (
        <span className="text-xs text-slate-500 mt-1 italic">{tooltip}</span>
      )}
    </div>
  );
}