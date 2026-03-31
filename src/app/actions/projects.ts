'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext }    from '@/lib/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectStatus = 'nouveau' | 'en_cours' | 'termine' | 'annule';

export interface Project {
  id:                  string;
  name:                string;
  description:         string | null;
  client_id:           string | null;
  quote_id:            string | null;
  quote_number:        string | null;
  affair_number:       string | null;
  chef_projet_user_id: string | null;
  commercial_user_id:  string | null;
  amount_ttc:          number;
  deadline:            string | null;
  status:              ProjectStatus;
  type:                string | null;
  notes:               string | null;
  created_at:          string;
  // joined
  client_nom:    string;
  chef_nom:      string;
  commercial_nom: string;
}

export interface ProjectNotifData {
  id:             string;
  project_id:     string;
  title:          string;
  message:        string | null;
  project_name:   string;
  affair_number:  string | null;
  client_nom:     string;
  commercial_name: string;
  amount_ttc:     number;
  created_at:     string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtEurServer(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}

// ─── createProjectFromQuote ───────────────────────────────────────────────────

export async function createProjectFromQuote(
  quoteId: string,
): Promise<{ success?: true; project_id?: string; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  // 1. Fetch quote
  const { data: quote, error: qErr } = await admin
    .from('quotes')
    .select('id, number, affair_number, objet, statut, client_id, validity, montant_ttc, chef_projet_user_id, commercial_user_id, project_created, clients(nom)')
    .eq('id', quoteId)
    .single();

  if (qErr || !quote) return { error: qErr?.message ?? 'Devis introuvable' };
  if (quote.statut !== 'accepte')     return { error: 'Le devis doit être en statut "Accepté".' };
  if (quote.project_created)          return { error: 'Un projet a déjà été créé pour ce devis.' };

  const clientNom = (quote.clients as unknown as { nom: string } | null)?.nom ?? '';

  // 2. Deadline = validity + 30j (ou today + 60j)
  const baseDate = quote.validity ?? new Date().toISOString().split('T')[0];
  const deadline = new Date(new Date(baseDate).getTime() + 30 * 86400 * 1000)
    .toISOString().split('T')[0];

  // 3. Créer le projet
  const { data: project, error: pErr } = await admin
    .from('projects')
    .insert({
      tenant_id,
      name:                quote.objet ?? `Projet ${quote.number}`,
      description:         `Projet créé depuis devis ${quote.number}`,
      client_id:           quote.client_id,
      quote_id:            quoteId,
      quote_number:        quote.number,
      affair_number:       quote.affair_number,
      chef_projet_user_id: quote.chef_projet_user_id,
      commercial_user_id:  quote.commercial_user_id,
      amount_ttc:          quote.montant_ttc,
      deadline,
      status:              'nouveau',
    })
    .select('id')
    .single();

  if (pErr || !project) return { error: pErr?.message ?? 'Erreur lors de la création du projet' };

  // 4. Mettre à jour le devis
  await admin
    .from('quotes')
    .update({ project_created: true, project_id: project.id, updated_at: new Date().toISOString() })
    .eq('id', quoteId);

  // 5. Notification chef de projet
  if (quote.chef_projet_user_id) {
    const montantStr = fmtEurServer(quote.montant_ttc);
    await admin
      .from('project_notifications')
      .insert({
        tenant_id,
        project_id: project.id,
        user_id:    quote.chef_projet_user_id,
        type:       'new_project',
        title:      'Nouveau projet affecté',
        message:    `${quote.objet ?? quote.number} · ${clientNom} · ${montantStr} · Devis ${quote.number}`,
      });
  }

  revalidatePath('/projets');
  revalidatePath('/commerce');
  return { success: true, project_id: project.id };
}

// ─── acceptProjectNotification ────────────────────────────────────────────────

export async function acceptProjectNotification(
  notificationId: string,
): Promise<{ success?: true; error?: string }> {
  const { admin } = await getAuthContext();

  const { data: notif, error: nErr } = await admin
    .from('project_notifications')
    .select('project_id')
    .eq('id', notificationId)
    .single();

  if (nErr || !notif) return { error: nErr?.message ?? 'Notification introuvable' };

  await Promise.all([
    admin
      .from('project_notifications')
      .update({ read: true, accepted: true })
      .eq('id', notificationId),
    admin
      .from('projects')
      .update({ status: 'en_cours', updated_at: new Date().toISOString() })
      .eq('id', notif.project_id),
  ]);

  revalidatePath('/projets');
  return { success: true };
}

// ─── getProjectNotifications ──────────────────────────────────────────────────

export async function getProjectNotifications(userId: string): Promise<ProjectNotifData[]> {
  const admin = await createAdminClient();

  const { data: notifs } = await admin
    .from('project_notifications')
    .select('id, project_id, title, message, created_at')
    .eq('user_id', userId)
    .eq('read', false)
    .order('created_at', { ascending: false });

  if (!notifs || notifs.length === 0) return [];

  const projectIds = [...new Set(notifs.map((n) => n.project_id))];
  const { data: projects } = await admin
    .from('projects')
    .select('id, name, affair_number, amount_ttc, client_id, commercial_user_id')
    .in('id', projectIds);

  if (!projects || projects.length === 0) return [];

  const clientIds = [...new Set(projects.map((p) => p.client_id).filter(Boolean))] as string[];
  const userIds   = [...new Set(projects.map((p) => p.commercial_user_id).filter(Boolean))] as string[];

  const [{ data: clients }, { data: users }] = await Promise.all([
    clientIds.length > 0
      ? admin.from('clients').select('id, nom').in('id', clientIds)
      : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
    userIds.length > 0
      ? admin.from('users').select('id, name').in('id', userIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const clientMap  = new Map((clients  ?? []).map((c) => [c.id, c.nom]));
  const userMap    = new Map((users    ?? []).map((u) => [u.id, u.name]));
  const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));

  return notifs.map((n) => {
    const proj = projectMap.get(n.project_id);
    return {
      id:              n.id,
      project_id:      n.project_id,
      title:           n.title,
      message:         n.message ?? null,
      project_name:    proj?.name ?? '',
      affair_number:   proj?.affair_number ?? null,
      client_nom:      proj?.client_id ? (clientMap.get(proj.client_id) ?? '—') : '—',
      commercial_name: proj?.commercial_user_id ? (userMap.get(proj.commercial_user_id) ?? '—') : '—',
      amount_ttc:      proj?.amount_ttc ?? 0,
      created_at:      n.created_at,
    };
  });
}

// ─── getProjects ──────────────────────────────────────────────────────────────

export async function getProjects(tenantId: string): Promise<Project[]> {
  const admin = await createAdminClient();

  const { data } = await admin
    .from('projects')
    .select('id, name, description, client_id, quote_id, quote_number, affair_number, chef_projet_user_id, commercial_user_id, amount_ttc, deadline, status, type, notes, created_at, clients(nom)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  return (data ?? []).map((p) => ({
    id:                  p.id,
    name:                p.name,
    description:         p.description ?? null,
    client_id:           p.client_id ?? null,
    quote_id:            p.quote_id ?? null,
    quote_number:        p.quote_number ?? null,
    affair_number:       p.affair_number ?? null,
    chef_projet_user_id: p.chef_projet_user_id ?? null,
    commercial_user_id:  p.commercial_user_id ?? null,
    amount_ttc:          p.amount_ttc ?? 0,
    deadline:            p.deadline ?? null,
    status:              (p.status ?? 'nouveau') as ProjectStatus,
    type:                p.type ?? null,
    notes:               p.notes ?? null,
    created_at:          p.created_at,
    client_nom:          (p.clients as unknown as { nom: string } | null)?.nom ?? '—',
    chef_nom:            '—',   // resolved client-side via users list
    commercial_nom:      '—',   // resolved client-side via users list
  }));
}
