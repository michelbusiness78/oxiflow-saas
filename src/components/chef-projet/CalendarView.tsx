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
  allDay:     'Journée',
  previous:   '‹',
  next:       '›',
  today:      "Aujourd'hui",
  month:      'Mois',
  week:       'Semaine',
  day:        'Jour',
  agenda:     'Agenda',
  date:       'Date',
  time:       'Heure',
  event:      'Événement',
  showMore:   (n: number) => `+ ${n} de plus`,
  noEventsInRange: 'Aucun événement sur cette période.',
};

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
      if (e.nature === 'sav') {
        prefix = e.urgency === 'critique' ? '🚨 ' : '🔧 ';
      } else {
        prefix = '🏗 ';
      }
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

// ── Event style ───────────────────────────────────────────────────────────────

function eventStyleGetter(event: CalEvent) {
  const color   = event.resource.color ?? '#93c5fd';
  const nature  = event.resource.nature;
  const urgency = event.resource.urgency;

  let borderLeft = 'none';
  if (event.resource.type === 'intervention') {
    if (nature === 'sav') {
      if (urgency === 'critique') borderLeft = '4px solid #dc2626';
      else if (urgency === 'urgent') borderLeft = '4px solid #ea580c';
      else borderLeft = '4px solid #d97706';
    } else {
      borderLeft = '4px solid #2563eb';
    }
  }

  return {
    style: {
      backgroundColor: color,
      borderRadius:    '6px',
      border:          'none',
      borderLeft,
      color:           '#1e293b',
      fontSize:        '12px',
      fontWeight:      '500',
      padding:         '2px 6px',
    },
  };
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
  onEdit,
  onClose,
}: {
  event: CalendarEventData;
  onEdit: () => void;
  onClose: () => void;
}) {
  const start = new Date(event.startISO).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const end   = new Date(event.endISO).toLocaleString('fr-FR',   { dateStyle: 'short', timeStyle: 'short' });

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
        {event.techNom   && <p>👷 {event.techNom}</p>}

        {/* Nature badge */}
        {event.type === 'intervention' && event.nature && (
          <p>
            <span className={[
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
              event.nature === 'sav'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-blue-100 text-blue-800',
            ].join(' ')}>
              {event.nature === 'sav' ? '🔧 SAV' : '🏗 Projet'}
            </span>
            {event.nature === 'sav' && event.urgency && event.urgency !== 'normal' && (
              <span className={[
                'ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
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

interface UserRow { id: string; name: string }

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
  const [events,     setEvents]     = useState<CalendarEventData[]>(initialEvents);
  const [isPending,  startTransition] = useTransition();
  const [selected,   setSelected]   = useState<CalendarEventData | null>(null);
  const [formOpen,   setFormOpen]   = useState(false);
  const [editing,    setEditing]    = useState<CalendarEventData | null>(null);
  const [clickedSlot, setClickedSlot] = useState<string | undefined>(undefined);

  const calEvents = useMemo(() => toCalEvents(events), [events]);

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

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
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
          events={calEvents}
          startAccessor="start"
          endAccessor="end"
          defaultView={Views.WEEK}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          messages={messages}
          culture="fr"
          eventPropGetter={eventStyleGetter}
          onRangeChange={handleRangeChange}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          style={{ height: '100%', padding: '8px' }}
        />
      </div>

      {/* Event detail panel */}
      {selected && (
        <EventDetailPanel
          event={selected}
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
