#!/usr/bin/env node
/**
 * ANT-99 — generate painterly pulp-poster cover art for each scenario.
 *
 * Writes <targetDir>/<scenarioId>/cover.jpg using Gemini gemini-2.5-flash-image.
 * Covers are kept SEPARATE from `staticImages` (they're card hero art, not
 * in-game evidence). `/api/scenarios` prefers cover.jpg when present.
 *
 * Usage:
 *   GEMINI_API_KEY=... node scripts/generate-covers.mjs [targetDir] [--force] [onlyId]
 *   default targetDir = /opt/apps/shared_data/public/scenarios (the live volume)
 */
import fs from 'node:fs';
import path from 'node:path';

const STYLE =
  'painted as a 1920s occult-detective pulp mystery movie poster, dramatic painterly key art, ' +
  'moody chiaroscuro lighting, atmospheric fog, muted sepia and teal palette with a single warm amber ' +
  'light source, deep shadows, weathered vintage texture, cinematic wide landscape composition, highly ' +
  'detailed, ominous Lovecraftian mood, absolutely no text, no lettering, no words, no title, no typography';

// Hand-authored subject per scenario (the "придумати" part).
const SUBJECTS = {
  'the-haunting':
    'a foreboding derelict Victorian house looming over a rain-slicked Boston street at dusk in the 1920s, ' +
    'one dim amber-lit window, bare twisted trees, wet cobblestones reflecting gaslight, a sense of dread',
  'the-last-telegram':
    'a lonely Boston telegraph office on a grim rainy November morning in the 1920s, a single ominous telegram ' +
    'on a worn wooden desk, telegraph wires vanishing into cold fog, faint silhouette at a frosted window',
  'barcelona-stones-of-the-unfinished':
    'the unfinished Sagrada Familia rising like the ribcage of a giant against a brooding autumn dusk in 1920s ' +
    'Barcelona, half-carved stone facades, scaffolding shrouded in sea mist, an ancient symbol faintly glowing ' +
    'among the stones, ominous and sacred',
};

const targetDir = process.argv[2] && !process.argv[2].startsWith('--')
  ? process.argv[2]
  : '/opt/apps/shared_data/public/scenarios';
const force = process.argv.includes('--force');
const onlyId = process.argv.slice(2).find((a) => !a.startsWith('--') && a !== targetDir);

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

async function generate(subject) {
  const full = `${subject}, ${STYLE}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: full }] }],
    generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 5000 * attempt));
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    );
    if (res.status === 429) { console.warn(`  rate-limited, retry ${attempt + 1}`); continue; }
    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part?.inlineData) throw new Error('no image in response');
    return Buffer.from(part.inlineData.data, 'base64');
  }
  throw new Error('rate limit after 3 attempts');
}

const ids = onlyId ? [onlyId] : Object.keys(SUBJECTS);
for (const id of ids) {
  const subject = SUBJECTS[id];
  if (!subject) { console.warn(`! no subject for ${id}, skip`); continue; }
  const dir = path.join(targetDir, id);
  const file = path.join(dir, 'cover.jpg');
  if (fs.existsSync(file) && !force) { console.log(`= ${id} cover exists, skip (use --force)`); continue; }
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  process.stdout.write(`… generating ${id} … `);
  try {
    const buf = await generate(subject);
    fs.writeFileSync(file, buf);
    console.log(`OK (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.log(`FAILED: ${e.message}`);
  }
}
console.log('done.');
