# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

---

## [0.3.24] — 2026-04-18

### Fixed
- **Обрив intro/відповідей Keeper на Gemini (ANT-58)**: Gemini 2.5 витрачав `maxOutputTokens` на приховані "thinking" токени, лишаючи на видимий текст ~30-40 токенів → `finishReason=MAX_TOKENS` при коротенькій відповіді. `callGeminiChat` тепер передає `thinkingConfig: { thinkingBudget: 0 }`, вимикаючи reasoning для game chat. Narrative output більше не обрізається.

### Changed
- **Gemini діагностика (ANT-58/60, Фаза 1)**: `callGeminiChat` у `/api/ai` тепер логує `finishReason`, `safetyRatings`, `promptFeedback.blockReason`, `thoughtsTokenCount`, довжину та межі тексту для intro-запитів, коротких відповідей (< 200 символів) і будь-якого не-`STOP` фінішу.

---

## [0.3.23] — 2026-04-18

### Changed
- **Ruleset-driven stats (ANT-63)**: DELTA-контракт і рендеринг статів перероблено на ruleset-driven. Player `stats` map тепер canonical source; legacy HP/SAN/LCK поля лишаються як backward-compat dзеркало. `StatsBar`/`CaseFilesPanel` і keeper-prompt генерують stat-лінію з `RULESETS[…].stats`, тому non-CoC системи підтримуються end-to-end.
- **Localized keeper prompt (ANT-64)**: коли сесія `language='en'`, весь системний prompt (plot guardrails, inventory/stat/image/location/NPC/completion sections, dice rules для CoC 7e та Kids on Bikes, intro instruction) тепер повністю англійською. Tag syntax незмінний.

### Fixed
- **Multi-action attribution (ANT-61)**: `/api/ai` більше не додає додатковий `[Name]:` префікс над уже відформатованим multi-player batch від клієнта, тому кіпер коректно адресує реплики по гравцях.
- **Double item consumption (ANT-62)**: сервер став єдиним authoritative джерелом inventory; клієнтське подвійне списання по `pendingItemUsesRef` прибрано. Одна дія тепер списує рівно 1 заряд, 1-use предмети зникають вчасно, не раніше.

---

## [0.3.22] — 2026-04-18

### Changed
- **Session completion UX (ANT-39)**: верхню active-session плашку прибрано. Замість неї статус сесії тепер показується компактними тегами біля назви та локації, а ручне завершення лишається тільки в settings як дострокове закриття.

### Fixed
- **Keeper-triggered completion (ANT-39)**: AI prompt/API flow тепер підтримують фінальні теги `[COMPLETE_SESSION]` та `[FINISH_EVENING]`, щоб Кіпер міг завершити сесію або вечір кампанії у природному фіналі без окремого in-flow CTA.
- **Completion analytics (ANT-39)**: у БД та адмінці тепер окремо видно нормально завершені сесії і сесії, закриті достроково.

---

## [0.3.21] — 2026-04-18

### Fixed
- **Scenario list refresh (ANT-44)**: адмінський `Scenario List` тепер показує всі сценарії з файлового сховища, навіть якщо по них ще немає session/cost stats, і оновлюється одразу після успішного save в генераторі.

---

## [0.3.20] — 2026-04-18

### Fixed
- **Lint cleanup (ANT-57)**: прибрано застарілі warnings у `src/app/api/ai/route.ts` після попередніх рефакторів. Поведінка не змінена; targeted lint по файлу тепер чистий.

---

## [0.3.19] — 2026-04-18

### Changed
- **Scenario generator save flow**: `Save` в адмінському генераторі тепер одразу запускає static image + ambient materialization і повертає явний статус по кожному етапу, замість “тихого” запису JSON без end-to-end feedback.

### Fixed
- **Scenario materials generation (ANT-45)**: save-route більше не падає всім запитом через одну asset-помилку. Static images та ambient обробляються окремо, а partial failures повертаються в UI як diagnostics.
- **Ambient runtime sync (ANT-41)**: після `[LOCATION]`/`[NEW_LOCATION]` сервер тепер одразу синхронізує `currentLocationGroup` з реальною новою локацією і віддає `ambientFile` для кожного переходу, щоб loop не губився через застарілий group-tracking.

