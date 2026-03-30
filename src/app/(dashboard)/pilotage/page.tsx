import { redirect }                       from 'next/navigation';
import { Suspense }                        from 'react';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { fetchKPIs, fetchActivity, fetchAlerts, type Period } from '@/lib/dashboard-data';
import { KPICard }          from '@/components/dashboard/KPICard';
import { ActivityFeed }     from '@/components/dashboard/ActivityFeed';
import { AlertPanel }       from '@/components/dashboard/AlertPanel';
import { PeriodSelector }   from '@/components/dashboard/PeriodSelector';

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style:                'currency',
    currency:             'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day:     'numeric',
    month:   'long',
    year:    'numeric',
  }).format(new Date());
}

// ─── Icônes KPI inline ────────────────────────────────────────────────────────

const IcoCA = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
  </svg>
);
const IcoDevis = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
  </svg>
);
const IcoInvoice = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);
const IcoWrench = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.896-2.472c.17-.31.43-.547.737-.68a5 5 0 0 0-1.94-9.388c-.22-.019-.44.007-.644.073L9.09 6.35a.83.83 0 0 0-.53.812l.01.364a.834.834 0 0 1-.524.794l-.864.32a.83.83 0 0 0-.516.884l.138.816a.83.83 0 0 1-.32.848l-.641.465a.832.832 0 0 0-.146 1.195l.497.612a.834.834 0 0 1 .163.882l-.17.435" />
  </svg>
);
const IcoTicket = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 0 1 0 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 0 1 0-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375Z" />
  </svg>
);
const IcoConversion = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-5 w-5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
  </svg>
);

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-base font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function PilotagePage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Nom : client régulier d'abord, admin en fallback si RLS bloque
  let profileName: string | null = null;

  const { data: regularProfile } = await supabase
    .from('users')
    .select('name')
    .eq('id', user.id)
    .single();

  if (regularProfile?.name) {
    profileName = regularProfile.name;
  } else {
    try {
      const admin = await createAdminClient();
      const { data: adminProfile } = await admin
        .from('users')
        .select('name')
        .eq('id', user.id)
        .single();
      if (adminProfile?.name) profileName = adminProfile.name;
    } catch { /* service role key absent en dev */ }
  }

  // Fallbacks : users.name → user_metadata.name → préfixe email → vide
  const rawName = profileName
    ?? (user.user_metadata?.name as string | undefined)
    ?? user.email?.split('@')[0]
    ?? '';

  const params    = await searchParams;
  const rawPeriod = params?.period ?? '30j';
  const period: Period = (['7j', '30j', '90j', '12m'] as Period[]).includes(rawPeriod as Period)
    ? (rawPeriod as Period)
    : '30j';

  const [kpis, activity, alerts] = await Promise.all([
    fetchKPIs(period),
    fetchActivity(),
    fetchAlerts(),
  ]);

  const prenom   = rawName.split(' ')[0] || null;
  const isDashboardEmpty = kpis.ca.value === 0 && kpis.devis.count === 0;

  return (
    <div className="space-y-8">

      {/* ── En-tête ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">
            {prenom ? <>Bonjour {prenom}&nbsp;👋</> : <>Bonjour&nbsp;👋</>}
          </h1>
          <p className="mt-0.5 text-sm capitalize text-slate-500">
            {fmtDate()}
          </p>
        </div>
        <Suspense>
          <PeriodSelector current={period} />
        </Suspense>
      </div>

      {/* ── Alertes (si présentes) ────────────────────────────────────── */}
      {alerts.length > 0 && (
        <Section title="Alertes">
          <AlertPanel alerts={alerts} />
        </Section>
      )}

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <Section title="Indicateurs clés">
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <KPICard
            label="Chiffre d'affaires"
            value={kpis.ca.value > 0 ? fmtEur(kpis.ca.value) : '—'}
            subLabel={`Factures payées — ${period}`}
            variation={kpis.ca.variation}
            icon={<IcoCA />}
            empty={kpis.ca.value === 0}
          />
          <KPICard
            label="Devis en attente"
            value={kpis.devis.count > 0 ? String(kpis.devis.count) : '—'}
            subLabel={kpis.devis.count > 0 ? `${fmtEur(kpis.devis.total)} en jeu` : 'Aucun devis envoyé'}
            icon={<IcoDevis />}
            empty={kpis.devis.count === 0}
          />
          <KPICard
            label="Factures impayées"
            value={kpis.impayees.count > 0 ? String(kpis.impayees.count) : '—'}
            subLabel={kpis.impayees.count > 0 ? `${fmtEur(kpis.impayees.total)} à encaisser` : 'Aucune impayée'}
            icon={<IcoInvoice />}
            alert={kpis.impayees.count > 0}
            empty={kpis.impayees.count === 0}
          />
          <KPICard
            label="Interventions en cours"
            value={kpis.interventions.count > 0 ? String(kpis.interventions.count) : '—'}
            subLabel={kpis.interventions.count === 0 ? 'Aucune en cours' : undefined}
            icon={<IcoWrench />}
            empty={kpis.interventions.count === 0}
          />
          <KPICard
            label="Tickets SAV ouverts"
            value={kpis.sav.count > 0 ? String(kpis.sav.count) : '—'}
            subLabel={kpis.sav.count > 0 ? `Délai moyen : ${kpis.sav.avgHours}h` : 'Aucun ticket ouvert'}
            icon={<IcoTicket />}
            alert={kpis.sav.count > 0 && kpis.sav.avgHours > 48}
            empty={kpis.sav.count === 0}
          />
          <KPICard
            label="Taux de conversion"
            value={kpis.conversion.pct != null ? `${kpis.conversion.pct} %` : '—'}
            subLabel="Devis acceptés / envoyés"
            icon={<IcoConversion />}
            empty={kpis.conversion.pct == null}
          />
        </div>
      </Section>

      {/* ── Bas de page ──────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Activité récente — 2/3 */}
        <div className="lg:col-span-2">
          <Section title="Activité récente">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5">
              <ActivityFeed items={activity} />
            </div>
          </Section>
        </div>

        {/* Colonne droite — 1/3 */}
        <div className="space-y-6">
          {/* Alertes OK (aucune) */}
          {alerts.length === 0 && (
            <Section title="Alertes">
              <AlertPanel alerts={[]} />
            </Section>
          )}

          {/* CTA démarrage si dashboard vide */}
          {isDashboardEmpty && (
            <Section title="Premiers pas">
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-5 space-y-3">
                <p className="text-sm text-slate-500">
                  Votre tableau de bord se remplira automatiquement avec votre activité.
                </p>
                <a
                  href="/commerce?tab=devis"
                  className="block w-full rounded-lg bg-blue-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                >
                  Créer votre premier devis
                </a>
                <a
                  href="/commerce?tab=clients"
                  className="block w-full rounded-lg border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-500 hover:bg-white transition-colors"
                >
                  Ajouter un client
                </a>
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
