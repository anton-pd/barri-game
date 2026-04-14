# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [0.2.2] — 2026-04-14

### Changed
- **Mobile sidebar** — панель «Матеріали справи» тепер прихована на мобільних пристроях. Відкривається кнопкою 📋 в хедері як overlay поверх чату (slide-in справа, backdrop для закриття). На десктопі (md+) поведінка без змін — завжди видима (ANT-7)

---

## [0.2.1] — 2026-04-14

### Fixed
- **TTS: голос НПС** — пошук NPC по частковому імені (AI може писати `[NPC:Ковальська]` замість повного `[NPC:Місіс Гаррієт Ковальська]`); тепер voice/gender правильно підтягуються навіть при скороченому тегу (ANT-11)
- **TTS: кубики** — прибрано озвучення деталей кидка `(1к100, треба X або менше)`, `[65]`, `Успіх N, провал 1кN SAN`; голос каже лише «Кинь Навичка», у чаті текст залишається повним (ANT-10)

---

## [0.2.0] — 2026-04-13

### Added
- **AI Provider Toggle** — перемикання між Claude Sonnet 4.6, Gemini 2.5 Flash та Gemini 2.5 Pro прямо під час гри (⚙️ в хедері)
- **NPC Speech Bubbles** — репліки персонажів відображаються окремими бульбашками зі своїм ім'ям замість єдиного блоку Кіпера
- **Multi-speaker TTS** — кожен NPC озвучується своїм голосом (Gemini multi-speaker API); нарація — голос Кіпера
- **TTS Prefetch** — Gemini TTS починає генеруватись одразу після AI-відповіді, без очікування на кнопку «озвучити»
- **Modern UI + Mobile** — viewport meta, bottom-sheet modal, збільшені touch targets, iOS input zoom fix, кастомний scrollbar
- **Версія** — відображається у заголовку SessionList

### Changed
- Хедер GameChat: кнопки TTS та ambient перенесені в collapsible ⚙️ панель; хедер тепер вміщається на мобільному
- Кнопки +/− статів: розмір 28×28px (були 20×20px)
- Textarea input: `font-size: 16px` (запобігає авто-zoom на iOS Safari)
- `CaseFilesDrawer` повністю на ширину на mobile

### Fixed
- iOS Safari auto-zoom при фокусі на input/textarea
- 300ms затримка тапу на мобільних браузерах

---

## [0.1.0] — 2026-03-01

### Added
- Базова механіка Call of Cthulhu 7e: HP, Sanity, Luck, навички, кубики, Pushed rolls, SAN checks
- AI Keeper на Claude Sonnet з кешуванням system prompt
- Text-to-Speech: OpenAI TTS + Gemini 2.5 Flash TTS з перемикачем
- Speech-to-Text (Whisper через OpenAI)
- Ambient звук локацій з fade in/out
- Генерація зображень (Gemini 2.5 Flash Image) — сцени, документи, артефакти
- Мультигравцевий режим (до 4 гравців) з чергою дій
- Інвентар з предметами та лічильником використань
- Матеріали справи: бріфінг сценарію, біографії гравців, галерея зображень
- Два сценарії: «Примарний Будинок» та «Останній Телеграм»
- Авто-збереження стану сесії в PostgreSQL
- Підсумовування world state кожні 20 повідомлень (Claude Haiku)
