'use server';

import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext }    from '@/lib/auth-context';
import { revalidatePath }    from 'next/cache';
import { sendEmail, sendEmailWithAttachment } from '@/lib/email';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id:    string;
  label: string;
  done:  boolean;
}

export interface MaterialItem {
  id:           string;
  // Champs communs
  designation?: string;
  reference?:   string;
  quantite?:    number;
  marque?:      string;
  modele?:      string;
  serial?:      string;
  location?:    string;
  // Matériel pré-rempli depuis le devis
  from_devis?:  boolean;
  // Compat avec anciennes données (type = catégorie libre)
  type?:        string;
}

export interface PlanningIntervention {
  id:                  string;
  title:               string;
  date_start:          string;
  date_end:            string | null;
  status:              string;
  type:                string | null;
  nature:              string | null;
  notes:               string | null;
  hours_planned:       number | null;
  is_new:              boolean;
  client_id:           string | null;
  tech_user_id:        string | null;
  tech_name:           string | null;
  project_id:          string | null;
  // Dénormalisés (remplis à la création)
  client_name:         string | null;
  client_address:      string | null;
  client_city:         string | null;
  client_phone:        string | null;
  affair_number:       string | null;
  type_intervention:   string | null;
  urgency:             string | null;
  under_contract:      boolean | null;
  // Pointage (horodatage automatique)
  hour_start:          string | null;
  hour_end:            string | null;
  timer_elapsed:       number | null;
  // Contenu
  observations:        string | null;
  checklist:           ChecklistItem[];
  materials_installed: MaterialItem[];
  // Rapport
  report_sent:         boolean;
  report_sent_at:      string | null;
  report_sent_to:      string | null;
  // Signature client
  signature_data:      string | null;
  signature_name:      string | null;
  signature_date:      string | null;
  // Joints (fallback si dénorm absent)
  clients:  { nom: string; adresse: string | null; cp: string | null; ville: string | null; tel: string | null } | null;
  projects: { name: string; affair_number: string | null } | null;
}

// ── Toutes les interventions du technicien ─────────────────────────────────────

export async function getMyInterventions(
  tenantId: string,
  userId:   string,
): Promise<PlanningIntervention[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('interventions')
    .select(`
      id, title, date_start, date_end, status, type, nature, notes,
      hours_planned, is_new, client_id, tech_user_id, tech_name, project_id,
      client_name, client_address, client_city, client_phone,
      affair_number, type_intervention, urgency, under_contract,
      hour_start, hour_end, timer_elapsed,
      observations, checklist, materials_installed,
      report_sent, report_sent_at, report_sent_to,
      signature_data, signature_name, signature_date,
      clients ( nom, adresse, cp, ville, tel ),
      projects ( name, affair_number )
    `)
    .eq('tenant_id', tenantId)
    .eq('tech_user_id', userId)
    .order('date_start', { ascending: false });

  return (data ?? []).map((i) => ({
    ...i,
    is_new:              (i.is_new              as boolean | null) ?? false,
    under_contract:      (i.under_contract      as boolean | null) ?? null,
    report_sent:         (i.report_sent         as boolean | null) ?? false,
    checklist:           (i.checklist           as ChecklistItem[] | null) ?? [],
    materials_installed: (i.materials_installed as MaterialItem[]  | null) ?? [],
    signature_data:      (i.signature_data      as string  | null) ?? null,
    signature_name:      (i.signature_name      as string  | null) ?? null,
    signature_date:      (i.signature_date      as string  | null) ?? null,
  })) as unknown as PlanningIntervention[];
}

// ── Marquer une intervention comme lue (is_new = false) ───────────────────────

export async function markInterventionRead(
  interventionId: string,
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { error } = await admin
    .from('interventions')
    .update({ is_new: false, updated_at: new Date().toISOString() })
    .eq('id', interventionId);

  if (error) return { error: error.message };
  revalidatePath('/technicien');
  return {};
}

// ── Changer le statut + horodatage automatique ────────────────────────────────

export async function updateInterventionStatus(
  interventionId: string,
  newStatus:       'planifiee' | 'en_cours' | 'terminee',
  timestamp?:      string,         // ISO passé depuis le client (Date.now())
): Promise<{ error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const ts = timestamp ?? new Date().toISOString();

  const patch: Record<string, unknown> = {
    status:     newStatus,
    statut:     newStatus,
    updated_at: new Date().toISOString(),
  };

  // Horodatage automatique
  if (newStatus === 'en_cours') patch.hour_start = ts;
  if (newStatus === 'terminee') patch.hour_end   = ts;

  const { error } = await admin
    .from('interventions')
    .update(patch)
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id);

  if (error) return { error: error.message };
  revalidatePath('/technicien');
  return {};
}

