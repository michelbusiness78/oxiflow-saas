// Browser-only — never import at the top level of a server module.
// ElevenLabs TTS (via /api/tts) with Web Speech API fallback.
// Sentence-level streaming: each sentence prefetches while the previous plays.

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// ── Clean markdown for speech ─────────────────────────────────────────────────

function cleanForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, 'bloc de code.')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/#+\s/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();
}

// ── Split text into sentences ─────────────────────────────────────────────────

function splitSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  const raw = text.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  // Merge very short fragments (< 8 chars) with the next sentence to avoid
  // overly small ElevenLabs requests
  const merged: string[] = [];
  for (const s of raw) {
    if (merged.length > 0 && merged[merged.length - 1].length < 8) {
      merged[merged.length - 1] += ' ' + s;
    } else {
      merged.push(s);
    }
  }
  return merged.length > 0 ? merged : [text];
}

// ── Web Speech API fallback ───────────────────────────────────────────────────

function speakWebSpeech(
  text:    string,
  volume:  number,
  rate:    number,
  onStart: (() => void) | undefined,
  onEnd:   (() => void) | undefined,
): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  const utterance  = new SpeechSynthesisUtterance(text);
  utterance.lang   = 'fr-FR';
  utterance.volume = volume;
  utterance.rate   = rate;
  utterance.pitch  = 1;

  const pickFrVoice = () => {
    const voices = speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang === 'fr-FR' && !v.localService) ??
      voices.find((v) => v.lang === 'fr-FR') ??
      voices.find((v) => v.lang.startsWith('fr'))
    );
  };
  const frVoice = pickFrVoice();
  if (frVoice) utterance.voice = frVoice;

  if (speechSynthesis.paused) speechSynthesis.resume();

  utterance.onstart  = () => onStart?.();
  utterance.onend    = () => onEnd?.();
  utterance.onerror  = () => onEnd?.();

  speechSynthesis.speak(utterance);
}

// ── TTSOptions ────────────────────────────────────────────────────────────────

export interface TTSOptions {
  volume?:      number;   // 0–1, default 0.9
  rate?:        number;   // 0.1–10, default 1 (fallback Web Speech only)
  onStart?:     () => void;
  onEnd?:       () => void;
  onGenerating?: () => void;  // called while ElevenLabs request is in-flight
}

// ── TTSQueue ──────────────────────────────────────────────────────────────────

export class TTSQueue {
  private queue:   string[]  = [];
  private running: boolean   = false;
  private volume:  number;
  private rate:    number;
  private onStart?:      () => void;
  private onEnd?:        () => void;
  private onGenerating?: () => void;

  private audioEl:  HTMLAudioElement | null = null;
  private audioUrl: string | null = null;

  // Prefetch cache: text → Promise<Blob | null>
  // Filled eagerly as sentences are enqueued so fetch overlaps with playback.
  private prefetch = new Map<string, Promise<Blob | null>>();

  constructor(opts: TTSOptions = {}) {
    this.volume       = opts.volume       ?? 0.9;
    this.rate         = opts.rate         ?? 1.0;
    this.onStart      = opts.onStart;
    this.onEnd        = opts.onEnd;
    this.onGenerating = opts.onGenerating;
  }

  // ── enqueue ─────────────────────────────────────────────────────────────────

  enqueue(text: string) {
    const clean = cleanForSpeech(text);
    if (!clean) return;

    // Split into sentences and prefetch all of them in parallel immediately.
    // By the time the first sentence finishes playing, later ones are ready.
    const sentences = splitSentences(clean);
    for (const s of sentences) {
      if (!this.prefetch.has(s)) {
        this.prefetch.set(s, this.fetchAudio(s));
      }
      this.queue.push(s);
    }

    if (!this.running) this.flush();
  }

  // ── fetchAudio ──────────────────────────────────────────────────────────────

  private async fetchAudio(text: string): Promise<Blob | null> {
    try {
      const res = await fetch('/api/tts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      });

      console.log(`[TTS] fetchAudio status=${res.status} content-type=${res.headers.get('content-type')}`);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('[TTS] /api/tts error:', res.status, errData);
        return null;
      }

      const ct = res.headers.get('content-type') ?? '';
      if (!ct.includes('audio')) {
        console.error('[TTS] content-type inattendu (pas audio):', ct);
        return null;
      }

      const blob = await res.blob();
      console.log(`[TTS] blob reçu: ${blob.size} bytes type=${blob.type}`);

      if (blob.size < 100) {
        console.error('[TTS] blob trop petit, probablement vide:', blob.size);
        return null;
      }

      return blob;
    } catch (err) {
      console.error('[TTS] fetchAudio exception:', err);
      return null;
    }
  }

  // ── flush ───────────────────────────────────────────────────────────────────

  private async flush() {
    if (!this.queue.length) { this.running = false; return; }
    this.running = true;

    const text = this.queue.shift()!;
    const isFirst = !this.audioEl && this.queue.length === 0;
    void isFirst; // used only conceptually

    // Signal "generating" while waiting (only relevant if cache miss)
    this.onGenerating?.();

    // Await the pre-fetched blob (already in-flight since enqueue)
    const blob = await (this.prefetch.get(text) ?? this.fetchAudio(text));
    this.prefetch.delete(text);

    if (blob) {
      // ── ElevenLabs path ──────────────────────────────────────────────────
      console.log('[TTS] ✅ Lecture ElevenLabs');
      const url   = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume  = this.volume;
      this.audioEl  = audio;
      this.audioUrl = url;

      audio.onplay = () => { this.onStart?.(); };

      await new Promise<void>((resolve) => {
        audio.onended = () => { this.revoke(); resolve(); };
        audio.onerror = (e) => {
          console.error('[TTS] Audio playback error:', e);
          this.revoke(); resolve();
        };
        audio.play().catch((e) => {
          console.error('[TTS] audio.play() rejeté (autoplay bloqué ?):', e);
          this.revoke(); resolve();
        });
      });
    } else {
      // ── Web Speech API fallback ───────────────────────────────────────────
      console.warn('[TTS] ⚠️ Fallback Web Speech API');
      await new Promise<void>((resolve) => {
        speakWebSpeech(
          text,
          this.volume,
          this.rate,
          () => this.onStart?.(),
          () => resolve(),
        );
      });
    }

    // ── Next segment ──────────────────────────────────────────────────────
    if (this.queue.length > 0) {
      this.flush();
    } else {
      this.running = false;
      this.onEnd?.();
    }
  }

  // ── revoke ──────────────────────────────────────────────────────────────────

  private revoke() {
    if (this.audioUrl) { URL.revokeObjectURL(this.audioUrl); this.audioUrl = null; }
    this.audioEl = null;
  }

  // ── stop ────────────────────────────────────────────────────────────────────

  stop() {
    this.queue   = [];
    this.running = false;
    this.prefetch.clear();

    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.revoke();
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }

  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }
  setRate(r: number)   { this.rate   = Math.max(0.1, Math.min(10, r)); }
  isSpeaking()         { return this.running; }
}
