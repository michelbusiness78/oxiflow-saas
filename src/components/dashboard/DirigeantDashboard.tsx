import { fmtEur } from '@/lib/format';
import type { DirigeantDashboardData, PrioriteItem } from '@/app/actions/dirigeant';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METEO_META = {
  green:   { label: 'En forme',    dot: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50 border-green-200'  },
  orange:  { label: 'Attention',   dot: 'bg-amber-500',  text: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200'  },
  red:     { label: 'En difficulté', dot: 'bg-red-500',  text: 'text-red-700',    bg: 'bg-red-50 border-red-200'      },
  unknown: { label: 'Inconnu',     dot: 'bg-slate-400',  text: 'text-slate-600',  bg: 'bg-slate-50 border-slate-200'  },
};

const PRIORITE_ICON: Record<PrioriteItem['type'], string> = {
  facture: '€',
  devis:   '📋',
};

function fmtVariation(pct: number | null): string {
  if (pct === null) return '—';
  return (pct >= 0 ? '+' : '') + pct + ' %';
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, badge, badgeColor, href,
}: {
  label:        string;
  value:        string;
  sub:          string;
  color:        string;
  badge?:       string;
  badgeColor?:  string;
  href?:        string;
}) {
  const inner = (
    <>
      {badge && (
        <span
          className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor ?? 'bg-slate-100 text-slate-600'}`}
        >
          {badge}
        </span>
      )}
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text2)] pr-16">
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

  const cls = 'rounded-[14px] border border-[var(--border)] bg-white p-4 relative transition-all hover:shadow-md hover:-translate-y-0.5';
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
  data: DirigeantDashboardData;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export function DirigeantDashboard({ data }: Props) {
  const { userName, kpis, meteoSocietes, meteoGlobal, caGlobalMois, sav, apiUsage, priorites, contratsARenouveler } = data;

  const prenom = userName.split(' ')[0] || userName;
  const today  = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());

  const meteoMeta = METEO_META[meteoGlobal];
  const apiPct    = apiUsage.tokenMax > 0
    ? Math.min(100, Math.round((apiUsage.tokensUsed / apiUsage.tokenMax) * 100))
    : 0;

  return (
    <div className="space-y-6">

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-[20px] font-bold text-[var(--text)]">
          Bonjour {prenom}&nbsp;!
        </h1>
        <p className="mt-0.5 text-sm capitalize text-[var(--text2)]">{today}</p>
      </div>

      {/* ── Météo sociétés ── */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[var(--text2)]">
          Météo sociétés — {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date())}
        </p>
        {meteoSocietes.length === 0 ? (
          /* Fallback : pas de table companies → carte unique globale */
          <div
            className={`flex items-center gap-4 rounded-[var(--radius)] border px-4 py-3 ${meteoMeta.bg}`}
            style={{ boxShadow: 'var(--shadow)' }}
          >
            <span className={`h-3 w-3 shrink-0 rounded-full ${meteoMeta.dot}`} />
            <span className="flex-1 text-sm font-semibold text-[var(--text)]">Entreprise</span>
            <span className="font-mono text-sm font-bold text-[var(--text)]">{fmtEur(caGlobalMois)}</span>
            <span className={`text-xs font-bold ${meteoMeta.text}`}>{meteoMeta.label}</span>
          </div>
        ) : (
          <div className="space-y-2">
            {meteoSocietes.map((s) => {
              const meta = METEO_META[s.meteo];
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-3"
                  style={{ boxShadow: 'var(--shadow)' }}
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="w-36 shrink-0 text-sm font-semibold text-[var(--text)]">
                    {s.nom}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--bg4)] overflow-hidden">
                    {s.objectif != null && s.objectif > 0 && (
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, Math.round((s.caMois / s.objectif) * 100))}%`,
                          backgroundColor: s.color,
                        }}
                      />
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-sm font-bold text-[var(--text)]">
                    {fmtEur(s.caMois)}
                  </span>
                  <span className={`shrink-0 text-xs font-bold ${meta.text}`}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4 KPI Cards ── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="CA Net mois"
          value={fmtEur(kpis.caMoisNet)}
          color="var(--green)"
          sub={`M-1 : ${fmtEur(kpis.caMoisPrecedent)}`}
          badge={fmtVariation(kpis.variationMois)}
          badgeColor={
            kpis.variationMois === null ? 'bg-slate-100 text-slate-500'
            : kpis.variationMois >= 0   ? 'bg-green-100 text-green-700'
            : 'bg-red-100 text-red-700'
          }
          href="/commerce?tab=factures"
        />
        <KpiCard
          label="CA Net annuel"
          value={fmtEur(kpis.caAnnuel)}
          color="var(--blue)"
          sub={`Depuis le 1er janvier`}
          href="/commerce?tab=factures"
        />
        <KpiCard
          label="Marge devis"
          value={kpis.margeDevisPct !== null ? `${kpis.margeDevisPct} %` : '—'}
          color="var(--purple)"
          sub={kpis.margeDevisPct !== null ? 'Sur devis acceptés' : 'Données insuffisantes'}
          href="/commerce?tab=devis&filter=acceptes"
        />
        <KpiCard
          label="En retard"
          value={String(kpis.enRetardFactures + kpis.enRetardTaches)}
          color="var(--red)"
          sub={`${kpis.enRetardFactures} facture${kpis.enRetardFactures !== 1 ? 's' : ''} · ${kpis.enRetardTaches} tâche${kpis.enRetardTaches !== 1 ? 's' : ''}`}
          badge={kpis.enRetardFactures + kpis.enRetardTaches > 0 ? '⚠' : undefined}
          badgeColor="bg-red-100 text-red-600"
          href="/commerce?tab=factures&filter=retard"
        />
      </div>

      {/* ── SAV + API Usage ── */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">

        {/* SAV */}
        <div
          className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-4"
          style={{ boxShadow: 'var(--shadow)' }}
        >
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text2)]">
            SAV — Tickets
          </p>
          {!sav.hasTable ? (
            <p className="text-sm text-[var(--text3)]">Module SAV non activé.</p>
          ) : (
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-[22px] font-extrabold text-[var(--red)]" style={{ letterSpacing: '-0.04em' }}>
                  {sav.ouverts}
                </p>
                <p className="text-[10px] text-[var(--text3)]">Ouverts</p>
              </div>
              <div className="text-center">
                <p className="text-[22px] font-extrabold text-[var(--amber)]" style={{ letterSpacing: '-0.04em' }}>
                  {sav.enCours}
                </p>
                <p className="text-[10px] text-[var(--text3)]">En cours</p>
              </div>
              <div className="text-center">
                <p className="text-[22px] font-extrabold text-[var(--green)]" style={{ letterSpacing: '-0.04em' }}>
                  {sav.clotures}
                </p>
                <p className="text-[10px] text-[var(--text3)]">Clôturés</p>
              </div>
            </div>
          )}
        </div>

        {/* API Usage */}
        <div
          className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-4"
          style={{ boxShadow: 'var(--shadow)' }}
        >
          <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text2)]">
            🔑 Usage API Claude
          </p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-[var(--text2)]">{apiPct} %</span>
            <span className="text-xs text-[var(--text3)]">
              {apiUsage.tokensUsed.toLocaleString('fr-FR')} / {(apiUsage.tokenMax / 1000).toFixed(1)}k tokens
              {' · '}
              {new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date())}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${apiPct}%`, backgroundColor: '#2563eb' }}
            />
          </div>
        </div>
      </div>

      {/* ── Alerte contrats à renouveler ── */}
      {contratsARenouveler > 0 && (
        <a
          href="/commerce?tab=contrats"
          className="flex items-center gap-3 rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100"
          style={{ boxShadow: 'var(--shadow)' }}
        >
          <span className="text-lg">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {contratsARenouveler} contrat{contratsARenouveler > 1 ? 's' : ''} à renouveler
            </p>
            <p className="text-xs text-amber-700">
              Contrat{contratsARenouveler > 1 ? 's' : ''} actif{contratsARenouveler > 1 ? 's' : ''} arrivant à échéance dans 30 jours ou déjà expirés
            </p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-amber-700">Voir →</span>
        </a>
      )}

      {/* ── Priorités du jour ── */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[var(--text2)]">
          Priorités du jour
        </p>
        {priorites.length === 0 ? (
          <div
            className="rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-8 text-center"
            style={{ boxShadow: 'var(--shadow)' }}
          >
            <p className="text-sm text-[var(--text3)]">Aucune priorité en retard. Bien joué !</p>
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white divide-y divide-[var(--border)]"
            style={{ boxShadow: 'var(--shadow)' }}
          >
            {priorites.map((p) => (
              <a
                key={`${p.type}-${p.id}`}
                href={p.lien}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-[var(--bg)] group"
              >
                {/* Type icon */}
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg4)] text-xs font-bold text-[var(--text2)]">
                  {PRIORITE_ICON[p.type]}
                </span>

                {/* Titre + projet */}
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--blue)]">
                    {p.titre}
                  </span>
                  {p.projetNom && (
                    <span className="ml-2 text-xs text-[var(--text3)]">{p.projetNom}</span>
                  )}
                </div>

                {/* Montant */}
                {p.montant !== null && (
                  <span className="shrink-0 font-mono text-xs font-bold text-[var(--text)]">
                    {fmtEur(p.montant)}
                  </span>
                )}

                {/* Échéance */}
                {p.echeance && (
                  <span className="shrink-0 text-xs text-[var(--text3)]">
                    {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(p.echeance))}
                  </span>
                )}

                {/* J+ badge */}
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-[var(--red)]">
                  J+{p.joursRetard}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
