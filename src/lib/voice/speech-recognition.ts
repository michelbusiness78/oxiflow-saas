// Browser-only — never import at the top level of a server module.

// Web Speech API type shims (not included in all TypeScript DOM libs)
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results:     SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance {
  lang:            string;
  interimResults:  boolean;
  maxAlternatives: number;
  continuous:      boolean;
  start():  void;
  stop():   void;
  abort():  void;
  onstart:      (() => void) | null;
  onsoundstart: (() => void) | null;
  onresult:     ((e: SpeechRecognitionEvent) => void) | null;
  onerror:      ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend:        (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition:       new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export function isSpeechRecognitionSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  );
}

export interface SpeechCallbacks {
  onInterim?: (text: string) => void;
  onFinal:    (text: string) => void;
  onError:    (msg: string) => void;
  onEnd?:     () => void;
}

export interface SpeechRecognitionHandle {
  start:  () => void;
  stop:   () => void;
  abort:  () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed':         'Microphone refusé. Autorisez l\'accès dans les paramètres du navigateur.',
  'audio-capture':       'Microphone introuvable.',
  'network':             'Erreur réseau lors de la reconnaissance vocale.',
  'service-not-allowed': 'Service vocal non autorisé.',
  'no-speech':           'Aucune parole détectée.',
  'aborted':             '',   // silent — triggered by our own stop()
};

const SILENCE_TIMEOUT_MS = 10_000;

export function createSpeechRecognition(
  callbacks: SpeechCallbacks,
): SpeechRecognitionHandle | null {
  if (!isSpeechRecognitionSupported()) return null;

  const Ctor =
    window.SpeechRecognition ?? window.webkitSpeechRecognition;

  const rec = new Ctor();
  rec.lang            = 'fr-FR';
  rec.interimResults  = true;
  rec.maxAlternatives = 1;
  rec.continuous      = false;

  let active       = false;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let hasFinal     = false;

  const clearTimer = () => { if (silenceTimer) { clearTimeout(silenceTimer); silenceTimer = null; } };
  const armTimer   = () => {
    clearTimer();
    silenceTimer = setTimeout(() => { if (active) rec.stop(); }, SILENCE_TIMEOUT_MS);
  };

  rec.onstart      = () => { active = true; hasFinal = false; armTimer(); };
  rec.onsoundstart = () => armTimer();

  rec.onresult = (e) => {
    clearTimer();
    let interim = '';
    let final   = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) { final += t; hasFinal = true; }
      else                       { interim += t; }
    }
    if (interim) callbacks.onInterim?.(interim);
    if (final)   { callbacks.onFinal(final.trim()); }
    armTimer();
  };

  rec.onerror = (e) => {
    clearTimer();
    active = false;
    const msg = ERROR_MESSAGES[e.error as string] ?? `Erreur reconnaissance : ${e.error}`;
    if (msg) callbacks.onError(msg);
  };

  rec.onend = () => {
    clearTimer();
    active = false;
    callbacks.onEnd?.();
  };

  return {
    start() { if (!active) { try { rec.start(); } catch { /* already started */ } } },
    stop()  { clearTimer(); if (active) { try { rec.stop();  } catch { /* already stopped */ } } },
    abort() { clearTimer(); active = false; try { rec.abort(); } catch { /* ignore */ } },
  };
}
