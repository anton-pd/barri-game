# Design System

## Overview

Barri's public landing surface uses a noir dossier system: dark ink backgrounds, aged paper cards, typewriter labels, serif display headlines, wax-seal red accents, and procedural case-file structure. The design should feel physical and investigative while staying legible on mobile and desktop.

## Color

- Ink surfaces: `#07060a`, `#0d0b10`, `#14111a`, `#1c1824`
- Paper text and cards: `#d8c8a6`, `#c3b088`, `#a8936a`
- Muted paper/rule color: use `#8f7b56` or lighter on dark backgrounds; avoid `#6b5a3e` as body text on ink.
- Amber accent: `#f0c77a`, `#d4a153`, `#a77a2c`
- Evidence red: use brighter red on dark backgrounds for text (`#e05a43` or similar); reserve darker reds for shadows, stamps, and paper surfaces.

Contrast matters more than antique patina. If a label is important enough to read, it must pass AA or be large enough to satisfy large-text contrast.

## Typography

- Display: `Playfair Display` for large case-file headlines and dramatic headings.
- Narrative/body: `IM Fell English` with fallbacks for the landing's old-print voice.
- Mechanical labels: `Special Elite` / PT Mono stack for case numbers, buttons, metadata, and short tags.
- Blackletter is decorative only: seals or background marks, never body copy.

Avoid long all-caps passages. Uppercase is acceptable for short stamps, buttons, and compact metadata labels. Body and explanatory copy should keep normal casing.

## Layout

- Page structure is a sequence of case-file sections with generous vertical rhythm.
- The hero is a two-column product proof: proposition and live game preview.
- Cards are acceptable where the metaphor is literal: case files, evidence records, testimony notes.
- Repeated section markers should not become generic eyebrow scaffolding. Use them sparingly or hide them from the main visual hierarchy when the heading already carries the section.

## Components

- Buttons use typewriter labels, rectangular forms, and offset stamp shadows.
- Case cards use paper backgrounds, rotated file shapes, stamped states, and metadata rows.
- Preview panels use dark terminal/bureau surfaces with readable paper text.
- Language and navigation controls stay compact but must keep 44px touch targets where practical.

## Motion

Texture and reveal motion should be atmospheric, never blocking content. All animations must preserve readable default content and respect `prefers-reduced-motion`.

## Accessibility

- Maintain semantic heading order.
- Decorative section labels should not create skipped heading hierarchies.
- Links and buttons need visible focus states.
- Text on dark backgrounds should use readable paper or amber tones, not low-contrast brown.
