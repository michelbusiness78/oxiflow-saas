import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limit';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL     = 'claude-sonnet-4-6';
const ANTHROPIC_VERSION = '2023-06-01';
const REQUEST_TIMEOUT_MS = 30_000;

// Uniquement POST
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: NextRequest) {
  // ── 1. Authentification ────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: 'Non authentifié.' },
      { status: 401 },
    );
  }

  // ── 2. Rate limiting ───────────────────────────────────────────────────────
  const rateLimit = checkRateLimit(user.id);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez dans une heure.' },
      {
        status: 429,
        headers: {
          'Retry-After':         String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit':   '50',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset':   String(rateLimit.resetAt),
        },
      },
    );
  }

  // ── 3. Récupère le tenant_id (non-bloquant — sert uniquement au logging) ──
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  const tenant_id: string | null = profile?.tenant_id ?? null;

  // ── 4. Parse et valide le body entrant ────────────────────────────────────
  let body: {
    messages: unknown[];
    system?: string;
    tools?: unknown[];
    max_tokens?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: 'Le champ "messages" est requis et ne peut pas être vide.' },
      { status: 400 },
    );
  }

  // ── 5. Vérifie la clé API ──────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[claude-proxy] ANTHROPIC_API_KEY manquante');
    return NextResponse.json(
      { error: 'Configuration serveur incorrecte.' },
      { status: 500 },
    );
  }

  // ── 6. Forward vers l'API Anthropic ───────────────────────────────────────
  const anthropicPayload: Record<string, unknown> = {
    model:      DEFAULT_MODEL,
    max_tokens: body.max_tokens ?? 1024,
    messages:   body.messages,
  };
  if (body.system)  anthropicPayload.system = body.system;
  if (body.tools?.length) anthropicPayload.tools = body.tools;

  let anthropicResponse: Response;
  try {
    anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body:   JSON.stringify(anthropicPayload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'TimeoutError';
    console.error('[claude-proxy] fetch error:', err);
    return NextResponse.json(
      { error: isTimeout ? 'Délai d\'attente dépassé.' : 'Erreur de connexion à l\'API.' },
      { status: 504 },
    );
  }

  // ── 7. Parse la réponse Anthropic ─────────────────────────────────────────
  let anthropicData: {
    id?: string;
    content?: unknown[];
    usage?: { input_tokens: number; output_tokens: number };
    error?: { message: string };
  };

  try {
    anthropicData = await anthropicResponse.json();
  } catch {
    return NextResponse.json(
      { error: 'Réponse invalide de l\'API Anthropic.' },
      { status: 502 },
    );
  }

  if (!anthropicResponse.ok) {
    console.error('[claude-proxy] Anthropic error:', anthropicData.error);
    return NextResponse.json(
      { error: anthropicData.error?.message ?? 'Erreur API Anthropic.' },
      { status: anthropicResponse.status },
    );
  }

  // ── 8. Log de l'usage (non-bloquant) ──────────────────────────────────────
  const tokensIn  = anthropicData.usage?.input_tokens  ?? 0;
  const tokensOut = anthropicData.usage?.output_tokens ?? 0;

  // Fire-and-forget avec admin client (contourne la policy no_client_insert)
  createAdminClient().then((admin) =>
  admin
    .from('api_usage')
    .insert({
      tenant_id,
      user_id:    user.id,
      tokens_in:  tokensIn,
      tokens_out: tokensOut,
      model:      DEFAULT_MODEL,
    })
    .then(({ error }) => {
      if (error) console.error('[claude-proxy] log usage error:', error.message);
    })
  );

  // ── 9. Retourne la réponse au client ──────────────────────────────────────
  return NextResponse.json(anthropicData, {
    status: 200,
    headers: {
      'X-RateLimit-Remaining': String(rateLimit.remaining),
      'X-RateLimit-Reset':     String(rateLimit.resetAt),
    },
  });
}
