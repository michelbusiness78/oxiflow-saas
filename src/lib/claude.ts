// Helper côté client pour appeler l'agent Claude via le proxy sécurisé.
// Ne contient aucune clé API — toutes les requêtes transitent par /api/claude-proxy.

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

export interface ClaudeContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ClaudeResponse {
  id:           string;
  type:         string;
  role:         'assistant';
  content:      ClaudeContentBlock[];
  model:        string;
  stop_reason:  string;
  usage: {
    input_tokens:  number;
    output_tokens: number;
  };
}

export interface ClaudeCallOptions {
  messages:   ClaudeMessage[];
  system?:    string;
  tools?:     ClaudeTool[];
  max_tokens?: number;
}

export class ClaudeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly isRateLimit = false,
  ) {
    super(message);
    this.name = 'ClaudeError';
  }
}

/**
 * Appelle l'agent Claude via le proxy sécurisé.
 * Retourne la réponse complète de l'API.
 */
export async function callClaude(options: ClaudeCallOptions): Promise<ClaudeResponse> {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch('/api/claude-proxy', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(options),
      signal:  controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ClaudeError('La requête a expiré (15s).', 504);
    }
    throw new ClaudeError('Impossible de joindre le serveur.', 0);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After');
    const msg = retryAfter
      ? `Limite atteinte. Réessayez dans ${Math.ceil(Number(retryAfter) / 60)} minute(s).`
      : 'Trop de requêtes. Réessayez plus tard.';
    throw new ClaudeError(msg, 429, true);
  }

  if (response.status === 401) {
    throw new ClaudeError('Session expirée. Veuillez vous reconnecter.', 401);
  }

  let data: ClaudeResponse & { error?: string };
  try {
    data = await response.json();
  } catch {
    throw new ClaudeError('Réponse serveur invalide.', 502);
  }

  if (!response.ok) {
    throw new ClaudeError(data.error ?? 'Erreur serveur.', response.status);
  }

  return data;
}

/**
 * Raccourci : extrait le texte brut du premier bloc "text" de la réponse.
 */
export function extractText(response: ClaudeResponse): string {
  for (const block of response.content) {
    if (block.type === 'text' && block.text) return block.text;
  }
  return '';
}

/**
 * Raccourci : extrait tous les blocs tool_use de la réponse.
 */
export function extractToolUses(response: ClaudeResponse): ClaudeContentBlock[] {
  return response.content.filter((b) => b.type === 'tool_use');
}
