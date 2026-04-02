// Endpoint de diagnostic ElevenLabs — GET /api/tts/test
// Vérifie la config et fait un appel réel vers ElevenLabs.
// À supprimer après validation en prod.

import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  const result: Record<string, unknown> = {
    apiKeyPresent:  !!apiKey,
    apiKeyPrefix:   apiKey  ? `${apiKey.substring(0, 8)}...`  : 'MISSING',
    voiceIdPresent: !!voiceId,
    voiceId:        voiceId ?? 'MISSING',
  };

  if (!apiKey || !voiceId) {
    return NextResponse.json({ ...result, error: 'Variables d\'environnement manquantes' }, { status: 500 });
  }

  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method:  'POST',
        headers: {
          'Accept':       'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key':   apiKey,
        },
        body: JSON.stringify({
          text:     'Test OxiFlow.',
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.5, similarity_boost: 1.0 },
        }),
      },
    );

    const contentType   = resp.headers.get('content-type');
    const contentLength = resp.headers.get('content-length');

    Object.assign(result, {
      elevenLabsStatus: resp.status,
      elevenLabsOk:     resp.ok,
      contentType,
      contentLength,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      Object.assign(result, { elevenLabsError: errText.slice(0, 300) });
    } else {
      const buf = await resp.arrayBuffer();
      Object.assign(result, { audioBytes: buf.byteLength });
    }
  } catch (e) {
    Object.assign(result, { elevenLabsError: (e as Error).message });
  }

  return NextResponse.json(result);
}
