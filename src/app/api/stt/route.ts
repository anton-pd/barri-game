export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'OpenAI API key not configured' }, { status: 503 });
  }

  const formData = await request.formData();
  const audio = formData.get('audio') as Blob | null;

  if (!audio) {
    return Response.json({ error: 'audio is required' }, { status: 400 });
  }

  const openaiForm = new FormData();
  openaiForm.append('file', audio, 'audio.webm');
  openaiForm.append('model', 'whisper-1');
  openaiForm.append('language', 'uk');

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

  const data = await res.json() as { text: string };
  return Response.json({ text: data.text });
}
