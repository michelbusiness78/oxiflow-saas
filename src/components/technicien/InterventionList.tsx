'use client';

import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InterventionForm, type Intervention } from './InterventionForm';
import { deleteInterventionAction } from '@/app/actions/interventions';
import { fmtDate } from '@/lib/format';

interface Client    { id: string; nom: string; adresse?: string; cp?: string; ville?: string; }
interface Catalogue { id: string; ref: string; designation: string; }

interface InterventionListProps {
  interventions: Intervention[];
  clients:       Client[];
  catalogue:     Catalogue[];
  currentUserId: string;
}

// ─── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  installation: { label: 'Installation', bg: 'bg-blue-50',  text: 'text-blue-600', dot: 'bg-blue-600'  },
  maintenance:  { label: 'Maintenance',  bg: 'bg-green-50',  text: 'text-oxi-success', dot: 'bg-green-500'  },
  sav:          { label: 'SAV',           bg: 'bg-oxi-warning-light',  text: 'text-oxi-warning', dot: 'bg-oxi-warning'  },
  depannage:    { label: 'Dépannage',    bg: 'bg-oxi-danger-light',   text: 'text-oxi-danger',  dot: 'bg-oxi-danger'   },
};

const STATUT_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  planifiee: { label: 'Planifiée', bg: 'bg-gray-100',             text: 'text-gray-600'       },
  en_cours:  { label: 'En cours',  bg: 'bg-blue-50',   text: 'text-blue-600'    },
  terminee:  { label: 'Terminée',  bg: 'bg-green-50',   text: 'text-oxi-success'    },
  annulee:   { label: 'Annulée',   bg: 'bg-oxi-danger-light',    text: 'text-oxi-danger'     },
};

function fmtDuree(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

// ─── Date filters ─────────────────────────────────────────────────────────────

type DateFilter = 'today' | 'week' | 'all';

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
         d.getMonth()    === now.getMonth()    &&
         d.getDate()     === now.getDate();
}

function isThisWeek(dateStr: string) {
  const d   = new Date(dateStr);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1); // lundi
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);
  return d >= startOfWeek && d <= endOfWeek;
}

// ─── Intervention Card ────────────────────────────────────────────────────────

