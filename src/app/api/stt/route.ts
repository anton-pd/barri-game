import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/auth';
import { trackAPICall } from '@/lib/costTracker';

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OpenAI API key not configured' }, { status: 503 });
  }

  const formData = await request.formData();
  const audio     = formData.get('audio') as Blob | null;
  const sessionId = formData.get('sessionId') as string | null ?? undefined;

  if (!audio) {
    return Response.json({ error: 'audio is required' }, { status: 400 });
  }

  // Best-effort auth for cost tracking
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  const payload = token ? await verifyJwt(token) : null;
  const userId = payload?.sub;

  const openaiForm = new FormData();
  openaiForm.append('file', audio, 'audio.webm');
  openaiForm.append('model', 'whisper-1');
  openaiForm.append('language', 'uk');
  openaiForm.append('response_format', 'verbose_json'); // needed for duration

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: openaiForm,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Whisper error:', res.status, err);
    return Response.json({ error: 'STT failed' }, { status: 502 });
  }

  const data = await res.json() as { text: string; duration?: number };

  // Track cost (non-blocking) — Whisper charges $0.006/min
  if (userId) {
    trackAPICall({
      sessionId,
      userId,
      provider: 'openai',
      type: 'stt',
      model: 'whisper-1',
      duration: data.duration,
    }).catch(console.error);
  }

  return Response.json({ text: data.text });
}
