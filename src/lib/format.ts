// Helpers de formatage partagés

export function fmtEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style:                'currency',
    currency:             'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR');
}

/** Formate un timestamp ISO en "16 avr. 2026 à 10h30" */
export function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', {
    day:    'numeric',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  }).replace(',', ' à').replace(':', 'h');
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
