import { getVoiceId } from '@/lib/voices';

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response('OpenAI API key not configured', { status: 503 });
  }

  const { text, voiceStyle } = (await request.json()) as {
    text: string;
    voiceStyle?: string;
  };

  if (!text?.trim()) {
    return new Response('text is required', { status: 400 });
  }

  const voice = getVoiceId(voiceStyle ?? 'keeper');

  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: text,
      voice,
      response_format: 'mp3',
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('OpenAI TTS error:', res.status, err);
    return new Response('TTS failed', { status: 502 });
  }

  const audio = await res.arrayBuffer();
  return new Response(audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'no-store',
    },
  });
}
