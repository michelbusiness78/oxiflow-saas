'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { InterventionNotificationBanner } from '@/components/technicien/InterventionNotificationBanner';
import { TechnicienPlanning }             from '@/components/technicien/TechnicienPlanning';
import { InterventionDetailPanel }        from '@/components/technicien/InterventionDetailPanel';
import type { InterventionNotifData, PlanningIntervention } from '@/app/actions/technicien-notifications';

interface Props {
  initialNotifications: InterventionNotifData[];
  initialPlanning:      PlanningIntervention[];
}

export function TechnicienContent({ initialNotifications, initialPlanning }: Props) {
  const router = useRouter();
  const [planning,  setPlanning]  = useState<PlanningIntervention[]>(initialPlanning);
  const [selected,  setSelected]  = useState<PlanningIntervention | null>(null);

  // Ouvrir le panel depuis le bandeau (par intervention_id)
  function handleOpenFromNotif(interventionId: string) {
    const found = planning.find((p) => p.id === interventionId);
    if (found) setSelected(found);
  }

  // Mise à jour optimiste du statut + refresh KPIs côté serveur
  function handleStatusChange(interventionId: string, newStatus: string) {
    setPlanning((prev) =>
      prev.map((p) => (p.id === interventionId ? { ...p, status: newStatus } : p)),
    );
    setSelected((prev) => (prev?.id === interventionId ? { ...prev, status: newStatus } : prev));
    router.refresh();
  }

  return (
    <>
      {/* A) Bandeau notifications */}
      <InterventionNotificationBanner
        initialNotifications={initialNotifications}
        onOpenDetail={handleOpenFromNotif}
      />

      {/* C) Planning terrain */}
      <div id="planning-list">
        <TechnicienPlanning
          interventions={planning}
          onSelect={setSelected}
        />
      </div>

      {/* Panel détail */}
      <InterventionDetailPanel
        intervention={selected}
        onClose={() => setSelected(null)}
        onStatusChange={handleStatusChange}
      />
    </>
  );
}
