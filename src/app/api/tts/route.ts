import { getOpenAIVoice, getGeminiVoice } from '@/lib/voices';

export async function POST(request: Request) {
  const { text, voiceStyle, provider = 'openai' } = (await request.json()) as {
    text: string;
    voiceStyle?: string;
    provider?: 'openai' | 'gemini';
  };

  if (!text?.trim()) {
    return new Response('text is required', { status: 400 });
  }

  if (provider === 'gemini') {
    return handleGemini(text, voiceStyle ?? 'keeper');
  }
  return handleOpenAI(text, voiceStyle ?? 'keeper');
}

// ── OpenAI ───────────────────────────────────────────────────────────────────

async function handleOpenAI(text: string, voiceStyle: string): Promise<Response> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('OpenAI API key not configured', { status: 503 });

  const voice = getOpenAIVoice(voiceStyle);

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', input: text, voice, response_format: 'mp3' }),
  });

  if (!res.ok) {
    console.error('OpenAI TTS error:', res.status, await res.text());
    return new Response('TTS failed', { status: 502 });
  }

  return new Response(await res.arrayBuffer(), {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}

// ── Gemini ───────────────────────────────────────────────────────────────────

async function handleGemini(text: string, voiceStyle: string): Promise<Response> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return new Response('Gemini API key not configured', { status: 503 });

  const voiceName = getGeminiVoice(voiceStyle);

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      }),
    }
  );

  if (!res.ok) {
    console.error('Gemini TTS error:', res.status, await res.text());
    return new Response('TTS failed', { status: 502 });
  }

  const data = await res.json() as {
    candidates: { content: { parts: { inlineData?: { mimeType: string; data: string } }[] } }[]
  };

  const audioPart = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!audioPart?.inlineData) {
    console.error('Gemini TTS: no audio in response');
    return new Response('TTS failed', { status: 502 });
  }

  const pcm = Buffer.from(audioPart.inlineData.data, 'base64');
  // Gemini returns audio/L16 (raw PCM) — wrap in WAV header so browser can play it
  const wav = pcmToWav(pcm, 24000);

  return new Response(wav.buffer as ArrayBuffer, {
    headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'no-store' },
  });
}

// Convert raw 16-bit PCM (little-endian, mono) to WAV
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // PCM chunk size
  header.writeUInt16LE(1, 20);            // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}
