// API route — proxy ElevenLabs TTS
// POST { text: string } → audio/mpeg

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID           = process.env.ELEVENLABS_VOICE_ID;

// ── Rate limit : 30 req/min par userId (mémoire) ──────────────────────────────

const TTS_WINDOW_MS  = 60_000;
const TTS_MAX_REQ    = 30;
const ttsRequests    = new Map<string, number[]>();

function checkTtsRateLimit(userId: string): boolean {
  const now  = Date.now();
  const hits  = (ttsRequests.get(userId) ?? []).filter((t) => now - t < TTS_WINDOW_MS);
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
    return NextResponse.json(
      { error: 'ElevenLabs non configuré.' },
      { status: 503 },
    );
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

  // Truncate to ElevenLabs limit (5 000 chars for free / 50 000 for paid)
  const safeText = text.slice(0, 4500);

  // ── 5. Appel ElevenLabs ────────────────────────────────────────────────────
  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?optimize_streaming_latency=2`,
    {
      method:  'POST',
      headers: {
        'xi-api-key':   ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text:     safeText,
        model_id: 'eleven_flash_v2_5',
        voice_settings: {
          stability:        0.65,
          similarity_boost: 0.85,
          style:            0.3,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!elRes.ok) {
    const errText = await elRes.text().catch(() => '');
    console.error('[/api/tts] ElevenLabs error:', elRes.status, errText);
    return NextResponse.json(
      { error: `ElevenLabs error ${elRes.status}` },
      { status: 502 },
    );
  }

  const audioBuffer = await elRes.arrayBuffer();

  return new NextResponse(audioBuffer, {
    status:  200,
    headers: {
      'Content-Type':  'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