---

## [0.3.17] — 2026-04-18

### Added
- **Ambient audio pipeline (ANT-30)**: `src/lib/ambient.ts` + `POST /api/scenarios/[id]/ambient` — ElevenLabs-based ambient генерація для static scenario locations/groups під час materials flow. Результат зберігається в shared `public/scenarios/<scenario>/ambient/` і записується в `ambientFile` у `scenario.json`.

### Changed
- **Runtime ambient resolution**: `src/app/api/ai/route.ts`, `src/app/session/[id]/page.tsx`, `src/components/GameChat.tsx` більше не конструюють URL з `locationId` — читають `ambientFile` зі сценарію (в т.ч. після reload).
- **Scenarios refresh**: оновлено `the-haunting` і `the-last-telegram` під новий контракт; попередні версії заархівовано в `scenarios/archive/2026-04-18/`. Тестовий `the-last-cup.json` прибрано з активних сценаріїв.

### Fixed
- **Post-deploy verification (ANT-23)**: генератор успішно відпрацював на проді з Opus 4.7 → fallback Gemini 2.5 Pro pipeline. Фікс підтверджено живим запуском.

---

## [0.3.16] — 2026-04-18

### Fixed
- **Scenario generator (ANT-23)**: перестав падати на великих сценаріях. Raised `max_tokens` 10 000 → 32 000 і переведено primary-модель на Claude Opus 4.7 з prompt caching на system prompt (~90% економії input на повторних викликах). Додано fallback на Gemini 2.5 Pro з `responseMimeType: application/json`, якщо Opus впав (timeout / parse error / 5xx).
- **Scenario generator — JSON parsing**: шукаємо text-блок у відповіді (а не припускаємо `content[0]`), знімаємо markdown fences надійнішим regex, на парсі-фейлі витягаємо підрядок від першого `{` до останнього `}`. Сервер логує `stop_reason` + `input/output_tokens`.
- **Scenario generator — timeouts**: `/api/admin/generate-scenario` тепер `runtime: 'nodejs'` + `maxDuration: 300`, щоб довга генерація не отримувала HTML 504 від reverse proxy (що давало `SyntaxError: Unexpected token '<'` у клієнта).
- **Scenario generator — Opus streaming**: Opus-path переведено на Anthropic streaming API, тому великі сценарії більше не падають у fallback на Gemini через SDK-помилку `Streaming is required for operations that may take longer than 10 minutes`.
- **Scenario provenance labels**: збережені generated scenarios тепер мають `generatedBy` metadata (`provider/model/fallbackFrom`), а в admin `Scenario List` з’явилась колонка `Source` з мітками `Opus`, `Gemini`, `Claude` або `legacy`.
- **Scenario generator UI**: клієнт парсить тіло як текст і акуратно показує HTTP-статус + перші 500 символів, якщо відповідь не JSON. Додано meta-рядок (`provider`, `model`, `input/output tokens`, `fallback`) над згенерованим JSON.

### Changed
- **Docs**: шляхи `/opt/apps/cthulhu` / `cthulhu-prod` у `CLAUDE.md`, `AGENTS.md`, `PROJECT_CONTEXT.md` замінено на актуальні `/opt/apps/barri` (prod), `/opt/apps/barri-dev` (staging) та `/opt/apps/shared_data/{scenarios,public/scenarios}` (shared volume). Команди деплою приведено у відповідність.

---

## [0.3.15] — 2026-04-17

### Fixed
- **Stale version badge**: футер на головній більше не зашитий на `v0.2.0` — версія тепер читається з `package.json` (`import { version }`), і `package.json` піднято до актуальної (ANT-29). Наступні релізи підсвічуватимуться автоматично при бампі версії.

---

## [0.3.14] — 2026-04-17

### Fixed
- **Dynamic image fullscreen**: `DynamicImage` fullscreen overlay now renders via `createPortal` to `document.body`, escaping the transformed sidebar wrapper that was trapping the preview inside the sidebar for sessions with dynamic session images.

