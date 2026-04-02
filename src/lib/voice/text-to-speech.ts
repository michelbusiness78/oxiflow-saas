// Browser-only — never import at the top level of a server module.
// ElevenLabs TTS (via /api/tts) with Web Speech API fallback.

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
  volume?:   number;   // 0–1, default 0.9
  rate?:     number;   // 0.1–10, default 1 (fallback Web Speech only)
  onStart?:  () => void;
  onEnd?:    () => void;
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

  // Audio element kept in a ref so we can stop mid-play
  private audioEl: HTMLAudioElement | null = null;
  private audioUrl: string | null = null;

  constructor(opts: TTSOptions = {}) {
    this.volume      = opts.volume      ?? 0.9;
    this.rate        = opts.rate        ?? 1.0;
    this.onStart     = opts.onStart;
    this.onEnd       = opts.onEnd;
    this.onGenerating = opts.onGenerating;
  }

  enqueue(text: string) {
    const clean = cleanForSpeech(text);
    if (!clean) return;
    this.queue.push(clean);
    if (!this.running) this.flush();
  }

  private async flush() {
    if (!this.queue.length) { this.running = false; return; }
    this.running = true;

    const text = this.queue.shift()!;

    // Signal "generating" to UI while waiting for ElevenLabs
    this.onGenerating?.();

    // ── Try ElevenLabs via /api/tts ───────────────────────────────────────
    let usedElevenLabs = false;
    try {
      const res = await fetch('/api/tts', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      });

      if (res.ok) {
        usedElevenLabs = true;
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);

        const audio    = new Audio(url);
        audio.volume   = this.volume;
        this.audioEl   = audio;
        this.audioUrl  = url;

        audio.onplay = () => {
          if (this.queue.length === 0) this.onStart?.();
        };

        await new Promise<void>((resolve) => {
          audio.onended = () => { this.revoke(); resolve(); };
          audio.onerror = () => { this.revoke(); resolve(); };
          audio.play().catch(() => { this.revoke(); resolve(); });
        });
      }
    } catch {
      // Network / fetch error — fall through to Web Speech
    }

    // ── Fallback: Web Speech API ──────────────────────────────────────────
    if (!usedElevenLabs && typeof window !== 'undefined') {
      await new Promise<void>((resolve) => {
        speakWebSpeech(
          text,
          this.volume,
          this.rate,
          () => { if (this.queue.length === 0) this.onStart?.(); },
          () => resolve(),
        );
      });
    }

    // ── After current segment ─────────────────────────────────────────────
    if (this.queue.length > 0) {
      this.flush();
    } else {
      this.running = false;
      this.onEnd?.();
    }
  }

  private revoke() {
    if (this.audioUrl) { URL.revokeObjectURL(this.audioUrl); this.audioUrl = null; }
    this.audioEl = null;
  }

  stop() {
    this.queue   = [];
    this.running = false;

    // Stop ElevenLabs audio
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.revoke();
    }

    // Stop Web Speech API fallback
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }

  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }
  setRate(r: number)   { this.rate   = Math.max(0.1, Math.min(10, r)); }
  isSpeaking()         { return this.running; }
}
