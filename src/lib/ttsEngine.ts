/**
 * Shared Gemini TTS fetch logic used by both the TTS route and the AI route prefetch.
 * Returns raw PCM Buffer (24 kHz, mono, 16-bit LE) or null on failure.
 */
import { getGeminiKeeperVoice, getGeminiNpcVoice } from '@/lib/voices';
import { stripDiceForTts } from '@/lib/segments';
import type { Segment } from '@/lib/segments';

export async function fetchGeminiPcm(
  text: string,
  voiceStyle: string,
  segments?: Segment[]
): Promise<Buffer | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const hasNpc = segments?.some((s) => s.type === 'npc');

  let body: object;

  if (hasNpc && segments) {
    // ── Multi-speaker ───────────────────────────────────────────────────────
    const lines = segments.map((s) => {
      const clean = stripDiceForTts(s.text);
      return s.type === 'narration'
        ? `Case Curator: ${clean}`
        : `${(s as Extract<Segment, { type: 'npc' }>).name}: ${clean}`;
    });

    const seen = new Set<string>();
    const speakerVoiceConfigs: object[] = [];

    seen.add('Case Curator');
    speakerVoiceConfigs.push({
      speaker: 'Case Curator',
      voiceConfig: { prebuiltVoiceConfig: { voiceName: getGeminiKeeperVoice() } },
    });

    for (const seg of segments) {
      if (seg.type === 'npc' && !seen.has(seg.name)) {
        seen.add(seg.name);
        speakerVoiceConfigs.push({
          speaker: seg.name,
          voiceConfig: { prebuiltVoiceConfig: { voiceName: getGeminiNpcVoice(seg.voiceStyle, seg.gender) } },
        });
      }
    }

    body = {
      contents: [{ parts: [{ text: lines.join('\n') }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs } },
      },
    };
  } else {
    // ── Single speaker ──────────────────────────────────────────────────────
    body = {
      contents: [{ parts: [{ text: stripDiceForTts(text) }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: getGeminiKeeperVoice() } } },
      },
    };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) {
      console.warn('Gemini TTS quota exceeded (429) — falling back to OpenAI');
    } else {
      console.error('Gemini TTS error:', res.status, errText.slice(0, 300));
    }
    return null;
  }

  const data = await res.json() as {
    candidates: { content: { parts: { inlineData?: { data: string } }[] } }[]
  };
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!part?.inlineData) return null;

  return Buffer.from(part.inlineData.data, 'base64');
}

export function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate    = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign  = numChannels * (bitsPerSample / 8);
  const header      = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}
