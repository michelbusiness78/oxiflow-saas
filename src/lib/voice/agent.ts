// Browser-safe — all calls go through the Next.js proxy.

export interface AgentContext {
  module:      string;  // 'Commerce', 'Projets', …
  role:        string;  // 'dirigeant', 'commercial', …
  userName:    string;
  companies?:  { id: string; name: string }[];
  clients?:    { id: string; name: string }[];
  technicians?: { id: string; name: string }[];
}

// ── Message types (Anthropic format) ──────────────────────────────────────────

type TextBlock       = { type: 'text';        text: string };
type ToolUseBlock    = { type: 'tool_use';    id: string; name: string; input: Record<string, unknown> };
type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string };
type ContentBlock    = TextBlock | ToolUseBlock | ToolResultBlock;

export type AgentMessage = {
  role:    'user' | 'assistant';
  content: string | ContentBlock[];
};

// ── Tool definitions ──────────────────────────────────────────────────────────

export const TOOLS = [
  // ── Actions directes ──────────────────────────────────────────────────────
  {
    name:        'creer_client',
    description: 'Crée un nouveau client directement en base de données',
    input_schema: {
      type: 'object' as const,
      properties: {
        nom:     { type: 'string', description: 'Nom du client (obligatoire)' },
        contact: { type: 'string', description: 'Nom du contact principal' },
        tel:     { type: 'string', description: 'Téléphone' },
        email:   { type: 'string', description: 'Email' },
        adresse: { type: 'string', description: 'Adresse' },
        ville:   { type: 'string', description: 'Ville' },
        cp:      { type: 'string', description: 'Code postal' },
      },
      required: ['nom'],
    },
  },
  {
    name:        'creer_devis_complet',
    description: 'Crée un devis complet avec ses lignes directement en base. Crée le client automatiquement s\'il n\'existe pas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_nom: { type: 'string', description: 'Nom du client' },
        objet:      { type: 'string', description: 'Objet / titre du devis' },
        lignes: {
          type: 'array',
          description: 'Lignes du devis',
          items: {
            type: 'object' as const,
            properties: {
              designation:   { type: 'string', description: 'Désignation du produit ou service' },
              quantite:      { type: 'number', description: 'Quantité' },
              prix_unitaire: { type: 'number', description: 'Prix unitaire HT en euros' },
              tva:           { type: 'number', description: 'Taux TVA en % (défaut 20)' },
            },
            required: ['designation', 'quantite', 'prix_unitaire'],
          },
        },
      },
      required: ['client_nom', 'objet', 'lignes'],
    },
  },
  {
    name:        'modifier_statut_devis',
    description: 'Modifie le statut d\'un devis (brouillon → envoye → accepte / refuse)',
    input_schema: {
      type: 'object' as const,
      properties: {
        numero_devis:   { type: 'string', description: 'Numéro exact du devis (ex: DEV-MARC-2025-001)' },
        client_nom:     { type: 'string', description: 'Nom du client pour trouver son dernier devis' },
        nouveau_statut: { type: 'string', enum: ['brouillon', 'envoye', 'accepte', 'refuse'] },
      },
      required: ['nouveau_statut'],
    },
  },
  {
    name:        'creer_facture_depuis_devis',
    description: 'Crée une facture à partir d\'un devis accepté',
    input_schema: {
      type: 'object' as const,
      properties: {
        numero_devis: { type: 'string', description: 'Numéro du devis' },
        client_nom:   { type: 'string', description: 'Nom du client pour trouver son dernier devis accepté' },
      },
    },
  },
  {
    name:        'creer_projet_depuis_devis',
    description: 'Crée un projet depuis un devis accepté',
    input_schema: {
      type: 'object' as const,
      properties: {
        numero_devis: { type: 'string', description: 'Numéro du devis' },
        client_nom:   { type: 'string', description: 'Nom du client pour trouver son dernier devis accepté' },
      },
    },
  },
  {
    name:        'modifier_statut_facture',
    description: 'Modifie le statut d\'une facture (brouillon → emise → payee)',
    input_schema: {
      type: 'object' as const,
      properties: {
        numero_facture: { type: 'string', description: 'Numéro de la facture (ex: FAC-MARC-2025-001)' },
        client_nom:     { type: 'string', description: 'Nom du client pour trouver sa dernière facture' },
        nouveau_statut: { type: 'string', enum: ['brouillon', 'emise', 'payee'] },
      },
      required: ['nouveau_statut'],
    },
  },
  {
    name:        'ajouter_produit_catalogue',
    description: 'Ajoute un produit ou service au catalogue',
    input_schema: {
      type: 'object' as const,
      properties: {
        designation: { type: 'string', description: 'Nom du produit ou service (obligatoire)' },
        reference:   { type: 'string', description: 'Référence produit' },
        prix_vente:  { type: 'number', description: 'Prix de vente HT en euros' },
        type:        { type: 'string', enum: ['materiel', 'service', 'forfait'] },
        fournisseur: { type: 'string', description: 'Fournisseur' },
        categorie:   { type: 'string', description: 'Catégorie' },
        unite:       { type: 'string', description: 'Unité (ex: unité, heure, jour)' },
      },
      required: ['designation'],
    },
  },
  // ── Consultation ──────────────────────────────────────────────────────────
  {
    name:        'consulter_devis',
    description: 'Consulte les devis (par client, par numéro, ou les 5 derniers)',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_nom:   { type: 'string', description: 'Nom du client' },
        numero_devis: { type: 'string', description: 'Numéro de devis spécifique' },
        statut:       { type: 'string', enum: ['brouillon', 'envoye', 'accepte', 'refuse'] },
      },
    },
  },
  {
    name:        'consulter_factures',
    description: 'Consulte les factures avec filtres optionnels',
    input_schema: {
      type: 'object' as const,
      properties: {
        statut:     { type: 'string', enum: ['brouillon', 'emise', 'payee', 'en_retard'] },
        client_nom: { type: 'string', description: 'Filtrer par client' },
      },
    },
  },
  {
    name:        'consulter_clients',
    description: 'Consulte les clients (recherche par nom ou liste des récents)',
    input_schema: {
      type: 'object' as const,
      properties: {
        nom: { type: 'string', description: 'Nom ou partie du nom pour la recherche' },
      },
    },
  },
  {
    name:        'resume_activite',
    description: 'Résumé global : devis en cours, factures en retard, projets actifs, CA du mois',
    input_schema: { type: 'object' as const, properties: {} },
  },
  // ── Navigation ────────────────────────────────────────────────────────────
  {
    name:        'creer_intervention',
    description: 'Navigue vers le formulaire de création d\'intervention',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_nom: { type: 'string',  description: 'Nom du client' },
        type:       { type: 'string',  enum: ['installation', 'maintenance', 'depannage', 'formation'] },
        date:       { type: 'string',  description: 'Date (YYYY-MM-DD), optionnel' },
      },
      required: ['client_nom', 'type'],
    },
  },
  // ── Tâches ────────────────────────────────────────────────────────────────
  {
    name:        'planifier_tache',
    description: 'Crée une nouvelle tâche et l\'assigne si besoin',
    input_schema: {
      type: 'object' as const,
      properties: {
        titre:         { type: 'string', description: 'Titre de la tâche' },
        assigne_nom:   { type: 'string', description: 'Nom de la personne à qui assigner (optionnel)' },
        date_echeance: { type: 'string', description: 'Échéance (YYYY-MM-DD, optionnel)' },
        priorite:      { type: 'string', enum: ['faible', 'normale', 'haute', 'urgente'] },
      },
      required: ['titre'],
    },
  },
  // ── Lecture données ───────────────────────────────────────────────────────
  {
    name:        'lister_taches',
    description: 'Liste les tâches projet en cours (non terminées), triées par priorité puis échéance. Répond à : "quelles sont mes tâches", "tâches urgentes", "todo".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name:        'lister_interventions',
    description: 'Liste les interventions récentes ou planifiées avec leur statut et technicien. Répond à : "interventions en cours", "planning techniciens", "prochaines interventions".',
    input_schema: {
      type: 'object' as const,
      properties: {
        statut: { type: 'string', enum: ['planifiee', 'en_cours', 'terminee'], description: 'Filtrer par statut (optionnel)' },
      },
    },
  },
  {
    name:        'lister_projets',
    description: 'Liste les projets actifs (nouveau et en cours) avec leur montant et deadline. Répond à : "projets en cours", "état des chantiers", "mes projets".',
    input_schema: { type: 'object' as const, properties: {} },
  },
  // ── Nouvelles actions ─────────────────────────────────────────────────────
  {
    name:        'creer_ticket_sav',
    description: 'Crée un ticket SAV (support / incident / demande client)',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_nom: { type: 'string', description: 'Nom du client' },
        titre:      { type: 'string', description: 'Titre du ticket (obligatoire)' },
        description: { type: 'string', description: 'Description détaillée du problème' },
        priorite:   { type: 'string', enum: ['faible', 'normale', 'haute', 'urgente'] },
      },
      required: ['client_nom', 'titre'],
    },
  },
  {
    name:        'noter_texte',
    description: 'Note du texte dicté dans le champ actif ou le presse-papiers. Utilise cet outil quand l\'utilisateur dit "note", "écris", "mémorise" ou dicte du texte à saisir.',
    input_schema: {
      type: 'object' as const,
      properties: {
        texte: { type: 'string', description: 'Texte à noter / saisir' },
      },
      required: ['texte'],
    },
  },
  {
    name:        'creer_projet',
    description: 'Crée un nouveau projet directement (sans devis existant)',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_nom:  { type: 'string', description: 'Nom du client' },
        nom:         { type: 'string', description: 'Nom du projet (obligatoire)' },
        description: { type: 'string', description: 'Description du projet' },
        montant_ttc: { type: 'number',  description: 'Montant TTC estimé en euros' },
        deadline:    { type: 'string',  description: 'Date de livraison prévue (YYYY-MM-DD)' },
      },
      required: ['client_nom', 'nom'],
    },
  },
  {
    name:        'creer_contrat',
    description: 'Crée un contrat de maintenance ou d\'abonnement pour un client',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_nom:       { type: 'string', description: 'Nom du client' },
        nom:              { type: 'string', description: 'Nom du contrat' },
        type:             { type: 'string', enum: ['maintenance', 'abonnement', 'garantie', 'autre'] },
        montant_mensuel:  { type: 'number',  description: 'Montant mensuel en euros' },
        date_debut:       { type: 'string',  description: 'Date de début (YYYY-MM-DD)' },
        date_fin:         { type: 'string',  description: 'Date de fin (YYYY-MM-DD)' },
      },
      required: ['client_nom', 'nom', 'type'],
    },
  },
  {
    name:        'creer_avoir',
    description: 'Crée un avoir (note de crédit) sur une facture existante',
    input_schema: {
      type: 'object' as const,
      properties: {
        numero_facture: { type: 'string', description: 'Numéro de la facture à avoit (ex: FAC-MARC-2025-001)' },
        client_nom:     { type: 'string', description: 'Nom du client pour trouver sa dernière facture' },
        motif:          { type: 'string', description: 'Motif de l\'avoir' },
      },
    },
  },
  {
    name:        'cloturer_intervention',
    description: 'Clôture (termine) une intervention planifiée ou en cours',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_nom:  { type: 'string', description: 'Nom du client' },
        intervention_titre: { type: 'string', description: 'Titre ou partie du titre de l\'intervention' },
        compte_rendu: { type: 'string', description: 'Compte-rendu d\'intervention (optionnel)' },
      },
      required: ['client_nom'],
    },
  },
  {
    name:        'creer_ndf',
    description: 'Crée une note de frais (déplacement, repas, fournitures, etc.)',
    input_schema: {
      type: 'object' as const,
      properties: {
        titre:      { type: 'string', description: 'Titre / objet de la dépense (obligatoire)' },
        montant:    { type: 'number',  description: 'Montant TTC en euros (obligatoire)' },
        categorie:  { type: 'string', enum: ['deplacement', 'repas', 'hebergement', 'fournitures', 'autre'] },
        date:       { type: 'string',  description: 'Date de la dépense (YYYY-MM-DD, défaut : aujourd\'hui)' },
        notes:      { type: 'string', description: 'Notes complémentaires' },
      },
      required: ['titre', 'montant'],
    },
  },
  {
    name:        'creer_conge',
    description: 'Crée une demande de congé ou d\'absence',
    input_schema: {
      type: 'object' as const,
      properties: {
        type:        { type: 'string', enum: ['conge_paye', 'rtt', 'maladie', 'formation', 'autre'] },
        date_debut:  { type: 'string', description: 'Date de début (YYYY-MM-DD)' },
        date_fin:    { type: 'string', description: 'Date de fin (YYYY-MM-DD)' },
        notes:       { type: 'string', description: 'Motif ou notes' },
      },
      required: ['type', 'date_debut', 'date_fin'],
    },
  },
];

