import { getOpenAIVoice } from '@/lib/voices';

export async function POST(request: Request) {
  const { text, voiceStyle } = (await request.json()) as {
    text: string;
    voiceStyle?: string;
  };

  if (!text?.trim()) {
    return new Response('text is required', { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return new Response('OpenAI API key not configured', { status: 503 });

  const voice = getOpenAIVoice(voiceStyle ?? 'keeper');

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
