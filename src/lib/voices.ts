// ── OpenAI TTS voices ────────────────────────────────────────────────────────
// Model: tts-1 | voices: alloy, ash, coral, echo, fable, onyx, nova, shimmer, verse
export const OPENAI_VOICE_MAP: Record<string, string> = {
  keeper:  'onyx',    // deep, authoritative narrator
  шепіт:   'echo',    // eerie, hollow
  nervous: 'nova',    // bright, anxious
  deep:    'fable',   // commanding, gravelly
  mystic:  'shimmer', // soft, ethereal
};

// ── ElevenLabs voices ────────────────────────────────────────────────────────
// Model: eleven_multilingual_v2 (підтримує українську)
// Voice IDs — pre-made voices, доступні на всіх тарифах
export const ELEVENLABS_VOICE_MAP: Record<string, string> = {
  keeper:  'pNInz6obpgDQGcFmaJgB', // Adam   — глибокий, авторитетний наратор
  шепіт:   'yoZ06aMxZJJ28mfd3POQ', // Sam    — хриплий, моторошний
  nervous: 'ErXwobaYiN019PkySvjV', // Antoni — природний, трохи схвильований
  deep:    'VR6AewLTigWG4xSOukaG', // Arnold — командний, різкий
  mystic:  'MF3mGyEYCl7XYWbV9V6O', // Elli   — тихий, ефірний жіночий
};

export function getOpenAIVoice(voiceStyle: string): string {
  return OPENAI_VOICE_MAP[voiceStyle] ?? OPENAI_VOICE_MAP.keeper;
}

export function getElevenLabsVoiceId(voiceStyle: string): string {
  return ELEVENLABS_VOICE_MAP[voiceStyle] ?? ELEVENLABS_VOICE_MAP.keeper;
}
