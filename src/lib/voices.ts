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
//
// Rule: Keeper narrator → always Charon.
//       NPC voices → gender-based: female → Aoede, male → Fenrir.
//       voiceStyle overrides for special NPCs (шепіт, mystic) still apply.
export const GEMINI_KEEPER_VOICE = 'Charon';

export const GEMINI_NPC_VOICE_BY_GENDER: Record<string, string> = {
  female: 'Aoede',   // warm, expressive
  male:   'Fenrir',  // deep, commanding
};

// voiceStyle overrides — applied on top of gender defaults when set
export const GEMINI_VOICE_STYLE_OVERRIDE: Record<string, string> = {
  шепіт:   'Kore',   // soft, unsettling (neutral)
  mystic:  'Puck',   // mysterious, ethereal (neutral)
};

export function getOpenAIVoice(voiceStyle: string): string {
  return OPENAI_VOICE_MAP[voiceStyle] ?? OPENAI_VOICE_MAP.keeper;
}

/** Keeper narrator — always the same voice regardless of any message metadata. */
export function getOpenAIKeeperVoice(): string {
  return OPENAI_VOICE_MAP.keeper;
}

/** Keeper narrator — always the same voice regardless of voiceStyle. */
export function getGeminiKeeperVoice(): string {
  return GEMINI_KEEPER_VOICE;
}

/** NPC voice — gender-based, with optional voiceStyle override. */
export function getGeminiNpcVoice(voiceStyle: string, gender?: 'male' | 'female'): string {
  // voiceStyle override takes precedence (e.g. шепіт, mystic)
  if (GEMINI_VOICE_STYLE_OVERRIDE[voiceStyle]) return GEMINI_VOICE_STYLE_OVERRIDE[voiceStyle];
  // Gender-based default
  if (gender) return GEMINI_NPC_VOICE_BY_GENDER[gender] ?? GEMINI_KEEPER_VOICE;
  // Fallback: male default
  return GEMINI_NPC_VOICE_BY_GENDER.male;
}

/** @deprecated Use getGeminiKeeperVoice() or getGeminiNpcVoice() */
export function getGeminiVoice(voiceStyle: string): string {
  if (voiceStyle === 'keeper') return GEMINI_KEEPER_VOICE;
  return GEMINI_VOICE_STYLE_OVERRIDE[voiceStyle] ?? GEMINI_NPC_VOICE_BY_GENDER.male;
}
