import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('..', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');

describe('deploy quality and smoke contract', () => {
  it('runs the quality gate before SSH deploy and a health smoke after it', () => {
    const workflow = read('.github/workflows/deploy.yml');

    expect(workflow).toContain('quality:');
    expect(workflow).toContain('needs: quality');
    expect(workflow).toContain('./scripts/ci-quality-gate.sh');
    expect(workflow).toContain('./scripts/smoke-health.sh');
  });

  it('keeps clean install and all release checks in the reusable quality gate', () => {
    const qualityGate = read('scripts/ci-quality-gate.sh');

    expect(qualityGate).toContain('npm ci');
    expect(qualityGate).toContain('npm test');
    expect(qualityGate).toContain('npx tsc --noEmit');
    expect(qualityGate).toContain('npm run lint');
    expect(qualityGate).toContain('npm run build');
  });

  it('fails the health smoke for a non-200 response or unexpected JSON', () => {
    const smoke = read('scripts/smoke-health.sh');

    expect(smoke).toContain('"${status}" != "200"');
    expect(smoke).toContain('payload != expected');
    expect(smoke).toContain('"status": "ok"');
  });
});
