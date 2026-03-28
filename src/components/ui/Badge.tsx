type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted';

const variants: Record<BadgeVariant, string> = {
  default: 'bg-oxi-bg text-oxi-text border border-oxi-border',
  primary: 'bg-oxi-primary-light text-oxi-primary',
  success: 'bg-oxi-success-light text-oxi-success',
  warning: 'bg-oxi-warning-light text-oxi-warning',
  danger:  'bg-oxi-danger-light text-oxi-danger',
  info:    'bg-oxi-info-light text-oxi-info',
  muted:   'bg-oxi-bg text-oxi-text-muted',
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