---

## [0.3.13] — 2026-04-17

### Changed
- **Linear workflow finalization**: `LINEAR.md` перетворено на єдине джерело правди для Claude/Codex з фінальним lifecycle, mandatory pre-review checklist, `small-task` критеріями та review comment шаблоном.
- **Linear access policy**: закріплено режим **API-only** (`LINEAR_API_KEY`) без MCP/OAuth fallback у `LINEAR.md`, `AGENTS.md`, `CLAUDE.md`.
- **Docs sync**: `PROJECT_CONTEXT.md` приведено до фактичного статусу `Ready for deploy` (було `Ready for Deployment`).

---

## [0.3.12] — 2026-04-17

### Fixed
- **CaseFiles sidebar**: fullscreen preview for static scenario images now opens outside the transformed sidebar wrapper, so it covers the full viewport on mobile and desktop (ANT-24).

---

## [0.3.11] — 2026-04-17

### Changed
- **Docs sync**: `AGENTS.md` доповнено окремим розділом `Codex-Specific Rules` для Linear workflow та пріоритету MCP/plugin над API.

---

## [0.3.10] — 2026-04-17

### Changed
- **Docs sync**: `AGENTS.md` приведено у відповідність до фактичної структури проєкту та `LINEAR.md`; додано коротку карту репозиторію й зафіксовано Linear MCP/plugin як preferred path.

---

## [0.3.9] — 2026-04-17

### Changed
- **Gemini TTS pricing**: модель білінгу змінено з per-char на per-token з окремими цінами на input ($0.50/M tok) і output ($2.00/M tok). Pricing editor показує TTS поряд з LLM у секції "Per token" (ANT-27).
- **Admin → Usage**: input/output для TTS тепер показуються в токенах ("N tok"); старі записи — з префіксом "~" (ANT-27).

---

## [0.3.8] — 2026-04-17

### Changed
- **Admin → Usage tab**: нова секція "By Scenario" з кількістю сесій, завершеннями, середньою вартістю та загальними витратами по кожному сценарію (ANT-26).
- **Admin → Scenarios tab**: "Scenario List" тепер показує лише session stats (без вартості) (ANT-26).
- **Admin → Usage → By Model**: колонка Input тепер коректно показує `chars` для TTS та `input_tokens` для image; колонка Output для TTS — формат "N tok / N ch" (ANT-27).
- **Admin → Settings → Model Pricing**: Gemini image переміщено в секцію TTS/Image/STT; TTS-моделі показують input price в $/1M tok форматі (ANT-27).

---

## [0.3.7] — 2026-04-17

### Added
- **Admin → Scenarios tab**: таблиця зі статистикою всіх сценаріїв — кількість сесій, завершень (з відсотком), середня кількість повідомлень, середня та загальна вартість (ANT-25, ANT-26).

### Fixed
- **Usage tracking**: тепер зберігаються output tokens для Gemini image generation (`totalTokenCount - promptTokenCount`) — раніше трекувались лише input tokens (ANT-27).

---

## [0.3.15] — 2026-04-17

### Added
- **Ambient audio generation (Phase 10)** — додано `POST /api/scenarios/[id]/ambient`, який генерує seamless ambient loop-и через ElevenLabs для `locationGroups` сценарію, зберігає `.mp3` у shared VPS storage і записує `ambientFile` назад у `scenario.json`.

### Changed
- **Ambient playback runtime** — ігровий клієнт більше не вгадує шлях як `/sounds/<locationId>.mp3`, а використовує фактичний `ambientFile` із сценарію. Це вирівнює runtime з `locationGroups` і дає коректне відновлення ambient після reload.
- **Session startup materials flow** — під час старту сесії ambient generation тепер тригериться поруч із генерацією статичних scenario materials, але тільки для статичних сценарних локацій. Для dynamic locations автоматичну генерацію поки не вмикаємо.
- **Scenario generator admin UI** — підказку `Phase 10` прибрано; тепер UI пояснює, що ambient генерується пізніше на етапі scenario materials generation.
- **Canonical scenarios refreshed** — `the-haunting` і `the-last-telegram` перезібрані під новий generator contract: `rolePresets`, повний `briefing`, soundPrompt на static locations, коректні `supportedRoles/defaultRoles`, нові `variants` та розширений clue/event structure.
- **Scenario archive cleanup** — попередні версії активних сценаріїв перенесено в `scenarios/archive/2026-04-18/`, а тестовий `the-last-cup` прибрано з активного набору.

