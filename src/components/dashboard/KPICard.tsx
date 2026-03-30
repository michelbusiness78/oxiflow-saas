interface KPICardProps {
  label:      string;
  value:      string;
  subLabel?:  string;
  variation?: number | null;  // % vs période précédente, null = pas de données
  icon:       React.ReactNode;
  alert?:     boolean;         // true = bordure rouge
  empty?:     boolean;
}

function VariationBadge({ variation }: { variation: number }) {
  const isPositive = variation >= 0;
  return (
    <span
      className={[
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
        isPositive
          ? 'bg-green-50 text-oxi-success'
          : 'bg-oxi-danger-light text-oxi-danger',
      ].join(' ')}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`h-3 w-3 ${isPositive ? '' : 'rotate-180'}`}
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M10 17a.75.75 0 0 1-.75-.75V5.612L5.29 9.77a.75.75 0 0 1-1.08-1.04l5.25-5.5a.75.75 0 0 1 1.08 0l5.25 5.5a.75.75 0 1 1-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0 1 10 17Z"
          clipRule="evenodd"
        />
      </svg>
      {Math.abs(variation)}%
    </span>
  );
}

export function KPICard({
  label,
  value,
  subLabel,
  variation,
  icon,
  alert = false,
  empty = false,
}: KPICardProps) {
  return (
    <div
      className={[
        'rounded-xl border bg-white p-5 transition-shadow hover:shadow-md',
        alert ? 'border-oxi-danger/40 bg-oxi-danger-light/30' : 'border-slate-200',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p
            className={[
              'mt-1.5 text-2xl font-bold tracking-tight',
              empty ? 'text-slate-400' : alert ? 'text-oxi-danger' : 'text-slate-800',
            ].join(' ')}
          >
            {value}
          </p>
          {subLabel && (
            <p className="mt-1 text-xs text-slate-400">{subLabel}</p>
          )}
        </div>

        <div
          className={[
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
            alert ? 'bg-oxi-danger/10 text-oxi-danger' : 'bg-white text-slate-500',
          ].join(' ')}
        >
          {icon}
        </div>
      </div>

      {variation != null && !empty && (
        <div className="mt-3 flex items-center gap-2">
          <VariationBadge variation={variation} />
          <span className="text-xs text-slate-400">vs période précédente</span>
        </div>
      )}
    </div>
  );
}