// ── System prompt ─────────────────────────────────────────────────────────────

const VOICE_RULES = `MODE VOCAL ACTIVÉ — Règles strictes :
- Réponds en 1 à 2 phrases MAXIMUM. Jamais plus.
- Parle comme à l'oral : court, direct, naturel.
- Pas de listes, pas de bullet points, pas de formatage.
- Pas de "Bien sûr !", "Avec plaisir !" ou formules inutiles.
- Si tu dois confirmer une action, dis juste le résultat : "C'est fait, le devis pour MDR Jolie Fleur est créé."
- Si tu as besoin d'info, pose UNE seule question.
- Limite-toi à 150 caractères si possible.`;

function buildSystemPrompt(ctx: AgentContext): string {
  const companiesSection = ctx.companies && ctx.companies.length > 0
    ? `\nSociétés disponibles : ${ctx.companies.map((c) => c.name).join(', ')}.`
    : '';

  const clientsSection = ctx.clients && ctx.clients.length > 0
    ? `\nClients actifs (${ctx.clients.length}) : ${ctx.clients.map((c) => c.name).slice(0, 20).join(', ')}${ctx.clients.length > 20 ? '…' : ''}.`
    : '';

  const techsSection = ctx.technicians && ctx.technicians.length > 0
    ? `\nTechniciens : ${ctx.technicians.map((t) => t.name).join(', ')}.`
    : '';

  return `${VOICE_RULES}

Tu es l'assistant vocal d'OxiFlow, un logiciel de gestion pour PME.
Tu parles français. Tu es efficace, direct et professionnel.

Actions disponibles :
CRÉATION : créer clients, devis, factures, projets, interventions, tâches, tickets SAV, contrats, avoirs, notes de frais, congés.
MODIFICATION : changer statut devis/facture, ajouter au catalogue, clôturer intervention.
CONSULTATION : consulter devis/factures/clients, résumé d'activité.
LECTURE : lister_taches, lister_interventions, lister_projets.
SAISIE : noter_texte (dicte du texte dans le champ actif).

Quand tu reçois des données d'un outil de lecture, formule une réponse vocale naturelle et concise.
Exemples : "Vous avez 5 tâches en cours. Les urgentes : commander le matériel Martin, relancer Durand."
           "3 interventions planifiées cette semaine. Demain : installation réseau chez Dupont avec Marc."

Formate les montants en euros. Module actif : ${ctx.module}. Utilisateur : ${ctx.userName} (rôle : ${ctx.role}).${companiesSection}${clientsSection}${techsSection}`;
}

