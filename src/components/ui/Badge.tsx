type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-[#F1F5F9] text-[#64748B]  border border-[#CBD5E1]',
  primary: 'bg-[#DBEAFE] text-[#1D4ED8]  border border-[#93C5FD]',
  success: 'bg-[#DCFCE7] text-[#16A34A]  border border-[#86EFAC]',
  warning: 'bg-[#FEF3C7] text-[#D97706]  border border-[#FCD34D]',
  danger:  'bg-[#FEE2E2] text-[#DC2626]  border border-[#FCA5A5]',
  info:    'bg-[#E0F2FE] text-[#0369A1]  border border-[#7DD3FC]',
  muted:   'bg-[#F1F5F9] text-[#94A3B8]  border border-[#CBD5E1]',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      ].join(' ')}
    >
      {children}
    </span>
  );
}

// Mapping statuts devis → variant
export function devisVariant(statut: string): BadgeVariant {
  return (
    { brouillon: 'muted', envoye: 'info', accepte: 'success', refuse: 'danger' } as Record<string, BadgeVariant>
  )[statut] ?? 'default';
}

export function devisLabel(statut: string): string {
  return (
    { brouillon: 'Brouillon', envoye: 'Envoyé', accepte: 'Accepté', refuse: 'Refusé' }
  )[statut] ?? statut;
}

// Mapping statuts factures → variant
export function factureVariant(statut: string): BadgeVariant {
  return (
    {
      brouillon: 'muted',
      envoyee:   'info',
      payee:     'success',
      partielle: 'warning',
      impayee:   'danger',
    } as Record<string, BadgeVariant>
  )[statut] ?? 'default';
}

export function factureLabel(statut: string): string {
  return (
    {
      brouillon: 'Brouillon',
      envoyee:   'Envoyée',
      payee:     'Payée',
      partielle: 'Partielle',
      impayee:   'Impayée',
    }
  )[statut] ?? statut;
}
