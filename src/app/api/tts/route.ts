// API route — proxy ElevenLabs TTS
// POST { text: string } → audio/mpeg

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID           = process.env.ELEVENLABS_VOICE_ID;

// ── Rate limit : 30 req/min par userId (mémoire) ──────────────────────────────

const TTS_WINDOW_MS = 60_000;
const TTS_MAX_REQ   = 30;
const ttsRequests   = new Map<string, number[]>();

function checkTtsRateLimit(userId: string): boolean {
  const now  = Date.now();
  const hits = (ttsRequests.get(userId) ?? []).filter((t) => now - t < TTS_WINDOW_MS);
  if (hits.length >= TTS_MAX_REQ) return false;
  hits.push(now);
  ttsRequests.set(userId, hits);
  return true;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  // ── 2. Rate limit ──────────────────────────────────────────────────────────
  if (!checkTtsRateLimit(user.id)) {
    return NextResponse.json(
      { error: 'Trop de requêtes TTS. Réessayez dans une minute.' },
      { status: 429 },
    );
  }

  // ── 3. Config ElevenLabs ───────────────────────────────────────────────────
  if (!ELEVENLABS_API_KEY || !VOICE_ID) {
    console.error('[/api/tts] ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID manquant');
    return NextResponse.json({ error: 'ElevenLabs non configuré.' }, { status: 503 });
  }

  // ── 4. Parse body ──────────────────────────────────────────────────────────
  let text: string;
  try {
    const body = await req.json();
    text = (body.text ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'Body JSON invalide.' }, { status: 400 });
  }

  if (!text) {
    return NextResponse.json({ error: 'Texte vide.' }, { status: 400 });
  }

  const safeText = text.slice(0, 500);

  // ── 5. Appel ElevenLabs ────────────────────────────────────────────────────
  console.log(`[/api/tts] Appel ElevenLabs — voice=${VOICE_ID} len=${safeText.length}`);

  let elRes: Response;
  try {
    elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method:  'POST',
        headers: {
          'Accept':       'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key':   ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: safeText,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability:        0.5,
            similarity_boost: 0.75,
            style:            0.0,
            use_speaker_boost: true,
          },
        }),
      },
    );
  } catch (fetchErr) {
    console.error('[/api/tts] fetch ElevenLabs échoué (réseau):', fetchErr);
    return NextResponse.json({ error: 'Erreur réseau ElevenLabs.' }, { status: 502 });
  }

  console.log(`[/api/tts] ElevenLabs réponse: status=${elRes.status} content-type=${elRes.headers.get('content-type')}`);

  if (!elRes.ok) {
    const errText = await elRes.text().catch(() => '');
    console.error('[/api/tts] ElevenLabs error:', elRes.status, errText.slice(0, 300));
    return NextResponse.json(
      { error: `ElevenLabs error ${elRes.status}`, detail: errText.slice(0, 200) },
      { status: 502 },
    );
  }

  const audioBuffer = await elRes.arrayBuffer();
  console.log(`[/api/tts] Audio reçu: ${audioBuffer.byteLength} bytes`);

  if (audioBuffer.byteLength < 100) {
    console.error('[/api/tts] Buffer audio trop petit:', audioBuffer.byteLength);
    return NextResponse.json({ error: 'Audio vide reçu d\'ElevenLabs.' }, { status: 502 });
  }

  return new NextResponse(audioBuffer, {
    status: 200,
    headers: {
      'Content-Type':   'audio/mpeg',
      'Content-Length': String(audioBuffer.byteLength),
      'Cache-Control':  'no-store',
    },
  });
}