// ── Sauvegarder la progression (checklist, matériel, observations) ────────────

export async function saveInterventionProgress(
  interventionId: string,
  data: {
    hour_start?:          string | null;
    hour_end?:            string | null;
    timer_elapsed?:       number;
    checklist?:           ChecklistItem[];
    materials_installed?: MaterialItem[];
    observations?:        string | null;
  },
): Promise<{ error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.hour_start          !== undefined) patch.hour_start          = data.hour_start;
  if (data.hour_end            !== undefined) patch.hour_end            = data.hour_end;
  if (data.timer_elapsed       !== undefined) patch.timer_elapsed       = data.timer_elapsed;
  if (data.checklist           !== undefined) patch.checklist           = data.checklist;
  if (data.materials_installed !== undefined) patch.materials_installed = data.materials_installed;
  if (data.observations        !== undefined) patch.observations        = data.observations;

  const { error } = await admin
    .from('interventions')
    .update(patch)
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id);

  if (error) return { error: error.message };
  revalidatePath('/technicien');
  return {};
}

// ── Sauvegarder la signature client ──────────────────────────────────────────

export async function saveInterventionSignature(
  interventionId: string,
  signatureData:  string,   // base64 PNG (data URI)
  signatureName:  string,
): Promise<{ error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const { error } = await admin
    .from('interventions')
    .update({
      signature_data: signatureData,
      signature_name: signatureName,
      signature_date: new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    })
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id);

  if (error) return { error: error.message };
  revalidatePath('/technicien');
  return {};
}

// ── Envoyer le rapport par email ──────────────────────────────────────────────

