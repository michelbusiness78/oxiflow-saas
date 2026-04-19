import { fmtEur } from '@/lib/format';
import type { DirigeantDashboardData, PrioriteItem, AlerteItem } from '@/app/actions/dirigeant';
import type { PersonalTask } from '@/app/actions/tasks';
import { MesTaches }         from '@/components/shared/MesTaches';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METEO_ICON: Record<string, string> = {
  green:   '🟢',
  orange:  '🟡',
  red:     '🔴',
  unknown: '⚪',
};

const METEO_LABEL: Record<string, string> = {
  green:   'OK',
  orange:  'Attention',
  red:     'Critique',
  unknown: 'Inconnu',
};

const ALERTE_ICON: Record<AlerteItem['type'], string> = {
  facture: '💸',
  contrat: '📄',
  projet:  '📌',
  sav:     '🔧',
};

const PRIORITE_ICON: Record<PrioriteItem['type'], string> = {
  facture: '€',
  devis:   '📋',
};

function fmtVariation(pct: number | null): string {
  if (pct === null) return '—';
  return (pct >= 0 ? '+' : '') + pct + ' %';
}

function fmtDelai(h: number | null): string {
  if (h === null) return '—';
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} j`;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, color, badge, badgeColor, href,
}: {
  label:       string;
  value:       string;
  sub:         string;
  color:       string;
  badge?:      string;
  badgeColor?: string;
  href?:       string;
}) {
  const inner = (
    <>
      {badge && (
        <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeColor ?? 'bg-slate-100 text-slate-600'}`}>
          {badge}
        </span>
      )}
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text2)] pr-16">{label}</p>
      <p className="mt-2 text-[24px] font-extrabold tabular-nums" style={{ color, letterSpacing: '-0.04em' }}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-[var(--text3)]">{sub}</p>
    </>
  );
  const cls = 'rounded-[14px] border border-[var(--border)] bg-white p-4 relative transition-all hover:shadow-md hover:-translate-y-0.5';
  if (href) return <a href={href} className={`block ${cls} cursor-pointer`} style={{ boxShadow: 'var(--shadow)' }}>{inner}</a>;
  return <div className={cls} style={{ boxShadow: 'var(--shadow)' }}>{inner}</div>;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  data:          DirigeantDashboardData;
  personalTasks: PersonalTask[];
  userId:        string;
  tenantId:      string;
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function DirigeantDashboard({ data, personalTasks, userId, tenantId }: Props) {
  const { userName, kpis, meteoSocietes, caGlobalMois, meteoGlobal, sav, priorites, alertes } = data;

  const prenom = userName.split(' ')[0] || userName;
  const today  = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date());
  const moisLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());

  const redAlertes    = alertes.filter((a) => a.severity === 'red');
  const orangeAlertes = alertes.filter((a) => a.severity === 'orange');

  return (
    <div className="space-y-6">

      {/* ── 1. En-tête ─────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[20px] font-bold text-[var(--text)]">Bonjour {prenom}&nbsp;!</h1>
        <p className="mt-0.5 text-sm capitalize text-[var(--text2)]">{today}</p>
      </div>

      {/* ── 2. Alertes critiques ────────────────────────────────────────────── */}
      {alertes.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[var(--text2)]">
            🚨 Alertes critiques
          </p>
          {redAlertes.map((a) => (
            <a key={`${a.type}-${a.id}`} href={a.href}
              className="flex items-center gap-3 rounded-[var(--radius)] border border-red-200 bg-red-50 px-4 py-3 transition-colors hover:bg-red-100"
              style={{ boxShadow: 'var(--shadow)' }}>
              <span className="text-base">{ALERTE_ICON[a.type]}</span>
              <span className="flex-1 min-w-0 text-sm font-semibold text-red-800 truncate">{a.label}</span>
              <span className="shrink-0 text-xs font-semibold text-red-700">Voir →</span>
            </a>
          ))}
          {orangeAlertes.map((a) => (
            <a key={`${a.type}-${a.id}`} href={a.href}
              className="flex items-center gap-3 rounded-[var(--radius)] border border-amber-200 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100"
              style={{ boxShadow: 'var(--shadow)' }}>
              <span className="text-base">{ALERTE_ICON[a.type]}</span>
              <span className="flex-1 min-w-0 text-sm font-semibold text-amber-800 truncate">{a.label}</span>
              <span className="shrink-0 text-xs font-semibold text-amber-700">Voir →</span>
            </a>
          ))}
        </div>
      )}

      {/* ── 3. Priorités du jour ────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[var(--text2)]">
          ⚡ Priorités du jour
        </p>
        {priorites.length === 0 ? (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white px-4 py-6 text-center"
            style={{ boxShadow: 'var(--shadow)' }}>
            <p className="text-sm text-[var(--text3)]">Aucune priorité en retard. Bien joué !</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white divide-y divide-[var(--border)]"
            style={{ boxShadow: 'var(--shadow)' }}>
            {priorites.map((p) => (
              <a key={`${p.type}-${p.id}`} href={p.lien}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-[var(--bg)] group">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--bg4)] text-xs font-bold text-[var(--text2)]">
                  {PRIORITE_ICON[p.type]}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-semibold text-[var(--text)] group-hover:text-[var(--blue)]">{p.titre}</span>
                  {p.projetNom && <span className="ml-2 text-xs text-[var(--text3)]">{p.projetNom}</span>}
                </div>
                {p.montant !== null && (
                  <span className="shrink-0 font-mono text-xs font-bold text-[var(--text)]">{fmtEur(p.montant)}</span>
                )}
                {p.echeance && (
                  <span className="shrink-0 text-xs text-[var(--text3)]">
                    {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(p.echeance))}
                  </span>
                )}
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-[var(--red)]">
                  J+{p.joursRetard}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* ── 3b. Mes tâches (widget condensé) ───────────────────────────────── */}
      <MesTaches
        initialTasks={personalTasks}
        tenantId={tenantId}
        userId={userId}
        condensed
      />

      {/* ── 4. Météo sociétés ───────────────────────────────────────────────── */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-[var(--text2)]">
          Météo sociétés — {moisLabel}
        </p>
        {meteoSocietes.length === 0 ? (
          <div className={`flex items-center gap-4 rounded-[var(--radius)] border px-4 py-3 bg-slate-50 border-slate-200`}
            style={{ boxShadow: 'var(--shadow)' }}>
            <span className="text-xl">{METEO_ICON[meteoGlobal]}</span>
            <span className="flex-1 text-sm font-semibold text-[var(--text)]">Entreprise</span>
            <span className="font-mono text-sm font-bold text-[var(--text)]">{fmtEur(caGlobalMois)}</span>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {meteoSocietes.map((s) => {
              const barPct = s.objectif && s.objectif > 0
                ? Math.min(100, Math.round((s.caNet / s.objectif) * 100))
                : null;
              return (
                <a key={s.id} href={`/commerce?tab=factures&company=${s.id}`}
                  className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-white p-4 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                  style={{ boxShadow: 'var(--shadow)' }}>
                  {/* Icône météo */}
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{METEO_ICON[s.meteo]}</span>
                    {s.variation !== null && (
                      <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${s.variation >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {fmtVariation(s.variation)}
                      </span>
                    )}
                  </div>
                  {/* Nom société */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--text2)] truncate">{s.nom}</p>
                    <p className="text-[10px] text-[var(--text3)]">{METEO_LABEL[s.meteo]}</p>
                  </div>
                  {/* CA net */}
                  <p className="text-[18px] font-extrabold tabular-nums text-[var(--text)]" style={{ letterSpacing: '-0.03em' }}>
                    {fmtEur(s.caNet)}
                  </p>
                  {/* Barre objectif */}
                  <div>
                    <div className="h-1.5 w-full rounded-full bg-[var(--bg4)] overflow-hidden">
                      {barPct !== null ? (
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${barPct}%`, backgroundColor: s.color }} />
                      ) : (
                        <div className="h-full rounded-full bg-slate-200 w-full" />
                      )}
                    </div>
                    <p className="mt-1 text-[10px] text-[var(--text3)]">
                      {barPct !== null
                        ? `${barPct} % de l'objectif (${fmtEur(s.objectif!)})`
                        : 'Aucun objectif défini'}
                    </p>
                  </div>
                  {/* Factures en retard */}
                  {s.facsRetard > 0 && (
                    <p className="text-[10px] font-semibold text-red-600">
                      ⚠ {s.facsRetard} facture{s.facsRetard > 1 ? 's' : ''} en retard
                    </p>
                  )}
                </a>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 5. KPIs financiers ──────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="CA Facturé mois"
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
          label="CA Facturé annuel"
          value={fmtEur(kpis.caAnnuel)}
          color="var(--blue)"
          sub="Depuis le 1er janvier"
          href="/commerce?tab=factures"
        />
        <KpiCard
          label="Marge devis"
          value={kpis.margeDevisPct !== null ? `${kpis.margeDevisPct} %` : '—'}
          color="var(--purple)"
          sub={kpis.margeDevisPct !== null ? 'Sur devis acceptés' : 'Données insuffisantes'}
          href="/commerce?tab=devis"
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

      {/* ── 6. SAV ──────────────────────────────────────────────────────────── */}
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-white p-4"
        style={{ boxShadow: 'var(--shadow)' }}>
        <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[var(--text2)]">
          SAV — Tableau de bord
        </p>
        {!sav.hasTable ? (
          <p className="text-sm text-[var(--text3)]">Module SAV non activé.</p>
        ) : (
          <div className="space-y-3">
            {/* 3 compteurs */}
            <div className="flex gap-3">
              <a href="/chef-projet?tab=sav&filter=ouvert"
                className="flex-1 text-center rounded-lg bg-red-50 py-3 transition-colors hover:bg-red-100 cursor-pointer">
                <p className="text-[22px] font-extrabold text-red-600" style={{ letterSpacing: '-0.04em' }}>{sav.ouverts}</p>
                <p className="text-[10px] text-[var(--text3)]">Ouverts →</p>
              </a>
              <a href="/chef-projet?tab=sav&filter=en_cours"
                className="flex-1 text-center rounded-lg bg-amber-50 py-3 transition-colors hover:bg-amber-100 cursor-pointer">
                <p className="text-[22px] font-extrabold text-amber-600" style={{ letterSpacing: '-0.04em' }}>{sav.enCours}</p>
                <p className="text-[10px] text-[var(--text3)]">En cours →</p>
              </a>
              <a href="/chef-projet?tab=sav&filter=cloture"
                className="flex-1 text-center rounded-lg bg-green-50 py-3 transition-colors hover:bg-green-100 cursor-pointer">
                <p className="text-[22px] font-extrabold text-green-600" style={{ letterSpacing: '-0.04em' }}>{sav.cloturesCeMois}</p>
                <p className="text-[10px] text-[var(--text3)]">Clôturés / mois →</p>
              </a>
            </div>

            {/* Délai moyen + taux sous contrat */}
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-0.5">Délai moyen</p>
                <p className="text-lg font-extrabold text-[var(--text)]" style={{ letterSpacing: '-0.04em' }}>
                  {fmtDelai(sav.delaiMoyenHeures)}
                </p>
                <p className="text-[10px] text-[var(--text3)]">résolution</p>
              </div>
              <div className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text3)] mb-0.5">Sous contrat</p>
                <p className="text-lg font-extrabold text-[var(--blue)]" style={{ letterSpacing: '-0.04em' }}>
                  {sav.tauxSousContrat !== null ? `${sav.tauxSousContrat} %` : '—'}
                </p>
                <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  {sav.tauxSousContrat !== null && (
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${sav.tauxSousContrat}%` }} />
                  )}
                </div>
              </div>
            </div>

            {/* Urgents */}
            {sav.urgents > 0 && (
              <a href="/chef-projet?tab=sav&filter=urgent"
                className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 transition-colors hover:bg-red-100 cursor-pointer">
                <span className="text-red-600 font-bold">⚠</span>
                <span className="text-sm font-semibold text-red-700">
                  {sav.urgents} ticket{sav.urgents > 1 ? 's' : ''} urgent{sav.urgents > 1 ? 's' : ''} en attente →
                </span>
              </a>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
