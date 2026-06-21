import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { absoluteUrl, jsonLd, SITE_URL } from '@/app/seo';

describe('public SEO routes', () => {
  it('keeps the sitemap focused on indexable acquisition pages', () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(urls).toEqual([absoluteUrl('/'), absoluteUrl('/demo')]);
    expect(urls).not.toContain(absoluteUrl('/auth/register'));
    expect(urls).not.toContain(absoluteUrl('/sessions'));
  });

  it('blocks private and API surfaces from crawling', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;

    expect(config.sitemap).toBe(absoluteUrl('/sitemap.xml'));
    expect(config.host).toBe(SITE_URL);
    expect(rules.allow).toBe('/');
    expect(rules.disallow).toEqual(expect.arrayContaining([
      '/admin/',
      '/api/',
      '/auth/',
      '/account/',
      '/session/',
      '/sessions/',
    ]));
  });

  it('escapes structured data before rendering it into a script tag', () => {
    expect(jsonLd({ name: '<script>alert(1)</script>' })).not.toContain('<script>');
  });
});
