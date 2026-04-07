'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { getAllTenantInterventions } from '@/app/actions/technicien';
import type { MaterialItem } from '@/app/actions/technicien';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtendedMaterial extends MaterialItem {
  interventionId:    string;
  interventionTitle: string;
  date:              string;
  techName:          string;
  techUserId:        string | null;
  clientName:        string;
  clientAddress:     string;
  typeIntervention:  string;
}

interface Props {
  tenantId:      string;
  currentUserId: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));

const todayStr  = new Date().toISOString().slice(0, 10);
const monthStr  = new Date().toISOString().slice(0, 7);

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TechnicienMateriel({ tenantId, currentUserId }: Props) {
  const [loading,    setLoading]    = useState(true);
  const [allItems,   setAllItems]   = useState<ExtendedMaterial[]>([]);
  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [myOnly,     setMyOnly]     = useState(false);
  const [selected,   setSelected]   = useState<ExtendedMaterial | null>(null);

  // Chargement des matériels (toutes interventions du tenant)
  useEffect(() => {
    getAllTenantInterventions(tenantId).then((interventions) => {
      const items: ExtendedMaterial[] = [];
      for (const iv of interventions) {
        for (const m of (iv.materials_installed ?? [])) {
          if (!m.designation && !m.marque && !m.modele) continue;
          items.push({
            ...m,
            interventionId:    iv.id,
            interventionTitle: iv.title,
            date:              iv.date_start,
            techName:          iv.tech_name ?? 'N/A',
            techUserId:        iv.tech_user_id ?? null,
            clientName:        iv.client_name ?? iv.clients?.nom ?? 'N/A',
            clientAddress:     [iv.client_address ?? iv.clients?.adresse, iv.client_city ?? iv.clients?.ville]
                                 .filter(Boolean).join(', ') || 'N/A',
            typeIntervention:  iv.type_intervention ?? 'N/A',
          });
        }
      }
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllItems(items);
      setLoading(false);
    });
  }, [tenantId]);

  // Types uniques (pour les chips filtres)
  const types = useMemo(() => {
    const counts = new Map<string, number>();
    for (const m of allItems) {
      if (m.typeIntervention && m.typeIntervention !== 'N/A') {
        counts.set(m.typeIntervention, (counts.get(m.typeIntervention) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [allItems]);

  // Stats header
  const stats = useMemo(() => ({
    total:   allItems.length,
    myMonth: allItems.filter((m) => m.date.startsWith(monthStr) && m.techUserId === currentUserId).length,
    today:   allItems.filter((m) => m.date.startsWith(todayStr)).length,
  }), [allItems, currentUserId]);

  // Filtrage
  const filtered = useMemo(() => {
    const q = normalize(search);
    return allItems.filter((m) => {
      if (myOnly && m.techUserId !== currentUserId) return false;
      if (filterType !== 'all' && m.typeIntervention !== filterType) return false;
      if (q && ![m.designation, m.marque, m.modele, m.serial, m.location, m.clientName, m.techName]
            .some((v) => v && normalize(v).includes(q))) return false;
      return true;
    });
  }, [allItems, search, filterType, myOnly, currentUserId]);

  const handleSelect = useCallback((m: ExtendedMaterial) => setSelected(m), []);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        <p className="mt-4 text-sm text-slate-400">Chargement de la base matériel…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-28">
      {/* ── En-tête ── */}
      <div className="px-4 pt-4 pb-3 space-y-1">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Base matériel commune</p>
        <p className="text-xs text-slate-400">
          {stats.total} équipement{stats.total !== 1 ? 's' : ''}
          {stats.myMonth > 0 && ` · ${stats.myMonth} par moi ce mois`}
          {stats.today > 0 && ` · ${stats.today} aujourd'hui`}
        </p>
      </div>

      {/* ── Recherche ── */}
      <div className="px-4 pb-3">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="search"
            placeholder="Marque, modèle, client, N° série…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* ── Filtres type (chips) ── */}
      {types.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={[
              'flex-none rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px]',
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
          >
            Tous ({allItems.length})
          </button>
          {types.map(([type, count]) => (
            <button
              key={type}
              type="button"
              onClick={() => setFilterType(type)}
              className={[
                'flex-none rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors min-h-[36px]',
                filterType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
              ].join(' ')}
            >
              {type} ({count})
            </button>
          ))}
        </div>
      )}

      {/* ── Filtre "Mes installations" ── */}
      <div className="px-4 pb-3">
        <button
          type="button"
          onClick={() => setMyOnly((v) => !v)}
          className={[
            'flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors border min-h-[44px]',
            myOnly
              ? 'bg-blue-50 border-blue-200 text-blue-700'
              : 'bg-white border-slate-200 text-slate-600',
          ].join(' ')}
        >
          <span className={[
            'w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold',
            myOnly ? 'bg-blue-600 text-white' : 'bg-slate-200 text-transparent',
          ].join(' ')}>✓</span>
          Mes installations uniquement
        </button>
      </div>

      {/* ── Liste ── */}
      <div className="px-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-slate-400">Aucun matériel trouvé</p>
          </div>
        ) : (
          filtered.map((m, idx) => {
            const isNew = m.date.startsWith(todayStr);
            return (
              <button
                key={`${m.interventionId}-${m.id}-${idx}`}
                type="button"
                onClick={() => handleSelect(m)}
                className="w-full text-left rounded-xl border border-[#dde3f0] bg-white p-4 shadow-sm hover:border-blue-300 active:bg-slate-50 transition-colors min-h-[80px]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {[m.marque, m.modele].filter(Boolean).join(' ') || m.designation || 'Matériel'}
                    </p>
                    {m.designation && (m.marque || m.modele) && (
                      <p className="text-xs text-slate-500 truncate">{m.designation}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400 truncate">{m.clientName}</p>
                    {m.location && (
                      <p className="text-xs text-slate-400 truncate">📍 {m.location}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {isNew && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">🆕</span>
                    )}
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{fmtDate(m.date)}</span>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{m.techName}</span>
                  </div>
                </div>
                {m.serial && (
                  <p className="mt-1.5 text-[10px] font-mono text-slate-400">S/N : {m.serial}</p>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* ── Panel détail (bottom sheet) ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-6">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelected(null)}
          />

          {/* Sheet */}
          <div className="relative z-10 w-full max-w-lg rounded-t-3xl md:rounded-2xl bg-white shadow-2xl max-h-[85vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100">
              <div>
                <p className="text-base font-bold text-slate-800">
                  {[selected.marque, selected.modele].filter(Boolean).join(' ') || selected.designation || 'Matériel'}
                </p>
                {selected.designation && (selected.marque || selected.modele) && (
                  <p className="text-xs text-slate-400">{selected.designation}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-full w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Contenu */}
            <div className="px-5 py-4 space-y-4">
              {/* Caractéristiques */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Équipement</p>
                {selected.marque && <DetailRow label="Marque"    value={selected.marque} />}
                {selected.modele && <DetailRow label="Modèle"    value={selected.modele} />}
                {selected.serial && <DetailRow label="N° Série"  value={selected.serial} mono />}
                {selected.location && <DetailRow label="Localisation" value={selected.location} />}
                {selected.reference && <DetailRow label="Référence" value={selected.reference} />}
                {selected.quantite && <DetailRow label="Quantité" value={`${selected.quantite}`} />}
              </div>

              {/* Client */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Client</p>
                <DetailRow label="Client"  value={selected.clientName}    />
                <DetailRow label="Adresse" value={selected.clientAddress} />
              </div>

              {/* Installation */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Installation</p>
                <DetailRow label="Date"        value={fmtDate(selected.date)}          />
                <DetailRow label="Technicien"  value={selected.techName}               />
                <DetailRow label="Type"        value={selected.typeIntervention}        />
                <DetailRow label="Intervention" value={selected.interventionTitle}      />
              </div>
            </div>

            {/* Pied */}
            <div className="px-5 pb-6 pt-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors min-h-[48px]"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sous-composant ligne détail ────────────────────────────────────────────────

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="min-w-[90px] text-xs font-semibold text-slate-400">{label}</span>
      <span className={`text-sm text-slate-800 flex-1 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
