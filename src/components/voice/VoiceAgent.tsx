'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AgentPanel, type ChatMessage, type AgentStatus } from './AgentPanel';
import {
  createSpeechRecognition,
  isSpeechRecognitionSupported,
  type SpeechRecognitionHandle,
} from '@/lib/voice/speech-recognition';
import { TTSQueue, isTTSSupported } from '@/lib/voice/text-to-speech';
import { runAgentTurn, type AgentMessage, type AgentContext } from '@/lib/voice/agent';
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

  // ── Refs ───────────────────────────────────────────────────────────────────
  const statusRef      = useRef<AgentStatus>('idle');    // mirrors state — safe in callbacks
  const agentOpenRef   = useRef(false);                  // mirrors agentOpen — safe in callbacks
  const recognitionRef = useRef<SpeechRecognitionHandle | null>(null);
  const ttsRef         = useRef<TTSQueue | null>(null);
  const historyRef     = useRef<AgentMessage[]>([]);     // Claude message history
  const clickTimer     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const clickCount     = useRef(0);
  const warnTimer      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer     = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isAgentMode    = useRef(false);                  // single vs agent mode

  // Keep refs in sync with state
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { agentOpenRef.current = agentOpen; }, [agentOpen]);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());

    // TTS queue
    ttsRef.current = new TTSQueue({
      onStart: () => setStatus('speaking'),
      onEnd:   () => {
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

    const context: AgentContext = {
      module:   getModuleLabel(pathname),
      role:     userRole,
      userName,
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

      safeSetStatus('speaking');
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
    idle:      { bg: 'bg-oxi-text-secondary',  ring: '',                        icon: '🎤', title: 'Clic : dicter | Double-clic : agent IA'    },
    listening: { bg: 'bg-red-500',             ring: 'ring-4 ring-red-300',     icon: '🎙️', title: 'Écoute en cours — clic pour arrêter'       },
    thinking:  { bg: 'bg-oxi-primary',         ring: 'ring-4 ring-blue-200',    icon: '🧠', title: 'Réflexion en cours…'                        },
    speaking:  { bg: 'bg-oxi-success',         ring: 'ring-4 ring-green-200',   icon: '🔊', title: 'Réponse en cours — clic pour couper'        },
  };
  const { bg, ring, icon, title } = btnConfig[status];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Floating button */}
      <button
        onClick={handleButtonClick}
        title={title}
        aria-label={title}
        className={[
          'fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center',
          'rounded-full shadow-lg transition-all duration-200 select-none',
          'text-xl hover:scale-110 active:scale-95',
          bg, ring,
          // Hide default mic button when agent panel is open (it's in the panel)
          agentOpen ? 'bottom-[calc(60vh+1rem)]' : 'md:bottom-6',
        ].join(' ')}
      >
        {icon}
      </button>

      {/* Fallback label for unsupported browsers */}
      {!speechSupported && !agentOpen && (
        <div className="fixed bottom-36 right-4 z-30 rounded-lg bg-oxi-surface border border-oxi-border px-3 py-1.5 text-xs text-oxi-text-muted shadow-sm">
          Mode texte uniquement
        </div>
      )}

      {/* Agent panel */}
      {agentOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-30 bg-black/20"
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
