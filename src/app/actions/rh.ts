'use server';
import { translateSupabaseError } from '@/lib/error-messages';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth-context';

const PATH = '/rh';

// ─── Congés ───────────────────────────────────────────────────────────────────

export type CongeInput = {
  type:        'cp' | 'rtt' | 'maladie' | 'sans_solde';
  date_debut:  string;
  date_fin:    string;
  nb_jours:    number;
  commentaire: string | null;
};

export async function createCongeAction(input: CongeInput) {
  const { admin, user, tenant_id } = await getAuthContext();

  const { error } = await admin.from('conges').insert({
    tenant_id,
    user_id: user.id,
    ...input,
    statut: 'en_attente',
  });
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return {};
}

export async function deleteCongeAction(id: string) {
  const { admin, user } = await getAuthContext();

  const { error } = await admin
    .from('conges')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)   // ne peut supprimer que ses propres congés
    .eq('statut', 'en_attente'); // seulement si pas encore traité

  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return {};
}

export async function changeCongeStatutAction(id: string, statut: 'valide' | 'refuse') {
  const { admin, user, tenant_id, role } = await getAuthContext();

  if (role !== 'dirigeant' && role !== 'rh') return { error: 'Non autorisé' };

  const { data: conge } = await admin
    .from('conges')
    .select('type, nb_jours, user_id')
    .eq('id', id)
    .single();

  const { error } = await admin
    .from('conges')
    .update({ statut, valide_par: user.id })
    .eq('id', id);
  if (error) return { error: translateSupabaseError(error.message) };

  // Déduction automatique du solde si CP ou RTT validé
  if (statut === 'valide' && conge && (conge.type === 'cp' || conge.type === 'rtt')) {
    const { data: current } = await admin
      .from('soldes_conges')
      .select('solde')
      .eq('user_id', conge.user_id)
      .eq('type', conge.type)
      .maybeSingle();

    const newSolde = Math.max(0, (current?.solde ?? 0) - conge.nb_jours);

    await admin.from('soldes_conges').upsert(
      { tenant_id, user_id: conge.user_id, type: conge.type, solde: newSolde },
      { onConflict: 'user_id,type' },
    );

    await admin.from('mouvements_soldes').insert({
      tenant_id,
      user_id:  conge.user_id,
      type:     conge.type,
      delta:    -conge.nb_jours,
      motif:    `Déduction congé ${conge.type.toUpperCase()} — ${conge.nb_jours}j`,
      conge_id: id,
    });
  }

  revalidatePath(PATH);
  return {};
}

// ─── Notes de frais ───────────────────────────────────────────────────────────

export type NoteFraisInput = {
  date:             string;
  montant:          number;
  categorie:        'transport' | 'repas' | 'hebergement' | 'fournitures' | 'autre';
  description:      string | null;
  justificatif_url: string | null;
};

export async function createNoteFraisAction(input: NoteFraisInput) {
  const { admin, user, tenant_id } = await getAuthContext();

  const { error } = await admin.from('notes_frais').insert({
    tenant_id,
    user_id: user.id,
    ...input,
    statut: 'soumise',
  });
  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return {};
}

export async function deleteNoteFraisAction(id: string) {
  const { admin, user } = await getAuthContext();

  const { error } = await admin
    .from('notes_frais')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)
    .eq('statut', 'soumise');

  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return {};
}

export async function changeNoteFraisStatutAction(
  id:     string,
  statut: 'validee' | 'remboursee' | 'rejetee',
) {
  const { admin, user, role } = await getAuthContext();

  if (role !== 'dirigeant' && role !== 'rh') return { error: 'Non autorisé' };

  const { error } = await admin
    .from('notes_frais')
    .update({ statut, valide_par: user.id })
    .eq('id', id);

  if (error) return { error: translateSupabaseError(error.message) };
  revalidatePath(PATH);
  return {};
}

// ─── Storage justificatifs ────────────────────────────────────────────────────

export async function uploadJustificatifAction(
  formData: FormData,
): Promise<{ url?: string; path?: string; error?: string }> {
  const { admin, tenant_id } = await getAuthContext();
  const file  = formData.get('file') as File | null;
  if (!file) return { error: 'Aucun fichier fourni.' };

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${tenant_id}/justificatifs/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage
    .from('rh')
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return { error: translateSupabaseError(error.message) };

  const { data: { publicUrl } } = admin.storage.from('rh').getPublicUrl(path);
  return { url: publicUrl, path };
}

// ─── Soldes ───────────────────────────────────────────────────────────────────

export async function updateSoldeAction(
  userId:   string,
  type:     'cp' | 'rtt',
  newSolde: number,
) {
  const { admin, tenant_id, role } = await getAuthContext();

  if (role !== 'dirigeant' && role !== 'rh') return { error: 'Non autorisé' };

  const { data: current } = await admin
    .from('soldes_conges')
    .select('solde')
    .eq('user_id', userId)
    .eq('type', type)
    .maybeSingle();

  const oldSolde = current?.solde ?? 0;
  const delta    = newSolde - oldSolde;
  if (delta === 0) return {};

  const { error } = await admin
    .from('soldes_conges')
    .upsert(
      { tenant_id, user_id: userId, type, solde: newSolde },
      { onConflict: 'user_id,type' },
    );
  if (error) return { error: translateSupabaseError(error.message) };

  await admin.from('mouvements_soldes').insert({
    tenant_id,
    user_id: userId,
    type,
    delta,
    motif: `Ajustement manuel`,
  });

  revalidatePath(PATH);
  return {};
}
