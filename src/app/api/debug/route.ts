import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const admin = createAdminClient();
  const results: Record<string, unknown> = {};

  // 1. Compter les enregistrements dans les tables clés
  const tables = ['invoices', 'invoice_lines', 'quotes', 'clients', 'companies', 'tenants', 'users'];
  for (const table of tables) {
    const { count, error } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true });
    results[`count_${table}`] = { count, error: error?.message ?? null };
  }

  // 2. Colonnes réelles de la table invoices — lire un sample avec SELECT *
  const { data: sample, error: sampleErr } = await admin
    .from('invoices')
    .select('*')
    .limit(1);

  results['invoices_columns_from_sample'] = sample && sample.length > 0
    ? Object.keys(sample[0])
    : 'TABLE VIDE (ou erreur)';
  results['invoices_sample_error'] = sampleErr?.message ?? null;

  // 3. Test SELECT avec les nouvelles colonnes (avoir_de, avoir_ref, echeancier)
  const { data: newCols, error: newColsErr } = await admin
    .from('invoices')
    .select('id, avoir_de, avoir_de_id, avoir_ref, echeancier')
    .limit(1);
  results['test_new_columns'] = {
    ok:    !newColsErr,
    error: newColsErr?.message ?? null,
    hint:  newColsErr?.hint ?? null,
    data:  newCols ?? null,
  };

  // 4. Test SELECT standard (sans nouvelles colonnes)
  const { data: std, error: stdErr } = await admin
    .from('invoices')
    .select('id, number, status, total_ttc, created_at')
    .limit(5);
  results['test_standard_select'] = {
    ok:    !stdErr,
    error: stdErr?.message ?? null,
    rows:  std ?? [],
  };

  // 5. Test INSERT minimal (dry-run — on vérifie juste la structure)
  // On insère une ligne puis on la supprime immédiatement
  const { data: tenantRow } = await admin.from('tenants').select('id').limit(1).single();
  const { data: clientRow } = await admin.from('clients').select('id').limit(1).single();

  if (tenantRow && clientRow) {
    const testPayload = {
      tenant_id:     tenantRow.id,
      number:        'TEST-DEBUG-001',
      type:          'facture',
      client_id:     clientRow.id,
      date_facture:  '2026-04-07',
      date_echeance: '2026-05-07',
      status:        'brouillon',
      total_ht:      0,
      total_tva:     0,
      total_ttc:     0,
    };
    const { data: ins, error: insErr } = await admin
      .from('invoices')
      .insert(testPayload)
      .select('id')
      .single();

    results['test_insert_minimal'] = {
      ok:    !insErr,
      error: insErr?.message ?? null,
      hint:  insErr?.hint ?? null,
    };

    // Nettoyage immédiat
    if (ins?.id) {
      await admin.from('invoices').delete().eq('id', ins.id);
    }
  } else {
    results['test_insert_minimal'] = 'Skipped — no tenant or client found';
  }

  // 6. Test INSERT avec echeancier (nouvelle colonne)
  if (tenantRow && clientRow) {
    const testPayloadNew = {
      tenant_id:     tenantRow.id,
      number:        'TEST-DEBUG-002',
      type:          'facture',
      client_id:     clientRow.id,
      date_facture:  '2026-04-07',
      date_echeance: '2026-05-07',
      status:        'brouillon',
      total_ht:      0,
      total_tva:     0,
      total_ttc:     0,
      echeancier:    [],
    };
    const { data: ins2, error: insErr2 } = await admin
      .from('invoices')
      .insert(testPayloadNew)
      .select('id')
      .single();

    results['test_insert_with_echeancier'] = {
      ok:    !insErr2,
      error: insErr2?.message ?? null,
      hint:  insErr2?.hint ?? null,
    };

    if (ins2?.id) {
      await admin.from('invoices').delete().eq('id', ins2.id);
    }
  }

  // 7. Tenants existants
  const { data: tenants } = await admin.from('tenants').select('id, name').limit(10);
  results['tenants'] = tenants ?? [];

  return NextResponse.json(results, { status: 200 });
}
