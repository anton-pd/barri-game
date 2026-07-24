import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifySessionLoad, sessionCreateErrorCopy } from '@/lib/sessionRecovery';

describe('session recovery', () => {
  it('distinguishes expired auth from transient load failures', () => {
    expect(classifySessionLoad({
      sessionsStatus: 401,
      scenariosStatus: 200,
      authStatus: 401,
    })).toBe('auth');
    expect(classifySessionLoad({
      sessionsStatus: 500,
      scenariosStatus: 200,
      authStatus: 200,
    })).toBe('unavailable');
    expect(classifySessionLoad({
      sessionsStatus: 200,
      scenariosStatus: 503,
      authStatus: 200,
    })).toBe('unavailable');
  });

  it('provides localized, non-technical create errors', () => {
    expect(sessionCreateErrorCopy('uk')).toContain('Чернетка збережена');
    expect(sessionCreateErrorCopy('en')).toContain('draft is saved');
    expect(sessionCreateErrorCopy('uk', 403)).not.toContain('403');
  });

  it('keeps DB exceptions out of the not-found path and exposes safe retry UI', () => {
    const page = readFileSync(
      new URL('../src/app/session/[id]/page.tsx', import.meta.url),
      'utf8'
    );
    const errorPage = readFileSync(
      new URL('../src/app/session/[id]/error.tsx', import.meta.url),
      'utf8'
    );

    expect(page).not.toContain('catch {\\n    return null;');
    expect(page).toContain('if (!session) return null');
    expect(errorPage).toContain('unstable_retry');
    expect(errorPage).toContain('Справу тимчасово недоступно');
    expect(errorPage).not.toContain('error.message');
  });

  it('keeps create failures inline without closing or clearing the draft', () => {
    const sessionList = readFileSync(
      new URL('../src/components/SessionList.tsx', import.meta.url),
      'utf8'
    );
    const createBody = sessionList.slice(
      sessionList.indexOf('async function createSession()'),
      sessionList.indexOf('async function deleteSession')
    );

    expect(createBody).toContain('setCreateError');
    expect(createBody).not.toContain('closeModal()');
    expect(createBody).not.toContain("setSessionName('')");
    expect(createBody).toContain('if (!session.id)');
  });

  it('fails closed when a successful load has malformed JSON shapes', () => {
    const sessionList = readFileSync(
      new URL('../src/components/SessionList.tsx', import.meta.url),
      'utf8'
    );

    expect(sessionList).toContain(
      '!Array.isArray(rawSessions) || !Array.isArray(rawScenarios) || !meData?.id'
    );
    expect(sessionList).toContain('session_list_invalid_response');
  });
});
