'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import LottiePlayer from '@/components/ui/LottiePlayer';
import { AgentPanel, type ChatMessage, type AgentStatus } from './AgentPanel';
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  type SpeechRecognitionHandle,
} from '@/lib/voice/speech-recognition';
import { TTSQueue, isTTSSupported } from '@/lib/voice/text-to-speech';
import { runAgentTurn, TOOLS, type AgentMessage, type AgentContext } from '@/lib/voice/agent';
import { navModules } from '@/lib/theme';

// ── Module label from pathname ────────────────────────────────────────────────

function getModuleLabel(pathname: string): string {
  const mod = navModules.find(
    (m) => pathname === m.href || pathname.startsWith(m.href + '/'),
  );
  return mod?.label ?? 'Dashboard';
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  userName: string;
  userRole: string;
}

interface VoiceData {
  companies:   { id: string; name: string }[];
  clients:     { id: string; name: string }[];
  technicians: { id: string; name: string }[];
}

// ── Inactivity timers ────────────────────────────────────────────────────────

const WARN_MS  = 2 * 60 * 1000;
const CLOSE_MS = 3 * 60 * 1000;

// ── Component ─────────────────────────────────────────────────────────────────

export function VoiceAgent({ userName, userRole }: Props) {
  const router   = useRouter();
  const pathname = usePathname();

  // ── State ──────────────────────────────────────────────────────────────────
  const [status,          setStatus]          = useState<AgentStatus>('idle');
  const [agentOpen,       setAgentOpen]       = useState(false);
  const [messages,        setMessages]        = useState<ChatMessage[]>([]);
  const [interimText,     setInterimText]     = useState('');
  const [inactivityWarn,  setInactivityWarn]  = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const voiceDataRef = useRef<VoiceData | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const statusRef          = useRef<AgentStatus>('idle');
  const agentOpenRef       = useRef(false);
  const recognitionRef     = useRef<SpeechRecognitionHandle | null>(null);
  const ttsRef             = useRef<TTSQueue | null>(null);
  const historyRef         = useRef<AgentMessage[]>([]);
  const clickTimer         = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clickCount         = useRef(0);
  const warnTimer          = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer         = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isAgentMode        = useRef(false);
  const audioUnlockedRef   = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { agentOpenRef.current = agentOpen; }, [agentOpen]);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());

    // TTS queue
    ttsRef.current = new TTSQueue({
      onGenerating: () => safeSetStatus('thinking'),   // keep "thinking" while ElevenLabs generates
      onStart:      () => safeSetStatus('speaking'),
      onEnd:        () => {
        // After speaking, loop back to listening in agent mode
        if (isAgentMode.current && agentOpenRef.current) {
          startListening();
        } else {
          safeSetStatus('idle');
        }
      },
    });

    // Chrome: voices load async — trigger the load and cache them on change
    if (isTTSSupported()) {
      speechSynthesis.getVoices(); // trigger first load
      speechSynthesis.onvoiceschanged = () => { speechSynthesis.getVoices(); };
    }

    return () => {
      recognitionRef.current?.abort();
      ttsRef.current?.stop();
      clearTimeout(warnTimer.current);
      clearTimeout(closeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Audio context unlock (mobile autoplay) ───────────────────────────────

  function unlockAudioContext() {
    if (audioUnlockedRef.current) return;
    const audio = new Audio();
    // 1-frame silent WAV — juste pour lever la restriction autoplay
    audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
    audio.play().then(() => {
      audioUnlockedRef.current = true;
      console.log('[TTS] AudioContext débloqué (mobile)');
    }).catch(() => {
      // Pas un vrai problème — sera réessayé au prochain clic
    });
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function safeSetStatus(s: AgentStatus) {
    statusRef.current = s;
    setStatus(s);
  }

  function addMessage(role: 'user' | 'agent', text: string) {
    const msg: ChatMessage = { id: crypto.randomUUID(), role, text, ts: Date.now() };
    setMessages((prev) => [...prev, msg]);
    return msg;
  }

  function resetInactivity() {
    clearTimeout(warnTimer.current);
    clearTimeout(closeTimer.current);
    setInactivityWarn(false);
    warnTimer.current  = setTimeout(() => setInactivityWarn(true), WARN_MS);
    closeTimer.current = setTimeout(() => handleClose(),            CLOSE_MS);
  }

  // ── Speech recognition setup ─────────────────────────────────────────────

  const startListening = useCallback(() => {
    if (statusRef.current === 'listening') return;

    recognitionRef.current?.abort();

    const handle = createSpeechRecognition({
      onInterim: (t) => setInterimText(t),
      onFinal:   (t) => {
        setInterimText('');
        if (!t) return;
        if (isAgentMode.current) {
          handleUserSpeech(t);
        } else {
          // Simple mode: fill active input
          fillActiveInput(t);
          safeSetStatus('idle');
        }
      },
      onError: (msg) => {
        setInterimText('');
        if (msg) addMessage('agent', `⚠️ ${msg}`);
        safeSetStatus('idle');
      },
      onEnd: () => {
        setInterimText('');
        if (statusRef.current === 'listening') safeSetStatus('idle');
      },
    });

    if (handle) {
      recognitionRef.current = handle;
      handle.start();
      safeSetStatus('listening');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fillActiveInput(text: string) {
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      const nativeSetter = Object.getOwnPropertyDescriptor(
        active.tagName === 'INPUT'
          ? HTMLInputElement.prototype
          : HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      nativeSetter?.call(active, text);
      active.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // ── Agent conversation ───────────────────────────────────────────────────

  async function handleUserSpeech(text: string) {
    if (statusRef.current === 'thinking') return;
    recognitionRef.current?.stop();
    addMessage('user', text);
    resetInactivity();
    await sendToAgent(text);
  }

  async function sendToAgent(text: string) {
    safeSetStatus('thinking');

    const vd = voiceDataRef.current;
    const context: AgentContext = {
      module:      getModuleLabel(pathname),
      role:        userRole,
      userName,
      companies:   vd?.companies,
      clients:     vd?.clients,
      technicians: vd?.technicians,
    };

    try {
      const { reply, updatedHistory } = await runAgentTurn(
        text,
        historyRef.current,
        context,
        { navigate: (path) => router.push(path) },
      );

      historyRef.current = updatedHistory;
      addMessage('agent', reply);
      resetInactivity();

      // Status transitions: thinking → (onGenerating keeps thinking) → speaking (onStart) → idle/listening (onEnd)
      ttsRef.current?.stop();
      ttsRef.current?.enqueue(reply);

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue.';
      addMessage('agent', `❌ ${msg}`);
      safeSetStatus('idle');
    }
  }

  // ── Click handler (single vs double) ────────────────────────────────────

  function handleButtonClick() {
    // Débloquer l'autoplay au premier geste utilisateur (requis iOS/Android)
    unlockAudioContext();

    if (statusRef.current === 'thinking') return;

    clickCount.current++;

    if (clickCount.current === 1) {
      clickTimer.current = setTimeout(() => {
        if (clickCount.current === 1) {
          // Single click
          handleSingleClick();
        }
        clickCount.current = 0;
      }, 300);
    } else if (clickCount.current >= 2) {
      clearTimeout(clickTimer.current);
      clickCount.current = 0;
      handleDoubleClick();
    }
  }

  function handleSingleClick() {
    if (agentOpen) {
      // In agent mode: toggle mic
      if (statusRef.current === 'listening') {
        recognitionRef.current?.stop();
        safeSetStatus('idle');
      } else if (statusRef.current === 'idle') {
        startListening();
      }
      return;
    }

    // Simple mode: start filling active input
    isAgentMode.current = false;
    if (statusRef.current === 'listening') {
      recognitionRef.current?.stop();
      safeSetStatus('idle');
    } else {
      startListening();
    }
  }

  function handleDoubleClick() {
    // Open agent panel
    isAgentMode.current = true;
    setAgentOpen(true);
    ttsRef.current?.stop();
    historyRef.current = [];
    resetInactivity();
    setTimeout(() => startListening(), 400); // small delay for panel animation

    // Fetch live context (companies / clients / technicians) from Supabase
    if (!voiceDataRef.current) {
      fetch('/api/voice-data')
        .then((r) => r.json())
        .then((data: VoiceData) => { voiceDataRef.current = data; })
        .catch(() => { /* silently ignore — system prompt will omit live data */ });
    }
  }

  // ── Debug : test batch des 5 phrases (dev uniquement) ───────────────────
  // Bouton "🧪" visible uniquement en développement. À supprimer après validation.

  const DEV_TEST_PHRASES = [
    'fais-moi un devis câblage pour GSK',
    'ajoute le client société Durand à Reims',
    'ouvre un ticket SAV urgent chez Novatech, panne climatisation',
    'note de frais 45 euros repas client',
    'cherche la facture de GSK',
  ];

  async function runDevTests() {
    console.group('[voice-test] === DÉBUT DES TESTS ===');

    // 1. GET /api/voice-data
    let vd: VoiceData | null = null;
    try {
      const r = await fetch('/api/voice-data');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      vd = (await r.json()) as VoiceData;
      console.log('[voice-test] GET /api/voice-data OK', {
        companies:   vd.companies.length,
        clients:     vd.clients.length,
        technicians: vd.technicians.length,
      });
    } catch (e) {
      console.error('[voice-test] GET /api/voice-data ERREUR:', e);
    }

    // 2. GET /api/voice-test (diagnostic)
    try {
      const r = await fetch('/api/voice-test');
      const diag = await r.json();
      console.log('[voice-test] GET /api/voice-test:', diag);
    } catch (e) {
      console.error('[voice-test] GET /api/voice-test ERREUR:', e);
    }

    // 3. Test des 5 phrases
    const ctx: AgentContext = {
      module:      getModuleLabel(pathname),
      role:        userRole,
      userName,
      companies:   vd?.companies,
      clients:     vd?.clients,
      technicians: vd?.technicians,
    };

    const SYSTEM = `MODE VOCAL ACTIVÉ — Règles strictes :
- Réponds en 1 à 2 phrases MAXIMUM.
- Parle comme à l'oral : court, direct, naturel.
Tu es l'assistant vocal d'OxiFlow. Module : ${ctx.module}. Utilisateur : ${ctx.userName} (rôle : ${ctx.role}).`;

    for (let i = 0; i < DEV_TEST_PHRASES.length; i++) {
      const phrase = DEV_TEST_PHRASES[i];
      console.group(`[voice-test] [${i + 1}/${DEV_TEST_PHRASES.length}] "${phrase}"`);

      // A. Appel brut au proxy (tool_use sans exécution)
      try {
        const res = await fetch('/api/claude-proxy', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            messages:   [{ role: 'user', content: phrase }],
            system:     SYSTEM,
            tools:      TOOLS,
            max_tokens: 512,
            mode:       'voice',
          }),
        });
        const data = await res.json() as {
          content?:     Array<{ type: string; id?: string; name?: string; input?: unknown; text?: string }>;
          stop_reason?: string;
          error?:       string;
        };

        if (data.error) {
          console.error('  [proxy] ERREUR:', data.error);
        } else {
          console.log('  [proxy] stop_reason:', data.stop_reason);
          for (const block of data.content ?? []) {
            if (block.type === 'tool_use') {
              console.log('  [proxy] 🔧 tool_use →', block.name, JSON.stringify(block.input));
            } else if (block.type === 'text') {
              console.log('  [proxy] 💬 text →', block.text);
            }
          }
        }
      } catch (e) {
        console.error('  [proxy] EXCEPTION:', e);
      }

      // B. Exécution complète via runAgentTurn (tools exécutés en base)
      try {
        const { reply } = await runAgentTurn(
          phrase, [], ctx,
          { navigate: (p) => console.log('  [agent] navigate →', p) },
        );
        console.log('  [agent] ✅ reply final:', reply);
      } catch (e) {
        console.error('  [agent] EXCEPTION:', e);
      }

      console.groupEnd();
    }

    console.groupEnd();
    console.log('[voice-test] === TESTS TERMINÉS ===');
  }

  function handleClose() {
    recognitionRef.current?.abort();
    ttsRef.current?.stop();
    clearTimeout(warnTimer.current);
    clearTimeout(closeTimer.current);
    isAgentMode.current = false;
    setAgentOpen(false);
    setMessages([]);
    setInterimText('');
    setInactivityWarn(false);
    safeSetStatus('idle');
    historyRef.current = [];
  }

  // ── Button appearance ────────────────────────────────────────────────────

  const btnConfig: Record<AgentStatus, { bg: string; ring: string; icon: string; title: string }> = {
    idle:      { bg: 'bg-slate-400',  ring: '',                        icon: '🎤', title: 'Clic : dicter | Double-clic : agent IA'    },
    listening: { bg: 'bg-red-500',             ring: 'ring-4 ring-red-300',     icon: '🎙️', title: 'Écoute en cours — clic pour arrêter'       },
    thinking:  { bg: 'bg-blue-600',         ring: 'ring-4 ring-blue-200',    icon: '🧠', title: 'Réflexion en cours…'                        },
    speaking:  { bg: 'bg-green-500',         ring: 'ring-4 ring-green-200',   icon: '🔊', title: 'Réponse en cours — clic pour couper'        },
  };
  const { bg, ring, icon, title } = btnConfig[status];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating button + sound-wave Lottie (loops when agent is active) */}
      <div
        className={[
          'fixed right-4 z-40 relative',
          agentOpen ? 'bottom-[calc(60vh+1rem)]' : 'bottom-20 md:bottom-6',
        ].join(' ')}
      >
        {/* Sound-wave animation — centered overlay behind button */}
        {status !== 'idle' && (
          <div
            className="pointer-events-none absolute"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: -1,
              width: 120,
              height: 120,
            }}
          >
            <LottiePlayer
              src="https://assets9.lottiefiles.com/packages/lf20_myejiggj.json"
              width={120}
              height={120}
              loop
              autoplay
            />
          </div>
        )}
        <button
          onClick={handleButtonClick}
          title={title}
          aria-label={title}
          className={[
            'relative flex h-14 w-14 items-center justify-center',
            'rounded-full shadow-lg transition-all duration-200 select-none',
            'text-xl hover:scale-110 active:scale-95',
            bg, ring,
          ].join(' ')}
        >
          {icon}
        </button>
      </div>

      {/* Dev-only test button — remove after validation */}
      {process.env.NODE_ENV === 'development' && !agentOpen && (
        <button
          onClick={runDevTests}
          title="Voice agent — batch test (dev)"
          className="fixed right-20 bottom-20 md:bottom-6 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400 text-base shadow hover:scale-110"
        >
          🧪
        </button>
      )}

      {/* Fallback label for unsupported browsers */}
      {!speechSupported && !agentOpen && (
        <div className="fixed bottom-36 right-4 z-30 rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-xs text-slate-400 shadow-sm">
          Mode texte uniquement
        </div>
      )}

      {/* Agent panel */}
      {agentOpen && (
        <>
          {/* Backdrop — above sidebar (z-30) but below modals (z-50) */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={handleClose}
            aria-hidden
          />
          <AgentPanel
            messages={messages}
            status={status}
            interimText={interimText}
            inactivityWarn={inactivityWarn}
            onClose={handleClose}
            onTextInput={(text) => {
              addMessage('user', text);
              resetInactivity();
              sendToAgent(text);
            }}
            textMode={!speechSupported}
          />
        </>
      )}
    </>
  );
}
