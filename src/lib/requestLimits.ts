export const PAID_MEDIA_LIMITS = {
  sessionIdChars: 128,
  ttsBodyBytes: 64 * 1024,
  ttsTextChars: 5_000,
  ttsSegments: 64,
  sttBodyBytes: 12 * 1024 * 1024,
  sttAudioBytes: 10 * 1024 * 1024,
  imagePromptChars: 1_000,
} as const;

export class PayloadTooLargeError extends Error {
  constructor(message = 'Payload too large') {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

export class InvalidJsonError extends Error {
  constructor() {
    super('Invalid JSON');
    this.name = 'InvalidJsonError';
  }
}

export function exceedsContentLength(request: Request, maxBytes: number): boolean {
  const raw = request.headers.get('content-length');
  if (!raw) return false;
  const length = Number(raw);
  return Number.isFinite(length) && length > maxBytes;
}

export async function readJsonWithLimit(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  if (exceedsContentLength(request, maxBytes)) {
    throw new PayloadTooLargeError();
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    throw new PayloadTooLargeError();
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new InvalidJsonError();
  }
}

export function isValidSessionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= PAID_MEDIA_LIMITS.sessionIdChars
  );
}
