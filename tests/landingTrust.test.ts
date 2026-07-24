import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('landing trust claims', () => {
  it('does not render unverified testimonial names or quotations', () => {
    const landing = read('../src/app/LandingClient.tsx');
    const content = read('../src/app/content.ts');

    expect(landing).not.toContain('testimony');
    expect(landing).not.toContain('<q>');
    expect(content).not.toContain('testimony:');
    expect(content).not.toContain('J. Harwell');
    expect(content).not.toContain('Mrs. E. Orne');
    expect(content).not.toContain('Dr. A. Pettigrew');
  });

  it('keeps landing JSON-LD free of reviews and aggregate ratings', () => {
    const page = read('../src/app/page.tsx');

    expect(page).toContain('"@type": "SoftwareApplication"');
    expect(page).not.toContain('"@type": "Review"');
    expect(page).not.toContain('aggregateRating');
    expect(page).not.toContain('reviewRating');
  });
});
