'use client';

import { useState, useCallback, useTransition, useMemo } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import { getCalendarEvents as fetchEvents } from '@/app/actions/chef-projet';
import type { CalendarEventData, ProjectForPlanning } from '@/app/actions/chef-projet';
import { InterventionFormModal } from '@/components/chef-projet/InterventionFormModal';
import type { ClientFull } from '@/components/chef-projet/InterventionFormModal';

// ── Localizer ─────────────────────────────────────────────────────────────────

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
  getDay,
  locales: { fr },
});

const messages = {
  allDay:          'Journée',
  previous:        '‹',
  next:            '›',
  today:           "Aujourd'hui",
  month:           'Mois',
  week:            'Semaine 7j',
  work_week:       'Semaine',
  day:             'Jour',
  agenda:          'Agenda',
  date:            'Date',
  time:            'Heure',
  event:           'Événement',
  showMore:        (n: number) => `+ ${n} de plus`,
  noEventsInRange: 'Aucun événement sur cette période.',
};

// ── Tech color system ─────────────────────────────────────────────────────────

const TECH_COLORS = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#14b8a6', // teal
];

/** Stable color per tech ID (hash-based, survives re-fetch / re-sort) */
function techIdToColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TECH_COLORS[h % TECH_COLORS.length];
}

type TechColorMap = Map<string, { color: string; name: string }>;

function buildTechColorMap(events: CalendarEventData[], techniciens: UserRow[]): TechColorMap {
  const techMap = new Map(techniciens.map((t) => [t.id, t]));
  const map: TechColorMap = new Map();
  for (const e of events) {
    if (e.tech_user_id && !map.has(e.tech_user_id)) {
      const fromDB = techMap.get(e.tech_user_id);
      map.set(e.tech_user_id, {
        color: fromDB?.color || techIdToColor(e.tech_user_id),
        name:  e.techNom ?? fromDB?.name ?? 'Technicien',
      });
    }
  }
  return map;
}

// ── Internal event type ───────────────────────────────────────────────────────

interface CalEvent {
  id:       string;
  title:    string;
  start:    Date;
  end:      Date;
  resource: CalendarEventData;
}

function toCalEvents(data: CalendarEventData[]): CalEvent[] {
  return data.map((e) => {
    let prefix = '';
    if (e.type === 'intervention') {
      prefix = e.nature === 'sav'
        ? (e.urgency === 'critique' ? '🚨 ' : '🔧 ')
        : '🏗 ';
    }
    return {
      id:       e.id,
      title:    prefix + e.title,
      start:    new Date(e.startISO),
      end:      new Date(e.endISO),
      resource: e,
    };
  });
}

// ── Custom event component (tooltip on hover) ─────────────────────────────────

function EventContent({ event }: { event: CalEvent }) {
  const techName = event.resource.techNom;
  return (
    <span title={techName ?? ''} className="truncate block w-full leading-tight">
      {event.title}
    </span>
  );
}

// ── Event style getter (uses tech color for left border) ──────────────────────

function makeEventStyleGetter(techColorMap: TechColorMap, filterTechId: string | null) {
  return function eventStyleGetter(event: CalEvent) {
    const color   = event.resource.color ?? '#93c5fd';
    const techId  = event.resource.tech_user_id;
    const techColor = techId
      ? (techColorMap.get(techId)?.color ?? '#94a3b8')
      : '#94a3b8';

    const isFiltered = filterTechId !== null
      && event.resource.type === 'intervention'
      && event.resource.tech_user_id !== filterTechId;

    return {
      style: {
        backgroundColor: color,
        borderRadius:    '6px',
        border:          'none',
        borderLeft:      `4px solid ${techColor}`,
        color:           '#1e293b',
        fontSize:        '12px',
        fontWeight:      '500',
        padding:         '2px 6px',
        opacity:         isFiltered ? 0.25 : 1,
        transition:      'opacity 0.15s',
      },
    };
  };
}

// ── Tech legend + filter bar ──────────────────────────────────────────────────

