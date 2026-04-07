'use server';
import { getAuthContext } from '@/lib/auth-context';

// ── Type ──────────────────────────────────────────────────────────────────────

export interface DocumentEntry {
  id:           string;
  name:         string;
  type:         string;
  size:         number;
  storage_path: string;
  uploaded_at:  string;
  uploaded_by:  string;
  description:  string;
  category:     string;
}

// ── uploadDocumentAction ──────────────────────────────────────────────────────

export async function uploadDocumentAction(
  interventionId: string,
  file: { name: string; mimeType: string; size: number; base64: string },
  description?: string,
): Promise<{ success?: true; doc?: DocumentEntry; error?: string }> {
  const { admin, tenant_id, name } = await getAuthContext();

  // Sanitize filename
  const safeName = file.name.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
  const path     = `${tenant_id}/interventions/${interventionId}/${safeName}`;

  // base64 → Buffer
  const b64    = file.base64.includes(',') ? file.base64.split(',')[1] : file.base64;
  const buffer = Buffer.from(b64, 'base64');

  // Upload vers Storage
  const { error: uploadError } = await admin.storage
    .from('documents')
    .upload(path, buffer, { contentType: file.mimeType, upsert: true });

  if (uploadError) return { error: uploadError.message };

  // Lire les docs existants
  const { data: iv } = await admin
    .from('interventions')
    .select('documents')
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id)
    .single();

  const existing: DocumentEntry[] = (iv?.documents as DocumentEntry[] | null) ?? [];

  const newDoc: DocumentEntry = {
    id:           `DOC_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name:         file.name,
    type:         file.name.split('.').pop()?.toLowerCase() ?? '',
    size:         file.size,
    storage_path: path,
    uploaded_at:  new Date().toISOString(),
    uploaded_by:  name,
    description:  description?.trim() ?? '',
    category:     'general',
  };

  const { error: updateError } = await admin
    .from('interventions')
    .update({ documents: [...existing, newDoc] })
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id);

  if (updateError) return { error: updateError.message };
  return { success: true, doc: newDoc };
}

// ── getDocumentUrlAction ──────────────────────────────────────────────────────

export async function getDocumentUrlAction(storagePath: string): Promise<string | null> {
  const { admin } = await getAuthContext();
  const { data }  = await admin.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600); // URL valide 1h
  return data?.signedUrl ?? null;
}

// ── deleteDocumentAction ──────────────────────────────────────────────────────

export async function deleteDocumentAction(
  interventionId: string,
  documentId:     string,
): Promise<{ success?: true; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();

  const { data: iv } = await admin
    .from('interventions')
    .select('documents')
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id)
    .single();

  const docs: DocumentEntry[] = (iv?.documents as DocumentEntry[] | null) ?? [];
  const doc = docs.find((d) => d.id === documentId);

  if (doc?.storage_path) {
    await admin.storage.from('documents').remove([doc.storage_path]);
  }

  const updated = docs.filter((d) => d.id !== documentId);

  const { error } = await admin
    .from('interventions')
    .update({ documents: updated })
    .eq('id', interventionId)
    .eq('tenant_id', tenant_id);

  if (error) return { error: error.message };
  return { success: true };
}

// ── Types dossier client ──────────────────────────────────────────────────────

export interface ChecklistItemLite { id: string; label: string; done: boolean; }
export interface MaterialItemLite  {
  id:           string;
  designation?: string;
  marque?:      string;
  modele?:      string;
  serial?:      string;
  location?:    string;
  reference?:   string;
  quantite?:    number;
  from_devis?:  boolean;
}

export interface InterventionForDossier {
  id:                  string;
  title:               string;
  status:              string;
  date_start:          string;
  tech_name:           string | null;
  timer_elapsed:       number | null;
  hour_start:          string | null;
  hour_end:            string | null;
  observations:        string | null;
  type_intervention:   string | null;
  materials_installed: MaterialItemLite[];
  checklist:           ChecklistItemLite[];
  documents:           DocumentEntry[];
  signature_name:      string | null;
  signature_date:      string | null;
}

export interface MaterialWithContext extends MaterialItemLite {
  intervention_date: string;
  tech_name:         string | null;
}

export interface DocumentWithContext extends DocumentEntry {
  intervention_id:    string;
  intervention_title: string;
  intervention_date:  string;
}

export interface ContratForDossier {
  id:              string;
  type:            string;
  montant_mensuel: number | null;
  actif:           boolean;
  date_debut:      string;
  date_fin:        string | null;
}

export interface ClientDossierData {
  interventions: InterventionForDossier[];
  materiel:      MaterialWithContext[];
  documents:     DocumentWithContext[];
  contrats:      ContratForDossier[];
  stats: {
    total_interventions: number;
    terminees:           number;
    total_materiel:      number;
    total_documents:     number;
    heures_totales:      number; // minutes
  };
}

// ── getClientTechnicalDossier ─────────────────────────────────────────────────

export async function getClientTechnicalDossier(clientId: string): Promise<ClientDossierData> {
  const { admin, tenant_id } = await getAuthContext();

  const [{ data: rawIvs }, { data: rawContrats }] = await Promise.all([
    admin
      .from('interventions')
      .select(`
        id, title, status, date_start, tech_name, timer_elapsed,
        hour_start, hour_end, observations, materials_installed, documents,
        checklist, signature_name, signature_date, type_intervention
      `)
      .eq('tenant_id', tenant_id)
      .eq('client_id', clientId)
      .order('date_start', { ascending: false }),
    admin
      .from('contrats')
      .select('id, type, montant_mensuel, actif, date_debut, date_fin')
      .eq('tenant_id', tenant_id)
      .eq('client_id', clientId),
  ]);

  const ivList: InterventionForDossier[] = (rawIvs ?? []).map((iv) => ({
    id:                  iv.id as string,
    title:               iv.title as string,
    status:              iv.status as string,
    date_start:          iv.date_start as string,
    tech_name:           (iv.tech_name as string | null) ?? null,
    timer_elapsed:       (iv.timer_elapsed as number | null) ?? null,
    hour_start:          (iv.hour_start as string | null) ?? null,
    hour_end:            (iv.hour_end as string | null) ?? null,
    observations:        (iv.observations as string | null) ?? null,
    type_intervention:   (iv.type_intervention as string | null) ?? null,
    materials_installed: (iv.materials_installed as MaterialItemLite[] | null) ?? [],
    checklist:           (iv.checklist as ChecklistItemLite[] | null) ?? [],
    documents:           (iv.documents as DocumentEntry[] | null) ?? [],
    signature_name:      (iv.signature_name as string | null) ?? null,
    signature_date:      (iv.signature_date as string | null) ?? null,
  }));

  // Parc matériel dédoublonné par serial
  const seriesSeen = new Set<string>();
  const materiel: MaterialWithContext[] = [];
  for (const iv of ivList) {
    for (const m of iv.materials_installed) {
      const key = m.serial || `${m.marque}|${m.modele}|${m.designation}|${m.id}`;
      if (!seriesSeen.has(key)) {
        seriesSeen.add(key);
        materiel.push({ ...m, intervention_date: iv.date_start, tech_name: iv.tech_name });
      }
    }
  }

  // Documents consolidés
  const documents: DocumentWithContext[] = [];
  for (const iv of ivList) {
    for (const doc of iv.documents) {
      documents.push({
        ...doc,
        intervention_id:    iv.id,
        intervention_title: iv.title,
        intervention_date:  iv.date_start,
      });
    }
  }

  return {
    interventions: ivList,
    materiel,
    documents,
    contrats: (rawContrats ?? []).map((c) => ({
      id:              c.id as string,
      type:            c.type as string,
      montant_mensuel: (c.montant_mensuel as number | null) ?? null,
      actif:           (c.actif as boolean) ?? false,
      date_debut:      c.date_debut as string,
      date_fin:        (c.date_fin as string | null) ?? null,
    })),
    stats: {
      total_interventions: ivList.length,
      terminees:           ivList.filter((iv) => iv.status === 'terminee').length,
      total_materiel:      materiel.length,
      total_documents:     documents.length,
      heures_totales:      ivList.reduce((s, iv) => s + (iv.timer_elapsed ?? 0), 0),
    },
  };
}
