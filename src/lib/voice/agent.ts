// Browser-safe — all calls go through the Next.js proxy.

export interface AgentContext {
  module:   string;  // 'Commerce', 'Projets', …
  role:     string;  // 'dirigeant', 'commercial', …
  userName: string;
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

const TOOLS = [
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
];

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: AgentContext): string {
  return `Tu es l'assistant vocal d'OxiFlow, un logiciel de gestion pour PME.
Tu parles français. Tu es efficace, direct et professionnel.
Tu peux créer des clients, des devis, des factures, des projets, des interventions et des tâches directement par commande vocale.
Quand l'utilisateur vous demande de créer quelque chose, faites-le immédiatement avec les informations fournies. Demandez les informations manquantes obligatoires si nécessaire.
Confirmez toujours l'action réalisée avec un résumé court (1 à 2 phrases maximum).
Formatez les montants en euros. Utilisez le vouvoiement.
Module actif : ${ctx.module}.
Utilisateur : ${ctx.userName} (rôle : ${ctx.role}).`;
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
        max_tokens: 1024,
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