---

## [0.3.6] — 2026-04-17

### Changed
- **Docs: `LINEAR.md`** — синхронізовано з фактичною структурою проекту Linear: додано Codex ID, всі 11 workflow-станів (включно з `Ideas`, `Improvements`, `AI Improvements`, `Canceled`, `Duplicate`), нові лейбли `Bug`/`Improvement`/`Feature`. Виправлено назву стану на `Ready for deploy` (було `Ready for Deployment`). Додано fallback-доступ через `LINEAR_API_KEY` з `.env` для read-only запитів.

---

## [0.3.5] — 2026-04-16

### Added
- **Staging Environment** — створено ізольоване середовище розробки `staging.barrigame.es` на порту `3001` (папка `/opt/apps/cthulhu`).
- **Shared Storage Strategy** — впроваджено спільну папку `/opt/apps/shared_data` для сценаріїв та асетів. Це запобігає дублюванню генерацій та витрат на API при спільній базі даних.
- **Ready for Deployment** — новий стан у Linear для керованого Пром-деплою.
- **Linear API Integration** — повна підтримка роботи з Linear через токен (аккаунт Claude). Робота ведеться виключно в проекті **Barri** (`ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c`).

### Changed
- **Git Branching Strategy** — перехід на `staging` як основну гілку розробки. Мердж у `main` лише для деплою на прод.

---

## [0.3.4] — 2026-04-15

### Added
- **Admin panel tabs** — адмінка розбита на 4 вкладки: Users / Usage / Scenarios / Settings (`AdminTabs.tsx`)
- **Usage tab: period filter** — фільтр по periodу для таблиць моделей та акаунтів: Today / Week / Month / All / Custom date
- **Usage tab: sessions** — розширена таблиця сесій: кількість гравців, повідомлень (з кіпером), avg output/input токенів, expandable model breakdown
- **Usage tab: accounts** — нова секція акаунтів з period filter та expandable деталями по моделях
- `costTracker.ts`: `Period` тип, `getSessionBreakdownEnhanced()`, `getAccountsBreakdown(period, date?)`, оновлено `getModelBreakdown(period, date?)`
- `api/admin/costs`: підтримка `?breakdown=sessions-enhanced`, `?breakdown=accounts`, параметрів `period` та `date`

---

## [0.3.3] — 2026-04-15

### Changed
- **Scenario generator** — перемкнено з `claude-opus-4-6` на `claude-sonnet-4-6`. Економія ~$0.40 за генерацію (з ~$0.50 до ~$0.10). Якість структурованого JSON-виводу аналогічна.

---

## [0.3.2] — 2026-04-15

### Changed
- **Scenario generator — rolePresets** — генератор тепер продукує `rolePresets[]` у кожному сценарії: тематичні ролі зі своїми навичками, інвентарем (включно з унікальними предметами) та бекграундом з ПЕРКОМ. `supportedRoles` і `defaultRoles` посилаються на id з `rolePresets`. `max_tokens` підвищено до 10000.
- **SCENARIO_GUIDE.md** — оновлено секцію 14 з повною документацією `rolePresets`.

---

## [0.3.1] — 2026-04-15

### Added
- **Scenario generator UI** — нова секція в адмін-панелі (`/admin`). Форма для генерації сценарію: назва EN/UK, premise, era, складність, мова, к-ть гравців, режим кампанії. Після генерації — перегляд JSON, кнопки "Copy JSON" та "Save to scenarios/". Зберігає файл через `POST /api/admin/generate-scenario/save`.
- Disabled checkbox "Generate ambient audio" з підказкою Phase 10 — задає очікування для майбутньої фічі.

