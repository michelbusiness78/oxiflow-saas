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

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}
