// OpenAI TTS voice IDs mapped to voiceStyle values used in scenario NPCs.
// Model: tts-1 (fast) — supports Ukrainian via multilingual training.
// Voices: alloy, ash, coral, echo, fable, onyx, nova, shimmer, verse

export const VOICE_MAP: Record<string, string> = {
  keeper:  'onyx',    // deep, authoritative narrator
  шепіт:   'echo',    // eerie, hollow
  nervous: 'nova',    // bright, anxious
  deep:    'fable',   // commanding, gravelly
  mystic:  'shimmer', // soft, ethereal
};

export function getVoiceId(voiceStyle: string): string {
  return VOICE_MAP[voiceStyle] ?? VOICE_MAP.keeper;
}