function InterventionCard({
  intervention,
  onEdit,
  onDelete,
}: {
  intervention: Intervention;
  onEdit:  () => void;
  onDelete:() => void;
}) {
  const t = TYPE_CONFIG[intervention.type]   ?? TYPE_CONFIG.maintenance;
  const s = STATUT_CONFIG[intervention.statut] ?? STATUT_CONFIG.planifiee;
  const photoCount = intervention.photos?.length ?? 0;
  const checkDone  = intervention.checklist?.filter((c) => c.done).length ?? 0;
  const checkTotal = intervention.checklist?.length ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-sm overflow-hidden active:scale-[0.99] transition-transform">
      {/* Bande colorée par type */}
      <div className={`flex items-center justify-between px-4 py-2.5 ${t.bg}`}>
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${t.dot}`} />
          <span className={`text-xs font-bold ${t.text}`}>{t.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.text}`}>
            {s.label}
          </span>
        </div>
      </div>

      {/* Corps */}
      <div className="px-4 py-3 space-y-2">
        {/* Client */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-base font-bold text-slate-800 leading-snug">{intervention.client_nom ?? '—'}</p>
            {intervention.adresse && (
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                </svg>
                {intervention.adresse}
              </p>
            )}
          </div>
          {fmtDuree(intervention.duree_minutes) && (
            <span className="rounded-lg bg-white px-2 py-1 text-xs font-mono font-semibold text-slate-500 shrink-0">
              {fmtDuree(intervention.duree_minutes)}
            </span>
          )}
        </div>

        {/* Date */}
        <p className="text-sm text-slate-500">
          {new Date(intervention.date).toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
          })}
        </p>

        {/* Indicateurs */}
        {(checkTotal > 0 || photoCount > 0) && (
          <div className="flex items-center gap-3 pt-1">
            {checkTotal > 0 && (
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${Math.round((checkDone / checkTotal) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{checkDone}/{checkTotal}</span>
              </div>
            )}
            {photoCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="h-3.5 w-3.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                </svg>
                {photoCount} photo{photoCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex border-t border-slate-200">
        <button
          onClick={onEdit}
          className="flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
          </svg>
          {intervention.statut === 'terminee' ? 'Voir / Rapport' : 'Ouvrir'}
        </button>
        <div className="w-px bg-slate-200" />
        <button
          onClick={onDelete}
          className="flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-semibold text-oxi-danger hover:bg-oxi-danger-light transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function InterventionList({ interventions, clients, catalogue, currentUserId }: InterventionListProps) {
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState<Intervention | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [error,      setError]      = useState('');

  const filtered = interventions.filter((i) => {
    if (dateFilter === 'today') return isToday(i.date);
    if (dateFilter === 'week')  return isThisWeek(i.date);
    return true;
  });

  // Sort: terminées en bas
  const sorted = [...filtered].sort((a, b) => {
    if (a.statut === 'terminee' && b.statut !== 'terminee') return 1;
    if (a.statut !== 'terminee' && b.statut === 'terminee') return -1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await deleteInterventionAction(deleteId);
    setDeleting(false);
    if ('error' in res && res.error) { setError(res.error); return; }
    setDeleteId(null);
  }

  // Counts for filter badges
  const todayCount = interventions.filter((i) => isToday(i.date)).length;
  const weekCount  = interventions.filter((i) => isThisWeek(i.date)).length;

  const enCours  = interventions.filter((i) => i.statut === 'en_cours').length;
  const terminee = interventions.filter((i) => i.statut === 'terminee').length;

  return (
    <>
      <div className="mx-auto max-w-xl space-y-4">
        {/* Métriques rapides */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Aujourd\'hui',  value: String(todayCount), color: 'text-blue-600'  },
            { label: 'En cours',      value: String(enCours),    color: 'text-oxi-warning'  },
            { label: 'Terminées',     value: String(terminee),   color: 'text-oxi-success'  },
          ].map((m) => (
            <div key={m.label} className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3 text-center">
              <p className={`text-2xl font-extrabold ${m.color}`}>{m.value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Filtre date */}
        <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white shadow-sm p-1.5">
          {([
            { key: 'today', label: `Aujourd'hui`, count: todayCount },
            { key: 'week',  label: 'Cette semaine', count: weekCount },
            { key: 'all',   label: 'Toutes',        count: interventions.length },
          ] as { key: DateFilter; label: string; count: number }[]).map((f) => (
            <button
              key={f.key}
              onClick={() => setDateFilter(f.key)}
              className={[
                'flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors',
                dateFilter === f.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800',
              ].join(' ')}
            >
              {f.label}
              <span className={`ml-1.5 text-xs ${dateFilter === f.key ? 'text-white/70' : 'text-slate-400'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {error && <div className="rounded-xl bg-oxi-danger-light px-4 py-3 text-sm text-oxi-danger">{error}</div>}

        {/* Liste des cartes */}
        {sorted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 p-12 text-center">
            <p className="text-slate-400 text-sm">
              {dateFilter === 'today' ? 'Aucune intervention aujourd\'hui' :
               dateFilter === 'week'  ? 'Aucune intervention cette semaine' :
               'Aucune intervention'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((intervention) => (
              <InterventionCard
                key={intervention.id}
                intervention={intervention}
                onEdit={() => { setEditing(intervention); setFormOpen(true); }}
                onDelete={() => { setError(''); setDeleteId(intervention.id); }}
              />
            ))}
          </div>
        )}

        {/* Bouton nouvelle intervention — gros, accessible au pouce */}
        <button
          onClick={() => { setEditing(null); setFormOpen(true); }}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 py-5 text-base font-bold text-white shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-6 w-6" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouvelle intervention
        </button>
      </div>

      {/* Form full-screen */}
      <InterventionForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        clients={clients}
        catalogue={catalogue}
        editing={editing}
        currentUserId={currentUserId}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Supprimer cette intervention ?"
        description="Les photos et données associées seront perdues."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        loading={deleting}
      />
    </>
  );
}
