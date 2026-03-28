// Browser-only — never import at the top level of a server module.

export function isTTSSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Strip markdown so TTS reads cleanly
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

export interface TTSOptions {
  volume?:   number;  // 0–1, default 0.9
  rate?:     number;  // 0.1–10, default 1
  onStart?:  () => void;
  onEnd?:    () => void;
}

export class TTSQueue {
  private queue:   string[]  = [];
  private running: boolean   = false;
  private volume:  number;
  private rate:    number;
  private onStart?: () => void;
  private onEnd?:   () => void;

  constructor(opts: TTSOptions = {}) {
    this.volume  = opts.volume  ?? 0.9;
    this.rate    = opts.rate    ?? 1.05;
    this.onStart = opts.onStart;
    this.onEnd   = opts.onEnd;
  }

  enqueue(text: string) {
    if (!isTTSSupported()) return;
    const clean = cleanForSpeech(text);
    if (!clean) return;
    this.queue.push(clean);
    if (!this.running) this.flush();
  }

  private flush() {
    if (!this.queue.length) { this.running = false; return; }
    this.running = true;

    const text      = this.queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang   = 'fr-FR';
    utterance.volume = this.volume;
    utterance.rate   = this.rate;
    utterance.pitch  = 1;

    // Prefer a local French voice over a Google/cloud one (lower latency)
    const voices = speechSynthesis.getVoices();
    const frVoice =
      voices.find((v) => v.lang === 'fr-FR' && v.localService) ??
      voices.find((v) => v.lang.startsWith('fr'));
    if (frVoice) utterance.voice = frVoice;

    utterance.onstart = () => {
      if (this.queue.length === 0) this.onStart?.();
    };

    utterance.onend = () => {
      if (this.queue.length === 0) {
        this.running = false;
        this.onEnd?.();
      } else {
        this.flush();
      }
    };

    utterance.onerror = () => {
      this.queue   = [];
      this.running = false;
      this.onEnd?.();
    };

    speechSynthesis.speak(utterance);
  }

  stop() {
    this.queue   = [];
    this.running = false;
    if (isTTSSupported()) speechSynthesis.cancel();
  }

  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); }
  setRate(r: number)   { this.rate   = Math.max(0.1, Math.min(10, r)); }
  isSpeaking()         { return this.running; }
}
