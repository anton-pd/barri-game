import { getOpenAIVoice, getElevenLabsVoiceId } from '@/lib/voices';

export async function POST(request: Request) {
  const { text, voiceStyle, provider = 'openai' } = (await request.json()) as {
    text: string;
    voiceStyle?: string;
    provider?: 'openai' | 'elevenlabs';
  };

  if (!text?.trim()) {
    return new Response('text is required', { status: 400 });
  }

  if (provider === 'elevenlabs') {
    return handleElevenLabs(text, voiceStyle ?? 'keeper');
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

// ── ElevenLabs ───────────────────────────────────────────────────────────────

async function handleElevenLabs(text: string, voiceStyle: string): Promise<Response> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return new Response('ElevenLabs API key not configured', { status: 503 });

  const voiceId = getElevenLabsVoiceId(voiceStyle);

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    console.error('ElevenLabs TTS error:', res.status, await res.text());
    return new Response('TTS failed', { status: 502 });
  }

  return new Response(await res.arrayBuffer(), {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}
