import type { TechnicienKpiData } from '@/app/actions/technicien-notifications';

interface Props {
  kpis: TechnicienKpiData;
}

function fmtShort(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
}

interface KpiCardProps {
  value:     number;
  label:     string;
  sub:       string;
  color:     string;   // Tailwind text color class
  bgColor:   string;   // Tailwind bg color class
}

function KpiCard({ value, label, sub, color, bgColor }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-[#dde3f0] bg-white p-5 shadow-sm">
      <div className={`mb-1 inline-flex h-9 w-9 items-center justify-center rounded-lg ${bgColor}`}>
        <span className={`text-lg font-bold ${color}`}>{value}</span>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-[#5a6382]">
        {label}
      </p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}

export function TechnicienKpis({ kpis }: Props) {
  const {
    todayCount,
    todayDone,
    weekCount,
    weekRemaining,
    pendingCount,
    nextPendingDate,
    monthDone,
    monthTotal,
  } = kpis;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        value={todayCount}
        label="Aujourd'hui"
        sub={`${todayDone} terminée${todayDone !== 1 ? 's' : ''} · ${todayCount - todayDone} restante${(todayCount - todayDone) !== 1 ? 's' : ''}`}
        color="text-[#2563eb]"
        bgColor="bg-blue-50"
      />
      <KpiCard
        value={weekCount}
        label="Cette semaine"
        sub={`${weekRemaining} restante${weekRemaining !== 1 ? 's' : ''}`}
        color="text-[#16a34a]"
        bgColor="bg-green-50"
      />
      <KpiCard
        value={pendingCount}
        label="En attente"
        sub={nextPendingDate ? `prochaine : ${fmtShort(nextPendingDate)}` : 'aucune planifiée'}
        color="text-[#d97706]"
        bgColor="bg-orange-50"
      />
      <KpiCard
        value={monthDone}
        label="Terminées ce mois"
        sub={`sur ${monthTotal} total ce mois`}
        color="text-[#64748b]"
        bgColor="bg-slate-50"
      />
    </div>
  );
}