function TechLegend({
  techColorMap,
  filterTechId,
  onFilter,
}: {
  techColorMap: TechColorMap;
  filterTechId: string | null;
  onFilter:     (id: string | null) => void;
}) {
  const techs = Array.from(techColorMap.entries());
  if (techs.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg mb-3">
      <span className="text-xs text-slate-400 font-medium mr-1">Techniciens :</span>

      {/* "Tous" pill */}
      <button
        onClick={() => onFilter(null)}
        className={[
          'rounded-full px-2.5 py-0.5 text-xs font-medium transition-all',
          filterTechId === null
            ? 'bg-blue-600 text-white ring-2 ring-blue-500 ring-offset-1'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
        ].join(' ')}
      >
        Tous
      </button>

      {/* One pill per tech */}
      {techs.map(([id, { color, name }]) => {
        const firstName = name.split(' ')[0];
        const active    = filterTechId === id;
        return (
          <button
            key={id}
            onClick={() => onFilter(active ? null : id)}
            className={[
              'flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-all text-slate-700',
              active
                ? 'bg-slate-100 ring-2 ring-blue-500 ring-offset-1'
                : 'bg-slate-100 hover:bg-slate-200',
            ].join(' ')}
          >
            <span
              style={{ width: 10, height: 10, backgroundColor: color, flexShrink: 0 }}
              className="inline-block rounded-full"
            />
            {firstName}
          </button>
        );
      })}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  planifiee: 'Planifiée',
  en_cours:  'En cours',
  terminee:  'Terminée',
  annulee:   'Annulée',
};

const URGENCY_LABELS: Record<string, string> = {
  normal:   'Normal',
  urgent:   'Urgent',
  critique: 'Critique',
};

function EventDetailPanel({
  event,
  techColorMap,
  onEdit,
  onClose,
}: {
  event:        CalendarEventData;
  techColorMap: TechColorMap;
  onEdit:       () => void;
  onClose:      () => void;
}) {
  const start    = new Date(event.startISO).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const end      = new Date(event.endISO).toLocaleString('fr-FR',   { dateStyle: 'short', timeStyle: 'short' });
  const techColor = event.tech_user_id ? techColorMap.get(event.tech_user_id)?.color : undefined;

  return (
    <div className="absolute right-4 top-4 z-50 w-72 rounded-xl border border-slate-200 bg-white shadow-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 leading-tight">{event.title}</h3>
        <button
          onClick={onClose}
          className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Fermer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-1.5 text-xs text-slate-500">
        <p>📅 {start} → {end}</p>
        {event.clientNom && <p>🏢 {event.clientNom}</p>}
        {event.techNom && (
          <p className="flex items-center gap-1.5">
            {techColor && (
              <span
                style={{ width: 8, height: 8, backgroundColor: techColor }}
                className="inline-block rounded-full shrink-0"
              />
            )}
            👷 {event.techNom}
          </p>
        )}

        {/* Nature badge */}
        {event.type === 'intervention' && event.nature && (
          <p className="flex flex-wrap gap-1">
            <span className={[
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
              event.nature === 'sav' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800',
            ].join(' ')}>
              {event.nature === 'sav' ? '🔧 SAV' : '🏗 Projet'}
            </span>
            {event.nature === 'sav' && event.urgency && event.urgency !== 'normal' && (
              <span className={[
                'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                event.urgency === 'critique' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800',
              ].join(' ')}>
                {URGENCY_LABELS[event.urgency]}
              </span>
            )}
          </p>
        )}

        {event.status && (
          <p>
            Statut :{' '}
            <span className="font-semibold text-slate-700">
              {STATUS_LABELS[event.status] ?? event.status}
            </span>
          </p>
        )}
        {event.notes && <p className="text-slate-400 italic">"{event.notes}"</p>}
      </div>

      {event.type === 'intervention' && (
        <button
          onClick={onEdit}
          className="w-full rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          Modifier
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface UserRow { id: string; name: string; color?: string | null }

interface Props {
  initialEvents:       CalendarEventData[];
  clients:             ClientFull[];
  techniciens:         UserRow[];
  projects:            ProjectForPlanning[];
  contractedClientIds: string[];
}

export function CalendarView({
  initialEvents,
  clients,
  techniciens,
  projects,
  contractedClientIds,
}: Props) {
  const [events,      setEvents]      = useState<CalendarEventData[]>(initialEvents);
  const [isPending,   startTransition] = useTransition();
  const [selected,    setSelected]    = useState<CalendarEventData | null>(null);
  const [formOpen,    setFormOpen]    = useState(false);
  const [editing,     setEditing]     = useState<CalendarEventData | null>(null);
  const [clickedSlot, setClickedSlot] = useState<string | undefined>(undefined);
  const [filterTechId, setFilterTechId] = useState<string | null>(null);

  // Stable color map rebuilt only when event list or techniciens change
  const techColorMap = useMemo(() => buildTechColorMap(events, techniciens), [events, techniciens]);

  const allCalEvents = useMemo(() => toCalEvents(events), [events]);

  // Dim non-matching events via opacity in eventStyleGetter; visually filter here too
  // (we keep all events in RBC so the calendar layout doesn't shift)
  const eventStyleGetter = useMemo(
    () => makeEventStyleGetter(techColorMap, filterTechId),
    [techColorMap, filterTechId],
  );

  // Re-fetch when range changes
  const handleRangeChange = useCallback(
    (range: Date[] | { start: Date; end: Date }) => {
      const start = Array.isArray(range) ? range[0] : range.start;
      const end   = Array.isArray(range) ? range[range.length - 1] : range.end;
      startTransition(async () => {
        const data = await fetchEvents(start.toISOString(), end.toISOString());
        setEvents(data);
      });
    },
    [],
  );

  const handleSelectEvent = useCallback((event: CalEvent) => {
    setSelected(event.resource);
  }, []);

  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    setClickedSlot(start.toISOString());
    setEditing(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback(() => {
    if (!selected) return;
    setEditing(selected);
    setSelected(null);
    setFormOpen(true);
  }, [selected]);

  const handleSaved = useCallback(() => {
    startTransition(async () => {
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const data  = await fetchEvents(start.toISOString(), end.toISOString());
      setEvents(data);
    });
  }, []);

  // Stable components object — avoids RBC remounting on every render
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calComponents = useMemo(() => ({ event: EventContent as any }), []);

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500">
          Cliquez sur un créneau libre pour créer une intervention.
        </p>
        <button
          onClick={() => { setEditing(null); setClickedSlot(undefined); setFormOpen(true); }}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Nouvelle intervention
        </button>
      </div>

      {/* Tech legend + filter */}
      <TechLegend
        techColorMap={techColorMap}
        filterTechId={filterTechId}
        onFilter={setFilterTechId}
      />

      {/* Loading indicator */}
      {isPending && (
        <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-20">
          <span className="text-sm text-slate-500">Chargement…</span>
        </div>
      )}

      {/* Calendar */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden" style={{ height: 620 }}>
        <Calendar
          localizer={localizer}
          events={allCalEvents}
          startAccessor="start"
          endAccessor="end"
          defaultView={Views.WORK_WEEK}
          views={[Views.MONTH, Views.WORK_WEEK, Views.DAY]}
          messages={messages}
          culture="fr"
          eventPropGetter={eventStyleGetter}
          components={calComponents}
          onRangeChange={handleRangeChange}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          min={new Date(0, 0, 0, 7, 0)}
          max={new Date(0, 0, 0, 19, 0)}
          style={{ height: '100%', padding: '8px' }}
        />
      </div>

      {/* Event detail panel */}
      {selected && (
        <EventDetailPanel
          event={selected}
          techColorMap={techColorMap}
          onEdit={handleEdit}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Form modal */}
      <InterventionFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        editing={editing}
        clients={clients}
        techniciens={techniciens}
        projects={projects}
        contractedClientIds={contractedClientIds}
        defaultStart={clickedSlot}
      />
    </div>
  );
}