---

## [0.3.0] — 2026-04-15

### Added
- **Scenario generator** — `POST /api/admin/generate-scenario` (admin-only). Приймає параметри сценарію, викликає `claude-opus-4-6`, повертає повний валідний JSON з усіма полями.
- **Scenario variants** — поле `variants: ScenarioVariant[]` у сценарії. При створенні сесії обирається випадковий варіант (різна стартова локація + `introHint` для Кіпера). Дозволяє перегравати сценарій з різними точками входу.
- `the-haunting.json` отримав 2 варіанти: "Стандартний" (офіс детектива) і "Відразу в справу" (одразу біля будинку).
- `SCENARIO_GUIDE.md` — нова секція про `variants`.

---

## [0.2.14] — 2026-04-15

### Removed
- **Панель гравців над чатом** — `StatsBar` прибрано з верхньої частини чату. Статистика доступна через сайдбар → вкладка «Гравці». Більш атмосферно — HP/SAN не маячать постійно перед очима.

---

## [0.2.13] — 2026-04-15

### Changed
- **Keeper prefix — умовна поведінка:** при 3+ гравцях Keeper використовує `Ім'я:` (без дужок) на початку абзацу коли адресує конкретного гравця. При 1–2 гравцях — без префіксу.

---

## [0.2.12] — 2026-04-15

### Fixed
- **Keeper не запускає кубики** — `[SET_PENDING_ROLL:]` тепер описаний як обов'язковий крок для КОЖНОГО кидка. Старі секції "Формат кидка" і "Кидки з наслідками" злито — усунено двозначність між текстовим форматом і тегом.

---

## [0.2.11] — 2026-04-15

### Added
- **Situational locations** — LLM може створювати нові локації тегом `[NEW_LOCATION:id:Назва:Опис]`. Зберігаються у `world_state.dynamicLocations`, відображаються правильно при перезавантаженні. Ambient аудіо не генерується. При повторному переході — `[LOCATION:id]` як для звичайних локацій.

---

## [0.2.10] — 2026-04-15

### Fixed
- **Location display shows "Акт 1" after transition** — LLM вигадував нові location ID замість використання існуючих. Додано перелік усіх доступних ID в інструкцію `[LOCATION:]` у системному промпті. UI fallback тепер показує відформатований ID замість "Акт 1" якщо назва не знайдена.

---

## [0.2.9] — 2026-04-15

### Fixed
- **Dynamic image re-generation on reload** — зображення `[IMAGE:...]` більше не перегенеровуються при заході у стару сесію. URL зберігається у `world_state.sessionImages` під реальним DB message ID (повертається у `done` event). При перезавантаженні `DynamicImage` знаходить URL у `sessionImages` і відображає збережений файл без запиту до Gemini.
- **`?json=true` параметр для `/api/image`** — повертає `{ url }` замість файлового буфера для client-side збереження URL.

---

## [0.2.8] — 2026-04-15

### Fixed
- **This page couldn't load (SessionList Crash v2)** — виправлено помилку, коли React падав після першого ходу гри через неправильне збереження `players` у БД у вигляді строки замість JSON («s.players.map is not a function»). Виправлено формування запиту в `postgres.js` та додано graceful parsing на клієнті для сумісності з вже пошкодженими сесіями в БД.
- **This page couldn't load (SessionList Crash)** — виправлено помилку "This page couldn't load" при заході на головну сторінку з простроченим токеном авторизації. Раніше компонент `SessionList` намагався розпарсити відповідь `401 Unauthorized` як масив сесій, що викликало крах React. Тепер відбувається коректний редірект на екран логіна.

---

## [0.2.7] — 2026-04-15

### Fixed
- **DiceRoller зависає після кидку** — `pendingRollResult` залишався в БД якщо LLM забував тег `[CLEAR_PENDING_ROLL]`. Тепер сервер примусово очищає його коли гравець надсилає чисте число (результат кидку)

---

## [0.2.6] — 2026-04-15

