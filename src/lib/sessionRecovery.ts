export type SessionLoadOutcome = 'ok' | 'auth' | 'unavailable';

export function classifySessionLoad(params: {
  sessionsStatus: number;
  scenariosStatus: number;
  authStatus: number;
}): SessionLoadOutcome {
  if (params.sessionsStatus === 401 || params.authStatus === 401) {
    return 'auth';
  }

  const statuses = [params.sessionsStatus, params.scenariosStatus, params.authStatus];
  return statuses.every((status) => status >= 200 && status < 300)
    ? 'ok'
    : 'unavailable';
}

export function sessionCreateErrorCopy(
  language: 'uk' | 'en',
  status?: number
): string {
  if (status === 403) {
    return language === 'en'
      ? 'You cannot open a new case with this account right now.'
      : 'Цей акаунт зараз не може відкрити нову справу.';
  }

  return language === 'en'
    ? 'Could not open the case. Your draft is saved here — try again.'
    : 'Не вдалося відкрити справу. Чернетка збережена тут — спробуйте ще раз.';
}
