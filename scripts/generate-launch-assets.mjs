#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const outDir = path.join(root, 'public/launch-assets');

function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseSvg({ width, height, children }) {
  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="blood" cx="78%" cy="18%" r="52%">
      <stop offset="0" stop-color="#7c2018" stop-opacity="0.78"/>
      <stop offset="0.44" stop-color="#351016" stop-opacity="0.34"/>
      <stop offset="1" stop-color="#07060a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="paper" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#e6d6ad"/>
      <stop offset="1" stop-color="#9f8658"/>
    </linearGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0.75 0 0 0 0 0.68 0 0 0 0 0.55 0 0 0 0.16 0"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="#07060a"/>
  <rect width="100%" height="100%" fill="url(#blood)"/>
  <rect x="34" y="34" width="${width - 68}" height="${height - 68}" fill="none" stroke="#a8936a" stroke-opacity="0.42"/>
  <rect width="100%" height="100%" filter="url(#grain)" opacity="0.34"/>
  ${children}
</svg>`;
}

function header(width, title = 'BARRI') {
  return `
  <g>
    <circle cx="74" cy="70" r="28" fill="none" stroke="#cdbb8e" stroke-width="2"/>
    <text x="74" y="80" text-anchor="middle" font-family="Georgia, serif" font-size="31" fill="#d8c8a6">B</text>
    <text x="116" y="80" font-family="Georgia, serif" font-size="31" letter-spacing="8" fill="#d8c8a6">${esc(title)}</text>
    <line x1="${width - 330}" y1="72" x2="${width - 70}" y2="72" stroke="#a8936a" stroke-opacity="0.5"/>
    <text x="${width - 70}" y="62" text-anchor="end" font-family="Courier New, monospace" font-size="17" letter-spacing="5" fill="#d4a153">AI CASE CURATOR</text>
  </g>`;
}

function label(x, y, text, color = '#d4a153') {
  return `<text x="${x}" y="${y}" font-family="Courier New, monospace" font-size="18" letter-spacing="6" fill="${color}">${esc(text)}</text>`;
}

function multiline({ x, y, lines, size = 54, fill = '#e6d6ad', lineHeight = 1.05, weight = 700, family = 'Georgia, serif', letterSpacing = 0 }) {
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" letter-spacing="${letterSpacing}" fill="${fill}">${lines.map((line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : size * lineHeight}">${esc(line)}</tspan>`).join('')}</text>`;
}

function caseCard({ x, y, w, h, id, title, meta, body, accent = '#d4a153' }) {
  const bodyY = y + 159;
  const footerY = y + h - 35;

  return `
  <g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#111017" stroke="#a8936a" stroke-opacity="0.55"/>
    <rect x="${x + 18}" y="${y + 18}" width="${w - 36}" height="96" fill="url(#paper)" opacity="0.92"/>
    <text x="${x + 36}" y="${y + 54}" font-family="Courier New, monospace" font-size="13" letter-spacing="4" fill="#4e3825">${esc(id)}</text>
    <text x="${x + 36}" y="${y + 91}" font-family="Georgia, serif" font-size="32" font-weight="700" fill="#130f12">${esc(title)}</text>
    <text x="${x + 24}" y="${y + 134}" font-family="Courier New, monospace" font-size="13" letter-spacing="3" fill="${accent}">${esc(meta)}</text>
    <text x="${x + 24}" y="${bodyY}" font-family="Georgia, serif" font-size="18" fill="#d8c8a6">${body.map((line, i) => `<tspan x="${x + 24}" dy="${i === 0 ? 0 : 21}">${esc(line)}</tspan>`).join('')}</text>
    <rect x="${x + 24}" y="${footerY}" width="${w - 48}" height="25" fill="none" stroke="${accent}" stroke-opacity="0.8"/>
    <text x="${x + w / 2}" y="${footerY + 17}" text-anchor="middle" font-family="Courier New, monospace" font-size="10" letter-spacing="4" fill="${accent}">REPLAYABLE CASE</text>
  </g>`;
}

async function writeSvgPng(file, svg, width, height) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await sharp(Buffer.from(svg)).png().resize(width, height).toFile(file);
}

async function makeProductHuntCaseFiles() {
  const width = 1270;
  const height = 760;
  const svg = baseSvg({
    width,
    height,
    children: `
      ${header(width)}
      ${label(76, 152, 'PRODUCT HUNT GALLERY / CASE FILES')}
      ${multiline({ x: 76, y: 230, lines: ['Choose a case.', 'Play it differently.'], size: 68, fill: '#e3d1a9' })}
      <text x="78" y="382" font-family="Georgia, serif" font-size="25" fill="#a99672">Barri ships with a free playable demo and a cabinet of full horror investigations.</text>
      ${caseCard({ x: 78, y: 430, w: 342, h: 250, id: 'FILE 00', title: 'Archive Door', meta: 'NO ACCOUNT DEMO', body: ['A 15-minute playable preview', 'with free text, clues, and rolls.'] })}
      ${caseCard({ x: 464, y: 430, w: 342, h: 250, id: 'FILE 01', title: 'Black Ledger', meta: 'NOIR HORROR', body: ['A debt book counts guilt', 'instead of money.'] })}
      ${caseCard({ x: 850, y: 430, w: 342, h: 250, id: 'FILE 02', title: 'Last Telegram', meta: 'TABLETOP MYSTERY', body: ['Investigate, improvise,', 'and let d100 decide.'] })}
    `,
  });
  await writeSvgPng(path.join(outDir, 'product-hunt/gallery-03-case-files-1270x760.png'), svg, width, height);
}

async function makeProductHuntProof() {
  const width = 1270;
  const height = 760;
  const features = [
    ['NO ACCOUNT DEMO', 'Launch visitors can try the demo immediately.'],
    ['FREE TEXT PLAY', 'Players type natural actions instead of canned branches.'],
    ['D100 HORROR RULES', 'Skill checks and consequences run inside the browser table.'],
    ['PERSISTENT CASE STATE', 'Clues, NPCs, injuries, and choices stay in the file.'],
  ];
  const rows = features.map(([title, body], i) => {
    const y = 404 + i * 72;
    return `
      <g>
        <rect x="682" y="${y - 36}" width="508" height="54" fill="#111017" stroke="#a8936a" stroke-opacity="0.35"/>
        <text x="706" y="${y - 13}" font-family="Courier New, monospace" font-size="14" letter-spacing="4" fill="#d4a153">${esc(title)}</text>
        <text x="706" y="${y + 10}" font-family="Georgia, serif" font-size="17" fill="#d8c8a6">${esc(body)}</text>
      </g>`;
  }).join('');
  const svg = baseSvg({
    width,
    height,
    children: `
      ${header(width)}
      ${label(76, 152, 'PRODUCT HUNT GALLERY / WHY IT WORKS')}
      ${multiline({ x: 76, y: 240, lines: ['A tabletop horror', 'session in one tab.'], size: 66, fill: '#e3d1a9', lineHeight: 1.02 })}
      <rect x="78" y="454" width="520" height="150" fill="#111017" stroke="#a8936a" stroke-opacity="0.48"/>
      <text x="116" y="505" font-family="Courier New, monospace" font-size="17" letter-spacing="5" fill="#d4a153">LIVE TRANSCRIPT</text>
      <text x="116" y="552" font-family="Georgia, serif" font-size="26" fill="#d8c8a6">“I inspect the brass hinges...”</text>
      <text x="116" y="594" font-family="Georgia, serif" font-size="23" fill="#a99672">The Curator tracks clues and calls for a roll.</text>
      ${rows}
    `,
  });
  await writeSvgPng(path.join(outDir, 'product-hunt/gallery-04-product-proof-1270x760.png'), svg, width, height);
}

async function makeProductHuntThumbnail() {
  const size = 240;
  const svg = baseSvg({
    width: size,
    height: size,
    children: `
      <circle cx="120" cy="86" r="46" fill="none" stroke="#d4a153" stroke-width="3"/>
      <text x="120" y="104" text-anchor="middle" font-family="Georgia, serif" font-size="56" font-weight="700" fill="#e6d6ad">B</text>
      <text x="120" y="162" text-anchor="middle" font-family="Georgia, serif" font-size="28" letter-spacing="7" fill="#e6d6ad">BARRI</text>
      <text x="120" y="194" text-anchor="middle" font-family="Courier New, monospace" font-size="11" letter-spacing="2" fill="#d4a153">AI CASE CURATOR</text>
    `,
  });
  await writeSvgPng(path.join(outDir, 'product-hunt/thumbnail-240x240.png'), svg, size, size);
}

async function makeItchCover() {
  const width = 315;
  const height = 250;
  const svg = baseSvg({
    width,
    height,
    children: `
      <rect x="24" y="22" width="267" height="206" fill="#101016" stroke="#a8936a" stroke-opacity="0.55"/>
      <text x="44" y="56" font-family="Courier New, monospace" font-size="10" letter-spacing="4" fill="#d4a153">BROWSER TABLETOP HORROR</text>
      <text x="44" y="106" font-family="Georgia, serif" font-size="42" font-weight="800" fill="#e6d6ad">Barri</text>
      <text x="44" y="136" font-family="Georgia, serif" font-size="22" font-weight="700" fill="#bf3f2f">AI Case Curator</text>
      <rect x="44" y="160" width="112" height="36" fill="none" stroke="#d4a153" stroke-opacity="0.8"/>
      <text x="100" y="184" text-anchor="middle" font-family="Courier New, monospace" font-size="13" letter-spacing="3" fill="#d4a153">d100</text>
      <text x="174" y="173" font-family="Georgia, serif" font-size="16" fill="#d8c8a6">Free demo</text>
      <text x="174" y="196" font-family="Georgia, serif" font-size="16" fill="#d8c8a6">No install</text>
    `,
  });
  await writeSvgPng(path.join(outDir, 'itch/cover-315x250.png'), svg, width, height);
}

async function makeItchCaseCabinet() {
  const width = 1280;
  const height = 720;
  const svg = baseSvg({
    width,
    height,
    children: `
      ${header(width)}
      ${label(76, 150, 'ITCH.IO SCREENSHOT / CASE CABINET')}
      ${multiline({ x: 76, y: 232, lines: ['Open the file.', 'Choose your horror.'], size: 72, fill: '#e3d1a9' })}
      <text x="80" y="375" font-family="Georgia, serif" font-size="25" fill="#a99672">A free demo first, then full investigations with their own clues, locations, and suspects.</text>
      ${caseCard({ x: 80, y: 430, w: 344, h: 220, id: 'FREE', title: 'Archive Door', meta: 'PLAY NOW', body: ['Fifteen minutes.', 'No account required.'] })}
      ${caseCard({ x: 468, y: 430, w: 344, h: 220, id: 'NOIR', title: 'Black Ledger', meta: 'NEW CASE', body: ['Debts, guilt, rain,', 'and a book that writes back.'] })}
      ${caseCard({ x: 856, y: 430, w: 344, h: 220, id: 'MYSTERY', title: 'Telegram', meta: 'D100 TABLE', body: ['Ask questions.', 'Roll when it matters.'] })}
    `,
  });
  await writeSvgPng(path.join(outDir, 'itch/screenshot-03-case-cabinet-1280x720.png'), svg, width, height);
}

await makeProductHuntCaseFiles();
await makeProductHuntProof();
await makeProductHuntThumbnail();
await makeItchCover();
await makeItchCaseCabinet();
