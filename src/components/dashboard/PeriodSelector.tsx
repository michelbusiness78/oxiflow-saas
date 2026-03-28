'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { Period } from '@/lib/dashboard-data';

const PERIODS: { value: Period; label: string }[] = [
  { value: '7j',  label: '7 j' },
  { value: '30j', label: '30 j' },
  { value: '90j', label: '90 j' },
  { value: '12m', label: '12 m' },
];

interface PeriodSelectorProps {
  current: Period;
}

export function PeriodSelector({ current }: PeriodSelectorProps) {
  const router     = useRouter();
  const pathname   = usePathname();
  const searchParams = useSearchParams();

  function select(period: Period) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', period);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="inline-flex items-center rounded-lg border border-oxi-border bg-oxi-bg p-0.5">
      {PERIODS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => select(value)}
          className={[
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            current === value
              ? 'bg-oxi-surface text-oxi-primary shadow-sm'
              : 'text-oxi-text-secondary hover:text-oxi-text',
          ].join(' ')}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
