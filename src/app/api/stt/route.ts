import { trackAPICall } from '@/lib/costTracker';
import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { requirePaidSessionAccess } from '@/lib/paidMediaAccess';
import {
  exceedsContentLength,
  isValidSessionId,
  PAID_MEDIA_LIMITS,
} from '@/lib/requestLimits';

const OPENAI_STT_TIMEOUT_MS = 60_000;

export async function POST(request: Request) {
  if (exceedsContentLength(request, PAID_MEDIA_LIMITS.sttBodyBytes)) {
    return Response.json({ error: 'Payload too large' }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const audio = formData.get('audio');
  const sessionId = formData.get('sessionId');

  if (!(audio instanceof Blob)) {
    return Response.json({ error: 'audio is required' }, { status: 400 });
  }
  if (audio.size === 0) {
    return Response.json({ error: 'audio is empty' }, { status: 400 });
  }
  if (audio.size > PAID_MEDIA_LIMITS.sttAudioBytes) {
    return Response.json({ error: 'Audio is too large' }, { status: 413 });
  }
  if (audio.type && !audio.type.startsWith('audio/')) {
    return Response.json({ error: 'Unsupported audio type' }, { status: 415 });
  }
  if (!isValidSessionId(sessionId)) {
    return Response.json({ error: 'valid sessionId is required' }, { status: 400 });
  }

  const access = await requirePaidSessionAccess(request, sessionId);
  if (!access.ok) return access.response;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OpenAI API key not configured' }, { status: 503 });
  }

  const openaiForm = new FormData();
  openaiForm.append('file', audio, 'audio.webm');
  openaiForm.append('model', 'whisper-1');
  openaiForm.append('language', 'uk');
  openaiForm.append('response_format', 'verbose_json'); // needed for duration

  let res: Response;
  try {
    res = await fetchWithTimeout('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: openaiForm,
      signal: request.signal,
    }, OPENAI_STT_TIMEOUT_MS);
  } catch (error) {
    console.error('Whisper request failed:', error);
    return Response.json({ error: 'STT timed out or failed' }, { status: 504 });
  }

  if (!res.ok) {
    const err = await res.text();
    console.error('Whisper error:', res.status, err);
    return Response.json({ error: 'STT failed' }, { status: 502 });
  }

  const data = await res.json() as { text: string; duration?: number };

  // Track cost (non-blocking) — Whisper charges $0.006/min
  trackAPICall({
    sessionId,
    userId: access.user.id,
    provider: 'openai',
    type: 'stt',
    model: 'whisper-1',
    duration: data.duration,
  }).catch(console.error);

  return Response.json({ text: data.text });
}
