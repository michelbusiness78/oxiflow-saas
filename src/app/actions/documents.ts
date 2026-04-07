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
