import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// ── Types internes ────────────────────────────────────────────────────────────

type QuoteRowFac = {
  id: string; number: string; statut: string;
  client_id: string; conditions: string | null; lignes: unknown;
};

type QuoteRowProj = {
  id: string; number: string; statut: string; affair_number: string | null;
  objet: string | null; client_id: string | null; validity: string | null;
  montant_ttc: number; chef_projet_user_id: string | null;
  commercial_user_id: string | null; project_created: boolean;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtEur = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

const STATUT_LABELS: Record<string, string> = {
  brouillon: 'brouillon',
  envoye:    'envoyé',
  accepte:   'accepté',
  refuse:    'refusé',
  emise:     'émise',
  payee:     'payée',
  en_retard: 'en retard',
};

function nextSeq(count: number): string {
  return String((count ?? 0) + 1).padStart(3, '0');
}

function quotePrefix(name: string, year: number): string {
  const raw  = (name ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  const code = raw.slice(0, 4) || 'OXI';
  return `DEV-${code}-${year}-`;
}

function invoicePrefix(name: string, year: number): string {
  const raw  = (name ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  const code = raw.slice(0, 4) || 'OXI';
  return `FAC-${code}-${year}-`;
}

// Recherche floue d'un client — renvoie { id, nom } ou null
async function findClient(
  admin:    ReturnType<typeof createAdminClient>,
  tenantId: string,
  nom:      string,
): Promise<{ id: string; nom: string } | { multiple: string } | null> {
  const { data } = await admin
    .from('clients')
    .select('id, nom')
    .eq('tenant_id', tenantId)
    .ilike('nom', `%${nom}%`)
    .order('nom')
    .limit(5);

  if (!data || data.length === 0) return null;
  if (data.length > 1) {
    return { multiple: data.map((c) => c.nom as string).join(', ') };
  }
  return { id: data[0].id as string, nom: data[0].nom as string };
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // Profil (admin)
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, name, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profil introuvable.' }, { status: 403 });

  const tenantId  = profile.tenant_id as string;
  const userName  = (profile.name as string) ?? 'OXI';
  const year      = new Date().getFullYear();

  const body = await request.json() as { tool: string; input: Record<string, unknown> };
  const { tool, input } = body;

  // ── creer_client ──────────────────────────────────────────────────────────
  if (tool === 'creer_client') {
    const nom = String(input.nom ?? '').trim();
    if (!nom) return NextResponse.json({ result: 'Le nom du client est obligatoire.' });

    const { error } = await admin.from('clients').insert({
      tenant_id: tenantId,
      nom,
      contact: input.contact ? String(input.contact) : null,
      tel:     input.tel     ? String(input.tel)     : null,
      email:   input.email   ? String(input.email)   : null,
      adresse: input.adresse ? String(input.adresse) : null,
      ville:   input.ville   ? String(input.ville)   : null,
      cp:      input.cp      ? String(input.cp)      : null,
      actif:   true,
    });

    if (error) return NextResponse.json({ result: `Erreur création client : ${error.message}` });
    return NextResponse.json({ result: `Client "${nom}" créé avec succès.` });
  }

  // ── creer_devis_complet ───────────────────────────────────────────────────
  if (tool === 'creer_devis_complet') {
    const clientNomInput = String(input.client_nom ?? '').trim();
    const objet          = String(input.objet ?? '').trim();
    const lignesInput    = (input.lignes as Array<{
      designation:   string;
      quantite:      number;
      prix_unitaire: number;
      tva?:          number;
    }>) ?? [];

    if (!clientNomInput) return NextResponse.json({ result: 'Le nom du client est obligatoire.' });
    if (!objet)          return NextResponse.json({ result: 'L\'objet du devis est obligatoire.' });
    if (lignesInput.length === 0) return NextResponse.json({ result: 'Au moins une ligne est requise.' });

    // Trouver ou créer le client
    let clientId: string;
    let clientNom: string;

    const found = await findClient(admin, tenantId, clientNomInput);
    if (found && 'multiple' in found) {
      return NextResponse.json({ result: `Plusieurs clients correspondent à "${clientNomInput}" : ${found.multiple}. Précisez le nom.` });
    }
    if (found) {
      clientId  = found.id;
      clientNom = found.nom;
    } else {
      // Créer le client automatiquement
      const { data: newClient, error: cErr } = await admin
        .from('clients')
        .insert({ tenant_id: tenantId, nom: clientNomInput, actif: true })
        .select('id, nom')
        .single();
      if (cErr || !newClient) return NextResponse.json({ result: `Erreur création client : ${cErr?.message}` });
      clientId  = newClient.id as string;
      clientNom = newClient.nom as string;
    }

    // Numéro de devis
    const devPrefix = quotePrefix(userName, year);
    const { count }  = await admin
      .from('quotes')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .like('number', `${devPrefix}%`);
    const seq          = nextSeq(count ?? 0);
    const number       = `${devPrefix}${seq}`;
    const rawCode      = (userName ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'OXI';
    const affair_number = `AF-${rawCode}-${year}-${seq}`;

    // Calculer les lignes et totaux
    const lignes = lignesInput.map((l, i) => {
      const tva      = l.tva ?? 20;
      const total_ht = +(l.quantite * l.prix_unitaire).toFixed(2);
      return {
        id:            crypto.randomUUID(),
        reference:     '',
        designation:   l.designation,
        description:   '',
        quantite:      l.quantite,
        unite:         'unité',
        prix_unitaire: l.prix_unitaire,
        tva,
        remise_pct:    0,
        total_ht,
        sort_order:    i,
      };
    });

    const montant_ht  = +lignes.reduce((s, l) => s + l.total_ht, 0).toFixed(2);
    const tva_amount  = +lignes.reduce((s, l) => s + l.total_ht * l.tva / 100, 0).toFixed(2);
    const montant_ttc = +(montant_ht + tva_amount).toFixed(2);

    const { error: qErr } = await admin.from('quotes').insert({
      tenant_id:         tenantId,
      number,
      affair_number,
      commercial_user_id: user.id,
      client_id:         clientId,
      objet,
      date:              new Date().toISOString().split('T')[0],
      statut:            'brouillon',
      lignes,
      montant_ht,
      tva_amount,
      montant_ttc,
      deposit_percent:   0,
    });

    if (qErr) return NextResponse.json({ result: `Erreur création devis : ${qErr.message}` });
    return NextResponse.json({
      result: `Devis ${number} créé pour ${clientNom}, montant ${fmtEur(montant_ttc)}.`,
    });
  }

  // ── modifier_statut_devis ─────────────────────────────────────────────────
  if (tool === 'modifier_statut_devis') {
    const nouveauStatut = String(input.nouveau_statut ?? '');
    const validStatuts  = ['brouillon', 'envoye', 'accepte', 'refuse'];
    if (!validStatuts.includes(nouveauStatut)) {
      return NextResponse.json({ result: `Statut invalide. Valeurs acceptées : ${validStatuts.join(', ')}.` });
    }

    let quoteId: string | null   = null;
    let quoteNum: string | null  = null;

    if (input.numero_devis) {
      const { data } = await admin
        .from('quotes')
        .select('id, number, statut')
        .eq('tenant_id', tenantId)
        .eq('number', String(input.numero_devis))
        .single();
      if (data) { quoteId = data.id as string; quoteNum = data.number as string; }
    } else if (input.client_nom) {
      const found = await findClient(admin, tenantId, String(input.client_nom));
      if (found && 'multiple' in found) {
        return NextResponse.json({ result: `Plusieurs clients trouvés : ${found.multiple}. Précisez.` });
      }
      if (found) {
        const { data } = await admin
          .from('quotes')
          .select('id, number')
          .eq('tenant_id', tenantId)
          .eq('client_id', found.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (data) { quoteId = data.id as string; quoteNum = data.number as string; }
      }
    }

    if (!quoteId) return NextResponse.json({ result: 'Devis introuvable.' });

    const { error } = await admin
      .from('quotes')
      .update({ statut: nouveauStatut, updated_at: new Date().toISOString() })
      .eq('id', quoteId);

    if (error) return NextResponse.json({ result: `Erreur : ${error.message}` });
    return NextResponse.json({ result: `Devis ${quoteNum} passé en ${STATUT_LABELS[nouveauStatut] ?? nouveauStatut}.` });
  }

  // ── creer_facture_depuis_devis ────────────────────────────────────────────
  if (tool === 'creer_facture_depuis_devis') {
    // Trouver le devis
    let quoteData: QuoteRowFac | null = null;

    if (input.numero_devis) {
      const { data } = await admin
        .from('quotes')
        .select('id, number, statut, client_id, conditions, lignes')
        .eq('tenant_id', tenantId)
        .eq('number', String(input.numero_devis))
        .single();
      quoteData = data as unknown as QuoteRowFac;
    } else if (input.client_nom) {
      const found = await findClient(admin, tenantId, String(input.client_nom));
      if (found && 'multiple' in found) {
        return NextResponse.json({ result: `Plusieurs clients trouvés : ${found.multiple}. Précisez.` });
      }
      if (found) {
        const { data } = await admin
          .from('quotes')
          .select('id, number, statut, client_id, conditions, lignes')
          .eq('tenant_id', tenantId)
          .eq('client_id', found.id)
          .eq('statut', 'accepte')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        quoteData = data as unknown as QuoteRowFac;
      }
    }

    if (!quoteData) return NextResponse.json({ result: 'Devis introuvable.' });
    if (quoteData.statut !== 'accepte') {
      return NextResponse.json({ result: `Le devis ${quoteData.number} doit être accepté avant de créer une facture (statut actuel : ${STATUT_LABELS[quoteData.statut] ?? quoteData.statut}).` });
    }

    // Vérifier si une facture existe déjà
    const { data: existing } = await admin
      .from('invoices')
      .select('id, number')
      .eq('tenant_id', tenantId)
      .eq('quote_id', quoteData.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ result: `Une facture ${existing.number} existe déjà pour ce devis.` });
    }

    // Générer le numéro de facture
    const facPrefix = invoicePrefix(userName, year);
    const { count: facCount } = await admin
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .like('number', `${facPrefix}%`);
    const facNumber = `${facPrefix}${nextSeq(facCount ?? 0)}`;

    // Mapper les lignes du devis vers les lignes de facture
    const quoteLignes = (quoteData.lignes as Array<{
      reference?: string; designation: string;
      quantite: number; prix_unitaire: number; tva: number; remise_pct: number;
    }>) ?? [];

    const totalHT  = +quoteLignes.reduce((s, l) => s + l.quantite * l.prix_unitaire * (1 - l.remise_pct / 100), 0).toFixed(2);
    const totalTVA = +quoteLignes.reduce((s, l) => {
      const ht = l.quantite * l.prix_unitaire * (1 - l.remise_pct / 100);
      return s + ht * l.tva / 100;
    }, 0).toFixed(2);
    const totalTTC = +(totalHT + totalTVA).toFixed(2);

    const today    = new Date().toISOString().split('T')[0];
    const echeance = new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0];

    const { data: inv, error: invErr } = await admin
      .from('invoices')
      .insert({
        tenant_id:     tenantId,
        number:        facNumber,
        type:          'facture',
        quote_id:      quoteData.id,
        quote_number:  quoteData.number,
        client_id:     quoteData.client_id,
        date_facture:  today,
        date_echeance: echeance,
        status:        'brouillon',
        conditions:    quoteData.conditions ?? null,
        total_ht:      totalHT,
        total_tva:     totalTVA,
        total_ttc:     totalTTC,
      })
      .select('id')
      .single();

    if (invErr || !inv) return NextResponse.json({ result: `Erreur création facture : ${invErr?.message}` });

    if (quoteLignes.length > 0) {
      await admin.from('invoice_lines').insert(
        quoteLignes.map((l, i) => ({
          invoice_id:       inv.id,
          sort_order:       i,
          reference:        l.reference ?? '',
          type:             'materiel',
          designation:      l.designation,
          quantity:         l.quantite,
          unit_price:       l.prix_unitaire,
          discount_percent: l.remise_pct,
          vat_rate:         l.tva,
        })),
      );
    }

    return NextResponse.json({
      result: `Facture ${facNumber} créée depuis le devis ${quoteData.number}, montant ${fmtEur(totalTTC)}.`,
    });
  }

  // ── creer_projet_depuis_devis ─────────────────────────────────────────────
  if (tool === 'creer_projet_depuis_devis') {
    let quoteData: QuoteRowProj | null = null;

    if (input.numero_devis) {
      const { data } = await admin
        .from('quotes')
        .select('id, number, statut, affair_number, objet, client_id, validity, montant_ttc, chef_projet_user_id, commercial_user_id, project_created')
        .eq('tenant_id', tenantId)
        .eq('number', String(input.numero_devis))
        .single();
      quoteData = data as unknown as QuoteRowProj;
    } else if (input.client_nom) {
      const found = await findClient(admin, tenantId, String(input.client_nom));
      if (found && 'multiple' in found) {
        return NextResponse.json({ result: `Plusieurs clients trouvés : ${found.multiple}. Précisez.` });
      }
      if (found) {
        const { data } = await admin
          .from('quotes')
          .select('id, number, statut, affair_number, objet, client_id, validity, montant_ttc, chef_projet_user_id, commercial_user_id, project_created')
          .eq('tenant_id', tenantId)
          .eq('client_id', found.id)
          .eq('statut', 'accepte')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        quoteData = data as unknown as QuoteRowProj;
      }
    }

    if (!quoteData) return NextResponse.json({ result: 'Devis introuvable.' });
    if (quoteData.statut !== 'accepte') {
      return NextResponse.json({ result: `Le devis ${quoteData.number} doit être accepté (statut : ${STATUT_LABELS[quoteData.statut] ?? quoteData.statut}).` });
    }
    if (quoteData.project_created) {
      return NextResponse.json({ result: `Un projet existe déjà pour le devis ${quoteData.number}.` });
    }

    const baseDate = quoteData.validity ?? new Date().toISOString().split('T')[0];
    const deadline = new Date(new Date(baseDate).getTime() + 30 * 86_400_000).toISOString().split('T')[0];

    const { data: project, error: pErr } = await admin
      .from('projects')
      .insert({
        tenant_id:           tenantId,
        name:                quoteData.objet ?? `Projet ${quoteData.number}`,
        description:         `Projet créé depuis devis ${quoteData.number}`,
        client_id:           quoteData.client_id,
        quote_id:            quoteData.id,
        quote_number:        quoteData.number,
        affair_number:       quoteData.affair_number,
        chef_projet_user_id: quoteData.chef_projet_user_id,
        commercial_user_id:  quoteData.commercial_user_id,
        amount_ttc:          quoteData.montant_ttc,
        deadline,
        status:              'nouveau',
      })
      .select('id')
      .single();

    if (pErr || !project) return NextResponse.json({ result: `Erreur création projet : ${pErr?.message}` });

    // Marquer le devis
    await admin
      .from('quotes')
      .update({ project_created: true, project_id: project.id, updated_at: new Date().toISOString() })
      .eq('id', quoteData.id);

    // Notification chef de projet
    if (quoteData.chef_projet_user_id) {
      await admin.from('project_notifications').insert({
        tenant_id:  tenantId,
        project_id: project.id,
        user_id:    quoteData.chef_projet_user_id,
        type:       'new_project',
        title:      'Nouveau projet affecté',
        message:    `${quoteData.objet ?? quoteData.number} · ${fmtEur(quoteData.montant_ttc)} · Devis ${quoteData.number}`,
      });
    }

    const chefMsg = quoteData.chef_projet_user_id ? ' Le chef de projet a été notifié.' : '';
    return NextResponse.json({
      result: `Projet "${quoteData.objet ?? quoteData.number}" créé depuis le devis ${quoteData.number}.${chefMsg}`,
    });
  }

  // ── modifier_statut_facture ───────────────────────────────────────────────
  if (tool === 'modifier_statut_facture') {
    const nouveauStatut = String(input.nouveau_statut ?? '');
    const validStatuts  = ['brouillon', 'emise', 'payee'];
    if (!validStatuts.includes(nouveauStatut)) {
      return NextResponse.json({ result: `Statut invalide. Valeurs acceptées : ${validStatuts.join(', ')}.` });
    }

    let invoiceId: string | null  = null;
    let invoiceNum: string | null = null;
    let currentStatus: string    = '';

    if (input.numero_facture) {
      const { data } = await admin
        .from('invoices')
        .select('id, number, status')
        .eq('tenant_id', tenantId)
        .eq('number', String(input.numero_facture))
        .single();
      if (data) { invoiceId = data.id as string; invoiceNum = data.number as string; currentStatus = data.status as string; }
    } else if (input.client_nom) {
      const found = await findClient(admin, tenantId, String(input.client_nom));
      if (found && 'multiple' in found) {
        return NextResponse.json({ result: `Plusieurs clients trouvés : ${found.multiple}. Précisez.` });
      }
      if (found) {
        const { data } = await admin
          .from('invoices')
          .select('id, number, status')
          .eq('tenant_id', tenantId)
          .eq('client_id', found.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (data) { invoiceId = data.id as string; invoiceNum = data.number as string; currentStatus = data.status as string; }
      }
    }

    if (!invoiceId) return NextResponse.json({ result: 'Facture introuvable.' });

    // Transitions autorisées
    const allowed: Record<string, string[]> = {
      brouillon: ['emise'],
      emise:     ['payee', 'brouillon'],
      en_retard: ['payee'],
    };
    if (!allowed[currentStatus]?.includes(nouveauStatut)) {
      return NextResponse.json({ result: `Transition ${STATUT_LABELS[currentStatus] ?? currentStatus} → ${STATUT_LABELS[nouveauStatut]} non autorisée.` });
    }

    const { error } = await admin
      .from('invoices')
      .update({ status: nouveauStatut, updated_at: new Date().toISOString() })
      .eq('id', invoiceId);

    if (error) return NextResponse.json({ result: `Erreur : ${error.message}` });
    return NextResponse.json({ result: `Facture ${invoiceNum} marquée comme ${STATUT_LABELS[nouveauStatut] ?? nouveauStatut}.` });
  }

  // ── ajouter_produit_catalogue ─────────────────────────────────────────────
  if (tool === 'ajouter_produit_catalogue') {
    const designation = String(input.designation ?? '').trim();
    if (!designation) return NextResponse.json({ result: 'La désignation est obligatoire.' });

    const prixVente = input.prix_vente ? Number(input.prix_vente) : null;

    const { error } = await admin.from('catalogue').insert({
      tenant_id:   tenantId,
      designation,
      ref:         input.reference  ? String(input.reference)  : null,
      prix_vente:  prixVente,
      type:        input.type       ? String(input.type)       : 'materiel',
      fournisseur: input.fournisseur ? String(input.fournisseur) : null,
      categorie:   input.categorie  ? String(input.categorie)  : null,
      unite:       input.unite      ? String(input.unite)      : 'unité',
      actif:       true,
    });

    if (error) return NextResponse.json({ result: `Erreur ajout catalogue : ${error.message}` });
    const prixStr = prixVente != null ? ` à ${fmtEur(prixVente)}` : '';
    return NextResponse.json({ result: `Produit "${designation}"${prixStr} ajouté au catalogue.` });
  }

  // ── consulter_devis ───────────────────────────────────────────────────────
  if (tool === 'consulter_devis') {
    let query = admin
      .from('quotes')
      .select('number, objet, statut, montant_ttc, date, clients(nom)')
      .eq('tenant_id', tenantId);

    if (input.numero_devis) {
      query = query.eq('number', String(input.numero_devis));
    } else if (input.client_nom) {
      const found = await findClient(admin, tenantId, String(input.client_nom));
      if (!found) return NextResponse.json({ result: `Aucun client trouvé pour "${input.client_nom}".` });
      if ('multiple' in found) return NextResponse.json({ result: `Plusieurs clients : ${found.multiple}. Précisez.` });
      query = query.eq('client_id', found.id);
    }

    if (input.statut) query = query.eq('statut', String(input.statut));

    const { data } = await query.order('created_at', { ascending: false }).limit(5);
    if (!data || data.length === 0) return NextResponse.json({ result: 'Aucun devis trouvé.' });

    const lines = data.map((q) => {
      const clientNom = (q.clients as unknown as { nom: string } | null)?.nom ?? '—';
      return `${q.number} · ${clientNom} · ${q.objet ?? '—'} · ${fmtEur(q.montant_ttc as number)} · ${STATUT_LABELS[q.statut as string] ?? q.statut}`;
    });

    return NextResponse.json({ result: `${data.length} devis : ${lines.join(' | ')}.` });
  }

  // ── consulter_factures ────────────────────────────────────────────────────
  if (tool === 'consulter_factures') {
    const today = new Date().toISOString().split('T')[0];
    let query = admin
      .from('invoices')
      .select('number, status, total_ttc, date_echeance, clients(nom)')
      .eq('tenant_id', tenantId);

    if (input.statut) {
      if (input.statut === 'en_retard') {
        query = query.eq('status', 'emise').lt('date_echeance', today);
      } else {
        query = query.eq('status', String(input.statut));
      }
    }

    if (input.client_nom) {
      const found = await findClient(admin, tenantId, String(input.client_nom));
      if (!found) return NextResponse.json({ result: `Aucun client trouvé pour "${input.client_nom}".` });
      if ('multiple' in found) return NextResponse.json({ result: `Plusieurs clients : ${found.multiple}. Précisez.` });
      query = query.eq('client_id', found.id);
    }

    const { data } = await query.order('date_facture', { ascending: false }).limit(10);
    if (!data || data.length === 0) return NextResponse.json({ result: 'Aucune facture trouvée.' });

    const total = data.reduce((s, f) => s + Number(f.total_ttc ?? 0), 0);

    if (data.length <= 3) {
      const lines = data.map((f) => {
        const clientNom = (f.clients as unknown as { nom: string } | null)?.nom ?? '—';
        const retard    = f.status === 'emise' && f.date_echeance && (f.date_echeance as string) < today;
        const statut    = retard ? 'en retard' : (STATUT_LABELS[f.status as string] ?? f.status);
        return `${f.number} · ${clientNom} · ${fmtEur(Number(f.total_ttc))} · ${statut}`;
      });
      return NextResponse.json({ result: `${data.length} facture(s), total ${fmtEur(total)} : ${lines.join(' | ')}.` });
    }

    return NextResponse.json({ result: `${data.length} factures trouvées pour un total de ${fmtEur(total)}.` });
  }

  // ── consulter_clients ─────────────────────────────────────────────────────
  if (tool === 'consulter_clients') {
    const nom = input.nom ? String(input.nom).trim() : null;

    let query = admin
      .from('clients')
      .select('nom, contact, tel, ville, actif', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    if (nom) {
      query = query.ilike('nom', `%${nom}%`);
    }

    const { data, count } = await query
      .order('nom')
      .limit(5);

    if (!data || data.length === 0) {
      return NextResponse.json({ result: nom ? `Aucun client trouvé pour "${nom}".` : 'Aucun client enregistré.' });
    }

    const list = data.map((c) =>
      `${c.nom}${c.ville ? ` (${c.ville})` : ''}${c.tel ? ` — ${c.tel}` : ''}`,
    ).join(' | ');

    if (!nom && (count ?? 0) > 5) {
      return NextResponse.json({ result: `${count} clients au total. Les 5 premiers : ${list}.` });
    }

    return NextResponse.json({ result: `${data.length} client(s) : ${list}.` });
  }

  // ── resume_activite ───────────────────────────────────────────────────────
  if (tool === 'resume_activite') {
    const today     = new Date().toISOString().split('T')[0];
    const moisDebut = `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;

    const [devisRes, facRes, projRes] = await Promise.all([
      admin
        .from('quotes')
        .select('statut, montant_ttc')
        .eq('tenant_id', tenantId),
      admin
        .from('invoices')
        .select('status, total_ttc, date_echeance, date_facture')
        .eq('tenant_id', tenantId),
      admin
        .from('projects')
        .select('status')
        .eq('tenant_id', tenantId)
        .in('status', ['nouveau', 'en_cours']),
    ]);

    const devis    = devisRes.data  ?? [];
    const factures = facRes.data    ?? [];
    const projets  = projRes.data   ?? [];

    const devisEnAttente = devis.filter((d) => d.statut === 'envoye');
    const montantDevis   = devisEnAttente.reduce((s, d) => s + Number(d.montant_ttc ?? 0), 0);

    const facturesEnRetard = factures.filter(
      (f) => f.status === 'emise' && f.date_echeance && (f.date_echeance as string) < today,
    );
    const montantRetard = facturesEnRetard.reduce((s, f) => s + Number(f.total_ttc ?? 0), 0);

    const caMois = factures
      .filter((f) => f.status === 'payee' && f.date_facture && (f.date_facture as string) >= moisDebut)
      .reduce((s, f) => s + Number(f.total_ttc ?? 0), 0);

    return NextResponse.json({
      result:
        `Vous avez ${devisEnAttente.length} devis en attente de réponse pour ${fmtEur(montantDevis)}, ` +
        `${facturesEnRetard.length} facture(s) en retard (${fmtEur(montantRetard)}), ` +
        `${projets.length} projet(s) actif(s). ` +
        `CA du mois : ${fmtEur(caMois)}.`,
    });
  }

  // ── planifier_tache ───────────────────────────────────────────────────────
  if (tool === 'planifier_tache') {
    const titre         = String(input.titre ?? '').trim();
    const assigne_nom   = input.assigne_nom   ? String(input.assigne_nom).trim()   : null;
    const date_echeance = input.date_echeance ? String(input.date_echeance).trim() : null;
    const priorite      = (['faible', 'normale', 'haute', 'urgente'].includes(String(input.priorite)))
      ? String(input.priorite) : 'normale';

    if (!titre) return NextResponse.json({ result: 'Titre de tâche manquant.' });

    let assigne_a: string | null = null;
    if (assigne_nom) {
      const { data: found } = await admin
        .from('users')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .ilike('name', `%${assigne_nom}%`)
        .limit(1)
        .single();
      if (found) assigne_a = found.id as string;
    }

    const { error } = await admin.from('project_tasks').insert({
      tenant_id:  tenantId,
      project_id: null,
      name:       titre,
      done:       false,
      due:        date_echeance || null,
      priority:   priorite === 'urgente' || priorite === 'haute' ? 'high'
                : priorite === 'faible' ? 'low' : 'mid',
    });

    if (error) return NextResponse.json({ result: `Erreur création tâche : ${error.message}` });

    const who  = assigne_nom   ? ` assignée à ${assigne_nom}` : '';
    const when = date_echeance ? ` pour le ${new Date(date_echeance).toLocaleDateString('fr-FR')}` : '';
    return NextResponse.json({ result: `Tâche "${titre}" créée${who}${when}.` });
  }

  // ── lister_taches ─────────────────────────────────────────────────────────
  if (tool === 'lister_taches') {
    const { data } = await admin
      .from('project_tasks')
      .select('name, done, due, priority, projects(name)')
      .eq('tenant_id', tenantId)
      .eq('done', false)
      .order('priority')
      .order('due', { ascending: true, nullsFirst: false })
      .limit(20);

    if (!data || data.length === 0) {
      return NextResponse.json({ result: 'Aucune tâche en cours.' });
    }

    const PRIO: Record<string, string> = { high: 'urgente', mid: 'normale', low: 'faible' };
    const lines = data.map((t) => {
      const proj  = (t.projects as unknown as { name: string } | null)?.name ?? '';
      const prio  = PRIO[t.priority as string] ?? t.priority;
      const echeance = t.due
        ? ` (échéance ${new Date(t.due + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })})`
        : '';
      return `${t.name}${proj ? ` [${proj}]` : ''} — ${prio}${echeance}`;
    });

    const urgentes = data.filter((t) => t.priority === 'high').length;
    const intro    = urgentes > 0
      ? `${data.length} tâche(s) en cours dont ${urgentes} urgente(s).`
      : `${data.length} tâche(s) en cours.`;

    return NextResponse.json({ result: `${intro} ${lines.slice(0, 5).join(' | ')}.` });
  }

  // ── lister_interventions ──────────────────────────────────────────────────
  if (tool === 'lister_interventions') {
    const statutFilter = input.statut ? String(input.statut) : null;

    let query = admin
      .from('interventions')
      .select('title, date_start, status, client_name, tech_name, nature, urgency')
      .eq('tenant_id', tenantId)
      .order('date_start', { ascending: false })
      .limit(10);

    if (statutFilter) {
      query = query.eq('status', statutFilter);
    } else {
      // Par défaut : planifiées + en cours
      query = query.in('status', ['planifiee', 'en_cours']);
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      return NextResponse.json({ result: 'Aucune intervention trouvée.' });
    }

    const STATUS_FR: Record<string, string> = {
      planifiee: 'planifiée',
      en_cours:  'en cours',
      terminee:  'terminée',
      annulee:   'annulée',
    };

    const lines = data.map((i) => {
      const date   = new Date(i.date_start as string).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      const tech   = i.tech_name ? ` — ${i.tech_name}` : '';
      const client = i.client_name ? ` chez ${i.client_name}` : '';
      const statut = STATUS_FR[i.status as string] ?? (i.status as string);
      return `${i.title}${client} le ${date}${tech} (${statut})`;
    });

    return NextResponse.json({ result: `${data.length} intervention(s) : ${lines.join(' | ')}.` });
  }

  // ── lister_projets ────────────────────────────────────────────────────────
  if (tool === 'lister_projets') {
    const { data } = await admin
      .from('projects')
      .select('name, status, deadline, amount_ttc, affair_number, clients(nom)')
      .eq('tenant_id', tenantId)
      .in('status', ['nouveau', 'en_cours'])
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(10);

    if (!data || data.length === 0) {
      return NextResponse.json({ result: 'Aucun projet actif.' });
    }

    const STATUS_FR: Record<string, string> = { nouveau: 'nouveau', en_cours: 'en cours' };

    const lines = data.map((p) => {
      const client   = (p.clients as unknown as { nom: string } | null)?.nom ?? '';
      const statut   = STATUS_FR[p.status as string] ?? (p.status as string);
      const deadline = p.deadline
        ? ` — livraison ${new Date(p.deadline as string + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
        : '';
      const montant  = p.amount_ttc ? ` ${fmtEur(p.amount_ttc as number)}` : '';
      return `${p.name}${client ? ` (${client})` : ''}${montant}${deadline} [${statut}]`;
    });

    return NextResponse.json({ result: `${data.length} projet(s) actif(s) : ${lines.join(' | ')}.` });
  }

  return NextResponse.json({ error: 'Outil inconnu.' }, { status: 400 });
}
