import { fmtEur, fmtDate } from '@/lib/format';
import type { CommerceDashboardData, QuoteStatutDash } from '@/app/actions/commerce';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUT_META: Record<QuoteStatutDash, { label: string; cls: string }> = {
  brouillon: { label: 'Brouillon', cls: 'bg-[#f1f5f9] text-[#5a6382]'       },
  envoye:    { label: 'Envoyé',    cls: 'bg-blue-100 text-blue-700'           },
  accepte:   { label: 'Accepté',  cls: 'bg-green-100 text-green-700'         },
  refuse:    { label: 'Refusé',   cls: 'bg-red-100 text-[#dc2626]'           },
};

function plural(n: number, word: string, wordP?: string) {
  return n !== 1 ? (wordP ?? word + 's') : word;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, color, sub, href,
}: {
  label: string;
  value: string;
  color: string;
  sub:   string;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text2)]">
        {label}
      </p>
      <p
        className="mt-2 text-[24px] font-extrabold tabular-nums"
        style={{ color, letterSpacing: '-0.04em' }}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[var(--text3)]">{sub}</p>
    </>
  );

  const cls = 'rounded-[14px] border border-[var(--border)] bg-white p-4 transition-all hover:shadow-md hover:-translate-y-0.5';
  if (href) {
    return (
      <a href={href} className={`block ${cls} cursor-pointer`} style={{ boxShadow: 'var(--shadow)' }}>
        {inner}
      </a>
    );
  }
  return (
    <div className={cls} style={{ boxShadow: 'var(--shadow)' }}>
      {inner}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  data:     CommerceDashboardData;
  userName: string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function CommerceDashboard({ data, userName }: Props) {
  const { kpis, quotesRecentes, alertesRelance, users } = data;

  const prenom = userName.split(' ')[0] || userName;
  const today  = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  function getName(id: string | null) {
    if (!id) return null;
    return users.find((u) => u.id === id)?.name ?? null;
  }

  return (
    <div className="space-y-6">

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-[20px] font-bold text-[var(--text)]">
          Bonjour {prenom}&nbsp;!
        </h1>
        <p className="mt-0.5 text-sm capitalize text-[var(--text2)]">{today}</p>
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="CA Devis total"
          value={fmtEur(kpis.caDevisTotal)}
          color="var(--green)"
          sub={`${kpis.totalDevis} ${plural(kpis.totalDevis, 'devis')} dont ${kpis.devisAcceptes} accepté${kpis.devisAcceptes !== 1 ? 's' : ''}`}
          href="/commerce?tab=devis"
        />
        <KpiCard
          label="CA Encaissé"
          value={fmtEur(kpis.caEncaisse)}
          color="var(--blue)"
          sub={`${kpis.facturesSoldees} ${plural(kpis.facturesSoldees, 'facture')} soldée${kpis.facturesSoldees !== 1 ? 's' : ''}`}
          href="/commerce?tab=factures&filter=soldees"
        />
        <KpiCard
          label="À Encaisser"
          value={fmtEur(kpis.aEncaisser)}
          color="var(--amber)"
          sub={`${kpis.facturesOuvertes} ${plural(kpis.facturesOuvertes, 'facture')} ouverte${kpis.facturesOuvertes !== 1 ? 's' : ''}`}
          href="/commerce?tab=factures&filter=ouvertes"
        />
        <KpiCard
          label="Factures en retard"
          value={String(kpis.facturesEnRetard)}
          color="var(--red)"
          sub={`${kpis.devisEnAttente} ${plural(kpis.devisEnAttente, 'devis')} en attente réponse`}
          href="/commerce?tab=factures&filter=retard"
        />
      </div>

      {/* ── CA par société (table companies absente → total unique) ── */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[var(--text2)]">
          CA par société (devis acceptés)
        </p>
        <div
          className="flex items-center gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-3"
          style={{ boxShadow: 'var(--shadow)' }}
        >
          <span className="w-36 shrink-0 text-sm font-semibold text-[var(--text)]">
            Société par défaut
          </span>
          <div className="flex-1 h-2 rounded-full bg-[var(--bg4)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--blue)]" style={{ width: '100%' }} />
          </div>
          <span className="shrink-0 font-mono text-sm font-bold text-[var(--text)]">
            {fmtEur(kpis.caDevisTotal)}
          </span>
        </div>
      </div>

      {/* ── Alertes relance ── */}
      {alertesRelance.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-800">
            ⏰ Relances à effectuer ({alertesRelance.length})
          </p>
          <div className="space-y-1.5">
            {alertesRelance.map((q) => {
              const days = Math.floor(
                (Date.now() - new Date(q.created_at).getTime()) / 86400_000,
              );
              return (
                <div
                  key={q.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-white px-3 py-2 text-xs"
                >
                  <span className="font-mono text-[var(--text3)]">{q.number}</span>
                  <span className="font-semibold text-[var(--text)]">{q.client_nom}</span>
                  <span className="flex-1 truncate text-[var(--text2)]">{q.objet ?? '—'}</span>
                  <span className="font-mono font-bold text-[var(--text)]">
                    {fmtEur(q.montant_ttc)}
                  </span>
                  <span className="rounded bg-red-100 px-1.5 py-0.5 font-bold text-[var(--red)]">
                    J+{days}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Devis récents ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text2)]">
            Devis récents
          </p>
          <a
            href="/commerce?tab=devis"
            className="text-xs font-semibold text-[var(--blue)] hover:underline"
          >
            Tout voir →
          </a>
        </div>

        <div
          className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white"
          style={{ boxShadow: 'var(--shadow)' }}
        >
          {quotesRecentes.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--text3)]">
              Aucun devis pour l'instant.
            </p>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {quotesRecentes.map((q) => {
                const meta    = STATUT_META[q.statut];
                const commNom = getName(q.commercial_user_id);
                const chefNom = getName(q.chef_projet_user_id);
                return (
                  <div
                    key={q.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:bg-[var(--bg)]"
                  >
                    {/* N° */}
                    <span className="w-28 shrink-0 font-mono text-xs text-[var(--text3)]">
                      {q.number}
                    </span>

                    {/* Statut */}
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.cls}`}>
                      {meta.label}
                    </span>

                    {/* Projet créé */}
                    {q.project_created && (
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                        Projet ✓
                      </span>
                    )}

                    {/* Client + objet */}
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-bold text-[var(--text)]">{q.client_nom}</span>
                      {q.objet && (
                        <span className="ml-2 text-xs text-[var(--text2)]">{q.objet}</span>
                      )}
                    </div>

                    {/* Meta droite */}
                    <div className="flex shrink-0 items-center gap-3 text-xs text-[var(--text3)]">
                      {q.affair_number && (
                        <span className="font-mono">{q.affair_number}</span>
                      )}
                      {commNom && <span>{commNom}</span>}
                      {chefNom && <span>→ {chefNom}</span>}
                      <span>{fmtDate(q.date)}</span>
                    </div>

                    {/* Montant */}
                    <span className="shrink-0 font-mono text-sm font-bold text-[var(--text)]">
                      {fmtEur(q.montant_ttc)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
