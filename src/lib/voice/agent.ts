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
  {
    name:        'creer_devis',
    description: 'Navigue vers le formulaire de création de devis pré-rempli',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_nom:  { type: 'string', description: 'Nom du client' },
        description: { type: 'string', description: 'Description ou objet du devis' },
      },
      required: ['client_nom'],
    },
  },
  {
    name:        'creer_intervention',
    description: 'Navigue vers le formulaire de création d\'intervention',
    input_schema: {
      type: 'object' as const,
      properties: {
        client_nom: { type: 'string',  description: 'Nom du client' },
        type:       { type: 'string',  enum: ['installation', 'maintenance', 'depannage', 'formation'], description: 'Type' },
        date:       { type: 'string',  description: 'Date (YYYY-MM-DD), optionnel' },
      },
      required: ['client_nom', 'type'],
    },
  },
  {
    name:        'consulter_kpis',
    description: 'Consulte les KPIs et statistiques du module actif',
    input_schema: { type: 'object' as const, properties: {} },
  },
  {
    name:        'rechercher_client',
    description: 'Recherche un client par nom dans la base de données',
    input_schema: {
      type: 'object' as const,
      properties: {
        nom: { type: 'string', description: 'Nom ou partie du nom du client' },
      },
      required: ['nom'],
    },
  },
  {
    name:        'planifier_tache',
    description: 'Crée une nouvelle tâche et l\'assigne si besoin',
    input_schema: {
      type: 'object' as const,
      properties: {
        titre:         { type: 'string', description: 'Titre de la tâche' },
        assigne_nom:   { type: 'string', description: 'Nom de la personne à qui assigner (optionnel)' },
        date_echeance: { type: 'string', description: 'Échéance (YYYY-MM-DD, optionnel)' },
        priorite:      { type: 'string', enum: ['faible', 'normale', 'haute', 'urgente'], description: 'Priorité, défaut normale' },
      },
      required: ['titre'],
    },
  },
];

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: AgentContext): string {
  return `Tu es l'assistant IA d'OxiFlow, un logiciel de gestion PME.
Tu répondras en français, de manière concise (1 à 3 phrases maximum pour les réponses vocales).
Module actif : ${ctx.module}.
Utilisateur : ${ctx.userName} (rôle : ${ctx.role}).

Tu peux utiliser les outils disponibles pour créer des éléments, consulter des données ou naviguer dans l'application.
Pour les demandes de création, utilise toujours l'outil approprié plutôt que de demander à l'utilisateur de le faire lui-même.
Quand tu utilises un outil de navigation (creer_devis, creer_intervention), confirme brièvement ce que tu as ouvert.`;
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
  switch (name) {
    case 'creer_devis': {
      const client = encodeURIComponent(String(input.client_nom ?? ''));
      const desc   = input.description ? `&desc=${encodeURIComponent(String(input.description))}` : '';
      callbacks.navigate(`/commerce?new_devis=1&client_nom=${client}${desc}`);
      return `Formulaire de devis ouvert pour le client "${input.client_nom}".`;
    }

    case 'creer_intervention': {
      const client = encodeURIComponent(String(input.client_nom ?? ''));
      const type   = encodeURIComponent(String(input.type ?? 'depannage'));
      const date   = input.date ? `&date=${encodeURIComponent(String(input.date))}` : '';
      callbacks.navigate(`/technicien?new_intervention=1&client_nom=${client}&type=${type}${date}`);
      return `Formulaire d'intervention ouvert (${input.type}) pour "${input.client_nom}".`;
    }

    case 'consulter_kpis':
      return await callAgentToolsAPI('consulter_kpis', input);

    case 'rechercher_client':
      return await callAgentToolsAPI('rechercher_client', input);

    case 'planifier_tache':
      return await callAgentToolsAPI('planifier_tache', input);

    default:
      return `Outil inconnu : ${name}.`;
  }
}

// ── Main agent loop ────────────────────────────────────────────────────────────

const MAX_TOOL_LOOPS = 6;

function extractText(content: ContentBlock[]): string {
  return content
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim();
}

export async function runAgentTurn(
  userText:         string,
  history:          AgentMessage[],
  context:          AgentContext,
  callbacks:        ToolCallbacks,
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

    // Add assistant turn to history
    messages.push({ role: 'assistant', content: assistantContent });

    // If no tool use → return text response
    if (data.stop_reason !== 'tool_use') {
      const reply = extractText(assistantContent);
      return { reply: reply || '…', updatedHistory: messages };
    }

    // Execute all tool_use blocks in parallel
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

  // Fallback if loop limit reached
  return {
    reply:          'Je n\'ai pas pu terminer l\'action demandée. Réessayez.',
    updatedHistory: messages,
  };
}
