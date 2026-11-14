import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Navigation, Send, X } from 'lucide-react';
import type {
  AdvisoryLanguage,
  NormalizationResult,
  PawanMessage,
  PawanNavAction,
  WorkspaceStep,
} from '../types/vayu.ts';

interface PawanAssistantProps {
  activeStep: WorkspaceStep;
  isAuthenticated: boolean;
  hasData: boolean;
  normalization: NormalizationResult | null;
  language: AdvisoryLanguage;
  onExecuteNavAction: (action: PawanNavAction) => void;
}

const STARTER_PROMPTS = [
  'How do I sign in and upload data?',
  'Where are the Heatmaps & Unit Converter?',
  'Switch to Hindi Citizen Advisory',
  'How are Ward, Society, and School actions separated?',
];

export const PawanAssistant: React.FC<PawanAssistantProps> = ({
  activeStep,
  isAuthenticated,
  hasData,
  normalization,
  language,
  onExecuteNavAction,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<PawanMessage[]>([
    {
      id: 'pawan-welcome',
      sender: 'pawan',
      text: 'Namaste! I am Pawan, your Vayu AI guide. Ask me about WHO/CPCB guidelines, our Unit Converter, Heatmaps, Data Integrity charts, or role-based actions—and I will take you directly to the right page.',
      actions: isAuthenticated
        ? [
            { label: 'Upload / Paste Data', targetPage: 'ingest' },
            { label: 'Load Test Fixture & Audit', targetPage: 'ingest', loadFixture: true },
          ]
        : [
            { label: 'Login / Register by Role', targetPage: 'auth' },
            { label: 'View Guidelines & Converter', targetPage: 'landing' },
          ],
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    const userMsg: PawanMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const response = await fetch('/api/pawan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          context: {
            activeStep,
            isAuthenticated,
            hasData,
            hasNormalized: Boolean(normalization),
            datasetTitle: normalization?.datasetTitle || '',
            overallNaqi: normalization?.overallNaqi ?? null,
            overallCategory: normalization?.overallCategory || '',
            currentLanguage: language,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Pawan could not reply right now.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `pawan-${Date.now()}`,
          sender: 'pawan',
          text: data.reply,
          actions: Array.isArray(data.suggestedActions) ? data.suggestedActions : [],
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `pawan-err-${Date.now()}`,
          sender: 'pawan',
          text:
            err instanceof Error
              ? `Sorry, I ran into a server issue: ${err.message}`
              : 'Sorry, I could not reach the assistant right now.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 no-print">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open Pawan AI assistant"
          className="inline-flex items-center gap-2.5 rounded-full bg-[#15803d] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_-4px_rgba(21,128,61,0.45)] transition-transform hover:scale-[1.02] hover:bg-[#00652c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16a34a]"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          <span>Ask Pawan</span>
        </button>
      ) : (
        <section
          aria-label="Pawan AI Assistant"
          className="flex h-[480px] w-[350px] sm:w-[390px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[#16a34a]/25 bg-white shadow-[0_24px_48px_-12px_rgba(20,83,45,0.28)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 bg-[#15803d] px-4 py-3 text-white">
            <div>
              <h2 className="font-display text-sm font-bold tracking-wide">
                Pawan · Vayu AI Guide
              </h2>
              <p className="text-[11px] text-[#d3ffd5]">
                Feature help &amp; instant page navigation
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close Pawan assistant"
              className="rounded-lg p-1.5 text-white/85 hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#faf8ff] p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-[#15803d] text-white'
                      : 'border border-slate-200 bg-white text-[#131b2e]'
                  }`}
                >
                  {msg.text}
                </div>

                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 max-w-[92%]">
                    {msg.actions.map((act, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => onExecuteNavAction(act)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#16a34a]/35 bg-[#f0fdf4] px-2.5 py-1.5 text-[11px] font-semibold text-[#15803d] hover:bg-[#dcfce7] transition-colors"
                      >
                        <Navigation className="h-3 w-3" aria-hidden="true" />
                        {act.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isSending && (
              <div className="text-xs text-slate-500 italic">Pawan is thinking...</div>
            )}
          </div>

          {/* Quick prompts */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 bg-white px-3 py-2">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isSending}
                onClick={() => void sendMessage(prompt)}
                className="shrink-0 rounded-md border border-slate-200 bg-[#faf8ff] px-2.5 py-1 text-[11px] font-medium text-[#3f493f] hover:border-[#16a34a]/40 hover:text-[#00652c]"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage(input);
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Pawan about features or pages..."
              aria-label="Message Pawan"
              className="flex-1 rounded-lg border border-slate-200 bg-[#faf8ff] px-3 py-2 text-xs text-[#131b2e] placeholder:text-slate-400 focus:border-[#16a34a] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              aria-label="Send message to Pawan"
              className="rounded-lg bg-[#15803d] p-2 text-white hover:bg-[#00652c] disabled:bg-slate-300 disabled:text-slate-600"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
    </div>
  );
};
