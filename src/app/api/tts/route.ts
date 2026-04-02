// API route — proxy ElevenLabs TTS
// POST { text: string } → audio/mpeg

import { NextRequest, NextResponse } from 'next/server';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID           = process.env.ELEVENLABS_VOICE_ID;

export async function POST(req: NextRequest) {
  if (!ELEVENLABS_API_KEY || !VOICE_ID) {
    return NextResponse.json(
      { error: 'ElevenLabs non configuré.' },
      { status: 503 },
    );
  }

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

  const elRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method:  'POST',
      headers: {
        'xi-api-key':   ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        'Accept':       'audio/mpeg',
      },
      body: JSON.stringify({
        text:           safeText,
        model_id:       'eleven_multilingual_v2',
        voice_settings: {
          stability:       0.5,
          similarity_boost: 0.75,
          style:           0.5,
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
