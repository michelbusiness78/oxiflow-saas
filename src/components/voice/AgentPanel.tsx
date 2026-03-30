'use client';

import { useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  id:      string;
  role:    'user' | 'agent';
  text:    string;
  ts:      number;
}

export type AgentStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

interface Props {
  messages:         ChatMessage[];
  status:           AgentStatus;
  interimText:      string;
  inactivityWarn:   boolean;
  onClose:          () => void;
  onTextInput:      (text: string) => void;
  textMode:         boolean;   // true when SpeechRecognition not supported
}

// ── ThinkingDots ──────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-slate-300 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  );
}

// ── StatusBar ─────────────────────────────────────────────────────────────────

function StatusBar({ status, interimText }: { status: AgentStatus; interimText: string }) {
  const config: Record<AgentStatus, { label: string; color: string }> = {
    idle:      { label: 'Inactif',          color: 'text-slate-400'    },
    listening: { label: 'Écoute…',          color: 'text-red-500'           },
    thinking:  { label: 'Réflexion…',       color: 'text-blue-600'       },
    speaking:  { label: 'Répond…',          color: 'text-oxi-success'       },
  };
  const { label, color } = config[status];
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white">
      <span className={`h-2 w-2 rounded-full ${
        status === 'idle'      ? 'bg-slate-300' :
        status === 'listening' ? 'bg-red-500 animate-pulse' :
        status === 'thinking'  ? 'bg-blue-600 animate-pulse' :
                                 'bg-green-500 animate-pulse'
      }`} />
      <span className={`text-xs font-medium ${color}`}>{label}</span>
      {interimText && (
        <span className="text-xs text-slate-400 italic truncate max-w-[200px]">
          "{interimText}"
        </span>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AgentPanel({
  messages,
  status,
  interimText,
  inactivityWarn,
  onClose,
  onTextInput,
  textMode,
}: Props) {
  const [visible,   setVisible]   = useState(false);
  const [textInput, setTextInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Slide-up animation
  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t); }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const t = textInput.trim();
    if (!t) return;
    setTextInput('');
    onTextInput(t);
  }

  return (
    <div
      className={[
        'fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl bg-white shadow-2xl',
        'border-t border-slate-200 transition-transform duration-300 ease-out',
        visible ? 'translate-y-0' : 'translate-y-full',
      ].join(' ')}
      style={{ height: '60vh' }}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold">
            IA
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Assistant OxiFlow</p>
            <p className="text-xs text-slate-400">
              {textMode ? 'Mode texte' : 'Double-clic micro pour parler'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-slate-800 transition-colors"
          aria-label="Fermer la conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status */}
      <StatusBar status={status} interimText={interimText} />

      {/* Inactivity warning */}
      {inactivityWarn && (
        <div className="shrink-0 bg-oxi-warning-light px-4 py-2 text-xs text-oxi-warning text-center">
          Conversation inactive — fermeture automatique dans 1 minute
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm text-slate-400 text-center px-6">
            {textMode
              ? 'Tapez votre message ci-dessous…'
              : 'Dites votre demande après avoir cliqué sur le micro.'}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={['flex', msg.role === 'user' ? 'justify-end' : 'justify-start'].join(' ')}
          >
            <div
              className={[
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-slate-800 rounded-bl-sm border border-slate-200',
              ].join(' ')}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Thinking indicator */}
        {status === 'thinking' && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-white border border-slate-200">
              <ThinkingDots />
            </div>
          </div>
        )}
      </div>

      {/* Text input (always shown, required in textMode) */}
      <form
        onSubmit={handleSend}
        className="shrink-0 flex items-center gap-2 border-t border-slate-200 px-3 py-2.5 bg-white"
      >
        <input
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder={textMode ? 'Écrivez votre message…' : 'Ou tapez ici…'}
          disabled={status === 'thinking'}
          className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!textInput.trim() || status === 'thinking'}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
          aria-label="Envoyer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 12 6-6 6 6M12 6v12" transform="rotate(90 12 12)" />
          </svg>
        </button>
      </form>
    </div>
  );
}
