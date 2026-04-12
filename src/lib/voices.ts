// ── OpenAI TTS voices ────────────────────────────────────────────────────────
// Model: tts-1 | voices: alloy, ash, coral, echo, fable, onyx, nova, shimmer, verse
export const OPENAI_VOICE_MAP: Record<string, string> = {
  keeper:  'onyx',    // deep, authoritative narrator
  шепіт:   'echo',    // eerie, hollow
  nervous: 'nova',    // bright, anxious
  deep:    'fable',   // commanding, gravelly
  mystic:  'shimmer', // soft, ethereal
};

// ── Gemini TTS voices ─────────────────────────────────────────────────────────
// Model: gemini-2.5-flash-preview-tts
// Available voices: Aoede, Charon, Fenrir, Kore, Puck, Zephyr, Leda, Orus, etc.
export const GEMINI_VOICE_MAP: Record<string, string> = {
  keeper:  'Charon',  // dark, deep narrator
  шепіт:   'Kore',    // soft, unsettling
  nervous: 'Aoede',   // varied, expressive
  deep:    'Fenrir',  // deep, commanding
  mystic:  'Puck',    // mysterious, ethereal
};

export function getOpenAIVoice(voiceStyle: string): string {
  return OPENAI_VOICE_MAP[voiceStyle] ?? OPENAI_VOICE_MAP.keeper;
}

export function getGeminiVoice(voiceStyle: string): string {
  return GEMINI_VOICE_MAP[voiceStyle] ?? GEMINI_VOICE_MAP.keeper;
}
