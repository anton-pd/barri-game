import { describe, it, expect } from 'vitest';
import { parseSegments, stripNpcTags, hasNpcSpeech } from '@/lib/segments';
import type { NPC } from '@/types';

const npcs: NPC[] = [
  { id: 'kovalska', name: 'Місіс Гаррієт Ковальська', description: '', voiceStyle: 'elderly_woman', secrets: [] } as NPC,
];

describe('parseSegments', () => {
  it('splits narration and NPC speech into ordered segments', () => {
    const raw = 'Ти заходиш до бібліотеки. [NPC:Місіс Гаррієт Ковальська]Що вам потрібно?[/NPC] Вона дивиться суворо.';
    const segs = parseSegments(raw, npcs);
    expect(segs).toHaveLength(3);
    expect(segs[0]).toMatchObject({ type: 'narration', text: 'Ти заходиш до бібліотеки.' });
    expect(segs[1]).toMatchObject({ type: 'npc', name: 'Місіс Гаррієт Ковальська', text: 'Що вам потрібно?' });
    expect(segs[2]).toMatchObject({ type: 'narration', text: 'Вона дивиться суворо.' });
  });

  it('resolves NPC voiceStyle via partial name match (short name)', () => {
    const segs = parseSegments('[NPC:Ковальська]Тихо.[/NPC]', npcs);
    expect(segs[0]).toMatchObject({ type: 'npc', voiceStyle: 'elderly_woman' });
  });

  it('falls back to keeper voice for an unknown NPC name', () => {
    const segs = parseSegments('[NPC:Незнайомець]Привіт.[/NPC]', npcs);
    expect(segs[0]).toMatchObject({ type: 'npc', voiceStyle: 'keeper' });
  });

  it('strips data-only action tags from narration', () => {
    const raw = 'Ти втрачаєш розум. [DELTA:{"0":{"sanity":-3}}] [LOCATION:study]';
    const segs = parseSegments(raw, npcs);
    expect(segs).toHaveLength(1);
    expect(segs[0].text).toBe('Ти втрачаєш розум.');
  });

  it('drops empty NPC speech', () => {
    const segs = parseSegments('[NPC:Ковальська][/NPC]', npcs);
    expect(segs).toHaveLength(0);
  });
});

describe('stripNpcTags', () => {
  it('keeps inner dialogue, removes the wrapper', () => {
    expect(stripNpcTags('[NPC:Хтось]Слова.[/NPC]')).toBe('Слова.');
  });

  it('removes orphan markers when a closing tag is missing', () => {
    expect(stripNpcTags('[NPC:Хтось]Обірвана думка')).toBe('Обірвана думка');
  });
});

describe('hasNpcSpeech', () => {
  it('is true when at least one NPC segment is present', () => {
    expect(hasNpcSpeech(parseSegments('[NPC:Ковальська]Так.[/NPC]', npcs))).toBe(true);
  });

  it('is false for pure narration', () => {
    expect(hasNpcSpeech(parseSegments('Просто опис.', npcs))).toBe(false);
  });
});