### Changed
- **Глобальні налаштування моделі та TTS** — вибір AI-моделі (Gemini Flash / Claude Sonnet) та TTS-провайдера (Gemini / OpenAI) перенесено з per-session ⚙️ панелі в адмін-панель (`/admin`). Налаштування зберігаються в БД і діють на всі сесії. За замовчуванням — Gemini 2.5 Flash + Gemini TTS
- **Спрощена ⚙️ панель** — прибрано вибір моделі та кнопку TTS. Лишилось: Пасив/Баланс/Актив, Автоозвучення, Ambient, Віртуальні кубики

---

## [0.2.5] — 2026-04-14

### Added
- **Language selection** — вибір мови гри (Українська / English) при створенні сесії. Кіпер відповідає відповідною мовою протягом усієї сесії (ANT-14)
- **Model pricing DB table** — ціни на API-виклики зберігаються в таблиці `model_pricing`, оновлюються через `PATCH /api/admin/pricing`. 7-денний in-memory cache. Виправлено ціни Gemini 2.5 Flash ($0.30/$2.50 замість $0.10/$0.40) (ANT-14)

---

## [0.2.4] — 2026-04-15

### Added
- **Dice Roller** — віртуальний генератор кидків d100 з анімацією slot-machine (два d10: десятки + одиниці). З'являється автоматично коли LLM запитує кидок. Тоггл "Віртуальні кубики" у ⚙️ панелі. Результат передається в LLM на підтвердження. Фізичний режим показує підказку з навичкою та порогом (ANT-13)

---

## [0.2.3] — 2026-04-14

### Added
- **Toggle switches** — перемикачі увімкнення/вимкнення Ambient та TTS прямо в ⚙️ панелі хедера (ANT-8)

### Fixed
- **Mobile panel** — overlay займає повний екран, кнопка закриття завжди видима (ANT-7)
- **NPC реєстрація** — NPC тепер авто-реєструються з тегів `[NPC:...]` одразу при появі в повідомленнях, без потреби перезавантажувати сесію (ANT-12)

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

## [0.2.1] — 2026-04-17

### Added
- **Session completion flow**: новий endpoint `POST /api/sessions/[id]/complete` для завершення one-shot/campaign session з фінальним read-only станом.
- **Campaign finish evening**: кампанії тепер можна завершувати “по вечорах” — зберігається короткий summary, а наступна session створюється автоматично.
- **Player feedback**: rating `1–5` і коментарі до завершеної сесії зберігаються окремо в `session_feedback`.
- **Test scenario**: новий мікро-сценарій `Остання Чашка` (`the-last-cup`) для швидкого ручного тесту flow завершення.

### Changed
- **GameChat**: додані статусна панель, кнопки `Завершити сесію` / `Завершити вечір` / `Завершити кампанію`, completion modal і read-only review mode.
- **Session list**: сесії тепер розділені на active / paused / completed замість жорсткого показу тільки активних.
- **AI prompt flow for campaigns**: нові кампанійні сесії підхоплюють summaries попередніх вечорів через `campaignContext`.
- **Admin**: у списку всіх сесій тепер видно status і feedback; у статистиці сценаріїв — середній rating і кількість оцінок.

### Fixed
- Завершені сесії більше не приймають нові ходи через `/api/ai`.
- Completed sessions більше не зникають із користувацького списку та адмінки.
- Коментар до feedback в адмінці тепер можна розгорнути й прочитати повністю.

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

---

## [0.3.18] — 2026-04-18

### Changed
- **Scenario generator UI**: статус генерації тепер показує актуальну primary model (`Claude Opus 4.7`) замість застарілого hardcoded `Claude Sonnet`.
- **Scenario generator copy**: прибрано зайву згадку про ambient audio з JSON-generation екрана; materials/asset generation тепер описано як окремий крок.
- **Game session UI**: completion CTA прибрано з основної статусної панелі активної сесії, щоб завершення не пропонувалось посеред проходження сценарію.

### Fixed
- Ручне завершення сесії/кампанії більше не вискакує як primary action у центрі активної гри; доступ до нього перенесено в settings panel.