// ── Tool callbacks ────────────────────────────────────────────────────────────

export interface ToolCallbacks {
  navigate: (path: string) => void;
}

async function callAgentToolsAPI(
  tool:  string,
  input: Record<string, unknown>,
): Promise<string> {
  try {
    const res = await fetch('/api/agent-tools', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tool, input }),
    });
    if (!res.ok) return `Erreur outil ${tool} : ${res.statusText}`;
    const data = await res.json() as { result?: string };
    return data.result ?? 'Aucun résultat.';
  } catch {
    return `Impossible d'exécuter l'outil ${tool}.`;
  }
}

async function executeTool(
  name:      string,
  input:     Record<string, unknown>,
  callbacks: ToolCallbacks,
): Promise<string> {
  // Navigation uniquement pour creer_intervention
  if (name === 'creer_intervention') {
    const client = encodeURIComponent(String(input.client_nom ?? ''));
    const type   = encodeURIComponent(String(input.type ?? 'depannage'));
    const date   = input.date ? `&date=${encodeURIComponent(String(input.date))}` : '';
    callbacks.navigate(`/technicien?new_intervention=1&client_nom=${client}&type=${type}${date}`);
    return `Formulaire d'intervention ouvert (${input.type}) pour "${input.client_nom}".`;
  }

  // noter_texte : client-side uniquement — remplit le champ actif ou copie dans le presse-papiers
  if (name === 'noter_texte') {
    const texte = String(input.texte ?? '');
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (active && ('value' in active) && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const start = active.selectionStart ?? active.value.length;
      const end   = active.selectionEnd   ?? active.value.length;
      active.value = active.value.slice(0, start) + texte + active.value.slice(end);
      active.dispatchEvent(new Event('input', { bubbles: true }));
      return `Texte inséré dans le champ actif.`;
    }
    try {
      await navigator.clipboard.writeText(texte);
      return `Texte copié dans le presse-papiers.`;
    } catch {
      return `Texte noté : "${texte.slice(0, 80)}${texte.length > 80 ? '…' : ''}".`;
    }
  }

  // Tous les autres outils transitent par /api/agent-tools
  return callAgentToolsAPI(name, input);
}