export async function sendInterventionReport(
  interventionId: string,
  pdfBase64?:     string,   // PDF généré côté client, encodé en base64
): Promise<{ error?: string; recipientEmail?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  // Récupérer l'intervention complète
  const { data: iv, error: ivErr } = await admin
    .from('interventions')
    .select('*')
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id)
    .single();

  if (ivErr || !iv) return { error: 'Intervention introuvable' };

  // Chercher le dirigeant du tenant
  const adminClient = createAdminClient();
  const { data: dirigeants } = await adminClient
    .from('users')
    .select('email, name, role')
    .eq('tenant_id', tenant_id)
    .eq('role', 'dirigeant')
    .eq('active', true)
    .limit(1);

  let recipient = (dirigeants ?? [])[0] ?? null;

  // Fallback : n'importe quel utilisateur actif avec un email valide
  if (!recipient?.email) {
    const { data: anyUser } = await adminClient
      .from('users')
      .select('email, name, role')
      .eq('tenant_id', tenant_id)
      .eq('active', true)
      .not('email', 'is', null)
      .limit(1);
    recipient = (anyUser ?? [])[0] ?? null;
  }

  console.log('[sendInterventionReport] destinataire:', recipient?.email ?? 'aucun');

  if (!recipient?.email) return { error: 'Aucun destinataire configuré' };

  // ── Formatage ────────────────────────────────────────────────────────────────

  const fmtTime = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
      : 'N/A';

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));

  let durationStr = 'N/A';
  if (iv.hour_start && iv.hour_end) {
    const mins = Math.floor(
      (new Date(iv.hour_end).getTime() - new Date(iv.hour_start).getTime()) / 60000,
    );
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    durationStr = h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
  }

  // ── Corps email ───────────────────────────────────────────────────────────────

  const materials = (iv.materials_installed as MaterialItem[] | null) ?? [];
  const materialsRows = materials.length > 0
    ? materials.map((m) => {
        const label    = m.designation || [m.marque, m.modele].filter(Boolean).join(' ') || m.type || 'Matériel';
        const details  = [
          m.reference && `Réf: ${m.reference}`,
          m.quantite   && `Qté: ${m.quantite}`,
          m.marque    && `Marque: ${m.marque}`,
          m.modele    && `Modèle: ${m.modele}`,
          m.serial    && `N° série: ${m.serial}`,
          m.location  && `Local.: ${m.location}`,
        ].filter(Boolean).join(' · ');
        return `<tr><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;">${label}</td><td style="padding:4px 8px;border-bottom:1px solid #e2e8f0;color:#64748b;">${details}</td></tr>`;
      }).join('')
    : '<tr><td colspan="2" style="padding:8px;color:#94a3b8;font-style:italic;">Aucun matériel renseigné</td></tr>';

  const checklist  = (iv.checklist as ChecklistItem[] | null) ?? [];
  const checkDone  = checklist.filter((c) => c.done).length;
  const checkRows  = checklist.length > 0
    ? checklist.map((c) => `<li style="margin:2px 0;">${c.done ? '✅' : '☐'} ${c.label}</li>`).join('')
    : '<li style="color:#94a3b8;font-style:italic;">Aucune checklist</li>';

  const subject = `[OxiFlow] Rapport d'intervention — ${iv.title} — ${fmtDate(iv.date_start)}`;

  const html = `
<!DOCTYPE html>
<html><body style="font-family:sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:20px;">
  <div style="border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:20px;">
    <h2 style="margin:0;color:#1e3a5f;">Rapport d'intervention</h2>
    <p style="margin:4px 0 0;color:#64748b;font-size:14px;">${fmtDate(iv.date_start)}</p>
  </div>

  <h3 style="color:#2563eb;font-size:14px;text-transform:uppercase;letter-spacing:.05em;">📋 Intervention</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
    <tr><td style="padding:4px 8px;color:#64748b;width:140px;">Titre</td><td style="padding:4px 8px;font-weight:600;">${iv.title}</td></tr>
    <tr><td style="padding:4px 8px;color:#64748b;">Client</td><td style="padding:4px 8px;">${[iv.client_name, iv.client_city].filter(Boolean).join(' — ') || 'N/A'}</td></tr>
    <tr><td style="padding:4px 8px;color:#64748b;">N° Affaire</td><td style="padding:4px 8px;">${iv.affair_number || 'N/A'}</td></tr>
    <tr><td style="padding:4px 8px;color:#64748b;">Nature</td><td style="padding:4px 8px;">${iv.nature === 'sav' ? 'SAV' : 'Projet'}</td></tr>
    <tr><td style="padding:4px 8px;color:#64748b;">Technicien</td><td style="padding:4px 8px;">${iv.tech_name || 'N/A'}</td></tr>
  </table>

  <h3 style="color:#2563eb;font-size:14px;text-transform:uppercase;letter-spacing:.05em;">⏱ Horaires</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
    <tr><td style="padding:4px 8px;color:#64748b;width:140px;">Début</td><td style="padding:4px 8px;">${fmtTime(iv.hour_start)}</td></tr>
    <tr><td style="padding:4px 8px;color:#64748b;">Fin</td><td style="padding:4px 8px;">${fmtTime(iv.hour_end)}</td></tr>
    <tr><td style="padding:4px 8px;color:#64748b;">Durée réelle</td><td style="padding:4px 8px;font-weight:600;">${durationStr}</td></tr>
    <tr><td style="padding:4px 8px;color:#64748b;">Heures prévues</td><td style="padding:4px 8px;">${iv.hours_planned != null ? `${iv.hours_planned}h` : 'N/A'}</td></tr>
  </table>

  <h3 style="color:#2563eb;font-size:14px;text-transform:uppercase;letter-spacing:.05em;">🔧 Matériel installé</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">${materialsRows}</table>

  <h3 style="color:#2563eb;font-size:14px;text-transform:uppercase;letter-spacing:.05em;">✅ Checklist (${checkDone}/${checklist.length})</h3>
  <ul style="font-size:14px;line-height:1.8;margin:0 0 20px;padding-left:16px;">${checkRows}</ul>

  ${iv.observations ? `
  <h3 style="color:#2563eb;font-size:14px;text-transform:uppercase;letter-spacing:.05em;">📝 Observations</h3>
  <p style="font-size:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;white-space:pre-wrap;margin-bottom:20px;">${iv.observations}</p>
  ` : ''}

  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
  <p style="font-size:12px;color:#94a3b8;">Rapport généré automatiquement par <strong>OxiFlow</strong> · oxiflow.fr</p>
</body></html>`;

  // ── Envoi ─────────────────────────────────────────────────────────────────────

  try {
    if (pdfBase64) {
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const dateLabel = new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      }).format(new Date(iv.date_start)).replace(/\//g, '-');
      await sendEmailWithAttachment(
        recipient.email,
        subject,
        `<p style="font-family:sans-serif;font-size:14px;color:#475569;">
          Veuillez trouver ci-joint le rapport d'intervention en PDF.<br><br>
          <em style="color:#94a3b8;">Rapport généré automatiquement par OxiFlow</em>
        </p>`,
        { filename: `rapport-intervention-${dateLabel}.pdf`, content: pdfBuffer },
      );
    } else {
      await sendEmail(recipient.email, subject, html);
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Erreur lors de l\'envoi' };
  }

  // Marquer comme envoyé
  await admin
    .from('interventions')
    .update({
      report_sent:    true,
      report_sent_at: new Date().toISOString(),
      report_sent_to: recipient.email,
      updated_at:     new Date().toISOString(),
    })
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id);

  revalidatePath('/technicien');
  return { recipientEmail: recipient.email };
}
