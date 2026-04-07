import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/voice-test
 * Diagnostic route — verifies that all voice agent dependencies are reachable.
 * Returns a health summary (auth, voice-data, env vars, tool count).
 * Remove or protect this route in production.
 */
export async function GET() {
  const result: Record<string, unknown> = {};

  // ── Auth ──────────────────────────────────────────────────────────────────
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    result.auth = error ? { ok: false, error: error.message } : { ok: true, userId: user?.id };
  } catch (e) {
    result.auth = { ok: false, error: String(e) };
  }

  // ── Admin client + tenant data ────────────────────────────────────────────
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from('users')
        .select('tenant_id, name, role')
        .eq('id', user.id)
        .single();

      const tenantId = profile?.tenant_id as string | undefined;

      if (tenantId) {
        const [companiesRes, clientsRes, techsRes] = await Promise.all([
          admin.from('companies').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
          admin.from('clients').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('actif', true),
          admin.from('users').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('role', 'technicien'),
        ]);

        result.voiceData = {
          ok:          true,
          companies:   companiesRes.count ?? 0,
          clients:     clientsRes.count ?? 0,
          technicians: techsRes.count ?? 0,
          profile:     { name: profile?.name, role: profile?.role },
        };
      } else {
        result.voiceData = { ok: false, error: 'No tenant_id' };
      }
    } else {
      result.voiceData = { ok: false, error: 'Not authenticated' };
    }
  } catch (e) {
    result.voiceData = { ok: false, error: String(e) };
  }

  // ── Env vars ──────────────────────────────────────────────────────────────
  result.env = {
    ANTHROPIC_API_KEY:    !!process.env.ANTHROPIC_API_KEY,
    ELEVENLABS_API_KEY:   !!process.env.ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID:  !!process.env.ELEVENLABS_VOICE_ID,
    SUPABASE_SERVICE_ROLE: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  // ── Tool count ────────────────────────────────────────────────────────────
  result.tools = {
    expected: 23,
    note: 'creer_client, creer_devis_complet, modifier_statut_devis, creer_facture_depuis_devis, creer_projet_depuis_devis, modifier_statut_facture, ajouter_produit_catalogue, consulter_devis, consulter_factures, consulter_clients, resume_activite, creer_intervention, planifier_tache, lister_taches, lister_interventions, lister_projets, creer_ticket_sav, noter_texte, creer_projet, creer_contrat, creer_avoir, cloturer_intervention, creer_ndf, creer_conge',
  };

  return NextResponse.json(result, { status: 200 });
}