// ── Main agent loop ────────────────────────────────────────────────────────────

const MAX_TOOL_LOOPS = 8;

function extractText(content: ContentBlock[]): string {
  return content
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim();
}

export async function runAgentTurn(
  userText:  string,
  history:   AgentMessage[],
  context:   AgentContext,
  callbacks: ToolCallbacks,
): Promise<{ reply: string; updatedHistory: AgentMessage[] }> {
  const messages: AgentMessage[] = [
    ...history,
    { role: 'user', content: userText },
  ];

  let loopCount = 0;

  while (loopCount < MAX_TOOL_LOOPS) {
    loopCount++;

    const res = await fetch('/api/claude-proxy', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        messages,
        system:     buildSystemPrompt(context),
        tools:      TOOLS,
        max_tokens: 512,
        mode:       'voice',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(err.error ?? 'Erreur du proxy Claude.');
    }

    const data = await res.json() as {
      content:     ContentBlock[];
      stop_reason: string;
    };

    const assistantContent = data.content ?? [];
    messages.push({ role: 'assistant', content: assistantContent });

    if (data.stop_reason !== 'tool_use') {
      const reply = extractText(assistantContent);
      return { reply: reply || '…', updatedHistory: messages };
    }

    const toolUseBlocks = assistantContent.filter(
      (b): b is ToolUseBlock => b.type === 'tool_use',
    );

    const toolResults: ToolResultBlock[] = await Promise.all(
      toolUseBlocks.map(async (block) => ({
        type:        'tool_result' as const,
        tool_use_id: block.id,
        content:     await executeTool(block.name, block.input, callbacks),
      })),
    );

    messages.push({ role: 'user', content: toolResults });
  }

  return {
    reply:          'Je n\'ai pas pu terminer l\'action demandée. Réessayez.',
    updatedHistory: messages,
  };
}
