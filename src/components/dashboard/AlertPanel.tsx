import Link from 'next/link';
import type { Alert } from '@/lib/dashboard-data';

const severityConfig = {
  warning: {
    container: 'border-oxi-warning/30 bg-oxi-warning-light',
    icon:      'text-oxi-warning',
    text:      'text-oxi-text',
  },
  danger: {
    container: 'border-oxi-danger/30 bg-oxi-danger-light',
    icon:      'text-oxi-danger',
    text:      'text-oxi-text',
  },
};

function AlertIcon({ severity }: { severity: Alert['severity'] }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`h-5 w-5 shrink-0 ${severityConfig[severity].icon}`}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

interface AlertPanelProps {
  alerts: Alert[];
}

export function AlertPanel({ alerts }: AlertPanelProps) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-oxi-success/30 bg-oxi-success-light px-4 py-3.5">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 shrink-0 text-oxi-success" aria-hidden>
          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
        </svg>
        <p className="text-sm font-medium text-oxi-success">
          Tout est en ordre — aucune alerte en cours.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {alerts.map((alert) => {
        const cfg = severityConfig[alert.severity];
        return (
          <li key={alert.id}>
            <Link
              href={alert.href}
              className={[
                'flex items-center gap-3 rounded-xl border px-4 py-3.5 transition-opacity hover:opacity-80',
                cfg.container,
              ].join(' ')}
            >
              <AlertIcon severity={alert.severity} />
              <p className={`flex-1 text-sm font-medium ${cfg.text}`}>{alert.message}</p>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4 shrink-0 text-oxi-text-muted" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
