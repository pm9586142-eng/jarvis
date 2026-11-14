import React, { useState } from 'react';
import { AlertCircle, Mic, Send, Square, VolumeX } from 'lucide-react';
import { AudioWaveVisualizer } from '../components/AudioWaveVisualizer';
import { QuantumCoreCanvas } from '../components/QuantumCoreCanvas';
import { isSpeechRecognitionSupported, isSpeechSynthesisSupported } from '../services/voice';
import { LanguageCode } from '../types/jarvis';

interface VoiceHudViewProps {
  language: LanguageCode;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  voiceError: string | null;
  audioLevel: number;
  reducedMotion: boolean;
  onStartListening: () => void;
  onStopListening: () => void;
  onStopSpeaking: () => void;
  onQuickCommand: (text: string) => void;
}

export const VoiceHudView: React.FC<VoiceHudViewProps> = ({
  language,
  isListening,
  isSpeaking,
  transcript,
  voiceError,
  audioLevel,
  reducedMotion,
  onStartListening,
  onStopListening,
  onStopSpeaking,
  onQuickCommand,
}) => {
  const sttSupported = isSpeechRecognitionSupported();
  const ttsSupported = isSpeechSynthesisSupported();
  const [typedDirective, setTypedDirective] = useState('');

  const handleSubmitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedDirective.trim()) return;
    onQuickCommand(typedDirective.trim());
    setTypedDirective('');
  };

  return (
    <div className="glass-panel-glow rounded-2xl p-6 flex flex-col items-center justify-between min-h-[calc(100dvh-9rem)] gap-6">
      <div className="text-center space-y-1">
        <h2 className="font-display text-lg sm:text-xl tracking-[0.2em] text-slate-100">
          VOICE INTELLIGENCE MATRIX
        </h2>
        <p className="font-mono-hud text-xs text-cyan-300">
          {isSpeaking
            ? 'VOCAL SYNTHESIS ACTIVE'
            : isListening
              ? 'LIVE ACOUSTIC LISTENING MATRIX'
              : `STANDBY • LANGUAGE: ${language}`}
        </p>
        <p className="font-mono-hud text-[11px] text-slate-400">
          STT: {sttSupported ? 'Web Speech Available' : 'Unsupported in this browser (use Chrome/Edge or type below)'} • TTS:{' '}
          {ttsSupported ? 'Available' : 'Unavailable'}
        </p>
      </div>

      <div className="w-full max-w-sm h-64">
        <QuantumCoreCanvas
          audioPulse={isListening || isSpeaking ? Math.max(0.2, audioLevel) : 0.04}
          nodeCount={54}
          reducedMotion={reducedMotion}
        />
      </div>

      <div className="w-full max-w-xl space-y-4">
        <div className="rounded-xl bg-[#040812] border border-slate-800 p-4 text-center">
          <p className="text-sm text-slate-200">
            {transcript
              ? `"${transcript}"`
              : isListening
                ? 'Listening for voice command...'
                : sttSupported
                  ? 'Tap Start Speaking below to issue a spoken directive to JARVIS.'
                  : 'Browser Speech Recognition is unavailable here. Use the command bar or presets below to speak via Gemini.'}
          </p>
        </div>

        {voiceError && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/40 px-4 py-2.5 flex items-center gap-2 text-xs text-rose-200 font-mono-hud">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{voiceError}</span>
          </div>
        )}

        <AudioWaveVisualizer
          audioLevel={audioLevel}
          isActive={isListening || isSpeaking}
          reducedMotion={reducedMotion}
        />

        <div className="flex flex-wrap items-center justify-center gap-3">
          {isSpeaking && (
            <button
              type="button"
              onClick={onStopSpeaking}
              className="px-5 py-3 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer"
            >
              <VolumeX className="w-4 h-4" />
              <span>INTERRUPT SPEAKING</span>
            </button>
          )}

          <button
            type="button"
            onClick={isListening ? onStopListening : onStartListening}
            className={`px-6 py-3 rounded-xl font-display text-xs font-bold tracking-wider flex items-center gap-2 cursor-pointer transition-colors ${
              isListening
                ? 'bg-rose-500 hover:bg-rose-400 text-white'
                : 'bg-cyan-400 hover:bg-cyan-300 text-[#02040A]'
            }`}
          >
            {isListening ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isListening ? 'STOP LISTENING' : 'START SPEAKING'}</span>
          </button>
        </div>

        {/* Typed Directive Fallback for any browser */}
        <form onSubmit={handleSubmitTyped} className="flex gap-2">
          <input
            type="text"
            value={typedDirective}
            onChange={(e) => setTypedDirective(e.target.value)}
            placeholder="Or type a spoken directive for JARVIS to answer & speak..."
            className="flex-1 bg-[#040812] border border-slate-700 focus:border-cyan-400 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!typedDirective.trim()}
            aria-label="Send voice directive"
            className="px-4 py-2.5 rounded-xl bg-[#0D1527] border border-cyan-400/50 hover:border-cyan-300 disabled:opacity-40 text-cyan-300 font-display text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>DISPATCH</span>
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          {[
            'Give me a system status report',
            'Provide my executive briefing for today',
            'Research latest clean energy breakthroughs',
          ].map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => onQuickCommand(cmd)}
              className="px-3 py-2 rounded-lg bg-[#0D1527] border border-slate-800 hover:border-cyan-400/50 font-mono-hud text-[11px] text-cyan-200 cursor-pointer"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
