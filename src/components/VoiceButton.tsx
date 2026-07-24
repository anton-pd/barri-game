'use client';

import { useState, useRef } from 'react';

interface VoiceButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  sessionId: string;
}

export default function VoiceButton({ onTranscript, disabled, sessionId }: VoiceButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return; // permission denied or not supported
    }

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setIsListening(false);
      setIsProcessing(true);

      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });

      try {
        const form = new FormData();
        form.append('audio', blob, 'audio.webm');
        form.append('sessionId', sessionId);

        const res = await fetch('/api/stt', { method: 'POST', body: form });
        if (res.ok) {
          const data = await res.json() as { text?: string };
          if (data.text?.trim()) onTranscript(data.text.trim());
        }
      } catch {
        // silent — user will type instead
      } finally {
        setIsProcessing(false);
      }
    };

    recorder.start();
    recorderRef.current = recorder;
    setIsListening(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function toggle() {
    if (isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  if (isProcessing) {
    return (
      <button
        disabled
        className="w-9 h-9 bg-stone-700 text-amber-600 animate-pulse flex items-center justify-center"
        title="Розпізнавання..."
        aria-label="Розпізнавання..."
      >⏳</button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={disabled}
      className={`w-9 h-9 transition-colors flex items-center justify-center ${
        isListening
          ? 'bg-red-600 animate-pulse text-white'
          : 'bg-stone-700 hover:bg-stone-600 active:bg-stone-500 text-stone-300'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={isListening ? 'Зупинити запис' : 'Говорити'}
      aria-label={isListening ? 'Зупинити запис' : 'Говорити'}
      aria-pressed={isListening}
    >
      {isListening ? '⏹' : '🎤'}
    </button>
  );
}
