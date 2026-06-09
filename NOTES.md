# Barri Game — Нотатки по змінах

## [2026-05-08 · Claude] — ANT-100: reading column + transcript rhythm

### Problem
На 1440px+ між кінцем кіперської бульки (760px max) і правим rail (320px) лишався dead-zone. Лейбли `Кіпер` / playerName повторювались на кожному ході, навіть коли той самий мовець говорив підряд.

### Solution
- `.chat-messages` тепер обмежений `max-width: 820px` і центрований (`margin: 0 auto`). Padding піднятий до `18px 24px 28px` (mobile 14px). Bubble max-width: keeper/NPC підняв до 92% (бо контейнер уже сам обмежений), user — до 75%, щоб дії гравця читались як короткі реплики справа.
- JSX: для `messages.map` додав `prev` lookup і прапор `sameAsPrev` (та сама `role`, для user ще той самий `player_idx`). Якщо так — ховаємо рейкову лейблу і застосовуємо `chat-msg--grouped` (`margin-top: -10px`), щоб repeated turns читались як один блок.
- Працює і для split-bubble assistant (NPC + наративні), і для standard single-bubble.

### Key decisions
- Лейбл NPC завжди показується (різні NPC у послідовних повідомленнях — не рідкість, не стискаємо).
- Replay button лишається на кожному окремому повідомленні, бо озвучення — на rівні message.id.
- 820px reading-column обрав за editorial baseline (~75 ch для IM Fell English + Special Elite на 15px).

## [2026-05-08 · Claude] — ANT-101: composer rail unification

### Problem
Під чатом стояло 5 окремих horizontal strips (player tabs, queue, inventory, dice hint, input), у кожного своє `background: var(--ink-1)` + `border-top` — візуально розпадались на ярус сходинок. На mobile додатково забирали вертикалі.

### Solution
- Обернув усе в єдиний `.composer-rail` (`<div>`) з одним `border-top` і одним фоном. Inner strips усередині отримують `background: transparent; border-top: none` через каскад. Padding узгоджено (10/14 desktop, 6/10 mobile).
- Top "meta" рядок: лейбл `ХІД` + tabs гравців зліва, queue chips справа (через `margin-left: auto` + `border-left: dashed`).
- Inventory chips і dice prompt лишилися окремими секціями всередині rail, але без зайвої chrome.
- Input + actions column (Voice / queue + / Send) — один gap-8 рядок.
- На mobile (≤640px) queue chips опускаються в новий рядок з `border-top: dashed` (бо `margin-left: auto` ламає wrap).
- `.composer-rail` має `padding-bottom: max(8px, env(safe-area-inset-bottom))` для iOS home indicator.

### Key decisions
- Лишив окремий рендер DiceRoller в межах rail (не намагався вмонтувати в композер row), щоб не ламати анімацію слот-машини.
- ARIA: `role="tablist"` на player switcher, `role="tab" aria-selected` на кнопках, `aria-label` на queue/input/actions.
- Старі CSS класи `.chat-player-selector`, `.chat-pending-strip`, `.chat-input-zone` лишилися визначеними (чіпси і pills все ще їх використовують), але JSX більше не виставляє контейнерні класи з зайвими borders/backgrounds — їх перебиває composer-rail.

## [2026-05-08 · Claude] — ANT-104: mobile UX polish

### Problem
Аудит на 390×844 виявив: переповнений top-nav на `/sessions` (BARRI · v · ADMIN · email · ВИЙТИ в один рядок), case-files drawer на mobile повзе full-screen без drag handle/scrim, інвентар-strip обрізається без affordance scroll, composer без safe-area вже мав `env()` правильно — додатково підтверджено.

### Solution
- **Sessions topbar**: на ≤720px ховаємо `v0.x.x` і inline-блок `Admin / email / Вийти`, замість них показуємо круглу `sessions-authmenu-trigger` (ініціал email) → попап-меню зі scrim і коректними `role="menu"` / `role="menuitem"`. Desktop поведінка незмінна.
- **Chat sidebar (CaseFilesPanel)**: замінив Tailwind-класи `fixed inset-0 md:relative md:flex md:w-64` на семантичний `.chat-sidebar` з власною respnsive поведінкою. Desktop — fixed-width 320px inspector rail. Mobile (≤767px) — bottom-sheet 88vh з drag handle, transform `translateY(100%)` ↔ 0, scrim `rgba(7,6,10,0.55)` з tap-to-close.
- **Inventory strip**: додав `scroll-snap-type: x proximity` + `mask-image: linear-gradient(...)` для м'яких fade-edges по 16px з обох боків — користувач бачить, що є ще предмети за межею.

### Key decisions
- Меню — JS-toggle, не `<details>`, бо потрібна закриваюча scrim і ARIA-семантика.
- Bottom-sheet drag handle поки декоративний (без gesture-drag) — це достатньо як affordance, повноцінне drag-to-dismiss робитиметься як окрема ітерація разом з motion-tier (ANT-103).
- Desktop sidebar лишається always-visible. ANT-102 (inspector rail collapse) розрулить toggle на широких екранах.

## [2026-05-08 · Claude] — ANT-98 follow-up: stati must be system-controlled only

### Problem
Перша версія ANT-98 повернула `+/−` кнопки на StatsBar та PATCH-handler — гравець міг сам редагувати HP/SAN/Luck. Anton одразу зафіксував правило: користувач не повинен мати змогу змінювати параметри ні через UI, ні через прохання до кіпера.

### Solution
- `StatsBar.tsx`: прибрано `+/−` кнопки повністю, прибрано `updateStat()` і проп `onUpdatePlayers`. UI лишився display-only — бар + число.
- `GameChat.tsx`: видалено `handleUpdatePlayers`, проп `onUpdatePlayers` більше не передається.
- `prompts.ts` (UA + EN): у блок `## ОНОВЛЕННЯ СТАТІВ` / `## STAT UPDATES` додано явну заборону змінювати стати на пряме прохання гравця ("додай мені 10 HP" тощо). Допустимий шлях — фікційне обґрунтування (бинт з інвентарю → narrate → `[DELTA]`).
- Збережено в memory як feedback-правило (`stats_system_controlled.md`).

## [2026-05-08 · Claude] — ANT-98: StatsBar regression — повернуто HP/SAN/Luck у чат

### Problem
Після ребренду noir компонент `StatsBar.tsx` залишився в коді, але ніхто його не імпортував — `grep -rn StatsBar src/` повертав лише сам файл. Як наслідок: гравці не бачили HP / SAN / Luck під час гри ні на desktop, ні на mobile, хоча сервер ці поля справно мутує через `[DELTA:]` теги.

### Solution
- `GameChat.tsx`: імпорт `StatsBar`, рендер у шапці одразу під `chat-header`, перед collapsible settings panel. Додав `handleUpdatePlayers` (PATCH `/api/sessions/:id` з новим масивом `players` + локальний `setSession`).
- `StatsBar.tsx`: рестайл з Tailwind stone/amber під семантичні CSS-класи з noir-токенами. Підтримка `activePlayer`, `onSelectPlayer`, `readOnly`. Клік на header картки тепер вибирає активного гравця і розгортає скіли+інвентар.
- `chat.css`: новий блок `.stats-bar` / `.stats-card` / `.stat-row` / `.inv-item`. HP — blood gradient, SAN — bruise (фіолетовий), LCK — amber. Контраст усіх текстових елементів на ink-2 ≥ 5:1 (paper-1, amber-1, smoke-0). Mobile media query звужує сітку до 28+22+1fr+50+22.

### Key decisions
- Залишив старий ручний `+/−` контроль для адміна/кіпера — авторитетним залишається сервер через `[DELTA:]`, але ручне коригування потрібне для edge case типу некоректного парсингу.
- `usableInventory` бейдж у заголовку картки показує лише придатні предмети (без зламаних/порожніх) — щоб не вводити в оману.
- Розгортання — per card, не глобально, щоб мульти-плеєр сесії не страждали від випадкового overflow.

## [2026-04-20 · Claude] — Landing promoted to main page; design-lab removed

### Problem
Лендінг існував лише як `/design-lab/landing` — прихований від реальних юзерів. Головна `/` одразу редиректила на логін. Потрібно було зробити лендінг публічною головною сторінкою, а app — `/sessions`.

### Solution
- `src/app/page.tsx` — замінений лендінгом (inline шрифти + LandingClient). Публічний, без auth.
- `src/app/sessions/page.tsx` — новий маршрут для списку сесій (логіка перенесена з колишнього `page.tsx`).
- `src/app/LandingClient.tsx`, `src/app/content.ts`, `src/app/landing.css` — перенесені з `design-lab/landing/`.
- Усі `href="/"` → `href="/sessions"` у: LandingClient, auth/login (post-login redirect), admin (back link), GameChat (back button).
- `src/app/design-lab/` — видалено повністю.
- `src/components/SessionListConceptA.tsx` — видалено.

### Key decisions
- Лендінг не потребує auth — Next.js App Router рендерить його публічно.
- `/sessions` вимагає auth — редиректить на `/auth/login` якщо токен відсутній.

---

## [2026-04-20 · Claude] — Noir landing: i18n + fixes

### Problem
1. Нотатки (testimony) занадто темні, важко читати. 2. Описи сценаріїв короткі — бракує зав'язки. 3. Потрібні UA/ES версії. 4. Не виділено що сценарії перегравувані.

### Solution
- `content.ts` — повний об'єкт з усіма рядками для EN / UA / ES.
- `LandingClient.tsx` — 'use client' компонент з перемикачем мов EN · УК · ES у topbar.
- `page.tsx` → тонка серверна обгортка (metadata + render LandingClient).
- CSS `.note` — фон змінено на `#f2e6cb`, прибрано SVG-noise; `.note q` та `.note-sig` переписані для чіткого чорного тексту на світлому папері.
- Тексти справ переписані: є зав'язка, деталі, і рядок `.case-replayable` (нова мітка з пунктирним бордером).
- Linear: ANT-82 (redesign game UI to noir-dossier) — задача в Ideas.

### Key decisions
- Перемикач мов — client-side state, без next-intl або окремих роутів. Достатньо для design-lab.
- Нотатки: простий `#f2e6cb` без шуму — достатньо атмосферно, набагато краще читається.

---

## [2026-04-20 · Claude] — Noir detective landing (design-lab)

### Problem
Потрібен крутий landing для Barri, натхненний tableforge.gg але у стилі noir-детектив + космічний хоррор.

### Solution
Новий роут `/design-lab/landing` (ізольований від основного layout через власний `layout.tsx` з next/font):
- `layout.tsx` — Special Elite (typewriter), Playfair Display (display serif), IM Fell English (vintage body), UnifrakturMaguntia (occult blackletter).
- `landing.css` — повна noir-палітра (ink/paper/amber/blood/bruise), film-grain overlay через SVG turbulence + анімований shift, vignette, стертий папір, подряпини.
- `page.tsx` — sticky top bar (dossier tab) → hero (велетенський типографічний заголовок + нахилена картка-dossier з paperclip та CLASSIFIED-штампом) → whisper ticker → exhibits grid (6 плиток-доказів) → procedure (4 кроки-інструкції) → case files (Haunting, Last Telegram, teaser) → testimony (handwritten нотатки з воску-печаткою) → final CTA з circle-seal + flicker → footer.

### Key decisions
- Ізольований layout під `design-lab` — не чіпає основну шапку і глобальний stone-950 background.
- Усі "фото" і декор — чистий CSS (градієнти, SVG noise), жодних зовнішніх ассетів.
- Commit fully-noir: всі тексти англійською у стилі поліцейського рапорту ("Exhibit A", "Sworn Testimony", "Dossier Nº 1929"), ticker з атмосферними фрагментами, redact-span на слові «unspeakable».
- CTA ведуть на `/` (сесії). При винесенні на корінь — route буде легко поміняти.

---

## [2026-04-20 · Claude] — Bump до версії 0.4.0

Версія піднята з 0.3.23 → 0.4.0. CHANGELOG отримав consolidated 0.4.0 entry, що підсумовує зміни поточного релізного циклу (Gemini caching, campaign disable, prompt fixes).

---

## [2026-04-20 · Claude] — Вимкнення кампаній + one-shot для the-last-telegram

### Problem
Механіка кампаній (multi-session, FINISH_EVENING, world state carryover) не працює коректно — 5 задокументованих багів (ANT-77..ANT-81). Потрібно тимчасово вимкнути до виправлення.

### Solution
- `src/app/api/sessions/route.ts`: примусово `campaign = null` — кампанія більше не створюється незалежно від `sessionConfig.isCampaign` в сценарії.
- `/opt/apps/shared_data/scenarios/the-last-telegram.json`: `sessionConfig.isCampaign` → `false` (one-shot режим).
- Linear: створено 5 bug-issues ANT-77..ANT-81 для відстеження проблем кампаній.

### Key decisions
- Не видаляємо code кампаній, просто bypass на рівні session creation — легко увімкнути назад.
- Сценарний файл змінено на shared VPS data (`/opt/apps/shared_data/scenarios/`), який монтується в обидва контейнери.

---

## [2026-04-20 · Claude] — Gemini implicit cache toggle

### Problem
Gemini 2.5 Flash підтримує implicit caching (автоматичний, без коду), але ми не отримували cache hits: `dynamic` блок включався прямо в `systemInstruction`, яка змінювалась на кожен запит → спільного префіксу немає → кеш ніколи не спрацьовував.

### Solution
- `route.ts`: при `geminiCacheEnabled=true` `systemInstruction = ruleset + static` (стабільний префікс, ~1500 tok); `dynamic` вставляється як синтетична перша пара `user/model` в `geminiHistory`. При `false` — поведінка без змін (combined mode).
- `queries.ts`: seed-рядок `gemini_cache_enabled: 'false'` (за замовчуванням OFF).
- `page.tsx` → `GameChat.tsx`: prop `defaultGeminiCacheEnabled` та `geminiCacheEnabled` state, прокидується в обидва fetch (`__intro__` та основний).
- `KeeperSettings.tsx`: toggle з підписом "split mode / combined mode". Debug-знімок отримав поле `geminiCacheMode: 'split'|'combined'`.

### Key decisions
- Default OFF щоб Anton міг порівняти якість промпту між режимами, не ризикуючи регресією.
- Synthetic `[СТАН СЕСІЇ]` / `Зрозумів.` пара — мінімальна синтетична конструкція, стандартна практика для Gemini multi-turn без окремих system-blocks.
- При `combined` (OFF) поведінка ідентична попередній, zero risk.

## [2026-04-20 · Claude] — prompt fixes: ruleset "roll ≤1" bug + debug log cleanup

### Problem
1. AI іноді запитував кидок по навичках, яких немає в списку гравця (напр. Locksmith=1, Occult=5 — базові CoC 7e). Результат: "Кинь X, треба 1 або менше" — абсурдно для наративу.
2. Debug JSON лог (Gemini) містив `systemPrompt` = `ruleset + static + dynamic` поруч з самими блоками — виглядало як дублювання ruleset.

### Solution
- `rulesets.ts` (обидві мови): додано секцію `### Якщо навичка відсутня в списку гравця` — AI не питає кидок по відсутніх навичках, натомість описує наративний провал або пропонує суміжну навичку зі списку. Жорстке правило: поріг у `[SET_PENDING_ROLL]` ніколи не < 10.
- `route.ts`: прибрано поле `systemPrompt` з дебаг-знімку `saveMessageDebug` — три окремих блоки (`ruleset`, `static`, `dynamic`) вже дають повну картину без дублювання.

### Key decisions
- Правило "ніколи поріг < 10" як запобіжник на рівні промпту — простіше ніж серверна валідація.
- Пропозиція суміжної навички (Electrical Repair замість Locksmith) зберігає можливість для гравця — не просто блокує дію.

## [2026-04-20 · Claude] — ANT-70: NPC деталі накопичуються під час гри

### Problem
`npcRelations` зберігав лише 4-стани enum (friendly/neutral/hostile/unknown). Не було механізму для запису того, що гравці дізнались про персонажа під час гри — в CaseFiles завжди відображалося тільки "Невідомо" без жодних деталей.

### Solution
- Новий тег `[NPC_UPDATE:Name:relation:notes]` — Кіпер емітує після взаємодії з NPC.
- Сервер (`route.ts`) парсить тег: оновлює `npcRelations` і акумулює нотатки в `world_state.npcDetails[npcId].notes` (append-only).
- `textForDB` стрипає `[NPC_UPDATE:]` — тег data-only, не зберігається в повідомленнях.
- Summarize-цикл Haiku отримав явний `npcDetails: currentWorldState.npcDetails` у merge — нотатки не затираються при periodic summary.
- Промпт (`prompts.ts`): в static block додано секцію `## ОНОВЛЕННЯ ДАНИХ ПРО ПЕРСОНАЖА` з правилами і прикладом; в dynamic block з'явився список `npcDetails` щоб AI знав що вже записано.
- UI (`GameChat.tsx`): CaseFilesPanel отримав prop `npcDetails`, нотатки відображаються жовтуватим текстом під статичним описом NPC.

### Key decisions
- Ім'я в тегу (не ID) — консистентно з `[NPC:Name]`, сервер резолвить до ID тою самою matching-логікою.
- Накопичення нотаток (не заміна): `existing ? \`${existing}. ${new}\` : new`.
- `npcDetails` НЕ включено в summarize prompt — Haiku не аналізує і не оновлює нотатки, лише main AI.

---

## [2026-04-19 · Claude] — ANT-60: довше structured intro

### Problem
- Стандартне intro було обмежене рядком "Почни гру: встанови атмосферу…" без структурних вимог. У парі з `RESPONSE STYLE` ("2-4 абзаци") це виливалось у коротке, дженерик intro: гравці не встигали відчути сетинг, зрозуміти епоху, розгледіти NPC і знайти сюжетний гачок.
- max_tokens для всіх відповідей — 900 у Gemini, 900 у Claude; intro не мав додаткового простору навіть якщо модель хотіла видати більше.

### Solution
- `src/lib/prompts.ts` — `introInstruction` (ua/en) переписано: явна 4-5-абзацна структура (кінематографічний план → час/місце → NPC/деталі → сюжетний гачок з **bold** ключовими підказками → опційний перехід до дії) і таргет 700-1100 символів. Пряме "не питай, не перелічуй дії".
- `src/app/api/ai/route.ts` — інтро-шлях тепер запитує більший бюджет: Gemini `maxOutputTokens: 1400` коли `diag.isIntro`, Claude `max_tokens: 1400` коли `isIntro`. Звичайні відповіді залишились 900.
- Діагностичні логи `[ANT-58]` продовжують спрацьовувати на intro, тож одразу побачимо, чи 1400 вистачає.

### Verification plan
- Staging: свіжа сесія на `the-last-telegram` (uk) + стара на `the-haunting` (uk) — intro має бути помітно довшим (700-1100 символів), структурованим, без обрізу.
- Перевірити англомовну сесію (`language='en'`) — той самий ефект через EN-копію інструкції.
- Гравець продовжує: наступне повідомлення Keeper має знов триматися 2-4 абзаців (не роздуватися).

---

## [2026-04-19 · Claude] — ANT-69: DiceRoller не зʼявлявся для Library Use

### Problem
DiceRoller не зʼявлявся, коли LLM запитував кидок "Library Use" (Бібліотека). Причина: regex для парсингу тегу `[SET_PENDING_ROLL]` в `src/app/api/ai/route.ts` використовував `([^\]]+)` для поля context — це потребує мінімум одного символу. LLM іноді генерує тег з порожнім контекстом (`...25:]`) або зовсім без нього (`...25]`), regex не матчив, `pendingRollResult` не встановлювався, DiceRoller не зʼявлявся.

### Solution
Змінено regex з `([^\]]+)` → `(?::([^\]]*))? ` — context тепер повністю опціональний, з fallback `''`. Обробляє всі три варіанти: повний context, порожній context, відсутній context.

### Key decisions
- Мінімальна зміна в одному файлі (`route.ts` рядок 568).
- Тип `context: string` в types/index.ts залишено без змін (fallback `''` зберігає контракт).
- DiceRoller вже обробляє `context` як falsy-значення (умовний рендер), тому компонент змін не потребував.

## [2026-04-19 · Claude] — ANT-66: Next.js standalone НЕ віддає рантайм-файли з public/

### Context
Перша спроба фіксу (retry PATCH sessionImages) була мимо каси. Anton потестив — картинка досі пуста. Debug-дамп показав, що LLM правильно пише `[IMAGE:schematic:Schematic of Relay Station]`, файл згенерувався на диску (`/opt/apps/shared_data/public/scenarios/dynamic/1c94b3e58781cdacd1a10771.jpg`, 1.7MB), URL правильно записаний у `world_state.sessionImages`. Але GET `/scenarios/dynamic/1c94b3e58781cdacd1a10771.jpg` повертав **404**.

Перевірка з рестартом контейнера: той самий URL → 200. ✅ Підтверджено: **Next.js 16.2 standalone кешує список `public/` при старті сервера.** Файли, створені в рантаймі, не віддаються.

Це **справжній** корінь ANT-66. Retry PATCH — просто нервовий захист, корисний але вторинний.

### Solution
1. `next.config.ts` — додано rewrite: `/scenarios/dynamic/:hash.jpg` → `/api/image/file/:hash`.
2. `src/app/api/image/file/[hash]/route.ts` — новий роут. Читає `/app/public/scenarios/dynamic/HASH.jpg` через `fs.readFileSync`, стрімить buffer із `Cache-Control: public, max-age=604800, immutable`.
3. Format URL у DB (`/scenarios/dynamic/HASH.jpg`) не змінюється — рantpawn працює для старих і нових картинок.
4. Retry/self-heal/fallback із попереднього коміту лишаються — захист на випадок мережевих проблем і деградації Gemini.

### Verify
- На staging після деплою: `curl -I https://staging.barrigame.es/scenarios/dynamic/<нова_hash>.jpg` → 200 БЕЗ рестарту контейнера.
- Клієнт: картинка з'являється одразу після генерації, без F5.

---

## [2026-04-19 · Claude] — ANT-66: dynamic image — надійна персистенція URL (первинна спроба)

### Problem
Anton: "Динамічне зображення не згенерувалось, лишилось битим. Після перезаходу на наступний день — зображення з'явилось. Чому так генерується?"

### Investigation
Flow: LLM пише `[IMAGE:...]` → client отримує `messageId` у `done` SSE → `DynamicImage` фетчить `/api/image` → `onUrlGenerated(msgId, url)` → PATCH `world_state.sessionImages`.

Root cause: PATCH був fire-and-forget з `.catch(console.error)`. Якщо мережа/вкладка дропнула між `onUrlGenerated` і PATCH — [IMAGE:] тег лишався у DB без URL у `sessionImages`, при рендері показувався placeholder "Генерується зображення..." (бо тег є, URL нема, fetch вже `fetched.current=true`). А файл на диску існував, бо `saveImageToCache` відбувався на стороні сервера синхронно.

Наступного дня при рендері сесії `DynamicImage` заново викликався без URL → `/api/image` давав cache hit (hash-based, і файл лежить на shared volume `/opt/apps/shared_data/public/scenarios`) → `onUrlGenerated` спрацьовував знову → цього разу PATCH проходив. Звідси "само полагодилось".

### Solution
1. **`GameChat.tsx` — `persistSessionImages`**: retry × 3 з exponential backoff (500/1000ms) перед тим як "здатись". `handleUrlGenerated` ідемпотентний: якщо `sessionImages[msgId] === url` — нічого не робимо.
2. **Self-heal у `DynamicImage`**: коли parent передав `url`, компонент одразу викликає `onUrlGenerated(msgId, url)`. Parent через guard нічого не зробить якщо URL уже в `sessionImages`, інакше — спробує знову PATCHнути. Тобто навіть якщо перший PATCH помер, наступний рендер (reload, переключення табів) витягне стан у консистент.
3. **UX на фейл**: замість `return null` на error — placeholder з кнопкою `↻ Спробувати ще раз`. Раніше зображення просто зникало.
4. **`/api/image` resilience**: Gemini помилки (не-429) і "no image in response" тепер fallback на Pollinations замість повернення 502. Раніше лише 3× 429 retries фолбечились.

### Key decisions
- Не стали робити server-side idempotent-URL в DB (наприклад, писати sessionImages одразу у `/api/ai`): client-side fetch `/api/image` лишається обов'язковим (бо він і генерує картинку), тож PATCH все одно потрібен. Покращили його надійність.
- Не міняли API /api/image контракту (URL у sessionImages = `/scenarios/dynamic/HASH.jpg`).
- Лог `[sessionImages PATCH]` у консолі допоможе відстежувати частоту race-conditions у проді.

### Verify on staging
1. Відкрити сесію, спровокувати dynamic image (напр. опис локації).
2. Перевірити DevTools Network: PATCH `/api/sessions/:id` виконується; у `world_state.sessionImages` є новий msg.id → URL.
3. Перезавантажити сторінку — зображення рендериться миттєво без повторного /api/image (бо URL уже у sessionImages).
4. У консолі браузера `[sessionImages PATCH]` має бути відсутнім у успішному кейсі.

---

## [2026-04-19 · Claude] — Revert ANT-72 частини (verbosity)
Anton прийняв ANT-67/71, але не ANT-72. `headingStyle` (uk + en) відкочено до попередньої версії ("2–4 абзаци..."). NPC hygiene зміни (ANT-67 — розширений `npcVoiceLine`, ANT-71 — явна заборона player-as-NPC у промті + server guard у `/api/ai/route.ts`) ЗАЛИШЕНІ. ANT-72 далі у `In Review` для окремої ітерації.

---

## [2026-04-19 · Claude] — ANT-67/71/72: гігієна NPC-тегів + щільніший стиль Кіпера

### Problem
З плейтесту нової кампанії (Останній телеграф):
- **ANT-72** Кіпер пише все довше, великі суцільні абзаци важко читати, мало розбивки на NPC-репліки.
- **ANT-67** Одного разу Кіпер вставив пряму мову NPC всередину narration (замість окремого `[NPC:]` тегу).
- **ANT-71** Одного разу Кіпер "озвучив" гравця — обгорнув слова гравця в `[NPC:Ім'я_Гравця]...[/NPC]`. Це рендерилось як NPC-бульбашка, а auto-register додавав гравця в `npcRelations`.

### Solution
Чистий prompt-тюнінг + один server-guard. Всі 3 — у єдиній гілці `feature/ANT-67-71-72`, бо правлять ту саму секцію промта.

**prompts.ts:**
- `headingStyle` (uk + en): обсяг "2–4 абзаци" → "1–2 за замовчуванням, до 3 у важливих сценах; кожен ≤ 3–4 речень, без води". Додано явне правило "ДІАЛОГИ NPC розбивай на окремі `[NPC:]` бульбашки; одна репліка = один тег".
- `npcVoiceLine` (uk + en): замість одного рядка — структурований блок правил: (1) тільки справжні NPC; (2) НІКОЛИ не загортати слова/думки гравців; (3) всередині тегу — лише пряма мова, жести/погляди/ремарки — у narration перед тегом; (4) одна репліка = один тег; (5) якщо NPC мовчить — не емітити тег.

**/api/ai/route.ts (server-guard для ANT-71):**
Перед `parseSegments` і перед auto-register циклом додано pre-процесор: для кожного `[NPC:X]...[/NPC]`, якщо `X` збігається (partial, case-insensitive) з іменем якогось гравця з `session.players` — тег розгортається, внутрішній текст залишається як narration. Таким чином:
- Клієнт не рендерить NPC-бульбашку з іменем гравця.
- Наступний цикл auto-register не бачить цей тег → гравець не потрапляє в `npcRelations` / `dynamicNpcs`.
- Текст не губиться, просто переходить у narration.

### Key decisions
- **Single PR** для 3 тікетів — всі вони правлять сусідні області промта + один помічник у route.ts. Окремі PR-и гарантовано генерували б мерж-конфлікти у `headingStyle`/`npcVoiceLine`.
- **Prompt-only для ANT-72**: не зменшуємо `max_tokens`, бо ANT-60 саме збільшив його до 900/1400 для intro. Стилем правимо тільки розподіл цих токенів.
- **Partial match для імен гравців**: дзеркалить існуючу логіку auto-register (`npc.includes(npcName) || npcName.includes(npc)`), щоб варіанти "Анна" / "Анна Коваль" / "Коваль" однаково розпізнавались як player.
- **Strip vs skip**: обрано strip (розгортати тег), а не просто пропускати auto-register. Інакше клієнт все одно показав би бульбашку "NPC: [імя_гравця]".

### Verification (staging)
1. Сесія з новим scenario → зробити 3–4 ходи. Візуально: відповіді коротші, діалоги NPC у окремих пастельних бульбашках.
2. Спровокувати діалог (напр. "говорю до NPC X") → перевірити, що мова NPC у окремому тегу, не всередині narration.
3. Спробувати змусити кіпера озвучити гравця (напр. "здається, Анна думає вголос: ...") → переконатись, що `[NPC:Анна]` на виході вже немає (або текст всередині, але рендериться як narration). Перевірити `🐛 debug` → у raw_output може бути `[NPC:Анна]`, але у DB-content — вже без тегу. У `world_state.npcRelations` гравця немає.
4. Export log → перевірити, що `raw_output` у debug-модалі містить оригінальне, а DB content — очищене.

---

## [2026-04-19 · Claude] — ANT-74: адмін-експорт логу + per-message debug Кіпера

### Problem
Для дебагу гри (чому Кіпер зігнорив тег, повторив DELTA, обрізав відповідь тощо) потрібно бачити повний input промт та сирий output LLM конкретного повідомлення. У БД зберігалася лише post-parse `content` (з NPC/IMAGE тегами, без DELTA/LOCATION і без промту/usage). Так само не було способу швидко витягти весь чат сесії для аналізу офлайн.

### Solution
- Нова таблиця `message_debug` (`queries.ts → initializeSchema`) з `message_id PK → messages(id)`, `prompt_blocks JSONB`, `raw_output TEXT`, `provider`, `model`, `input_tokens`, `output_tokens`, `finish_reason`. Додано `saveMessageDebug`, `getMessageDebug`.
- `/api/ai/route.ts` — після `send('done')` робить fire-and-forget `saveMessageDebug(savedAssistantMsg.id, …)` з `{ruleset, static, dynamic, history, systemPrompt?}` + сирий `assistantText` + `finishReason` (Anthropic: `finalMsg.stop_reason`; Gemini: `callGeminiChat` повертає його окремим полем). Signature `callGeminiChat` розширено: тепер повертає `finishReason: string | null`.
- Нові endpoint-и під `role === 'admin'` JWT-гейтом:
  - `GET /api/admin/sessions/[id]/export` — markdown з метаданими + транскриптом (raw content, fenced blocks).
  - `GET /api/admin/messages/[id]/debug` — JSON рядок `message_debug` або 404 із поясненням, що для цього повідомлення debug не зберігався (предує фічі).
- `session/[id]/page.tsx` рахує `isAdmin = dbUser.role === 'admin'` і передає у `GameChat` як prop.
- `GameChat.tsx`:
  - Новий prop `isAdmin`. Якщо true — у settings drawer зʼявляється `⬇ Export log`, а під кожною бульбашкою Кіпера (біля `↻ озвучити`) — `🐛 debug`, яка відкриває модал із JSON + `Copy JSON` та `⬇ .json`.
  - Handlers `exportChatLog`, `openDebug`, `closeDebug`, `downloadDebug`.

### Key decisions
- **Тільки для нових повідомлень**: історія до деплою не має промту/raw-output, debug-API повертає 404 для старих. Прийнятний трейд-офф замість бекфілу.
- **Fire-and-forget** запис у БД — не блокує відповідь, як `trackAPICall`. Час Кіпера не змінюється.
- **Гейт серверний**: адмін-ендпоїнти перевіряють JWT на кожен запит; клієнтський `isAdmin` — лише для UI.
- **Формат debug — JSON** (легше дифати), **формат логу чату — markdown** (зручніше переглядати, теги під fenced blocks).

### Verification (staging)
- Сесія → кілька ходів з `[DELTA]`, `[NPC]`, `[IMAGE]` → `🐛 debug` → перевірити, що `raw_output` містить усі теги (зокрема `[DELTA]`/`[LOCATION]`, які зрізаються з DB-`content`).
- Non-admin роль: кнопок немає; прямий `GET /api/admin/...` → 403.
- Export log → відкрити .md → перевірити role/player_idx/timestamp/тег-вміст.

---

## [2026-04-19 · Claude] — ANT-58/60: діагностичне логування Gemini (Фаза 1)

### Problem
- **ANT-58**: відповіді Keeper іноді обриваються на пів слова, особливо перше intro-повідомлення.
- **ANT-60**: intro треба зробити довшим, щоб гравці зрозуміли сетинг.
- У проду й staging немає жодного логу `finishReason` / `safetyRatings` / довжини відповіді — причину обриву ретроспективно неможливо встановити. `callGeminiChat` (non-streaming) лише кидає помилку на порожній відповіді й нічого не логує на коротких.

### Solution (Фаза 1 — діагностика)
- `src/app/api/ai/route.ts` — `callGeminiChat` отримав опційний `diag: { sessionId, isIntro }`. Логується `finishReason`, `promptFeedback.blockReason`, `candidatesTokenCount`, довжина тексту, перші/останні 120 символів і `safetyRatings` у випадках: intro, не-`STOP` фініш або довжина < 200. Виклик у головному handler-і передає `{ sessionId, isIntro }`.
- Дозволяє підтвердити гіпотезу про `SAFETY`/`MAX_TOKENS` у `finishReason`, перш ніж чіпати `safetySettings` чи prompt для intro.

### Next steps
- Деплой гілки `feature/ANT-58-60` на staging.
- Anton відтворює intro + кілька ходів на сценарії 2 (uk) → аналізуємо логи `apps-barri-dev-1`.
- Фаза 2 (виправлення) — окремим комітом після логів.

### Фаза 2 — root cause + fix (ANT-58)
- Лог staging-сесії `798842bb-24e1-4010-81f2-736cb9eed3b6` показав `finishReason=MAX_TOKENS` при `outTokens=36`, `safety=[]`. Причина — **Gemini 2.5 "thinking" tokens** жеруть `maxOutputTokens` але не повертаються в `candidatesTokenCount`.
- `callGeminiChat` → `generationConfig.thinkingConfig: { thinkingBudget: 0 }` — вимикає reasoning для game chat (narrative output не виграє від thinking, але платить токенами і обрізаний finish).
- Діагностику розширено `usageMetadata.thoughtsTokenCount` — тепер видно, чи thinking справді вимкнувся.

---

## [2026-04-18 · Claude] — ANT-61/62/63/64: Keeper/GameChat audit fixes

### Problem
Codex запропонував 4 баги в `AI Improvements` після аудиту `audits/gamechat-keeper-audit-2026-04-18.md`:

- **ANT-61** `/api/ai` завжди обгортав `message` у `[Name]: ...`, тому multi-action payload від клієнта (уже префіксований) отримував подвійний префікс → incorrect attribution batched turns.
- **ANT-62** `[USE_ITEM:]` обробляється і на сервері (authoritative inventory mutation), і на клієнті (`consumePendingItems` через `pendingItemUsesRef`) → одна дія списувала заряд двічі, 1-use предмети зникали передчасно.
- **ANT-63** Тип `Player.stats?: Record<string, StatEntry>` існував, але prompt, DELTA-парсер і UI все ще хардкодили `hp/sanity/luck` → non-CoC ruleset підтримано тільки частково.
- **ANT-64** `language=en` перемикало тільки footer (LANGUAGE + RESPONSE_STYLE). Усі контрольні секції (ІНВЕНТАР, СТАТИ, ЗОБРАЖЕННЯ, ЛОКАЦІЇ, NPC, ЗАВЕРШЕННЯ, dice rules, player line) залишались українською.

### Solution
- **ANT-61** `src/app/api/ai/route.ts` — у `userContent` для `allActions.length > 1` повідомлення передається як-є; single-action шлях залишає додавання `[Name]:` префіксу.
- **ANT-62** `src/components/GameChat.tsx` — видалено `pendingItemUsesRef` + `consumePendingItems`; клієнт тепер тільки вставляє `(використовує: …)` в input і дзеркалить `data.players` із серверної відповіді. Сервер став authoritative єдиним джерелом inventory truth.
- **ANT-63** Новий helper `src/lib/statUtils.ts` з `resolvePlayerStats/formatStatLine/buildDeltaTemplate/applyDeltaToPlayer`:
  - резолвить stat-values через ruleset defs з fallback на legacy CoC поля;
  - при DELTA мутації одразу оновлює і `p.stats[id]`, і дзеркало legacy поля (hp/sanity/luck) → existing code, що читає legacy, продовжує працювати;
  - DELTA instruction тепер генерується з `buildDeltaTemplate(rulesetId)` → LLM бачить ключі, актуальні для поточної системи.
  - `prompts.ts` рендерить player-line через `formatStatLine`; `GameChat`/`StatsBar` рендерять стати з `resolvePlayerStats` і передаваного `rulesetId`. `session/[id]/page.tsx` прокидає `rulesetId` з `readScenarioFile`.
- **ANT-64** `src/lib/prompts.ts` — увесь static/dynamic блок локалізовано через `COPY` lookup (`uk`/`en`): заголовки ЗАХИСТ СЮЖЕТУ/КРИТИЧНІ УСПІХИ/ІНВЕНТАР/СТАТИ/ЗОБРАЖЕННЯ/ПЕРЕХОДИ/NPC/ЗАВЕРШЕННЯ, inventory status labels, поточний стан, гравці, railguard/skill rule. `src/lib/rulesets.ts` — `buildRulesetPromptBlock(rulesetId, lang)` з англійськими перекладами CoC 7e та Kids on Bikes правил кубиків. Intro-текст теж локалізовано через `getIntroUserContent(lang)`.

### Key decisions
- Legacy hp/sanity/luck поля залишаються — UI/DB back-compat, а `stats` мапа — canonical. Мутатор пише в обидва канали для узгодженості.
- DELTA контракт розширено: ключі тепер довільні stat ids (для CoC лишається `{hp, sanity, luck}` — це ж stat ids ruleset-у, так що old LLM output валідний).
- Прибрано client-side inventory mutation повністю, а не «gate» — подвійне списання неможливе за визначенням.
- Для багатослов’яних рулсетів `buildDeltaTemplate` виводить тільки stat ids з ruleset defs, без legacy-хлоп fallback у prompt — це не заважає LLM, бо ruleset stats для CoC — це й є hp/sanity/luck.

### Verification
- `npx tsc --noEmit` — без помилок.
- `npx next build` — білд пройшов чисто (27 routes).
- Тест на staging заплановано: (1) multi-player batch через UI → перевірити що відповідь кіпера не приписує весь батч першому гравцю; (2) використати одноразовий предмет → переконатись що `uses` зменшується на 1, не на 2; (3) сесія з `language='en'` → перевірити що весь системний prompt англійською; (4) створити CoC сесію → HP/SAN/LCK UI, DELTA, stat adjustments працюють як раніше.

## [2026-04-18 · Codex] — ANT-36 + ANT-40: TTS voice consistency and Claude stream persistence

### Problem
- `ANT-36` описував нестабільний голос Кіпера в сесії `Тест нового сценарію`: narrator мав звучати одним голосом, але в окремих репліках міг спрацьовувати інший already-prefetched audio path.
- Root cause був не в prompt/AI voice selection, а в **server-side Gemini TTS prefetch cache**:
  - cache key будувався лише з перших 300 символів тексту;
  - він не враховував `voiceStyle` і не враховував `segments` / multi-speaker layout;
  - тому дві різні репліки з однаковим початком могли повернути не свій cached WAV.
- `ANT-40` посилався на staging-сесію `Тест нового сценарію`, де persisted assistant messages обривались посеред слова / речення.
- Root cause був у Claude streaming path в `src/app/api/ai/route.ts`:
  - клієнту ми стрімили всі `content_block_delta.text_delta`;
  - але для збереження в БД брали лише `finalMsg.content[0].text`;
  - якщо Anthropic повертав кілька text blocks, persisted message містив тільки перший блок, хоча live stream уже показав більше тексту.

### Solution
- **`src/lib/ttsPrefetch.ts`**
  - cache key переведено з `text.slice(0, 300)` на стабільний `sha1` від `{ text, voiceStyle, segments }`;
  - для segment-based Gemini TTS тепер окремо розрізняються narration-only та multi-speaker репліки, навіть якщо вони починаються однаково.
- **`src/app/api/tts/route.ts`**
  - `getPrefetch()` тепер шукає cache по повному voice-aware key, а не лише по тексту;
  - OpenAI path більше не використовує message-level `voiceStyle` для narrator audio.
- **`src/lib/voices.ts`**
  - додано окремий helper для keeper narrator voice в OpenAI, щоб fallback завжди тримав один голос.
- **`src/app/api/ai/route.ts`**
  - додано `extractAnthropicTextContent()` для складання тексту з усіх text blocks у `finalMessage()`;
  - під час streaming тепер накопичуємо `assistantText += ev.delta.text` і саме streamed text стає primary source of truth;
  - після `finalMessage()` беремо зібраний `finalText` тільки якщо він довший за вже накопичений streamed text, замість сліпого `content[0].text`.

### Why this fixes the bugs
- Клієнт і persistence тепер спираються на один і той самий повний текстовий потік.
- Навіть якщо Anthropic розбиває відповідь на кілька text blocks, БД більше не втрачає “хвіст” відповіді.
- Gemini TTS більше не пере-використовує чужий cached audio для реплік з однаковим початком, а keeper narrator стабільно лишається одним голосом.

### Verification
- `npm run lint -- src/lib/voices.ts src/lib/ttsPrefetch.ts src/app/api/tts/route.ts src/app/api/ai/route.ts`
  - без помилок
- `npm run build`
  - успішно пройшов

### Linear / scope note
- `ANT-36` переведено з `Planned` у `In Progress` на Codex після явного go-ahead від Anton.
- Для верифікації звірено staging DB: сесія `Тест нового сценарію` існує як `cde2b7bd-2b24-4ca9-8d1f-aae5710e2096`, а глобальний `tts_provider` на staging — `gemini`, тож фікс зроблено саме в релевантному runtime path.
- `ANT-40` переведено з `Planned` у `In Progress` на Codex після прямого запиту Anton.
- Діагностика опиралась на реальну staging session `Тест нового сценарію` (`cde2b7bd-2b24-4ca9-8d1f-aae5710e2096`), як і було в описі задачі.

## [2026-04-18 · Codex] — ANT-38: explicit player requests now force a dynamic image tag

### Problem
- `ANT-38` описував конкретний UX gap: коли гравець активно просить щось показати, гра має згенерувати динамічне зображення того, про що він просить.
- Перевірка staging session показала, що runtime path для dynamic images існує, але тригер майже не спрацьовує:
  - `/api/image` працює як окремий generation/cache route;
  - `GameChat` вже вміє рендерити `[IMAGE:...]` і зберігати `sessionImages`;
  - але у staging-сесії `Тест нового сценарію` не було жодного persisted `[IMAGE:...]` tag, тобто Keeper просто не отримував достатньо жорсткий prompt signal, щоб додавати image tags на прямі прохання гравця.

### Solution
- **`src/app/api/ai/route.ts`**
  - додано `isExplicitImageRequest()` для явних фраз типу `покажи`, `показати`, `як це виглядає`, `show me`, `what does ... look like`, `photo`, `map`, `letter`, `draw`;
  - якщо поточне player message підпадає під цей intent, у prompt тепер передається окрема instruction:
    - у цій же відповіді ОБОВʼЯЗКОВО додати рівно один `[IMAGE:type:short English description]`;
    - type має бути осмисленим (`map`, `letter`, `photo`, `artifact`, `scene`, `newspaper`).
- **`src/lib/prompts.ts`**
  - `buildSystemPromptBlocks()` тепер приймає optional `imageRequestInstruction`;
  - instruction інжектиться в dynamic block окремою секцією `## ВІЗУАЛЬНИЙ ЗАПИТ`, щоб вона діяла саме на поточний хід і не розмивалася серед загальних правил.

### Why this fixes the bug
- Проблема була не в image generation backend і не в frontend rendering.
- Реальний дефект: для прямого visual request у Keeper не було enough-priority instruction, а загальне правило “РІДКО — лише ключові моменти” працювало проти user expectation.
- Тепер явний запит гравця підвищує пріоритет image tag саме для цього response turn.

### Verification
- `npm run lint -- src/app/api/ai/route.ts src/lib/prompts.ts`
  - очікується чисто
- `npm run build`
  - має пройти
- staging deploy
  - після rebuild `https://staging.barrigame.es` має відповідати як звично

### Scope note
- Це targeted fix для explicit image requests.
- Не чіпав `/api/image` і не ламав уже існуючий cache/render path для dynamic images.

## [2026-04-18 · Codex] — ANT-44: generated scenario appears immediately in admin scenario list

### Problem
- У staging root cause підтвердився не в save-path, а в admin list semantics:
  - `ScenarioGenerator` зберігав новий `scenario.json` у shared storage коректно;
  - `/api/scenarios` уже віддавав новий сценарій;
  - але `ScenarioStats` рендерив “Scenario List” лише з `/api/admin/costs?breakdown=scenarios`, тобто тільки сценарії, які вже мають session/cost rows.
- Через це freshly generated scenario не з’являвся в admin UI, поки хтось не створить по ньому сесію.

### Solution
- **`src/app/admin/ScenarioStats.tsx`**
  - тепер паралельно завантажує `/api/admin/costs?breakdown=scenarios` і `/api/scenarios`;
  - мержить всі file-backed scenario ids зі stats rows;
  - для нових сценаріїв без usage даних показує нульові counters замість повної відсутності в таблиці.
- **`src/app/admin/AdminTabs.tsx`**
  - додано `scenarioRefreshToken`, який дозволяє сценарному табу форсувати reload списку після save.
- **`src/app/admin/ScenarioGenerator.tsx`**
  - після успішного save викликає `onSaved()`, щоб `ScenarioStats` одразу підтягнув новий сценарій без ручного reload сторінки.

### Verification
- `npm run lint -- src/app/admin/AdminTabs.tsx src/app/admin/ScenarioGenerator.tsx src/app/admin/ScenarioStats.tsx`
  - без помилок
- `npm run build`
  - успішно пройшов
- На staging підтверджено, що новий сценарій `barcelona-sagrada-mystery.json` уже є в shared storage і доступний через `/api/scenarios`; цей фікс закриває саме admin-list gap, через який він не з’являвся в таблиці одразу.

## [2026-04-18 · Codex] — ANT-57: targeted lint cleanup for AI route

### Problem
- `src/app/api/ai/route.ts` мав 4 stale lint warnings після попередніх рефакторів:
  - unused import `InventoryItem`
  - unused import `NPC`
  - `detectVoiceStyle(_text, _npcs)` з невикористаними параметрами
  - `callGeminiText(..., _system)` з невикористаним параметром
- Це не ламало runtime, але створювало шум саме в одному з найризикованіших файлів проєкту.

### Solution
- Прибрано невикористані imports.
- `detectVoiceStyle()` спрощено до безаргументної helper-функції.
- `callGeminiText()` прибрано невикористаний `_system` параметр, а call site у summarize-flow оновлено.
- Поведінку не змінювали: keeper voice як і раніше жорстко повертає `keeper`.

### Verification
- `npm run lint -- src/app/api/ai/route.ts`
  - без warnings
- `npm run build`
  - успішно пройшов

## [2026-04-18 · Codex] — ANT-45 + ANT-41: scenario materials flow and ambient runtime sync

### Problem
- `ANT-45`: admin scenario generator після `Save` лише записував `scenario.json`; static images та ambient жили в окремих routes і не були надійно прив’язані до save-flow. У UI не було видно, що саме згенерувалося, а що впало частково.
- `ANT-41`: runtime ambient мав окремий дефект у `/api/ai` — `currentLocationGroup` оновлювався з pre-response location ще до розбору `[LOCATION]`, а після реального переходу на нову локацію не перераховувався. Через це transition-aware ambient міг розсинхронюватися із фактичним місцем гри.

### Solution
- **`src/lib/staticImages.ts`**
  - винесено static image generation в shared helper, який тепер використовується і route-ом `/api/scenarios/[id]/images`, і admin save-flow;
  - helper повертає не тільки `images`, а й `generated` / `failed`, щоб не губити partial failures.
- **`src/app/api/admin/generate-scenario/save/route.ts`**
  - route переведено на `runtime = 'nodejs'` + `maxDuration = 300`;
  - після `writeScenarioFile()` тепер окремо запускаються static images і ambient generation;
  - save-route більше не завалює весь запит, якщо впала тільки одна material stage: повертає `materialErrors`, `imageFailures`, `generatedImageIds`, `generatedAmbientIds`.
- **`src/app/admin/ScenarioGenerator.tsx`**
  - кнопка і copy оновлені під реальний flow: `Save + generate materials`;
  - після save показуються counters і warnings по partial failures, замість сліпого `Saved to disk`.
- **`src/lib/scenarioFiles.ts` / `src/lib/randomEvents.ts` / `src/app/api/ai/route.ts`**
  - додано shared helper `resolveLocationGroupIdForLocation()`;
  - після `[LOCATION]` / `[NEW_LOCATION]` сервер одразу синхронізує `currentLocationGroup` із новою `currentLocation`;
  - у SSE `done` ambient URL тепер віддається для кожного location transition, а не тільки коли спрацьовує крихкий `groupChanged` heuristic.

### Related Linear context
- Пошук по Linear показав, що баг розбитий щонайменше на два окремі planned issues:
  - `ANT-45` — generation/materialization path
  - `ANT-41` — runtime ambient dropout після старту сесії
- Обидві задачі переведено в `In Progress` на Codex з різними коментарями:
  - у `ANT-45` описано save/materials track
  - у `ANT-41` описано runtime/group-sync track
- Дублікати типу `ANT-49` / `ANT-52` не рухалися окремо, щоб не засмічувати workflow.

### Verification
- `npm run lint -- src/app/api/ai/route.ts src/app/api/admin/generate-scenario/save/route.ts src/app/admin/ScenarioGenerator.tsx src/lib/scenarioFiles.ts src/lib/randomEvents.ts src/lib/staticImages.ts src/app/api/scenarios/[id]/images/route.ts`
  - без помилок; лишилися старі warnings у `src/app/api/ai/route.ts` про невикористані параметри, не пов’язані з цими змінами.
- `npm run build`
  - успішно пройшов.

## [2026-04-17 · Codex] — ANT-30: ElevenLabs ambient для сценарних матеріалів

### Problem
- Ambient у проєкті існував лише як schema/UI-заготовка: `soundPrompt` і `ambientFile` були в сценаріях, `GameChat` мав toggle і autoplay-логіку, але реальної генерації та persistence pipeline не було.
- Runtime був розсинхронізований із моделлю даних: клієнт завжди намагався грати `/scenarios/<scenarioId>/sounds/<locationId>.mp3`, хоча сервер уже мислив через `locationGroups[].ambientFile`.
- Потрібно було генерувати ambient один раз для сценарних матеріалів, зберігати на VPS у shared storage і не запускати автогенерацію для `dynamicLocations`.

### Solution
- **`src/lib/ambient.ts`** — новий helper для ElevenLabs sound generation:
  - збирає targets із `locationGroups` (пріоритетно) та окремих static locations без групи;
  - генерує seamless loop `.mp3`;
  - зберігає у `public/scenarios/<scenarioId>/ambient/<targetId>.mp3`;
  - записує `ambientFile` назад у `scenario.json`;
  - повертає `ambientByLocation` map для runtime.
- **`src/lib/scenarioFiles.ts`** — новий shared helper для читання/запису сценаріїв і ambient lookup (`resolveAmbientFileForLocation`, `buildAmbientByLocation`).
- **`src/app/api/scenarios/[id]/ambient/route.ts`** — новий GET/POST endpoint:
  - `GET` віддає вже відомий `ambientByLocation`;
  - `POST` одноразово догенеровує missing ambient файли і оновлює сценарій.
- **`src/app/session/[id]/page.tsx`** — тепер віддає в `GameChat` не лише `locationNames`, а й initial `ambientByLocation`.
- **`src/components/GameChat.tsx`**:
  - більше не хардкодить `/sounds/<locationId>.mp3`;
  - використовує `ambientFile` / `ambientByLocation`;
  - на mount тригерить `/api/scenarios/<id>/ambient` у фоні поруч із генерацією images;
  - коректно відновлює ambient після reload;
  - при переході в dynamic location без ambient — зупиняє попередній loop замість продовження чужого звуку.
- **`src/app/api/ai/route.ts`** — у SSE `done` тепер віддається реальний `ambientFile` через helper, а не прямий lookup по group.
- **`src/lib/costTracker.ts` / `src/types/index.ts`** — додано тип `ambient` у usage tracking, щоб ElevenLabs виклики не ламали типи й могли логуватися окремо.
- **Docs/UI**:
  - `PROJECT_CONTEXT.md`: Phase 10 більше не позначено як deferred gap;
  - `SCENARIO_GUIDE.md`: додано `POST /api/scenarios/<id>/ambient` і пояснення про shared storage;
  - `src/app/admin/ScenarioGenerator.tsx`: прибрано disabled note про Phase 10, замінено на пояснення про automatic materials-time generation;
  - `CHANGELOG.md`: додано релізний запис про ambient generation.

### Key decisions
- Primary unit генерації — **`locationGroup`**, а не окрема локація. Це збігається з уже наявним random-event/risk runtime і не дублює майже однакові loops для сусідніх кімнат.
- Для static location з `soundPrompt`, яка не входить у жодну group, лишено fallback-генерацію окремого файлу — щоб схема залишалась гнучкою.
- `dynamicLocations` поки **не** запускають ambient generation автоматично. Hook для майбутнього залишено через новий ambient helper + runtime map, аналогічно до path з dynamic images.

### Verification
- `npm run build` — успішно.

### Scenario follow-up
- `scenarios/archive/2026-04-18/` — заархівовано попередні бойові версії `the-haunting.json`, `the-last-telegram.json`, а також тестовий `the-last-cup.json`.
- `scenarios/the-haunting.json` — повністю оновлено під новий generator contract: додано `rolePresets`, `briefing`, `soundPrompt` для всіх static locations, нові `locationGroups`, освіжені NPC/locations/variants.
- `scenarios/the-last-telegram.json` — так само повністю оновлено; сценарій розширено до 8 локацій і 5 rolePresets, щоб він реально відповідав campaign-level вимогам генератора.
- `scenarios/the-last-cup.json` — прибрано з активного набору; top-level `scenarios/` тепер містить лише дві бойові кампанії.

## [2026-04-17 · Claude] — ANT-29: динамічна версія у футері

### Проблема
- Футер головної сторінки показував зашиту `v0.2.0`, хоча в `CHANGELOG.md` вже 0.3.14. `package.json` теж лишався на 0.2.0.

### Рішення
- `src/components/SessionList.tsx`: `v0.2.0` замінено на імпорт `version` з `package.json` (`import { version as appVersion } from '../../package.json'`). `resolveJsonModule` у tsconfig вже увімкнено.
- `package.json`: bumped `version` до 0.3.15 (актуальний реліз).

### Рішення прийняті
- Small-task — без окремого Planned-етапу.
- Сам текст змін у лог не виводиться, як і просив Anton у описі таски — лише номер версії.

## [2026-04-17 · Codex] — Docs: Linear env assumption clarified

### Problem
- У кількох сесіях Codex передчасно робив висновок, що `LINEAR_API_KEY` недоступний, якщо змінна не була напряму видима в поточному shell.
- Для Barri це збиває workflow: ключ очікується і локально, і на VPS, тож перед ескалацією треба спершу перевіряти проєктні env-джерела.

### Solution
- `AGENTS.md`: додано явне правило, що `LINEAR_API_KEY` очікується і в local dev env, і у VPS Codex env; якщо змінна порожня в shell, спочатку перевіряти env sources.
- `LINEAR.md`: те саме правило додано в canonical workflow, а блок про “API unavailable” уточнено — спочатку перевірка env, потім уже ескалація Антону.

## [2026-04-17 · Claude] — ANT-24 follow-up: fullscreen для dynamic-зображень

### Проблема
- Після попереднього фіксу в деяких сесіях fullscreen-превʼю все одно відкривалось усередині сайдбара.
- Причина: `DynamicImage` (використовується і в чаті, і для «Сесійних матеріалів» у сайдбарі) тримав свій оверлей як сусідній `<div class="fixed inset-0 z-50">` у тому ж фрагменті. Обгортка сайдбара має `transform` (`translate-x-0 / translate-x-full`), а це робить її containing block для `position: fixed` нащадків — тож оверлей обмежувався шириною сайдбара.
- Попередній фікс (0.3.12) розвʼязав це лише для оверлея `CaseFilesPanel` (статичні сценарні зображення), але не для `DynamicImage`, тому сесії з dynamic session images лишались зламаними.

### Рішення
- `src/components/GameChat.tsx`: оверлей у `DynamicImage` загорнуто в `createPortal(..., document.body)`, z підвищено до `z-[100]` — той самий патерн, що і в `CaseFilesPanel`.

## [2026-04-17 · Codex] — ANT-24: fullscreen preview для матеріалів справи

### Що змінено
- `src/components/GameChat.tsx`: fullscreen-превʼю статичних матеріалів із вкладки `Матеріали` тепер рендериться через `portal` у `document.body`.
- Це прибирає обмеження від трансформованого sidebar wrapper на мобільному та дозволяє превʼю відкриватись на весь екран.

### Примітка
- Зміна точкова, без впливу на dynamic image preview у чаті.

## Статус фаз
- [x] Фаза 0: Підготовка
- [x] Фаза 1: Типи і схема БД
- [x] Фаза 2: Ruleset система
- [x] Фаза 3: Сценарії і ролі
- [x] Фаза 4: Оптимізація промптів
- [x] Фаза 5: Campaign layer
- [x] Фаза 6: Real-time (SSE/streaming)
- [x] Фаза 7: Asset management
- [x] Фаза 8: Cost tracking
- [x] Фаза 9: UI зміни
- [ ] Фаза 10: Ambient audio (окремо, після стабілізації)
- [x] Фаза 11: Інвентар як джерело правди
- [x] Фаза 12: Keeper Activity System
- [x] Фаза 13: Random Event Engine
- [x] Фаза 14: Dice Roller (ANT-13)
- [x] Фаза 15: Workflow & Staging (2026-04-16)

---

## Фаза 0 — Підготовка (2026-04-13)
### Крок 0.1: Аудит
- Проект білдився без помилок
- Всі файли наявні, структура відома

### Крок 0.2: Ініціалізація NOTES.md
- Файл NOTES.md створено

---

## Фаза 1 — Типи і схема БД (2026-04-13)
### Що змінено
- `src/types/index.ts`: додано StatEntry, RulesetConfig, RulesetStatDef, RolePreset, Campaign, SessionSummary, NPCState, APIUsageRecord, ScenarioAsset, CampaignAsset, LocationGroup, LocationRiskState
- `Player`: додано `stats?`, `equippedItemId?` (backward compat — legacy hp/sanity/luck лишились)
- `WorldState`: додано currentLocation, passiveMessageCount, totalMessageCount, pendingRollResult, activeRandomEvent, locationRisk, currentLocationGroup
- `GameSession`: додано campaign_id, session_number, keeper_style
- `Scenario`: додано rulesetId, supportedRoles, defaultRoles, sessionConfig, rolePresets, locationGroups, eventHints
- `InventoryItem`: додано equipped, broken
- `src/lib/queries.ts`: нові таблиці campaigns, session_summaries, scenario_assets, campaign_assets, api_usage; нові колонки в game_sessions; Campaign queries
### Рішення прийняті
- users.id — UUID (не INTEGER як в плані), адаптовано
- Backward compat: всі нові поля в existing типах — optional

---

## Фаза 2 — Ruleset система (2026-04-13)
### Що змінено
- `src/lib/rulesets.ts` — новий файл
- RULESETS: CoC 7e, Kids on Bikes, DnD 5e конфіги
- buildRulesetPromptBlock() — повні правила кубиків CoC та KoB
- Включено SET_PENDING_ROLL instructions в CoC block

---

## Фаза 3 — Сценарії і ролі (2026-04-13)
### Що змінено
- `scenarios/the-haunting.json`: rulesetId, supportedRoles, sessionConfig, locationGroups, eventHints, ambientFile в локаціях
- `scenarios/the-last-telegram.json`: аналогічно + 4 locationGroups
- `src/lib/roles.ts`: rulesetId додано до всіх presets; getRolesForScenario() helper
### Відомі проблеми
- rolePresets не перенесені в JSON сценаріїв (лишились в roles.ts для backward compat)
- getRolesForScenario() fallback до ROLE_PRESETS якщо scenario.rolePresets порожній

---

## Фаза 4 — Оптимізація промптів (2026-04-13)
### Що змінено
- `src/lib/prompts.ts`: повна переробка
- buildSystemPromptBlocks() тепер повертає {ruleset, static, dynamic}
- Фільтрація NPC — тільки зустрічені (metNPCs з npcRelations)
- Фільтрація локацій — тільки поточна + відвідані
- Компактний формат навичок (Skill:value)
- Детальний формат інвентаря з item IDs
- Всі inventory mutation tags описані в промпті
- campaignContext і eventInstruction як injection points
- buildSummarizePrompt тепер витягує currentLocation
### Орієнтовний розмір
- Ruleset block: ~400-500 tok (кешується)
- Static scenario: ~600-900 tok (кешується)
- Dynamic block: ~400-600 tok
- Загалом: ~3500 tok, після кешу ~850 нових

---

## Фаза 5 — Campaign layer (2026-04-13)
### Що змінено
- `src/lib/campaigns.ts` — новий файл
- createCampaign(), getCampaignContext(), closeSession()
- Session summaries via Haiku model
### Відомі проблеми
- Не інтегровано в /api/sessions/route.ts (потребує UI для campaign creation)

---

## Фаза 6 — Real-time (2026-04-13)
### Що змінено
- `src/app/api/ai/route.ts`: три-блочний caching (ruleset/static/dynamic)
- max_tokens: 600 (основний), 500 (summarize)
- LOCATION тег оновлює worldState.currentLocation + visitedLocations
- Activity tracking: passiveMessageCount, totalMessageCount
- Keeper activity section інжектується в dynamic block
### Відомі проблеми
- SSE streaming (ReadableStream) — не реалізовано, лишився request/response
- Причина: потребує змін у GameChat.tsx клієнтській частині; відкладено

---

## Фаза 7 — Asset management (2026-04-13)
### Що змінено
- `src/lib/assets.ts` — новий файл
- getOrGenerateImage() з scenario → campaign → generate fallback
- generateImageExternal() — placeholder, потребує wire-up до /api/image
### Відомі проблеми
- generateImageExternal() кидає Error — треба рефакторити /api/image логіку в модуль

---

## Фаза 8 — Cost tracking (2026-04-13)
### Що змінено
- `src/lib/costTracker.ts` — новий файл
- trackAPICall() з PRICING для Anthropic/Gemini/OpenAI
- getSessionCosts, getUserCosts, getAdminOverview queries
- `src/app/api/admin/costs/route.ts` — новий endpoint
- trackAPICall() викликається в ai/route.ts після кожного LLM запиту (non-blocking)
### Відомі проблеми
- TTS і image calls ще не tracked (потребує інтеграції в /api/tts та /api/image)

---

## Фаза 9 — UI зміни (2026-04-13)
### Що змінено
- `src/components/StatsBar.tsx`: equipped (⚔), broken (✕) відображення в інвентарі
- `src/components/SessionList.tsx`: getRolesForScenario() для scenario-specific ролей; campaign/one-shot badge; player limits
- `src/app/admin/page.tsx`: API Costs секція з посиланням на /api/admin/costs

---

## Фаза 11 — Інвентар як джерело правди (2026-04-13)
### Що змінено
- `src/types/index.ts`: InventoryItem.equipped, InventoryItem.broken, Player.equippedItemId
- `src/app/api/ai/route.ts`: parseInventoryTags() з USE_ITEM, REMOVE_ITEM, EQUIP, BREAK_ITEM
- `src/lib/prompts.ts`: повна секція inventory instructions з усіма тегами
### Інваріант
- LLM ніколи не є джерелом правди для інвентаря
- LLM генерує теги → код застосовує мутації → БД зберігає → наступний запит отримує актуальний стан

---

## Фаза 12 — Keeper Activity System (2026-04-13)
### Що змінено
- `src/types/index.ts`: passiveMessageCount, lastSkillCheckAt, totalMessageCount, pendingRollResult в WorldState; keeperStyle в GameSession
- `src/app/api/ai/route.ts`: isPassiveMessage(), buildKeeperActivitySection(); SET_PENDING_ROLL / CLEAR_PENDING_ROLL parsing
- `src/lib/rulesets.ts`: SET_PENDING_ROLL instructions в CoC rules block

---

## Фаза 13 — Random Event Engine (2026-04-13)
### Що змінено
- `src/lib/randomEvents.ts` — новий файл
- evaluateRandomEvent(): накопичений шанс BASE=5%, MAX=60%, INC=5.5 → halves кожен цикл
- applyEventDecision(), resolveActiveEvent(), clearActiveEvent()
- buildEventInstruction() — 4 типи з scenario eventHints
- locationGroups в обох сценаріях для групування ризику
- RANDOM_EVENT тег обробляється в ai/route.ts
- ambientFile повертається клієнту при зміні location group
### Математика
- Цикл 1: MAX за 10 повідомлень (INC=5.5)
- Цикл 2: MAX за 20 повідомлень (INC=2.75)
- Цикл 3: MAX за 40 повідомлень (INC=1.38)
- Transition events: 15% фіксований шанс при зміні групи

---

## ANT-7: Mobile Sidebar (2026-04-14)
### Що змінено
- `src/components/GameChat.tsx`: `showSidebar` state + кнопка 📋 `md:hidden` в хедері
- `CaseFilesPanel`: новий пропс `onClose?` → кнопка × в хедері панелі
- Wrapper div з `translate-x-full md:translate-x-0` + `fixed inset-y-0 right-0 z-50` для mobile overlay
- Backdrop `md:hidden fixed inset-0 bg-black/60 z-40` закривається по кліку
- Desktop: поведінка без змін (`md:relative md:flex md:w-64`)

---

## TTS Bugfixes (2026-04-14) — ANT-10, ANT-11

### ANT-11: Голос НПС (segments.ts)
- **Баг**: AI іноді пише `[NPC:Ковальська]` замість `[NPC:Місіс Гаррієт Ковальська]` → lookup по `npcMap` не знаходить NPC → fallback `voiceStyle:'keeper'`, немає gender → Gemini призначає Fenrir замість Aoede
- **Фікс**: partial name matching — якщо точний match не знайдено, шукаємо NPC де повне ім'я містить слово з тегу (довше 2 символів)

### ANT-10: Кубики у TTS (segments.ts + ttsEngine.ts)
- **Баг**: TTS озвучує `(1к100, треба 65 або менше)`, `[65]`, `Успіх 0, провал 1к3 SAN` — деталі які не потрібні в аудіо
- **Фікс**: `stripDiceForTts()` — стрипить dice notation перед відправкою в Gemini TTS; у чаті текст залишається повним
- Застосовується і в single-speaker і в multi-speaker режимах (per-segment)

---

---

## Admin panel redesign (2026-04-15) — ANT-19/20/21/22

**Проблема:** адмінка була одним великим скролом без структури; таблиця моделей показувала лише 30 днів; сесії без деталей.

**Рішення:**
- `AdminTabs.tsx` — 'use client' компонент з tab-навігацією, 4 вкладки: Users / Usage / Scenarios / Settings. `admin/page.tsx` залишається server component, передає users + sessions як props.
- `UsageTab.tsx` — новий клієнтський компонент з 3 секціями:
  1. **By Model** — фільтр Today/Week/Month/All/Custom, refetch при зміні
  2. **Sessions** — all-time top 50; player_count з `jsonb_array_length(players)`, message_count + keeper_message_count з `messages` через subquery, avg output/input tokens (AVG по llm-типу), expandable model breakdown
  3. **By Account** — той самий period filter, expandable model breakdown
- `costTracker.ts` — додано `Period` type, `periodFilter()` SQL fragment helper, нові функції `getSessionBreakdownEnhanced()` (2 запити: stats + model breakdown, merge в TS) та `getAccountsBreakdown()` (аналогічно)
- `api/admin/costs/route.ts` — нові breakdowns `sessions-enhanced` і `accounts`, params `period` і `date`

**Ключові рішення:**
- Expandable рядки через Set<string> у state — жодного додаткового fetch при розкритті (дані вже завантажені)
- `periodFilter()` повертає sql fragment (безпечно, параметризовано) — вбудовується у WHERE через postgres.js template literal
- Sessions не мають period filter (показуємо всі активні сесії по сумарній вартості, не прив'язуємо до дати)
- `CostsTables.tsx` більше не використовується (функціональність перенесена в `UsageTab.tsx`)

## Наступні кроки
- Фаза 10: ElevenLabs ambient audio generation (після стабілізації)
- ~~SSE streaming: реалізувати client-side reader в GameChat.tsx~~ ✅ ЗРОБЛЕНО
- Wire-up generateImageExternal() до існуючої image generation логіки
- ~~Track TTS/image API calls в costTracker~~ ✅ ЗРОБЛЕНО
- Додати keeperStyle selector в session creation UI ← ВЖЕ є в settings panel
- Тестування нових тегів в реальній грі

---

## Рефакторинг кодової бази (ANT-14) — 2026-04-14

Виконані покращення з аудиту структури:

**1. extractLocationFromMessages видалено** — функція завжди повертала `undefined` бо LOCATION теги стрипились з БД. Замінено на `worldState.currentLocation`.

**2. updateSession батчінг** — два окремих UPDATE+SELECT замінено одним запитом. `updateSession` тепер приймає всі поля разом.

**3. segments.ts** — додано strip для USE_ITEM, REMOVE_ITEM, EQUIP, BREAK_ITEM, SET_PENDING_ROLL, CLEAR_PENDING_ROLL, RANDOM_EVENT при клієнтському парсінгу.

**4. gemini-pro видалено** — `AiProvider` тепер `'claude-sonnet' | 'gemini-flash'`. Застарілий `proxy.ts` видалено.

**5. Model pricing DB table** — `model_pricing` таблиця з seed-даними. `costTracker.ts` завантажує ціни з БД (7-денний кеш). Виправлено ціни gemini-2.5-flash: $0.10→$0.30 input, $0.40→$2.50 output. Endpoint `GET/PATCH /api/admin/pricing`.

**6. Docker volume для dynamic images** — перевірено: `docker-compose.yml` вже має `./cthulhu/public/scenarios:/app/public/scenarios` — покриває `dynamic/` підпапку. Рішення вже існує.

**7. Language selection** — `language VARCHAR(5) DEFAULT 'uk'` в `game_sessions`. Вибір мови в SessionList modal. `buildSystemPromptBlocks()` приймає `language` опцію — додає мовну інструкцію + стиль відповіді відповідною мовою.

---

## Fix: DiceRoller зависає після кидку (2026-04-15)

**Проблема:** `pendingRollResult` зберігається в БД через `[SET_PENDING_ROLL]`, але очищається лише якщо LLM включив `[CLEAR_PENDING_ROLL]` у відповідь. LLM часто забуває цей тег → кубики відкриваються при кожному перезавантаженні сесії.

**Рішення:** В `ai/route.ts`, після обробки всіх тегів: якщо `worldState.pendingRollResult` був встановлений на початку ходу І вхідне повідомлення є чистим числом (`/^\d+$/`) І LLM вже не очистив його — примусово очищаємо.

**Також:** вручну очищено зависший `pendingRollResult` в сесії `ed2535ef` через SQL `(world_state #>> '{}')::jsonb - 'pendingRollResult'`.

---

## Глобальні налаштування моделі та TTS (2026-04-15)

- `app_settings` таблиця в БД (key/value, PRIMARY KEY на key). Seeds: `ai_provider=gemini-flash`, `tts_provider=gemini`.
- `GET/PATCH /api/admin/settings` — читання та оновлення налаштувань.
- `getAllAppSettings()` + `setAppSetting()` в `queries.ts`.
- Session page (`session/[id]/page.tsx`) завантажує налаштування server-side і передає в `GameChat` як пропси `defaultAiProvider` / `defaultTtsProvider`.
- `GameChat`: `aiProvider` та `ttsProvider` більше не в localStorage — визначаються пропсами. Прибрано `changeAiProvider()`, `toggleTtsProvider()`, константу `AI_PROVIDERS`.
- З ⚙️ панелі прибрано вибір моделі та кнопку TTS-провайдера.
- Новий `KeeperSettings.tsx` client component в `/admin` — картки вибору моделі та TTS, зберігає при кліку, показує "Saved ✓".
- За замовчуванням: **Gemini 2.5 Flash** + **Gemini TTS** (замість попереднього Claude Sonnet за замовчуванням).

---

## Аналіз структури проекту (2026-04-15)

Повний аудит кодової бази після фаз 0-14. Мета: знайти невідповідності між NOTES/PROJECT_CONTEXT та реальним кодом, технічний борг, потенційні баги та ідеї покращень.

### Що реалізовано, чого немає в документації

**SSE streaming реалізований повністю:**
- Сервер (`api/ai/route.ts`): `ReadableStream` з `event: chunk` + `event: done` + `event: error`
- Клієнт (`GameChat.tsx`): `readSseStream()` читає потік та оновлює optimistic bubble в реальному часі
- PROJECT_CONTEXT.md застарів: у розділі "Current Gaps" написано "SSE client-side error recovery — Basic retry only", але насправді SSE вже повністю реалізоване

**TTS/image cost tracking реалізований:**
- `/api/tts/route.ts`: `trackAPICall()` для Gemini TTS і OpenAI TTS
- `/api/image/route.ts`: `trackAPICall()` для Gemini Image і DALL-E 2
- Пункти "Track TTS/image API calls" у "Наступні кроки" вже виконані

**keeperStyle selector вже є:**
- В `GameChat.tsx` settings panel є три кнопки (Пасив/Баланс/Актив) — це і є selector в session UI
- Але у SessionList.tsx (сторінка створення сесії) — його дійсно немає

**dynamicNpcs реалізований:**
- `api/ai/route.ts` авто-реєструє imрrovised NPCs в `worldState.dynamicNpcs`
- `GameChat.tsx` передає `dynamicNpcs` у `CaseFilesPanel`
- У PROJECT_CONTEXT.md згадки немає — треба додати

**Автофолбек image generation:**
- `api/image/route.ts`: Gemini → fallback на Pollinations (безкоштовний) після 3 спроб з rate limit
- Вибір провайдера через `IMAGE_PROVIDER` env var (`gemini` | `openai` | інший → Pollinations)
- В документації не описано

**gemini-2.0-flash / gemini-pro:** ✅ ВИПРАВЛЕНО — `gemini-pro` видалено з `GEMINI_MODELS`, `AiProvider` тепер `'claude-sonnet' | 'gemini-flash'`.

### Технічний борг та потенційні проблеми

**1. `updateSession` — подвійний запит до БД** ✅ ВИПРАВЛЕНО — один батчований UPDATE.

**2. `extractLocationFromMessages` — завжди повертала `undefined`** ✅ ВИПРАВЛЕНО — функцію видалено, використовується `worldState.currentLocation`.

**3. `segments.ts` не стрипав inventory теги на клієнті** ✅ ВИПРАВЛЕНО — додано strip для USE_ITEM, REMOVE_ITEM, EQUIP, BREAK_ITEM, SET_PENDING_ROLL, CLEAR_PENDING_ROLL, RANDOM_EVENT.

**4. `GameChat.tsx` — 1236 рядків, монолітний компонент**
- Можна декомпозувати: `useAudio()`, `useInventory()`, `useSse()`, `MessageList`, `SettingsPanel`
- Не критично зараз, але збільшує cognitive load

**5. `costTracker.ts` — застарілі ціни** ✅ ВИПРАВЛЕНО — `model_pricing` таблиця в БД, ціни Gemini 2.5 Flash виправлено ($0.30/$2.50).

**6. Docker volume для dynamic images** ✅ ПЕРЕВІРЕНО — `docker-compose.yml` вже має `./cthulhu/public/scenarios:/app/public/scenarios`.

**7. `proxy.ts` — невикористаний** ✅ ВИПРАВЛЕНО — файл видалено.

**8. `gemini-pro` мертвий код** ✅ ВИПРАВЛЕНО — видалено разом з п.2 аудиту.

**9. `isPassiveMessage()` — тільки українські патерни**
- При English сесіях (`language='en'`) короткі повідомлення можуть хибно класифікуватись як passive
- Прийнятно поки; варто додати англійські патерни якщо стане помітно

**10. `pendingRollResult` зависає в БД** ✅ ВИПРАВЛЕНО — force-clear на сервері коли гравець надсилає число.

### Залишкові покращення

| Пріоритет | Зміна | Складність |
|-----------|-------|------------|
| Low | Декомпозиція `GameChat.tsx` на хуки + менші компоненти | High |
| Low | Документувати `dynamicNpcs`, `IMAGE_PROVIDER` env, image cache path в PROJECT_CONTEXT | Low |
| Low | `isPassiveMessage()` — додати англійські патерни для `language='en'` сесій | Low |

---

## Fix: Збій "This page couldn't load" при простроченому токені (2026-04-15)

**Проблема:** Якщо JWT токен авторизації прострочився, запит `/api/sessions` на клієнті повертав `401 Unauthorized` з тілом `{ error: 'Unauthorized' }`. Компонент `SessionList` одразу розпарсював це як масив, не перевіряючи статус (відсутність `.catch` та `res.ok`). Оскільки `error` не є масивом, метод `.map` викликав помилку і ламав увесь React-додаток з помилкою клієнтського рендерингу "This page couldn't load".

**Рішення:** 
- У `src/components/SessionList.tsx` додано коректну обробку `Promise.all` запитів через `try/catch`. 
- Якщо `res.status === 401`, відбувається примусовий редирект (через `window.location.href`) на сторінку `/auth/login`. 
- Для інших помилок обережно відображається пустий масив, що не дає додатку збій.

---

## План виправлення краху "The page couldn't load" (SessionList Crash v2) 2026-04-15

### Огляд проблеми
Додаток досі падає на головній сторінці. Аналіз показав, що крах відбувається під час виконання `s.players.map(...)` або при зверненні до `s.world_state.act` у клієнтському рендерингу компонента `SessionList.tsx` ПІСЛЯ успішної авторизації.

Під час рефакторингу `updateSession` (ANT-14, батчінг запитів БД), оптимізація запитів до БД за допомогою `sql.unsafe` призвела до збереження строк замість JSON:
```typescript
if (updates.players !== undefined) { 
  sets.push(`players = $${sets.length + 1}`);
  vals.push(JSON.stringify(jsonOf(updates.players))); 
}
```
Оскільки `sql.unsafe` використовує сирі параметри `$1`, PostgreSQL сприймає надісланий `JSON.stringify()` як звичайну текстову строку, зберігаючи її всередині `JSONB` колонки. Коли API повертає дані: `players` — це формально валідний тип String, який не має методу `.map()`, через що React падає під час рендерингу. Нові сесії працюють, але після першого оновлення — об'єкти заміняються строками і `SessionList` вмирає.

### Виконані зміни
1. **[ЗМІНЕНО] queries.ts**: Замінено перелік парметрів у `sql.unsafe` на вбудований синтаксис `postgres.js` (`sql\`UPDATE game_sessions SET ${sql(data)}\``), який правильно зберігає JSON без подвійного Stringify парсингу.
2. **[ЗМІНЕНО] SessionList.tsx**: Додано `graceful degradation` до клієнтського коду, перевіряючи `typeof s.players === 'string'` та `typeof s.world_state === 'string'`, парсячи їх назад для backward compatibility.


---

## Fix: Dynamic image re-generation on session reload (ANT-Image-Cache) 2026-04-15

### Проблема
При заході у стару сесію всі зображення `[IMAGE:...]` перегенеровувались заново (витрачались токени Gemini). Причина: клієнт зберігав URL у `sessionImages` під ключем `optimisticId` (timestamp на момент запиту), а після перезавантаження `dynamicImages` населявся з реальних `msg.id` з БД — ключі не співпадали, тому `DynamicImage` не знаходив кешований URL і робив новий запит до API.

### Рішення
Три файли:
1. **`src/types/index.ts`** — `sessionImages?: Record<string, string>` у `WorldState` (додано Gemini)
2. **`src/app/api/image/route.ts`** — підтримка `?json=true` для повернення `{ url }` замість буфера (додано Gemini)
3. **`src/app/api/ai/route.ts`** — повертаємо `messageId: savedAssistantMsg.id` у `done` event замість того, щоб ігнорувати return value `saveMessage()`
4. **`src/components/GameChat.tsx`** — `DynamicImage` приймає `url` prop і `onUrlGenerated` callback (додано Gemini); після отримання `done` event перемаппуємо `optimisticId`/`introId` → `realId` у `messages`, `voiceStyles`, `msgSegments`, `dynamicImages`; `handleUrlGenerated` зберігає URL у `sessionImages[realId]` та PATCH-ить БД

### Ключове рішення
Не намагатись "виправити" кеш на рівні файлової системи — проблема в ключах React state. Достатньо повернути реальний DB ID з API і перемаппувати optimistic ID одразу після отримання відповіді.

---

## Fix: Location display falls back to "Акт 1" after transition (2026-04-15)

### Проблема
Після переходу в нову локацію UI показував "Акт 1" замість назви локації. LLM вигадував нові location ID (`elm_street_782_hallway`, `carlos_lopez_house`), яких немає в `scenario.locations`. `scenario.locations.find(l => l.id === location)` повертав `undefined`, `locationName` = `null`, UI падав на fallback "Акт 1".

Корінь проблеми: в промпті інструкція `[LOCATION:location_id]` не перераховувала доступні ID. LLM бачив тільки поточну + відвідані локації в `## ЛОКАЦІЇ` секції, але для нових локацій ID не знав.

### Рішення
- **`src/lib/prompts.ts`**: додано перелік усіх `scenario.locations` ID з назвами в інструкцію `[LOCATION:]` — LLM бачить повний список і не вигадує нові
- **`src/components/GameChat.tsx`**: UI fallback — якщо `currentLocationName` = null але `currentLocation` є, показуємо ID з заміною `_` → пробіл; "Акт 1" тільки якщо взагалі немає location

---

## Feature: Situational (dynamic) locations (2026-04-15)

### Проблема
Сценарії мали лише статичні локації (прописані в JSON). Гравці могли входити до місць, яких немає в сценарії (крамниця, провулок), LLM вигадував ID — вони не зберігались, при повторному візиті локація "забувалась".

### Рішення
Два типи локацій:
- **Статичні** — у `scenario.json`, мають ambient аудіо, показуються в промпті з деталями
- **Ситуативні** — LLM створює тегом `[NEW_LOCATION:id:Назва:Опис]`, зберігаються у `world_state.dynamicLocations`. Без аудіо. При повторному переході — звичайний `[LOCATION:id]`.

### Зміни
- **`src/types/index.ts`**: `DynamicLocation {name, description}` + `WorldState.dynamicLocations`
- **`src/lib/prompts.ts`**: в static блоці — нове правило `[NEW_LOCATION:]` + перелік сценарних ID; у dynamic блоці — компактний список вже створених ситуативних локацій
- **`src/app/api/ai/route.ts`**: парсинг `[NEW_LOCATION:]` → запис у `dynamicLocations`, стрипінг з `textForDB`, `locationName` шукає в обох джерелах
- **`src/app/session/[id]/page.tsx`**: `locationNames` включає `world_state.dynamicLocations` при завантаженні сторінки

### Ключові рішення
- Опис ситуативної локації зберігається у world_state, але НЕ передається повністю в промпт (тільки id+name) — LLM пам'ятає контекст з чату
- Ambient logic незмінна: динамічні локації просто відсутні в `locationGroups` → audio не грає автоматично
- Backward compat: `dynamicLocations` optional, старі сесії без змін

---

## Fix: Keeper не ставить [SET_PENDING_ROLL] для звичайних перевірок (2026-04-15)

### Проблема
LLM ігнорував тег `[SET_PENDING_ROLL:]` для звичайних skill checks (Psychology, Spot Hidden тощо). Писав "Кинь Психологію (1к100, треба 50 або менше)" текстом без тегу — кубики не запускались, гравець мусив вводити число вручну.

Причина: в `rulesets.ts` тег був описаний тільки в окремій секції "Кидки з наслідками (ситуативні перевірки)". LLM сприймав це як два різних режими: текст — для звичайних, тег — для ситуативних. "Формат кидка" і "SET_PENDING_ROLL" були паралельними інструкціями.

### Рішення
Переписано секцію в `rulesets.ts`: тег тепер є обов'язковим кроком 2 для КОЖНОГО кидка (навичка, SAN, Luck, бій). Текст без тегу явно недостатній. SAN checks і Luck rolls також отримали конкретні приклади тегу.

Попередній "Формат кидка" і "Кидки з наслідками" злито в одну секцію "Як запитувати кидок — ОБОВ'ЯЗКОВИЙ порядок".

---

## Fix: Keeper виводить [Ім'я]: перед відповіддю (2026-04-15)

### Проблема
LLM починав відповіді з `[Anton]:` — наприклад `[Anton]: Ви прямуєте до будинку...`.

Причина: інструкція `Префікс [Ім'я]: — окремі гравці. Ніколи не дій від їх імені.` пояснювала що означає префікс, але LLM починав використовувати той самий формат у своїх відповідях, адресуючи нарацію гравцю.

### Рішення
Змінено формулювання в `prompts.ts` — тепер явно забороняє LLM використовувати цей префікс у своїх відповідях:
"Якщо бачиш префікс [Ім'я]: у повідомленні — це гравець. Ніколи не дій від їх імені і НІКОЛИ не використовуй цей префікс у своїх відповідях."

---

## Udate: Keeper prefix [Name]: → Name: (2026-04-15)

### Рішення змінено
Попередній фікс (заборона префіксу) скасовано. Поведінка стала умовною:
- **1–2 гравці:** без префіксу
- **3+ гравці:** `Ім'я:` (без дужок) на початку абзацу коли відповідь адресована конкретному гравцю

Реалізовано умовно в dynamic блоці промпту через `players.length > 2`.

---

## ANT-14: Видалено StatsBar над чатом (2026-04-15)

Прибрано `import StatsBar` та `<StatsBar>` з `GameChat.tsx`. Компонент `StatsBar.tsx` збережено. Статистика гравців доступна в сайдбарі (вкладка «Гравці»).

---

## ANT-15: Scenario generator + variants (2026-04-15)

### Що зроблено
1. **`src/lib/scenarioGenerator.ts`** — нова функція `generateScenario()`, викликає `claude-opus-4-6` з детальним системним промптом (повна схема сценарію + правила). Повертає розпарсений JSON.
2. **`src/app/api/admin/generate-scenario/route.ts`** — POST endpoint, admin-only. Параметри: `title, titleUk, premise, era, difficulty, minPlayers, maxPlayers, isCampaign, estimatedSessions, language`.
3. **`src/types/index.ts`** — `ScenarioVariant {id, label, startingLocation, introHint}`, `variants?` у `Scenario`, `variantId?`/`variantHint?` у `WorldState`.
4. **`src/app/api/sessions/route.ts`** — `pickVariant()` обирає випадковий варіант зі сценарію, передає у createSession.
5. **`src/lib/queries.ts`** — `createSession` приймає `variantId`/`variantHint`, зберігає у `world_state`.
6. **`src/lib/prompts.ts`** — dynamic блок включає `variantHint` секцію якщо є.
7. **`src/app/api/ai/route.ts`** — очищає `variantHint` після інтро.
8. **`scenarios/the-haunting.json`** — додано 2 variants: "Стандартний" (офіс) і "Відразу в справу" (будинок).
9. **`SCENARIO_GUIDE.md`** — нова секція 16 "variants".

### Ключові рішення
- `variantHint` зберігається в world_state і включається в dynamic блок (не static) — не засмічує кеш
- Очищається одразу після першого AI response — не витрачає токени далі
- Генератор повертає JSON без збереження на диск — це робить адмін UI (ANT-17)

## ANT-18: Scenario generator — rolePresets (2026-04-15)

### Що зроблено
1. **`src/lib/scenarioGenerator.ts`** — додано `rolePresets` до схеми в SYSTEM_PROMPT: повна структура з id, name, description, rulesetId, hp/sanity/luck, skills, background, inventory. Додано розділ "rolePresets rules" з вимогами (2-5 ролей, HP/Sanity/Luck діапазони, навички, інвентар, ПЕРК у бекграунді). max_tokens: 8000 → 10000.
2. **`SCENARIO_GUIDE.md`** — розширено секцію 14: повна документація `rolePresets` з прикладом і правилами.

### Ключові рішення
- `getRolesForScenario()` вже пріоритезує `scenario.rolePresets` над глобальними — нульові зміни в runtime коді
- Backtick символи всередині template literal SYSTEM_PROMPT замінено на plain text (уникнення TypeScript parse error)
- Навички — англійською (game engine використовує їх як ключі)

## ANT-17: Admin UI для генерації сценаріїв (2026-04-15)

### Що зроблено
1. **`src/app/admin/ScenarioGenerator.tsx`** — новий client component. Форма: title/titleUk, premise (textarea), era, difficulty, language, minPlayers/maxPlayers, isCampaign + estimatedSessions, disabled ambient checkbox (Phase 10). Після генерації — показ JSON у `<pre>`, кнопки "Copy JSON" і "Save to scenarios/".
2. **`src/app/api/admin/generate-scenario/save/route.ts`** — POST endpoint, admin-only. Отримує `{id, json}`, валідує id (kebab-case), пише `scenarios/{id}.json` через `fs.writeFileSync`.
3. **`src/app/admin/page.tsx`** — додано `<ScenarioGenerator />` між KeeperSettings і CostsTables.

### Ключові рішення
- Save — окрема дія після перегляду JSON, щоб адмін міг перевірити перед записом
- id валідується regex `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` — захист від path traversal
- `generateAmbient` checkbox — disabled з підказкою "Phase 10 — not yet implemented", щоб задати очікування
- Статус генерації: idle → generating → done/error, кнопка disabled поки немає title/titleUk/premise

---

## Фаза 15 — Workflow & Staging (2026-04-16)

### Що змінено
- **Ізоляція середовищ**: 
  - `/opt/apps/cthulhu` — Devon/Staging (гілка `staging`, порт 3001)
  - `/opt/apps/cthulhu-prod` — Production (гілка `main`, порт 3000)
- **Shared Storage**: Створено спільне сховище `/opt/apps/shared_data` (сценарії та асети). Обидва середовища дивляться в одну точку, що економить кошти на AI-генераціях (оскільки БД спільна).
- **Caddy**: налаштовано `staging.barrigame.es` з автоматичним SSL.
- **Git Workflow**: 
  - Основна гілка розробки — `staging`.
  - Фічі розробляються в `feature/ANT-XXX` від `staging`.
  - Деплой на Prod — тільки через `Ready for Deployment` в Linear (мердж у `main`).
- **Linear Integration**: 
  - Повна автоматизація через API Key (Claude account).
  - Робота виключно в проекті **Barri** (`ffeca0b2-16b3-4d2e-a7e6-0181ea2e991c`).

### Рішення прийняті
- База даних залишається спільною. Усі асети (картинки, сценарії) також спільні через Volume мапінг на `/opt/apps/shared_data`.
- AI працює в `cthulhu` папці, щоб не втрачати контекст NOTES/CHANGELOG.

---

## ANT-32: Покращення відображення сесій (2026-04-16)
### Що змінено
- `src/components/SessionList.tsx`: видалено відображення `Акт X` зі списку сесій на головній сторінці.
- `src/components/SessionList.tsx`: додано лічильник сесій для кампаній (`Сесія: перша`, `друга` тощо) з використанням українських порядкових числівників.
- Використовується `session_number` та `campaign_id` з об'єкта сесії.
### Рішення прийняті
- Для перших 10 сесій використовуються слова (`перша`, `друга`...), далі — цифровий формат (`11-та`).
- One-shot сесії тепер не мають додаткових міток біля назви, що робить UI чистішим.

---

## [2026-04-17 · Claude] — Docs · Синхронізація LINEAR.md з фактичною структурою Linear

### Problem
LINEAR.md був розсинхронізований з реальною структурою проекту у Linear:
- Codex ID був `TBD`, хоча в команді Codex уже з ID `3f8713c1-72d2-4781-b3c0-1ed4e1017a4b`.
- Стан називався "Ready for Deployment" у доках, але у Linear — "Ready for deploy".
- Не були згадані стани `Ideas`, `Improvements`, `AI Imprtovements`, `Canceled`, `Duplicate`.
- Відсутні нові лейбли `Bug`, `Improvement`, `Feature`.
- Workflow-таблиця була у зламаному форматі (5 колонок без заголовка).

### Solution
Переписано `/opt/apps/barri-dev/LINEAR.md`:
- Додано ID для всіх 11 станів workflow (з фактичними назвами, включаючи тайпо `AI Imprtovements` — він реально так називається в Linear).
- Додано Codex ID у identity-таблицю.
- Додано всі 6 поточних лейблів.
- Переписано lifecycle-таблицю як читабельний крок-за-кроком процес.
- Додано окрему секцію про backlog-стани (`Ideas`/`Improvements`/`AI Imprtovements`/`Canceled`/`Duplicate`).
- Додано fallback-доступ через `LINEAR_API_KEY` з `/opt/apps/.env` для випадків, коли MCP OAuth недоступний (як цього разу на VPS).

### Key decisions
- Залишено точну назву стану `AI Imprtovements` з тайпо — інструкція мусить відповідати Linear, інакше state-transitions зламаються. Варто виправити на стороні Linear окремо.
- Не правили назви інших станів / лейблів — source of truth у Linear.
- Додано fallback через прямий GraphQL, бо MCP OAuth на VPS не завжди доступний (OAuth flow вимагає браузера). Це read-only паттерн; state-changes все одно через MCP, коли можливо.

---

## [2026-04-17 15:00] Claude — ANT-27 fix2: Gemini TTS → token-based input+output pricing

### Problem
TTS модель не мала output ціни у pricing editor. Модель повинна мати і input (текст що відправляємо) і output (аудіо що отримуємо) — обидва в токенах.

### Solution
- `costTracker.ts`: FALLBACK_PRICING для Gemini TTS змінено з `{ perChar }` на `{ inputPer1M: 0.50, outputPer1M: 2.00 }` (сума $2.50/M — те саме). `calculateCost()` для TTS: якщо є inputPer1M — використовує token-based billing, fallback — perChar (для OpenAI TTS).
- `queries.ts`: seed замінено (inputPer1M + outputPer1M замість perChar). Додано міграцію: DELETE perChar для Gemini TTS.
- `tts/route.ts`: Gemini TTS тепер трекує `inputTokens = outputTokens = ceil(text.length/4)` + `characters` (для сумісності).
- `UsageTab.tsx`: renderInput/renderOutput показують "N tok" для token-based даних; "~N tok" для старих записів з chars.
- `PricingEditor.tsx`: Gemini TTS тепер у секції "Per token" (має outputPer1M); секція перейменована з "LLM — per token" на "Per token — LLM / TTS".

### Key decisions
- outputTokens для TTS ≈ inputTokens (chars/4) — Gemini не повертає реальний token count аудіо, але білінг приблизно такий.
- perChar залишено тільки для OpenAI TTS (OpenAI білить по символах).
- Ціна: $0.50 in + $2.00 out = $2.50/M tok (відповідає попередньому $2.50/M).

---

## [2026-04-17 14:00] Claude — ANT-26/27 fix: правильне розміщення stats + TTS/image display

### Problem
Антон повернув ANT-26 та ANT-27 з коментарями:
- ANT-26: scenario stats з ціною були на вкладці Scenarios — мало бути на Usage. Scenarios tab: залишити тільки session stats.
- ANT-27: (a) Usage table не показувала input для TTS/image; (b) TTS output має бути "N tok / N ch"; (c) PricingEditor: image модель була в LLM секції; (d) TTS не мала input pricing в editor.
- Також: LINEAR.md — додано правило обов'язкового коментаря при переході в In Review.

### Solution
- `ScenarioStats.tsx`: прибрано cost-колонки (тільки session_count, completed_count, avg_messages).
- `UsageTab.tsx`: нова секція "By Scenario" з cost-даними; `renderInput()` показує chars для TTS, input_tokens для LLM/image; `renderOutput()` для TTS — "N tok / N ch" (chars/4).
- `PricingEditor.tsx`: LLM-фільтр змінено на `'outputPer1M' in metrics` (image без outputPer1M іде в нижню секцію); TTS `perChar` тепер показується в Input-колонці з міткою "$/1M tok".
- `LINEAR.md`: додано правило "Review comment (mandatory)".

### Key decisions
- `perChar` for TTS залишається одиницею зберігання — тільки UI відображає його як "$/1M tok" (через toDisplay). Не дублюємо запис inputPer1M для TTS.
- TTS output = chars/4 (стандартне відношення для Gemini TTS: 4 chars = 1 token).

---

## [2026-04-17 12:00] Claude — ANT-25/26/27: Scenario stats + image output tokens

### Problem
- ANT-25/26: В адмін-панелі на вкладці Scenarios не було таблиці зі статистикою сценаріїв (кількість сесій, завершень, середня кількість повідомлень, вартість).
- ANT-27: Gemini image API повертає `totalTokenCount` у `usageMetadata`, але ми зберігали тільки `promptTokenCount`. Output tokens не трекувались.

### Solution
- **ANT-27**: `src/app/api/image/route.ts` — обчислюємо `outputTokens = totalTokenCount - promptTokenCount` і передаємо в `trackAPICall()`.
- **ANT-25/26**: `src/lib/costTracker.ts` — нова функція `getScenarioBreakdown()`: JOIN game_sessions + api_usage + messages, GROUP BY scenario_id. Повертає session_count, completed_count, avg_messages, total_cost, avg_cost_per_session.
- `src/app/api/admin/costs/route.ts` — додано `breakdown=scenarios`.
- `src/app/admin/ScenarioStats.tsx` — новий `use client` компонент з таблицею сценаріїв.
- `src/app/admin/AdminTabs.tsx` — `ScenarioStats` додано вгорі Scenarios-вкладки.

### Key decisions
- Completed = `game_sessions.status = 'completed'`, відсоток завершення — поряд із кількістю.
- Avg cost per session = AVG від per-session суми (не від окремих записів api_usage).
- Scenario stats не фільтруються за period — показуємо all-time дані.

---

## [2026-04-17 · Claude] — Docs · Виправлено `AI Improvements` в LINEAR.md

### Problem
Anton виправив тайпо на стороні Linear: стан `AI Imprtovements` тепер називається `AI Improvements` (UUID незмінний: `c1749d1a-916d-456b-8338-ecd14f360754`).

### Solution
- `LINEAR.md`: замінено всі згадки `AI Imprtovements` → `AI Improvements`, видалено warning-блок про тайпо.
- `CHANGELOG.md`: оновлено запис `[0.3.6]` (версія ще не задеплоєна, тому можна правити на місці).

### Key decisions
- Історичні записи в цьому журналі (вище) залишено з оригінальним написанням — NOTES.md append-only, редагувати минулі записи не можна.

---

## [2026-04-17 13:10] Codex — Docs sync: AGENTS/Linear

### Що змінено
- `AGENTS.md`: додано коротку карту структури проєкту (`src/app`, `src/components`, `src/lib`, `scenarios/`, `public/scenarios/`) і вирівняно wording Linear workflow з `LINEAR.md`.
- `AGENTS.md`: зафіксовано, що для Linear краще спочатку використовувати MCP/plugin шлях, а API залишити як fallback.
- `AGENTS.md`: виправлено назву фінального стану на `Ready for deploy`, щоб збігатися з фактичним Linear workflow.

### Причина
- Потрібно було оновити агентські інструкції під реальну структуру репо та прибрати дрібні розбіжності з Linear workflow.

---

## [2026-04-17 13:30] Codex — AGENTS: Codex-specific Linear rules

### Що змінено
- `AGENTS.md`: додано окремий розділ `Codex-Specific Rules` з короткими правилами для вибору задач, використання `small-task`, переходу в `Planned`/`In Review`, і роботи через MCP/plugin.

### Примітка
- У цій сесії Linear tools не були доступні, тому практично взяти Todo-задачу й перевести її по workflow не вдалося.

---

## [2026-04-17 19:28] Codex — Docs: фіналізовано єдиний Linear workflow (Claude + Codex, API-only)

### Problem
- Інструкції по Linear були розкидані між `LINEAR.md`, `AGENTS.md`, `CLAUDE.md` і частково розходилися:
  - різні формулювання по етапах workflow;
  - згадки про MCP/OAuth разом із API fallback;
  - залишкова назва стану `Ready for Deployment` в `PROJECT_CONTEXT.md`.

### Solution
- `LINEAR.md` переписано як **single source of truth** для обох агентів:
  - фінальний lifecycle (Selection → Complexity gate → Setup → Dev → Pre-review → In Review → Deploy/Done);
  - чіткий порядок для complex/small tasks;
  - mandatory pre-review checklist;
  - критерії `small-task`;
  - правила для backlog-станів;
  - доступ до Linear тільки через GraphQL API (`LINEAR_API_KEY`), без MCP.
- `AGENTS.md` синхронізовано до короткого чекліста, який посилається на `LINEAR.md`.
- `CLAUDE.md` оновлено: зафіксовано shared workflow і policy `API-only`.
- `PROJECT_CONTEXT.md` виправлено на фактичний стан `Ready for deploy`.

### Key decisions
- Для зменшення “зоопарку” інструкцій детальний процес залишено тільки в `LINEAR.md`, а інші файли мають короткий узгоджений summary.
- Воркфлоу уніфіковано для Claude і Codex; розділяється лише identity rule по assigned задачах.
- MCP шлях прибрано з операційного процесу цього проєкту: працюємо тільки через Linear API.

---

## [2026-04-17 20:32] Codex — ANT-28/31: завершення сесії, кампанійний “finish evening”, feedback і тестовий сценарій

### Problem
- `ANT-28`: не було повного flow завершення сесії — без read-only режиму, без rating/comment, без адмінської видимості feedback.
- `ANT-31`: кампанійний flow існував лише фрагментами (`session_summaries`, `closeSession()`, `campaignContext`), але не був підключений end-to-end.
- Completed sessions випадали зі списків, а `POST /api/ai` дозволяв писати навіть у завершену сесію.

### Solution
- Додано доменний endpoint `POST /api/sessions/[id]/complete`:
  - `mode: "complete-session"` — завершує сесію, ставить `completed_at`, опційно зберігає feedback;
  - `mode: "finish-evening"` — для кампаній: генерує session summary, оновлює campaign state, створює наступну сесію і зберігає попередню як completed.
- Додано `game_sessions.completed_at` і нову таблицю `session_feedback` (`session_id`, `rating`, `comment`, `submitted_by_user_id`, timestamps).
- `src/app/api/ai/route.ts`: completed sessions тепер server-side read-only (`409`), а campaign sessions отримують `campaignContext` з попередніх summaries.
- `src/app/api/sessions/route.ts`: при створенні campaign scenario автоматично створюється `campaign` і перша `game_session` прив’язується до нього.
- `src/lib/queries.ts`:
  - `createSession()` розширено підтримкою `campaignId`, `sessionNumber`, `initialWorldState`;
  - списки сесій більше не фільтрують лише `active`;
  - `getAllSessionsWithOwner()` тепер підтягує status + feedback;
  - додано `updateCampaignRecord()`, `getSessionSummaryBySessionId()`, `upsertSessionFeedback()`.
- `GameChat.tsx`:
  - нова status-панель для `active/completed/paused`;
  - `Завершити сесію`, `Завершити вечір`, `Завершити кампанію`;
  - completion modal з rating/comment;
  - completed/paused session = read-only review mode без composer/queue/send, але з доступом до chat/TTS/case files.
- `SessionList.tsx`: розділення на Active / Paused / Completed, статусні бейджі, cache fallback для щойно завершених сесій.
- Admin/UI:
  - `AdminTabs.tsx`: усі сесії, статус, feedback;
  - `ScenarioStats.tsx` і `UsageTab.tsx`: avg rating + rating count по сценаріях.
- Додано тестовий сценарій `scenarios/the-last-cup.json` — короткий one-shot для швидкої ручної перевірки flow завершення.

### Verification
- `npm run build` — успішно.

### Key decisions
- Rating/comment винесено в окрему таблицю `session_feedback`, щоб не текти через публічний session payload.
- Для кампаній використано модель “completed old session + create next session”, а не “paused one row forever”.
- Read-only захист зроблено на сервері (`/api/ai`, `PATCH /api/sessions/[id]`) і на клієнті (`GameChat`), щоб UI не був єдиною лінією захисту.

### Follow-up
- Виявився важливий staging-specific нюанс: `barri-dev` монтує `/opt/apps/shared_data/scenarios` поверх `/app/scenarios`, тому нові scenario JSON з repo не з’являються автоматично в live API без окремого sync у shared volume.
- `the-last-cup.json` вручну досинхронізовано в `/opt/apps/shared_data/scenarios`, після чого `https://staging.barrigame.es/api/scenarios` почав віддавати `the-last-cup`.
- `src/app/admin/AdminTabs.tsx`: feedback cell змінено з `truncate + title` на `details/summary`, щоб comment можна було реально прочитати в адмінці.

---

## ANT-23: Scenario generator — Opus 4.7 primary + Gemini 2.5 Pro fallback + robust JSON (2026-04-18)

**Problem.** Адмін-генератор сценаріїв падав на prod і staging. Користувач бачив `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`. Логи `apps-barri-1` показали `Scenario generation failed: Error: Generator returned invalid JSON: { "id": "sagrada-familia-occult", ... "rolePresets": [ { "id": "arqueologa_catalana", "name": "Каталонська Археол` — JSON обривався на першій ролі.

**Root cause.** Дві проблеми накладались:
1. `max_tokens: 10000` на `claude-sonnet-4-6` — повний сценарій з `rolePresets` + 8–14 локаціями + NPCs + systemPrompt + variants не вміщується; модель обривалась посеред JSON → `JSON.parse` падав.
2. Довгі запити ловили Caddy-таймаут → Caddy повертав HTML-сторінку помилки → клієнтський `res.json()` бачив `<!DOCTYPE` і кидав `SyntaxError`.

**Fix.**
1. `src/lib/scenarioGenerator.ts`: primary → `claude-opus-4-7` з prompt caching на SYSTEM_PROMPT (`cache_control: { type: 'ephemeral' }`) — ~90% знижки на input на повторних запусках. `max_tokens: 32000`. Fallback → `gemini-2.5-pro` з `responseMimeType: 'application/json'`. Якщо Opus падає (timeout / parse / 5xx), автоматично пробуємо Gemini, у відповідь повертаємо `fallbackReason`.
2. Парсер зроблено стійким: шукаємо text-блок через `content.find(b => b.type === 'text')` (а не `content[0]`), знімаємо markdown fences `/```(?:json)?\s*([\s\S]*?)```/`, на фейлі `JSON.parse` — беремо підстроку від першого `{` до останнього `}`. Сервер логує `provider`, `model`, `stop_reason`, `input/output_tokens`.
3. `src/app/api/admin/generate-scenario/route.ts`: `export const runtime = 'nodejs'` + `export const maxDuration = 300`, щоб проксі не різав запит. Повертаємо в JSON ще й `provider/model/stopReason/tokens/fallbackReason`.
4. `src/app/admin/ScenarioGenerator.tsx`: спочатку `res.text()`, потім `JSON.parse` — якщо body не JSON, показуємо `HTTP {status} — non-JSON response:` + перші 500 символів (замість марного `Unknown error`). Додано meta-рядок над JSON (провайдер/модель/токени/fallback-marker).

**Also (доки — застаріли після перейменування).** У `CLAUDE.md`, `AGENTS.md`, `PROJECT_CONTEXT.md` замінено `/opt/apps/cthulhu` / `cthulhu-prod` на актуальні `/opt/apps/barri` (prod), `/opt/apps/barri-dev` (staging) та `/opt/apps/shared_data/{scenarios,public/scenarios}` (shared volume, монтується в обидва контейнери). Команди деплою оновлено. Сам save-роут `generate-scenario/save` не чіпали — `process.cwd()/scenarios` в standalone Next.js = `/app/scenarios`, а це вже змапа на `shared_data`, тож файли й так потрапляють у правильне місце.

**Key decisions.**
- Primary — Opus 4.7 (а не Sonnet 4.6 з піднятим лімітом), бо якість важлива для авторського тулу, а prompt caching на системному промпті робить повторні виклики дешевими; Gemini 2.5 Pro як fallback задовольняє вимогу «щоб не коштувало космос» — навіть якщо Opus таймаутиться, генерація не пропадає.
- Не чіпали `trackAPICall` у цьому таску — генератор і раніше не трекав вартість, окремо розберемось за потреби.
- Працював у worktree `.claude/worktrees/ant-23`, щоб не заважати Codex, який паралельно веде ANT-30 у `/Users/anton.leshchenko/Projects/Barri`.

---

## ANT-30: Ambient generation + scenario refresh + deploy sync (2026-04-18)

**What changed.**
- Додано окремий ambient pipeline через ElevenLabs: `src/lib/ambient.ts` + `POST /api/scenarios/[id]/ambient`.
- Ambient генерується один раз під час materials flow для static scenario locations/groups, зберігається в shared `public/scenarios/<scenario>/ambient/`, а шлях пишеться в `ambientFile` у `scenario.json`.
- Runtime вирівняно під реальний `ambientFile`: `src/app/api/ai/route.ts`, `src/app/session/[id]/page.tsx`, `src/components/GameChat.tsx` більше не збирають URL з `locationId`; після reload ambient теж відновлюється.
- Dynamic session locations поки не генерують ambient, але код залишає такий future hook за аналогією з dynamic images.
- Оновлено сценарії `the-haunting` і `the-last-telegram` під новий контракт; попередні версії заархівовано в `scenarios/archive/2026-04-18/`. Тестовий `the-last-cup.json` прибрано з активних сценаріїв.

**Staging/prod operational notes.**
- У live середовищах сценарії беруться не з repo напряму, а з shared volume `/opt/apps/shared_data/scenarios`, змонтованого поверх `/app/scenarios`. Тому оновлення/архівація scenario JSON потребують або save-route, або явного sync у shared storage.
- Для staging було вручну синхронізовано shared scenarios: активними лишилися тільки `the-haunting.json` і `the-last-telegram.json`; старі версії та `the-last-cup.json` перенесено в `/opt/apps/shared_data/scenarios/archive/2026-04-18/`.
- На staging успішно відпрацювали:
  - `POST /api/scenarios/the-haunting/ambient`
  - `POST /api/scenarios/the-last-telegram/ambient`
  - `POST /api/scenarios/the-haunting/images`
  - `POST /api/scenarios/the-last-telegram/images`
- Після цього `https://staging.barrigame.es/api/scenarios` віддавав тільки `the-haunting` і `the-last-telegram`.

**Git/history notes.**
- Робочий коміт Codex по ANT-30: `a109fbb` (`ANT-30: ambient audio and scenario refresh`).
- Тимчасово `staging` вказував на merge-коміт `cdfa88d`, але окремо було форсовано `origin/staging` прямо на `a109fbb` для чистого staging-тесту.
- Пізніше Claude залив staging у prod; фінальна перевірка показала, що нічого не загубилось:
  - `a109fbb` входить у `origin/main`
  - `cdfa88d` теж входить у `origin/main`
  - `ANT-23` (`15b4a44`) теж у `origin/main`
  - `git diff origin/main..origin/staging` на момент перевірки був порожній

**Verification.**
- `npm run build` локально пройшов.
- Staging rebuild на VPS пройшов успішно через `docker compose -f /opt/apps/docker-compose.yml up -d --build barri-dev`.
- Prod після деплою перевірено користувачем: ambient assets доступні, критичних втрат у коді/історії не виявлено.

**Tomorrow / follow-up.**
- Є питання до якості згенерованих сценаріїв `the-haunting` і `the-last-telegram`; це окремий follow-up на завтра.
- При наступному колі правок треба фіксити саме content/scenario-level проблеми, а не ambient/storage pipeline: інфраструктурно flow уже працює.

---

## ANT-23 post-deploy (2026-04-18)

- Deployed `staging` → `main` через flow з PROJECT_CONTEXT: merge staging → main локально, push, на VPS `cd /opt/apps/barri && git pull` + `docker compose -f /opt/apps/docker-compose.yml up -d --build barri barri-dev`.
- Після rebuild обидва контейнери `apps-barri-1` і `apps-barri-dev-1` піднялися, `https://barrigame.es` і `https://staging.barrigame.es` → 307 (нормальний auth redirect).
- Користувач підтвердив, що генератор працює (Opus 4.7 → fallback Gemini 2.5 Pro). Дрібні правки по якості — окремі таски.
- Linear `ANT-23` → `Done`, feature-гілку `feature/ANT-23` та worktree видалено.
- Версію бампнуто до `0.3.17` разом з ANT-30 changelog-записом.

---

## [2026-04-18 · Codex] — ANT-39 + ANT-42: completion CTA gating і тексти генератора

### Problem
- `GameChat` показував primary CTA завершення прямо в статусній панелі для будь-якої активної сесії. Це виглядало як пропозиція завершити гру посеред проходження сценарію.
- `ScenarioGenerator` мав зашитий текст `Calling Claude Sonnet`, хоча primary model у генераторі зараз Opus 4.7.
- У generator UI лишався зайвий текст про ambient audio, хоча цей екран генерує лише scenario JSON, а матеріали/asset-и створюються окремим кроком.

### Solution
- **`src/components/GameChat.tsx`**
  - прибрано completion CTA з основної статусної панелі активної сесії;
  - summary для active session переписано так, щоб не підштовхувати до завершення посеред гри;
  - ручне завершення перенесено в settings-panel як окремий manual control, щоб CTA не з'являвся в центрі ігрового потоку.
- **`src/app/admin/ScenarioGenerator.tsx`**
  - статус генерації змінено на `Generating with Claude Opus 4.7 — this can take 1–3 min`;
  - текст про ambient generation замінено на нейтральний опис окремого кроку генерації scenario materials.

### Verification
- `npm run lint -- src/app/admin/ScenarioGenerator.tsx src/components/GameChat.tsx`
  - без помилок; лишилися старі warnings `@next/next/no-img-element` у `GameChat`, не пов'язані з цими задачами.
- `npm run build`
  - успішно пройшов на `feature/ANT-39-42`.

---

## [2026-04-18 · Codex] — ANT-43: Opus streaming fix + scenario provenance labels

### Problem
- `ANT-43`: новий сценарій згенерувався через fallback на Gemini, хоча primary path мав іти через `claude-opus-4-7`.
- Повторна перевірка staging-логів показала точну причину fallback:
  - `[scenarioGenerator] Opus failed, falling back to Gemini: Streaming is required for operations that may take longer than 10 minutes`
- Окремо з’ясувалося, що навіть після виправлення Opus-path зовнішній виклик через `https://staging.barrigame.es/api/admin/generate-scenario` може завершуватися `524` через proxy/CDN timeout, хоча внутрішній route продовжує працювати.
- Для вже збережених generated scenarios не було жодної persisted-позначки, якою моделлю вони створені.

### What changed
- `src/lib/scenarioGenerator.ts`
  - `generateWithOpus()` переведено з `client.messages.create()` на `client.messages.stream(...).finalMessage()`.
  - Це прибирає Anthropic SDK failure на довгих non-streaming Opus-запитах і дозволяє дочекатися повного JSON для великих сценаріїв.
- `src/types/index.ts`
  - додано optional `Scenario.generatedBy` з полями `provider`, `model`, `generatedAt`, `fallbackFrom`.
- `src/app/api/admin/generate-scenario/save/route.ts`
  - save-flow тепер приймає `generatedBy` і вшиває provenance прямо в збережений scenario JSON.
  - у response повертається `generatedBy`, щоб UI міг підтвердити persisted metadata.
- `src/app/admin/ScenarioGenerator.tsx`
  - при `Save + generate materials` у save-route передається provenance поточної генерації.
  - якщо був fallback, у metadata зберігається `fallbackFrom: 'claude-opus-4-7'`.
- `src/app/admin/ScenarioStats.tsx`
  - у `Scenario List` додано колонку `Source` з мітками `Opus`, `Gemini`, `Claude`, `legacy`.
  - також показується `title/titleUk`, щоб список сценаріїв у адмінці був читабельнішим.
- Shared scenario backfill
  - `barcelona-sagrada-mystery.json` у `/opt/apps/shared_data/scenarios/` вручну доповнено `generatedBy = { provider: 'gemini', model: 'gemini-2.5-pro', fallbackFrom: 'claude-opus-4-7' }`.
  - Це робив через контейнер, бо файл у shared volume належав `root:root`.

### Verification
- `npm run lint -- src/lib/scenarioGenerator.ts src/app/admin/ScenarioGenerator.tsx src/app/admin/ScenarioStats.tsx src/app/api/admin/generate-scenario/save/route.ts src/types/index.ts`
  - без помилок.
- `npm run build`
  - успішно.
- `docker compose -f /opt/apps/docker-compose.yml up -d --build barri-dev`
  - staging container перебілджено й піднято.
- Повторний external POST на `https://staging.barrigame.es/api/admin/generate-scenario`
  - повернув `524`; це вже зовнішній proxy timeout.
- Повторний internal POST всередині `apps-barri-dev-1` на `http://127.0.0.1:3001/api/admin/generate-scenario`
  - `200 OK`
  - `provider=anthropic`
  - `model=claude-opus-4-7`
  - `fallbackReason=null`
  - `scenarioId=barcelona-stone-whispers`
- Актуальні staging-логи після rebuild:
  - `[generate-scenario] ok provider=anthropic model=claude-opus-4-7 stop=end_turn ...`

### Key conclusions
- Початковий fallback на Gemini був не через відсутній ключ і не через недоступну модель Opus.
- Реальна причина: старий non-streaming Anthropic SDK path для довгого Opus generation request.
- Після переходу на streaming сам генератор на staging уже виконується на Opus.
- Якщо потрібен стабільний запуск саме через публічний `staging.barrigame.es`, окремо треба вирішувати CDN/proxy timeout (`524`) для дуже довгих admin POST-запитів.

---

## [2026-04-18 · Codex] — Linear review triage + selective prod deploy for ANT-42 / ANT-44

### Review triage
- Після review Anton повернув фактичний scope для `ANT-39`:
  - прибрати верхню active-session плашку повністю;
  - залишити лише компактний тег біля назви сесії / локації;
  - manual early finish залишити в settings;
  - окремо доробити auto-completion від Keeper та роздільну статистику normal completion vs early close в адмінці.
- `ANT-39` переведено з `In Review` назад у `In Progress` на Codex з коментарем про новий accepted scope.
- `ANT-45` також повернуто з `In Review` у `In Progress`, бо Anton повторно підтвердив: на сценарії, згенерованому Opus, зображення й ambient досі не зʼявилися; у Gemini-path усе ок.

### Deploy
- `Ready for deploy` містив `ANT-42` і `ANT-44`.
- Простий `staging -> main` merge був ризикований, бо `staging` уже включав незатверджені `ANT-39` / `ANT-45`.
- Тому на prod checkout `/opt/apps/barri` зроблено **selective deploy**:
  - `7bc3a70` — `ANT-42: update generator UI copy`
  - `0a6eb79` — `ANT-44: refresh scenario list after generator save`
- Prod rebuilt successfully:
  - `docker compose -f /opt/apps/docker-compose.yml up -d --build barri`
  - build пройшов успішно (`next build` усередині Docker)
  - `curl -I https://barrigame.es` → `307 /auth/login`

### Operational note
- `git push origin main` з VPS не спрацював через відсутні GitHub credentials (`fatal: could not read Username for 'https://github.com'`).
- Тобто live prod checkout оновлений локально і контейнер задеплоєний, але remote `origin/main` з цього хоста не був запушений.

---

## [2026-04-18 · Codex] — ANT-39: session completion UX + keeper auto-complete + end-state analytics

### Problem
- Верхня active-session плашка в грі лишалась нав'язливою і займала надто багато простору.
- Ручне завершення сесії було змішане з основним ігровим UI замість того, щоб лишатися аварійною дією в settings.
- В адмінці не було поділу між сесіями, завершеними нормально, і сесіями, закритими достроково.
- Ідеальний flow вимагав, щоб у природному фіналі саме Кіпер міг тригернути завершення сесії / вечора кампанії.

### What changed
- `src/components/GameChat.tsx`
  - прибрано великий верхній status panel;
  - лишено компактні статусні теги біля назви сесії та поточної локації;
  - manual end у settings тепер оформлено як дострокове закриття;
  - read-only summary/stats лишаються доступними в компактному форматі;
  - completion modal тепер знає різницю між normal completion і early close;
  - keeper-triggered completion обробляється без фальшивого user feedback.
- `src/lib/prompts.ts`
  - додано інструкції для фінальних тегів `[COMPLETE_SESSION]` і `[FINISH_EVENING]`.
- `src/app/api/ai/route.ts`
  - фінальні completion tags парсяться, прибираються з persisted text і віддаються клієнту як окрема completion action.
- `src/app/api/sessions/[id]/complete/route.ts`
  - completion endpoint приймає `trigger` (`keeper` / `manual`) і `endedEarly`.
- `src/lib/queries.ts`, `src/types/index.ts`
  - `game_sessions` тепер зберігає `completion_trigger` і `ended_early`.
- `src/lib/costTracker.ts`, `src/app/admin/ScenarioStats.tsx`, `src/app/admin/UsageTab.tsx`, `src/app/admin/AdminTabs.tsx`, `src/app/admin/page.tsx`
  - адмінка й usage breakdown тепер окремо показують normal completions vs early-closed sessions;
  - all sessions table показує читабельний status label (`completed by keeper`, `closed early`, etc.).

### Verification
- `npm run lint -- src/components/GameChat.tsx src/app/api/ai/route.ts src/lib/prompts.ts src/app/api/sessions/[id]/complete/route.ts src/lib/queries.ts src/lib/costTracker.ts src/app/admin/AdminTabs.tsx src/app/admin/page.tsx src/app/admin/ScenarioStats.tsx src/app/admin/UsageTab.tsx src/types/index.ts`
  - без errors; лишились старі `@next/next/no-img-element` warnings у `GameChat`
- `npm run build`
  - успішно
- `docker compose -f /opt/apps/docker-compose.yml up -d --build barri-dev`
  - staging container успішно перебілджено й піднято
- `curl -I https://staging.barrigame.es`
  - `307 /auth/login` після rebuild

### ANT-45 status
- Додатковий ручний repro через shared storage більше не підтвердив явний missing-materials стан для Opus-generated сценарію.
- У shared data Opus-generated scenario assets уже присутні, і Anton окремо підтвердив, що зображення на Opus scenario вже видно.

## 2026-04-20 — Competitive/UI strategy brief (Barri vs TableForge)
- Підготовлено окремий документ: `analysis/BARRI_UI_COMPETITIVE_ROADMAP.md`.
- Включено benchmark `Barri vs TableForge` + референси `Quest Portal`/`Alchemy RPG`.
- Додано phased roadmap (Phase 0-4) з quality gates і premium noir design proposition для CoC/детективного позиціонування.

## 2026-04-20 — Moodboards v1 (local)
- Додано документ з 4 moodboard-напрямами: `analysis/BARRI_MOODBOARDS_V1.md`.
- Рекомендовано hybrid-напрям `Noir Evidence Desk + Occult Minimal Luxe` для premium CoC UX.

## 2026-04-20 — Visual concepts v1 (local HTML)
- Створено локальний пакет: `analysis/visual-concepts-v1/`.
- Додано 4 окремі візуальні концепти (A/B/C/D), кожен містить `Home` + `Chat` з фейковими даними.
- Додано `index.html` для навігації, `shared.css`/`shared.js` для спільної поведінки та стилів.

## 2026-04-20 — Visual concepts v2: Concept A (local HTML)
- Створено новий пакет ітерації: `analysis/visual-concepts-v2/`.
- Додано `Concept A v2` як окремий файл: `analysis/visual-concepts-v2/concept-a-noir-evidence-v2.html`.
- Оновлено арт-дирекшен для A:
  - постерний Home-first viewport з сильним атмосферним фоном;
  - більш операційний Chat-layout (caseboard rail + stream + player/context rail);
  - додано помітні, але стримані motion-ефекти (poster drift, staggered timeline/messages);
  - покращено адаптивність під mobile через окремі брейкпойнти в `shared.css`.
- Додано нові `index.html`, `README.md`, `shared.css`, `shared.js` для v2-пакету.

## 2026-04-20 — Isolated homepage redesign (Concept A style)
- Додано окремий route для редизайну головної, без заміни існуючої `/` сторінки:
  - `src/app/design-lab/concept-a-home/page.tsx`
- Додано окремий компонент `src/components/SessionListConceptA.tsx`.
  - Логіка збережена з поточної головної (`sessions/scenarios loading`, `new game modal`, `session create/delete`, role picker).
  - UI перероблено під стиль `Noir Evidence Desk` (hero з atmosphere image, amber-noir palette, case-oriented cards, themed modal).
- Перевірка:
  - `npm run lint -- src/components/SessionListConceptA.tsx src/app/design-lab/concept-a-home/page.tsx` (без errors).
- Оновлення design-lab доступу: `/design-lab/concept-a-home` тепер відкривається без auth redirect.
  - Якщо `/api/sessions` повертає `401`, сторінка переходить у preview mode з демо-даними (без редіректу на `/auth/login`).

## 2026-04-20 — Landing concept v1 (AI Keeper for Investigative Horror)
- Створено локальний лендинг-концепт: `analysis/landing-concepts-v1/concept-b-ai-keeper.html`.
- Додано конверсійні секції: hero CTA, positioning vs generic AI DM, product flow, product tour, FAQ, waitlist.
- Додано мікроанімації: reveal on scroll + subtle hero parallax.

## 2026-04-20 — Landing redesign v2 + competitor analysis
- Повністю перероблено `analysis/landing-concepts-v1/concept-b-ai-keeper.html` (premium v2).
- Попередню версію збережено як `concept-b-ai-keeper-v1.html`.
- Додано детальний аналіз конкурентів: `analysis/landing-concepts-v1/COMPETITOR_ANALYSIS_BARRI_LANDING_2026-04-20.md`.
- У v2 додано: сильніша ієрархія, інтерактивний showcase, оновлені блоки позиціонування, мікроанімації.

## 2026-04-21 — Auth pages redesign (Noir Dossier style)
**Problem:** Login, Register, and Verify pages used generic Tailwind/stone-color styling (rounded-2xl cards, emoji headers, bg-stone-950) — completely inconsistent with the noir-dossier landing aesthetic.
**Solution:**
- Created `src/app/auth/layout.tsx` — loads the same 4 noir fonts (Special Elite, Playfair Display, IM Fell English, UnifrakturMaguntia) and wraps in `landing-root` class, making all CSS variables available.
- Created `src/app/auth/auth.css` — auth-specific components in noir style: paper-textured dossier card with torn top edge, punched hole detail, blood-red rotated stamp, typewriter form labels, bottom-border-only inputs, ink/blood CTA button with shadow offset, oldprint italic footer.
- Rewrote `auth/login/page.tsx` — "Enter the Archive" card with "Restricted" stamp, "Miskatonic Bureau of Investigation" header, typewriter inputs.
- Rewrote `auth/register/page.tsx` — "Begin Your Initiation" intake form; success state with "Application Filed" blood-stamp and dispatched-letter message.
- Rewrote `auth/verify/page.tsx` — "Identity Verification" pending / "Seal Broken" error states with matching noir language.
**Key decisions:**
- Reused `landing.css` CSS variables directly — no duplication of color/font tokens.
- `auth-card` uses `mix-blend-mode: multiply` on stamps for paper-over-dark visual accuracy.
- Card rotated −0.5deg for subtle dossier feel without distracting from form usability.

## 2026-04-21 — Password reset + email noir redesign
**Problem:** Відсутній функціонал відновлення пароля; всі системні листи мали застарілий stone/emoji стиль несумісний з noir-dossier брендингом.
**Solution:**
- DB migration: `reset_token VARCHAR(64)` + `reset_expires TIMESTAMPTZ` + index (через `ALTER TABLE ADD COLUMN IF NOT EXISTS` в `initializeSchema()`).
- New queries: `setPasswordResetToken`, `getUserByResetToken`, `updatePasswordAndClearResetToken` (queries.ts).
- New API: `POST /api/auth/forgot-password` (генерує токен, завжди 200 — no enumeration), `POST /api/auth/reset-password` (валідує токен + оновлює хеш).
- New pages: `/auth/forgot-password` та `/auth/reset-password?token=XXX` — обидві в noir-dossier стилі. Reset page використовує `useSearchParams` в `<Suspense>` (Next.js 16 requirement).
- `email.ts` повністю переписаний: shared `noirEmailHtml()` helper з `border-bottom + border-right` трюком для blood-shadow кнопки (email-клієнти не підтримують box-shadow). Paper card (`#c3b088`) на ink-фоні (`#07060a`), Georgia/Courier New як email-сумісні замінники шрифтів. Два листи: verify + password reset.
- Login page: додано inline "Forgot code?" link в label полю Clearance Code.
**Key decisions:**
- `forgot-password` завжди повертає 200 незалежно від існування email — запобігає перерахуванню акаунтів.
- Reset token має TTL 1 год (verify — 24 год).
- `sendPasswordResetEmail` викликається fire-and-forget щоб не витікав timing.

## 2026-04-21 — Landing CTA logic: register-first + auth redirect
**Problem:** CTA кнопки лендінгу вели на `/sessions` (вимагала логіну), а не на реєстрацію. Авторизований користувач бачив лендінг замість прямого переходу на сесії.
**Solution:**
- `page.tsx` — server-side auth check: якщо є валідний `auth_token` cookie → `redirect('/sessions')`. Жодного flash.
- `LandingClient.tsx` — всі CTA (`enter-btn`, hero `btn-primary`, `case-open`, final `btn-primary`) змінені з `/sessions` → `/auth/register`. Footer nav-link `/sessions` залишений без змін (це утилітарна навігація, не маркетинговий CTA).

## 2026-04-21 — "Forgot code?" link fix + Cyrillic fonts
**Problem 1:** `<Link>` всередині `<label>` є невалідним HTML (interactive element inside label) — браузер вирізав посилання з DOM.
**Fix:** Обгорнув лейбл і посилання в `div.auth-field-labelrow` (flex-row, space-between). Додав CSS-клас `.auth-forgot` в `auth.css`.

**Problem 2:** Special Elite і IM Fell English не мають Cyrillic підтримки — текст на УК у кнопках/лейблах/тікері падав на системний sans-serif (Arial-подібний), що повністю ламало noir-typewriter естетику.
**Fix:** Завантажено PT Mono (cyrillic+latin) і PT Serif (cyrillic+latin) як додаткові шрифти в `page.tsx` та `auth/layout.tsx`. Оновлено `landing.css`: `--font-typewriter` додано `"PT Mono"` як fallback, `--font-oldprint` — `"PT Serif"`. Playfair Display оновлено до subset `["latin", "cyrillic"]`.

**Deployment lesson:** Завжди робити `git pull origin staging` на VPS перед `docker compose build`, інакше збирається старий код (COPY . . кешується).

## 2026-04-22 — Sessions page noir redesign (Tier 1 + Tier 2)
**Problem:** Sessions page `/sessions` was completely off-brand — stone Tailwind theme with no connection to the noir-dossier visual language of the landing and auth pages.

**Solution:**
- `src/app/sessions/layout.tsx` — NEW: loads all 6 noir fonts (same as auth layout) + `landing.css` + `sessions.css`, wraps in `landing-root`. Sessions page now inherits all noir CSS tokens.
- `src/app/sessions/sessions.css` — NEW: full noir design system for sessions page. Covers: topbar auth section, bureau stats strip, section dividers, session cards (with thumbnail, torn edge, status stamp, location, summary, player chips), empty state, case file cards, new-session modal (all components use paper/ink/blood/amber token palette).
- `src/components/SessionList.tsx` — REWRITTEN in full:
  - **Tier 1**: scene thumbnail from `world_state.sessionImages` on each card; HP/SAN + role in player chips; current location tag on card; scenario cards always visible on page (no modal step for scenario selection); full noir card design (rotated paper cards, torn top edge, status stamps, typewriter/oldprint/serif fonts).
  - **Tier 2**: "Previously..." summary from `session_summaries` table shown on card; bureau statistics strip (active/paused/completed/messages counts); empty state with blackletter glyph + "no cases open" copy.
  - Topbar reuses `.topbar`/`.mark`/`.seal`/`.wordmark` classes from landing.css; auth section (email, admin link, logout) styled with noir CSS classes.
  - New session flow simplified: scenarios visible on page, clicking "Розпочати розслідування" opens modal pre-configured for that scenario (no scenario picker step inside modal).
  - User data (email, role) loaded from `/api/auth/me` alongside sessions/scenarios in a single `Promise.all`.
- `src/lib/queries.ts` — `getSessionsByUserId` extended: adds `latest_summary` (LATERAL JOIN on `session_summaries`) and `message_count` (LATERAL COUNT on `messages`) to each session row.

**Key decisions:**
- `world_state.sessionImages` is keyed by message UUID (not time-ordered), so `Object.values().pop()` gives the last inserted image as thumbnail — imprecise but functionally correct for decorative use.
- Scenarios section is always rendered below sessions; no need for a "New game" button that hides scenarios in a multi-step modal.
- Bureau stats strip only shown when sessions exist (not on empty state).
- Session card `session-card:nth-child(even)` rotates opposite direction — gives natural stack-of-papers feel.

## 2026-04-24 — Game Chat noir redesign
**Problem:** GameChat.tsx used raw Tailwind stone/amber color classes throughout — completely inconsistent with the noir-dossier design language applied to the landing, auth, and sessions pages.

**Solution:**
- `src/app/session/[id]/layout.tsx` — NEW: wraps game session page in `landing-root` with all 6 noir fonts (Special Elite, Playfair Display, IM Fell English, UnifrakturMaguntia, PT Mono, PT Serif). Imports `landing.css` and new `chat.css`.
- `src/app/session/[id]/chat.css` — NEW: ~450 lines of noir-specific chat UI classes covering:
  - `chat-root`, `chat-header`, `chat-back-btn`, `chat-session-name`, `chat-header-sub`, `chat-location`, `chat-status-badge` (active/paused/complete variants)
  - `chat-icon-btn`, `chat-icon-btn--active`
  - `chat-settings-panel`, `chat-settings-divider`, `chat-settings-keeper-group/btn`, `chat-settings-aux-btn`, `chat-settings-volume-row`, `chat-settings-stats`, `chat-settings-end-row/btn`
  - `chat-messages`, `chat-empty-state`, `chat-empty-glyph`
  - `chat-bubble-label` (keeper/npc/user variants)
  - `chat-bubble--keeper` (aged paper, IM Fell italic, quotation mark glyph), `chat-bubble--npc` (paper-2 with blood left border), `chat-bubble--user` (ink-2, typewriter)
  - `chat-replay-btn` with `--playing` (amber pulse animation) and `--loading` states
  - `chat-loading-bubble`, `chat-loading-dots`, `chat-loading-dot` (bounce animation)
  - `chat-readonly-zone`, `chat-readonly-card`, `chat-readonly-title`, `chat-readonly-text`
  - `chat-player-selector`, `chat-player-btn`, `chat-player-btn--active`
  - `chat-pending-strip`, `chat-pending-pill`, `chat-pending-pill__name/text/remove`
  - `chat-inventory-strip`, `chat-inventory-item`, `chat-inventory-item__uses`
  - `chat-dice-hint`, `chat-dice-hint__skill/threshold`
  - `chat-input-zone`, `chat-input-wrap` (bottom-border only, telegraphic), `chat-textarea`, `chat-send-btn` (ink background, blood-shadow offset)
  - `chat-completion-overlay`, `chat-completion-card/title/desc/btn--primary/btn--cancel`
  - `chat-status-error`
  - `chat-sidebar`
  - Grain animation disabled in chat context via `.landing-root:has(.chat-root)::before { animation: none; opacity: 0.13 }`
- `src/components/GameChat.tsx` — All Tailwind color/typography classes in the main game UI replaced with semantic noir CSS class names. Structural Tailwind (flex, gap, overflow, w/h, max-w, min-w, shrink, truncate) kept unchanged.

**Key decisions:**
- `chat-bubble--keeper` uses paper-0→paper-1 gradient with `border-radius: 4px 16px 16px 16px` (notched top-left corner) and a CSS `::before` quote glyph — creates a "torn from a journal" feel.
- `chat-bubble--npc` uses `paper-2` (darker aged paper) with `border-left: 3px solid var(--blood-2)` — marks NPC speech as "evidence from a witness".
- `chat-bubble--user` uses `ink-2` with typewriter font — player actions feel like telegram dispatches.
- Empty state uses UnifrakturMaguntia glyph `ꝏ` instead of emoji — consistent with blackletter dossier aesthetic.
- Grain animation disabled in chat for UX (hours of use, would cause eye strain). Reduced to 13% static opacity instead.
- Subcomponents `Toggle`, `DynamicImage`, `CaseFilesPanel`, and admin debug panel retain Tailwind colors — these are lower-priority and will be addressed in a follow-up (Tier 3 or later).

## 2026-06-03 — Test harness: Vitest unit tests (ANT-107)
**Problem:** Project had zero automated tests (`package.json` only had dev/build/start/lint). Complex server-side state transitions — especially the campaign continuity subsystem (ANT-77..81) — were impossible to verify repeatably by hand, which is exactly why that subsystem rotted unverified. We need a reusable harness before touching campaign logic.

**Solution:**
- Added `vitest` devDep + `vitest.config.ts` (node environment, `globals: true`, native `resolve.tsconfigPaths: true` so the `@/*` alias resolves — dropped the `vite-tsconfig-paths` plugin after Vite warned it is now built in).
- Scripts: `npm test` (`vitest run`) and `npm test:watch` (`vitest`).
- First 34 tests against existing deterministic logic, proving the harness and giving immediate regression coverage:
  - `tests/segments.test.ts` — `parseSegments` (narration/NPC split, partial-name voice resolution, keeper fallback, data-tag stripping, empty-speech drop), `stripNpcTags`, `hasNpcSpeech`.
  - `tests/inventoryTags.test.ts` — full inventory lifecycle: ITEM add/dedupe, USE_ITEM floor + infinite (-1) guard, REMOVE_ITEM + equip clear, EQUIP exclusivity, BREAK_ITEM, purity (no mutation of input), bad-index no-op.
  - `tests/randomEvents.test.ts` — guard branches (pending roll / active event), accumulation fire→reset+halve and no-fire grow (Math.random mocked), `applyEventDecision`, `resolveActiveEvent`/`clearActiveEvent`, `buildEventInstruction`.
  - `tests/prompts.test.ts` — `buildSystemPromptBlocks` returns `{ruleset,static,dynamic}`; campaign-summary section appears in `dynamic` only when `campaignContext.recentSummaries` is provided (directly relevant to ANT-80); world-state rendering; en language path.
  - `tests/fixtures.ts` — shared minimal type-valid `makeScenario` / `makePlayer` / `makeWorldState` builders.

**Key decisions:**
- **Vitest, unit-only, LLM never called** (decision confirmed with Anton). DB-touching orchestration is validated via staging playthrough, not integration tests — keeps the harness zero-infra.
- **Extracted `parseInventoryTags`** out of `src/app/api/ai/route.ts` (which pulls server-only deps like `next/headers`, so it can't be imported into a test) into pure `src/lib/inventoryTags.ts`, re-imported in the route. No behavior change. Same extraction pattern will be used in Part 2 for completion-tag detection and `buildNextSessionWorldState`.
- Pre-existing lint error in `DiceRoller.tsx:22` (`react-hooks/set-state-in-effect`) is a staging baseline issue, untouched here — flagged separately.

**Verification:** `npm test` → 34 passed; `npx tsc --noEmit` clean; `eslint tests/ src/lib/inventoryTags.ts` clean.

**Next:** Part 2 (separate branch) — re-enable campaign creation (auto from `isCampaign`) and fix ANT-77..81, locked down with campaign-specific unit tests on this harness.

## 2026-06-03 — Campaign continuity re-enabled + fixed (ANT-77–81)
**Problem:** The five "campaign bugs" were not five independent defects — they were one continuity subsystem that Codex had largely implemented but **disabled at the entry point and never validated end-to-end**. `POST /api/sessions` hard-passed `campaignId: undefined` ("Campaigns disabled until campaign mechanics are fixed"), so `createCampaign()` was never called and no session ever had a `campaign_id`. That single gate made ANT-79/80/81 unreachable: world-state inheritance (`buildNextSessionWorldState`), prior-evening summaries in the intro (`getCampaignContext` → `campaignSection` in `buildSystemPromptBlocks`), and the `finish-evening` flow (creates next session, redirects) all existed but could never fire. ANT-77 (keeper auto-closing without confirm) and ANT-78 (dead-end read-only chat) were live client issues on top.

**Solution:**
- **Re-enable (keystone) — `src/app/api/sessions/route.ts`:** `getScenarioSessionMeta` already surfaced `isCampaign`; when true, `createCampaign(userId, scenarioId, name)` then link session 1 with `{ campaignId, sessionNumber: 1 }`. Session 1 keeps the *normal* starting world state (correct `currentLocation`/`variantId`) — no `initialWorldState` override; inheritance only matters from evening 2, which `buildNextSessionWorldState` already handles. One-shot path unchanged.
- **ANT-77 — `src/components/GameChat.tsx`:** the keeper-completion branch in the `done` handler now calls `openCompletionModal(action, { trigger: 'keeper' })` instead of `submitCompletion(..., { requireConfirmation: false })`. Player explicitly confirms via the modal (with optional rating/comment). Also made the modal's submit pass `requireConfirmation: false` so the modal itself is the single confirmation step (removed the redundant `window.confirm` that previously stacked on top — affected the manual end-early path too).
- **ANT-78 — `src/components/GameChat.tsx` + `chat.css`:** read-only card now uses `statusMeta.summary` (already campaign-aware) and, for a completed campaign evening, renders a forward affordance: a `useEffect` fetches `/api/sessions`, finds the next evening of the same `campaign_id` (smallest `session_number` greater than current) and shows a "Продовжити — Вечір N" link; falls back to a "До списку справ" link if no next evening exists. New `.chat-readonly-actions` style.
- **Testability extractions:** `buildNextSessionWorldState` → pure `src/lib/campaignState.ts` (kept out of `campaigns.ts`, which instantiates `new Anthropic()` at module load — a separate pure module means the state test needs no SDK mock). Completion-tag detection → `src/lib/completionTags.ts` `detectCompletionAction(text)`, replacing the two inline regex flags in `ai/route.ts` (single `completionAction` variable now). Removed the now-unused `Player` type import in `ai/route.ts`.

**Tests (on the ANT-107 harness, +10 → 44 total):**
- `tests/campaignState.test.ts` — carries `npcRelations`/`visitedLocations`/`discoveredClues`/`dynamicLocations`/`dynamicNpcs`/`openThreads`/`act`/`summary`; resets `passiveMessageCount`/`totalMessageCount`/`pendingRollResult`/`activeRandomEvent`/`locationRisk`/`sessionImages`/`variantHint`; purity.
- `tests/completionTags.test.ts` — finish-evening vs complete-session precedence, null, lookalike text.
- `tests/campaignContext.test.ts` — `getCampaignContext` formats summaries chronologically as `Вечір N: …` (queries + `@anthropic-ai/sdk` mocked).

**Key decisions:**
- Auto-enable from the scenario `isCampaign` flag (confirmed with Anton) — zero new UI; the scenario author already declares campaign intent.
- The DB-touching orchestration (finish-evening creates the next row, summary persisted) is validated by staging playthrough, not integration tests — keeps the harness zero-infra (per the unit-only decision).

**Verification:** `npm test` → 44 passed; `npx tsc --noEmit` clean; `npm run build` clean (all routes compile); lint 0 errors on changed files. Branch `feature/ANT-77-81-campaign-flow` is **stacked on `feature/ANT-107-test-harness`** — merge ANT-107 first. Remaining: interactive staging playthrough (campaign create → finish-evening confirm → inherit → evening-2 summary → read-only forward link).

### 2026-06-03 addendum — staging verification + two operational findings
**Staging API smoke (barri_dev DB, real LLM):** campaign session creation → `campaign_id` set, `session_number=1`; finish-evening → evening 1 `completed`, evening 2 created with same `campaign_id` + `session_number=2`; world_state inheritance confirmed (npcRelations/discoveredClues/act carried, totalMessageCount/pendingRollResult/locationRisk reset); `session_summaries` row persisted (feeds ANT-80 intro). One-shot scenario → no `campaign_id` (negative case). ANT-77/78 (modal confirm + read-only forward link) remain for browser verification.

**Finding 1 — scenario data drift (repo vs live):** the running containers read scenarios from the `shared_data/scenarios` volume mount (`/app/scenarios`), NOT from the repo's `scenarios/` dir. The two had drifted: repo `the-last-telegram.json` had `isCampaign:true` but the live `shared_data` copy had `isCampaign:false` (plus live has generated `ambientFile` paths the repo lacks). The auto-enable-from-flag approach therefore depends on the LIVE file's flag. Flipped `shared_data/scenarios/the-last-telegram.json` → `isCampaign:true` (approved). Repo scenario edits do NOT affect the app — only shared_data does.

**Finding 2 — Claude shell shadows ANTHROPIC_API_KEY (deploy gotcha):** the Claude Code shell exports `ANTHROPIC_API_KEY` as an empty string. `docker compose` prefers shell env over `.env`, so rebuilding/recreating a barri container from within this shell blanks the key (→ all Claude/Haiku features 500, incl. closeSession). Prod survived only because its container predates this. **When deploying a barri container from the Claude shell, strip the override:** `cd /opt/apps && env -u ANTHROPIC_API_KEY docker compose --env-file /opt/apps/.env -f docker-compose.yml up -d --force-recreate <svc>`. Anton deploying from his own shell is unaffected. (Only `ANTHROPIC_API_KEY` is shadowed; other keys are unset and resolve from `.env` normally.)

### 2026-06-03 — Campaign completion UX fixes (review feedback)
After Anton's staging review of the campaign flow, three UX fixes (same `feature/ANT-77-81-campaign-flow` branch):
- **End-button colors swapped** (`GameChat.tsx`): "Завершити вечір" → secondary/black (softer), "Завершити кампанію достроково" → primary/red (most final). One-shot "Закрити сесію" stays red. Implemented by making the first button's class conditional on `session.campaign_id` and setting the campaign-complete button to `--primary`.
- **Return to menu on full campaign completion** (`GameChat.tsx`, `submitCompletion`): added `else if (mode === 'complete-session' && session.campaign_id) → window.location.href = '/sessions'`. Finishing just an evening still redirects to the next evening; finishing the whole campaign now lands on the case list.
- **Session-list CTA relabelled** (`SessionList.tsx`): "Увійти" → "Продовжити" for active/paused, "Переглянути" for completed sessions.
Verification: `npm test` 44/44, `tsc` clean, lint 0 errors. Rebuilt staging (with `env -u ANTHROPIC_API_KEY`).

### 2026-06-03 — Campaign list/redirect UX (2nd review round)
- **finish-evening now redirects to /sessions** too (not into the new evening). `submitCompletion`: any campaign completion (finish-evening or complete-session) → `/sessions`; one-shot complete stays on read-only chat. Rationale: after finishing an evening the player should land in the menu and see the campaign's next active evening to continue, rather than being dropped straight into it.
- **Played evenings reclassified** (`SessionList.tsx`): a completed evening that is NOT the latest in its campaign is a "played evening" of an ongoing campaign, not a closed case. Computed `latestEveningByCampaign` + `isPlayedEvening(s)`; such evenings now render under "Відкриті справи" with a "Вечір зіграно" stamp (mod active) and the "Переглянути" read-only CTA, instead of "Закрито" in the completed section. Fixes the confusion of one campaign appearing simultaneously as active (evening 2) and closed (evening 1). `statusStamp` gained an optional `playedEvening` arg; `SessionCard` a `playedEvening` prop.
Verification: `npm test` 44/44, `tsc` clean, lint 0 errors.

## 2026-06-03 — Release gate: waiting-list + per-user daily cost cap (ANT-108)
**Problem:** Pre-public-launch, registration was fully open and every AI turn (Claude/Gemini/TTS/STT/image) spent real money with no ceiling — no access control, no spend cap. Two release blockers: (1) gradual access rollout, (2) per-user spend protection.

**Solution (model confirmed with Anton — waiting list, $-based daily cap, admin-managed):**
- **DB (`queries.ts` ensureSchema):** `users.access_status VARCHAR(20)` with a deliberate 3-step migration so existing accounts are NOT locked out: ADD COLUMN nullable → backfill existing rows to `approved` → SET DEFAULT `'pending'` + NOT NULL. Admins force-set to `approved`. Index `idx_users_access_status`. New `app_settings`: `daily_limit_enabled` ('true'), `daily_user_cost_limit_usd` ('0.50').
- **Queries:** `getUserById`/`getUserByEmail`/`getAllUsers` now select `access_status`; `getAllUsers` also returns per-user `daily_cost` (FILTER sum of `api_usage.cost_usd` since CURRENT_DATE). New `updateUserAccessStatus(id, status)` and `getUserDailyCost(userId)`.
- **Pure gate logic — `src/lib/accessGate.ts`:** `evaluateAccessGate(inputs)` (no DB/server deps, ANT-107-harness testable). Admin → always ok; non-approved → 403 `not_approved`; over cap (when `enforceDailyCap` + enabled + limit>0 + spent ≥ limit) → 429 `daily_limit_reached`. Approval checked before cap.
- **Enforcement (by DB, NOT JWT — so approve/block takes effect immediately without re-login):**
  - `/api/ai` POST: after auth, `Promise.all([getUserById, getAllAppSettings, getUserDailyCost])` → `evaluateAccessGate({enforceDailyCap:true})`; non-ok → returns `{error:code,message}` with gate.status before any LLM call.
  - `/api/sessions` POST: approval gate only (`enforceDailyCap:false`) — session creation is cost-free.
  - `/api/auth/me`: returns `access_status` for the client.
- **Client:**
  - `register/page.tsx` + `auth.css` (`.auth-waitlist-note`): success screen reframed as "You're on the waiting list" + note that access opens in small groups.
  - `SessionList.tsx`: `UserInfo.access_status`; early-return waiting-list screen (pending ⧖ / blocked ✕) instead of case files for non-approved users (admins/approved unaffected).
  - `GameChat.tsx`: 403/429 from `/api/ai` now surface the server `message` in the bubble (waiting-list / daily-limit) instead of the generic connection error.
- **Admin:**
  - New `PATCH /api/admin/users/[id]/access` `{access_status}` (admin-only, mirrors role route; validates pending/approved/blocked).
  - `AccessControl.tsx` (Approve/Block, mirrors RoleToggle). `AdminTabs.tsx`: Access column + Today $ column + "N awaiting access" badge; `accessMeta()` helper. `page.tsx` user cast extended.
  - `KeeperSettings.tsx`: per-user daily cost cap section (enable toggle + USD input, saved on blur via existing settings PATCH).

**Key decisions:**
- DB-checked gates (not JWT claims) so admin approve/block is instant — JWT lives 7 days, baking access_status in would need re-login.
- Daily cap is $-based (Anton's choice): maps directly to `api_usage`, protects the bill. Resets at UTC midnight (`created_at >= CURRENT_DATE`).
- Session creation is cost-free → only the approval gate applies there, not the cap (a capped user can still plan tomorrow's session).
- `accessGate.ts` kept pure (zero imports) per the ANT-107 pattern; routes fetch inputs.

**Tests (harness, +12 → 56 total):** `tests/accessGate.test.ts` — waiting-list (pending/blocked → 403), admin bypass (approval + cap), cap boundary (≥ blocks, just-under allows), enforceDailyCap:false / disabled / zero-limit skips, approval-before-cap precedence.

**Verification:** `npm test` 56/56; `tsc` clean; eslint 0 errors on changed files (pre-existing `<img>` warnings only); `npm run build` clean, `/api/admin/users/[id]/access` route compiled. Branch `feature/ANT-108`. Remaining: staging browser walkthrough (register→pending screen, admin approve→access, daily cap block).

## 2026-06-03 — Location stuck after dynamic location (ANT-68) + ANT-65 verification
**ANT-68 problem:** After the Keeper created a situational location via `[NEW_LOCATION:my_apartments:...]`, the header location stopped reflecting subsequent moves until the player returned to a standard scenario location.

**Root cause:** `summarizeAndUpdateWorldState` (runs every 20 messages, fire-and-forget) merged the summary LLM's JSON with `{ ...currentWorldState, ...parsed }`. The summarize prompt asks the LLM to emit `currentLocation` and `visitedLocations`, so `parsed` clobbered the authoritative navigation state — which is actually owned by deterministic `[LOCATION:]`/`[NEW_LOCATION:]` tag parsing. The summary LLM doesn't reliably know dynamic-location ids, so it guessed (often an older standard location), and because the summary's `updateSession` is fire-and-forget it could land *after* the turn's main `updateSession`, overwriting the correct `currentLocation`. The display then stayed wrong until a fresh `[LOCATION:<standard>]` reset it (matches Anton's repro: "when I returned to standard locations it updated").

**Fix:** Extracted the merge into pure `src/lib/worldStateMerge.ts` → `mergeSummarizedWorldState(current, parsed)`. It takes narrative fields from the summary (act, summary, discoveredClues, npcRelations, openThreads, playerNotes) but always keeps navigation/engine/cache fields from the authoritative current state: `currentLocation`, `visitedLocations`, `dynamicLocations`, `currentLocationGroup`, `passiveMessageCount`, `totalMessageCount`, `locationRisk`, `pendingRollResult`, `activeRandomEvent`, `npcDetails`, `sessionImages`, `dynamicNpcs`, `variantId`, `variantHint`. `src/app/api/ai/route.ts` now calls it instead of the inline spread. No prompt/tag-protocol change.

**Tests (+6):** `tests/worldStateMerge.test.ts` — dynamic currentLocation not clobbered, visitedLocations not dropped, group/dynamicLocations/dynamicNpcs preserved, narrative fields applied, sessionImages cache never clobbered, engine fields preserved.

**Verification:** `npm test` 50/50; `tsc` clean (after `rm -rf .next` to drop a stale ANT-108 route artifact from a prior build); eslint 0 errors; `npm run build` clean.

**ANT-65 (verify-only, per Anton):** "session ends by itself → no rating/thanks banner" was the same defect as **ANT-77** (keeper auto-closing without confirm), already fixed and in `staging`. Verified the full chain is intact: `detectCompletionAction` parses `[COMPLETE_SESSION]`/`[FINISH_EVENING]` (unit-tested in `completionTags.test.ts`) → `/api/ai` done event returns `completionAction` → `GameChat` done handler calls `openCompletionModal(action, { trigger:'keeper' })` (GameChat.tsx:1184-1185) → modal renders the 1-5 rating + comment + "Подякувати й завершити". There is no server-side auto-completion (status only flips via `/api/sessions/[id]/complete`, gated by the modal). Recommended closing ANT-65 as resolved by ANT-77; final play-to-ending confirmation is Anton's review step.

## 2026-06-03 — Atmosphere & motion pass + reduced-motion (ANT-103)
**Scope (UI-only, focused subset of the issue):** subtle chat motion + a real `prefers-reduced-motion` audit. Confirmed ANT-105 (auth noir) is already implemented — all auth pages use the `.auth-*` noir system, 0 Tailwind — left a note recommending closure.

**Changes:**
- `chat.css` (+~80 lines): `.chat-msg--reveal` (fade + 6px rise, 180ms, `both`) + `@keyframes chat-reveal`; `.chat-settings-panel` reveal + `chat-panel-in`; `.chat-evidence-loading` aged-paper shimmer (`::after` sweep, `chat-shimmer`) replacing the generic Tailwind pulse placeholder; and a `@media (prefers-reduced-motion: reduce)` block that disables reveal/panel/loading-dots/replay-pulse/shimmer (keeping final visible state) and makes the sidebar slide instant.
- `GameChat.tsx`: newest message row gets `chat-msg--reveal` (`idx === messages.length-1`) — keyed by `msg.id`, so it animates once on mount, not per stream chunk; the `DynamicImage` loading branch now renders `.chat-evidence-loading` instead of `bg-stone-800 animate-pulse`.
- `DiceRoller.tsx`: `roll()` checks `matchMedia('(prefers-reduced-motion: reduce)')` and, when set, skips the 1600ms slot-machine flicker — sets the final d100 digits and `phase='done'` immediately. The pre-existing `react-hooks/set-state-in-effect` error at `DiceRoller.tsx:22` (in the `useEffect`, untouched) remains a staging baseline issue, not introduced here.

**Key decisions:**
- Reveal gated to the newest message only — avoids animating the whole transcript on load and avoids re-animating on streaming/state updates (React reuses the keyed DOM node).
- Animations use `both` fill so reduced-motion (animation:none) still lands on the visible end state.
- Keeper "typing" pulse already existed (`.chat-loading-bubble`/bounce dots) — kept, now covered by reduced-motion.
- Out of this slice (deferred): TTS/STT speaking-indicator rework.

**Verification:** `npm run build` clean; `tsc` clean; `npm test` 62/62 (no logic change); eslint adds no new errors (only the documented baseline + pre-existing `<img>` warnings). Branch `feature/ANT-103`. Visual/motion confirmation is the review step (transient animations can't be asserted headlessly).

## 2026-06-03 — Inspector rail dossier rebuild + collapse (ANT-102)
**Problem:** `CaseFilesPanel` was a generic dark panel with four mutually-exclusive tabs (Опис/Гравці/Матеріали/Персонажі) — key context was hidden behind tab switches, the rail competed visually with the transcript, and on desktop it couldn't collapse (the ✕ only worked on the mobile overlay because desktop visibility wasn't tied to `showSidebar`).

**Solution (UI-only, GameChat.tsx + chat.css):**
- **Rewrote `CaseFilesPanel`**: removed the tab state; added a persistent top **summary** (status stamp + current location + objective + counts: materials/NPCs/locations) and **collapsible `<details>` sections** (Опис справи + Слідчі `open`; Персонажі + Матеріали collapsed). Static scenario images load lazily on first open of Матеріали (`imagesRequested` flag) instead of being gated behind a tab. New props: `statusLabel`, `currentLocationName`, `counts`.
- **Dossier visuals** (`chat-dossier__*`, `chat-dossier-card`, `chat-npc-stamp--{friendly,hostile,neutral,unknown}`, `chat-evidence-card`): rotated bordered status/relationship stamps, captioned evidence cards, typewriter section headers — all on existing noir tokens.
- **Desktop collapse**: new `railCollapsed` state (persisted in `localStorage` `barri.railCollapsed`). `.chat-sidebar--collapsed` (≥768px) shrinks the rail to a 48px icon-only `.chat-rail-strip` (expand chevron + live counts); `<details>` content hidden. The header 📋 button now routes through `toggleCaseFiles()` — mobile toggles the drawer (`showSidebar`), desktop toggles collapse — fixing the dead desktop ✕. Mobile bottom-sheet drawer unchanged.

**Key decisions:**
- Native `<details>`/`<summary>` for sections — accessible, no extra JS state, keyboard-operable.
- Counts computed once in the parent and passed to both the panel summary and the collapsed strip so they stay consistent.
- Collapse is desktop-only (all collapse CSS gated under `min-width:768px`); mobile always renders the full dossier in the drawer.

**Verification:** `tsc` clean; eslint 0 errors on GameChat (pre-existing `<img>` warnings only); `npm run build` clean; `npm test` 62/62 (no logic change). Branch `feature/ANT-102`. Visual/interaction confirmation (expand/collapse, stamps, evidence cards, mobile drawer) is the review step.

## 2026-06-03 — Sessions list cover art + available/closed restyle (ANT-99)
**Problem:** Most `/sessions` cards fell back to a giant ∞ glyph because scenario scenes are only generated during play; "Доступні справи" were flat imageless panels and "Закриті справи" looked identical to active.

**Solution (UI + small server augment, NO image generation → zero cost):**
- **`GET /api/scenarios`** now attaches `cover?: string` per scenario: the first `staticImages[]` entry whose `<id>.jpg` exists under `public/scenarios/<id>/` (cached assets on the shared_data volume). Pure filesystem check, no generation. Added `cover?` to the `Scenario` type.
- **`SessionList.tsx`**: built `coverById` (scenario_id → cover) from loaded scenarios; `SessionCard` gained a `coverFallback` prop and now resolves thumbnail as `sessionImages → scenario cover → fallback`, so new sessions show real imagery instead of ∞. Closed sessions (`status==='completed' && !playedEvening`) get a `session-card--closed` modifier. Available `case-file-card`s gained a `.case-file-thumb` cover hero (with a sealed-paper fallback + "Справа" classified tab).
- **`sessions.css`**: `.case-file-thumb`/img/fallback/seal/classified, `.session-card--closed` muted (desaturated thumb + lower opacity, brightens on hover), reduced-motion guard for the cover zoom.

**Key decisions:**
- Cover uses **existing cached assets only** — confirmed with the disk listing (`shared_data/public/scenarios/<id>/*.jpg`); no Gemini image calls, no API cost. Scenarios without any generated static image still degrade gracefully (sealed-paper fallback, not the giant ∞).
- Counts/cover computed server-side once in the list endpoint to keep the client simple and avoid N per-card requests.

**Verification:** `tsc` clean; eslint 0 errors (only the new cover `<img>` warnings, same pattern as existing thumbnails); `npm run build` clean; `npm test` green (no logic change). Branch `feature/ANT-99`. Post-deploy: confirm `/api/scenarios` returns `cover` URLs and they 200. Visual confirmation (hero thumbs, closed muting, mobile heights) is the review step.

## 2026-06-04 — Bespoke painterly scenario covers (ANT-99 follow-up)
**Ask (Anton):** the earlier ANT-99 cover reused a location/clue image; he wanted a real, *cool* cover generated per scenario.

**Solution:** painterly **1920s occult-detective pulp-poster** art direction (chosen by Anton over photo/woodcut). One hand-authored subject per scenario (derelict Boston house for the-haunting/-v2; lonely telegraph office for the-last-telegram; storm-lit unfinished Sagrada Família for the two Barcelona scenarios) + shared poster style suffix, "no text/lettering" guard.
- `scripts/generate-covers.mjs` (committed — documents prompts; reusable with `--force [id]`): calls Gemini `gemini-2.5-flash-image`, writes `<targetDir>/<id>/cover.jpg`. Some shared_data dirs are root-owned (container-created), so those covers were generated *inside* the container (`docker cp` script → `docker exec node`); the rest ran on the host.
- Post-processed all five with `sharp` (in-container) to **900×600 JPEG q82** → 44–81 KB each (Gemini returns ~1.7 MB PNG-in-jpg; way too heavy for a card grid). 3:2 crop gives a consistent card aspect.
- `GET /api/scenarios` cover priority: `cover.jpg` → first existing `staticImage`. Added `cover` to `STYLE_MAP` in `staticImages.ts` for future in-pipeline regeneration.

**Cost:** 5 images on `gemini-2.5-flash-image` (~$0.04 each ≈ $0.20). Regenerable any time via the script.

**Verification:** `tsc` clean; eslint clean on changed TS; `npm run build` clean. Covers live on the shared_data volume and serve 200. Branch `feature/ANT-99-covers`. Visual quality is Anton's call — if a cover misses, re-run `node scripts/generate-covers.mjs --force <id>` (host) or via container for root-owned dirs.

## 2026-06-08 — ANT-109 instant demo + waitlist capture

**Problem:** Product Hunt / itch.io launch visitors landed on a beautiful public page, but the primary CTA sent them straight to registration before they could experience Barri.

**Solution:**
- Added public `/demo` route with a short scripted playable case, `The Archive Door`.
- Demo shows the core loop without auth: player action -> Keeper response -> tracked clues/items -> d100 check -> completion state.
- The scene ends when the archive is opened, after 10 player messages, or when the 5-minute preview timer expires.
- Added waitlist modal after completion/limit with `POST /api/waitlist`.
- Added `waitlist_entries` table via `ensureSchema()` with unique email upsert and demo metadata (`source`, `outcome`, `message_count`, `notes`, `user_agent`).
- Landing CTAs now point to `/demo` instead of `/auth/register`, preserving register/login links from the demo modal/auth pages.

**Verification:**
- `npm run lint -- src/app/demo/page.tsx src/app/demo/DemoClient.tsx src/app/api/waitlist/route.ts src/app/LandingClient.tsx src/lib/queries.ts` — passed.
- `npm run build` — passed.
- Browser QA on `http://localhost:3000/demo`:
  - happy path `Inspect the brass door` -> `Search the intake desk` -> `Use the silver pin on the lock` opens the archive and shows waitlist modal;
  - waitlist submit reaches success in local dev fallback (local Postgres was not running);
  - mobile viewport DOM verified at 390x844;
  - landing DOM verified with 5 `/demo` links and 0 `/auth/register` primary CTA links.
- In-app Browser screenshot capture timed out repeatedly on `Page.captureScreenshot`, so verification used DOM snapshots and interactions rather than screenshot artifacts.

**Key decisions:**
- Demo Keeper is scripted/deterministic instead of calling the live LLM. This keeps launch traffic fast, free, and stable while still showing Barri's interaction loop.
- The waitlist API returns a success-only fallback in non-production if DB is unavailable, but production still fails loudly if persistence is broken.

## 2026-06-08 — ANT-109 follow-up: instant demo wired to Keeper prompt

**Problem:** Anton caught that `/demo` looked good but the Keeper turn was still a keyword-scripted mock, not connected to Barri's actual system prompt/scenario flow.

**Solution:**
- Added `src/lib/demoScenario.ts` with a real short `Scenario` object for “The Archive Door”: CoC 7e ruleset, locations, railguards, must-happen events, NPC echo, demo-specific system guidance, and one investigator player.
- Added public `POST /api/demo/keeper` that builds prompt blocks through `buildSystemPromptBlocks(DEMO_SCENARIO, worldState, players, { language: 'en' })`, calls Gemini 2.5 Flash, parses core Keeper tags (`ITEM`, `LOCATION`, `COMPLETE_SESSION`, pending roll), and returns updated demo `worldState`/players without auth or DB session persistence.
- Reworked `DemoClient.tsx` to remove the local `resolveKeeperTurn()` keyword script. The UI now posts player actions + history + demo state to `/api/demo/keeper`; progress indicators are derived from returned state/inventory.

**Key decisions:**
- Kept `/api/demo/keeper` separate from `/api/ai` because the demo must be public/no-auth and should not create a user session, but it reuses the same system prompt builder and tag conventions.
- Added lightweight state inference only for UI progress (door inspected / pin / passphrase / archive open) in case the LLM narrates the clue but omits an optional state tag; Keeper text itself is not scripted.
- Used Gemini Flash for launch demo cost/speed and capped history/message size for public access.

**Verification so far:**
- `npm run lint -- src/app/demo/page.tsx src/app/demo/DemoClient.tsx src/app/api/demo/keeper/route.ts src/lib/demoScenario.ts` — passed.
- `npm run build` — passed after local `npm install` restored missing dev dependency `vitest`; lockfile churn reverted.
- `npm test` — 62/62 passed.
- In-app Browser local `/demo` renders title/input; clicking “Inspect the brass door” calls `/api/demo/keeper` and shows a controlled connection notice because local env has no `GEMINI_API_KEY`. Full LLM verification must happen on staging where Docker env provides the key.

## 2026-06-08 — ANT-109 follow-up: launch waitlist gate polish

**Ask:** Anton requested public launch flow cleanup:
1. Landing topbar `Enter Dossier` should become a styled waitlist CTA that bypasses demo and goes directly to the waitlist form.
2. The waiting-list form must not allow account registration; access is only through the waitlist during launch.
3. Public `Open Case Files` should show one unlocked demo case and then real existing scenarios as locked/access-denied files with a secondary waitlist CTA.

**Solution:**
- Landing:
  - topbar CTA now routes to `/auth/register` as waitlist intake (`Join Waitlist` / localized copy);
  - final CTA also routes to waitlist;
  - hero/demo CTA and demo case still route to `/demo`.
- `/auth/register` is now waitlist-only: one email field, posts to `POST /api/waitlist`, no password/confirm fields, success state says the request is filed.
- `POST /api/auth/register` now returns `403 registration_closed` to prevent direct registration API bypass while launch access is waitlist-gated.
- Login footer copy changed from “Begin initiation” to “Join the waiting list”.
- Demo completion modal no longer links to account creation/registration; success state just confirms filing and the secondary link is “Already cleared?” to login.
- Landing case cabinet now renders:
  - one open demo card (“The Cursed Archive” / localized variants) with `Try Keeper`;
  - locked cards fetched from `/api/scenarios`, using real scenario titles/covers/metadata, with `Access denied` primary state and `Join waitlist` secondary action.

**Verification:**
- `npm run lint -- src/app/LandingClient.tsx src/app/content.ts src/app/auth/register/page.tsx src/app/auth/login/page.tsx src/app/api/auth/register/route.ts src/app/demo/DemoClient.tsx` — passed.
- `npm run build` — passed.
- `npm test` — 62/62 passed.
- Browser local landing DOM: `Join Waitlist` present, `Enter Dossier` absent, `Try Keeper` present, real scenarios loaded from `/api/scenarios`, locked cards show `Access denied`.
- Browser local waitlist page DOM: only one email field, no password/confirm/register copy, `Join Waiting List` present.
- `POST /api/auth/register` returns `403 registration_closed`.
- `POST /api/waitlist` returns `{ ok: true }` locally (dev fallback).

## 2026-06-08 — ANT-109 follow-up: demo bugfixes after review

**Bugs reported by Anton:**
1. Demo checklist advanced regardless of what the user wrote.
2. Demo itself had no Ukrainian/Spanish localization.
3. Roll event showed two suggested text actions instead of a dice emulator; roll state needed a separate UI surface.
4. Timer modal reopened after closing; 5 minutes was too short. Demo should be 15 minutes with guard-patrol fiction and locked chat after timeout.

**Solution:**
- Replaced keyword-based progress inference with explicit Keeper tags:
  - `[DEMO_CLUE:door_inspected]`
  - `[DEMO_CLUE:silver_pin]`
  - `[DEMO_CLUE:passphrase]`
  - `[DEMO_CLUE:archive_open]`
- Removed the unsafe “user mentioned silver pin → give pin” shortcut. The pin now comes from world state/inventory or a real `[ITEM:]` mutation.
- Added mandatory demo progress tag guidance to the demo scenario prompt and route-level `DEMO KEEPER MODE`.
- Added route `language` support:
  - `uk` uses the Ukrainian prompt path;
  - `en` uses English;
  - `es` uses English base prompt with a stronger Spanish-only override in the dynamic demo section.
- Landing demo links now preserve language via `/demo?lang=<lang>`.
- Added full demo UI copy for EN/UK/ES with language switcher inside `/demo`.
- Replaced roll suggestions (`Roll 32` / `Roll 78`) with a dedicated demo d100 dice panel:
  - shows skill/threshold/context;
  - animates d100;
  - submits the final result into the Keeper route.
- Added roll safety net in `/api/demo/keeper`: if the model writes a roll request but forgets `[SET_PENDING_ROLL]`, the route synthesizes `pendingRollResult`.
- Added forced pending-roll clear when the user submits a plain dice result, mirroring `/api/ai`.
- Timer increased to 15 minutes. Fiction reframed as “next guard patrol”.
- Timeout now sets a terminal `guard` state, opens the waitlist modal once, and after closing the modal the chat remains blocked instead of reopening the modal every tick.

**Verification so far:**
- `npm run lint -- src/app/demo/DemoClient.tsx src/app/demo/page.tsx src/app/api/demo/keeper/route.ts src/lib/demoScenario.ts src/app/LandingClient.tsx` — passed.
- `npm run build` — passed.
- `npm test` — 62/62 passed.
- Local Browser:
  - `/demo?lang=uk` renders Ukrainian title/copy, 15-minute patrol timer, Ukrainian input and suggestions.
  - `/demo?lang=es` renders Spanish title/copy and no roll text suggestions.
  - landing `/demo` links include `?lang=<currentLang>`.
- Full LLM/state verification must happen on staging after deploy because local env has no `GEMINI_API_KEY`.

**Follow-up during staging QA:**
- Staging Browser QA showed the Ukrainian suggested action “Обшукати стіл реєстрації” could make the Keeper describe the desk without uncovering the silver pin.
- Strengthened `DEMO KEEPER MODE` with canonical EN/UK/ES demo intents:
  - inspect brass door → door clue;
  - search intake/registration desk → silver filing pin + item tag;
  - listen at keyhole → passphrase;
  - use silver filing pin → pending Locksmith d100 roll;
  - passphrase or successful lock roll → archive completion.
- This keeps checklist updates tied to Keeper tags/state mutations while making the core localized demo actions reliable.

**Microcopy follow-up:**
- Replaced the demo door label “cases that refused to die” / “справи, що відмовилися померти” with “Paranormal Cases Division” / “Відділ паранормальних справ” / Spanish equivalent.
- Updated the intake desk clue so the Keeper references the Paranormal Cases Division instead of records that “refused to die”.
- No retest requested; copy-only change.

**Final launch follow-up:**
- Temporarily removed demo suggested action buttons above the chat to encourage visitors to write their own actions.
- Kept the dedicated d100 dice panel because it is roll-resolution UI, not a hint/action shortcut.
- Updated EN/UK/ES demo briefing copy so it asks users to tell the Keeper what they do in their own words.

## 2026-06-08 — Admin usage: anonymous demo tracking

**Ask:** Anton requested that admin usage now also track anonymous public demo sessions.

**Solution:**
- Extended `api_usage` with lightweight attribution fields:
  - `source` (`session` default, `demo` for public demo);
  - `anonymous_session_id`;
  - `scenario_id`.
- `/demo` now creates a per-page-load anonymous demo id and sends it to `/api/demo/keeper`.
- `/api/demo/keeper` now tracks Gemini usage via `trackAPICall()` with `source='demo'`, `scenarioId='instant-demo-archive-door'`, and the anonymous id.
- `trackAPICall()` now supports nullable `userId` so public anonymous calls can be tracked without a user record.
- Admin Usage now has an `Anonymous Demo` section with sessions, calls, tokens, avg cost/session, total cost, and expandable model breakdown.
- Admin model totals will include demo usage automatically because the records are in `api_usage`.

## 2026-06-08 — VPS cleanup: deprecated Telegram bot

**Finding:** VPS disk was 95% full. `/var/log/syslog.1` was ~24.65GB and `/var/log/syslog` was ~11.09GB. The spam source was `tg-bot.service` (`/opt/tg-bot`, PID 905), not Hermes. The old bot was polling Telegram with a revoked token and logging huge `401 Unauthorized` request/response objects into syslog.

**Immediate mitigation without sudo:** removed the old bot code/token and `node_modules` from `/opt/tg-bot`, replaced `bot.js` with a no-op process, and killed the old PID so systemd restarted the no-op. This stops Telegram polling/log spam, but the root-owned systemd unit still needs sudo removal.

**Docs:** added `SERVER_STRUCTURE.md` and linked it from `PROJECT_CONTEXT.md` and `AGENTS.md` so the VPS layout and service ownership are easier to identify.

**Final sudo cleanup still needed on VPS:**
```bash
sudo systemctl stop tg-bot.service
sudo systemctl disable tg-bot.service
sudo rm -f /etc/systemd/system/tg-bot.service
sudo systemctl daemon-reload
sudo rm -rf /opt/tg-bot
sudo truncate -s 0 /var/log/syslog /var/log/syslog.1
sudo journalctl --vacuum-size=300M
df -h /
```

## 2026-06-08 — Linear planning: demo-style full GameChat refresh

**Ask:** Anton wants the main staging game chat to use the stronger visual direction from `/demo`, while preserving full session functionality. He also wants the side hints rebuilt as a living plan where items appear, complete, or get crossed out depending on play.

**Linear plan created:**
- `ANT-114` — `GameChat: apply demo dossier/console visual language to full session chat`
  - Restyle `/session/[id]` around the demo dossier + live transcript console visual language.
  - Preserve full GameChat functionality: TTS/autovoice, ambient, Keeper style, dice modes, voice input, multi-player queue, inventory, completion feedback, read-only sessions, admin debug/export.
  - Coordinate with `ANT-102` and `ANT-103`, which already touch the inspector rail and atmosphere/motion.
- `ANT-115` — `GameChat: dynamic case plan sidebar with revealed/completed/crossed-out steps`
  - Add a backward-compatible `world_state.casePlan` concept.
  - Add a generalized plan tag protocol for Keeper-driven plan updates.
  - Render hidden/available/completed/crossed-out plan items in the side dossier with demo-like visual treatment.
  - Persist plan updates in `world_state` and document the tag protocol when implemented.

Both issues were created in `AI Improvements`, assigned to Codex, and cross-linked with coordination comments.

## 2026-06-08 — ANT-114 implementation: demo-style full GameChat refresh

**Ask:** Anton said to start `ANT-114` now: make the main game chat visually closer to the `/demo` design while keeping full game-session functionality.

**Implementation:**
- Created branch `feature/ANT-114` from current `staging`/`origin/staging` head.
- Moved Linear `ANT-114` to `In Progress`, assigned to Codex, and added an implementation-start comment.
- Updated `GameChat` shell classes so the full chat owns its layout through `chat-root` + `chat-game-column` instead of relying on Tailwind utility composition for the primary frame.
- Added an `ANT-114` override section at the end of `src/app/session/[id]/chat.css`:
  - desktop now reads as a demo-like two-panel workspace: paper case dossier rail on the left, dark live transcript console on the right;
  - mobile keeps the existing bottom-sheet dossier behavior;
  - transcript bubbles now follow the demo console style: Keeper/NPC/player messages are dark, bordered transcript entries instead of heavy rounded parchment bubbles;
  - settings, stats, inventory strip, composer, send button, completion modal, and dossier cards were restyled into the same archive-file visual language;
  - full controls remain present: TTS replay/autovoice, ambient, Keeper style, dice modes, VoiceButton, multi-player queue, inventory item use, completion/feedback, read-only state, admin debug/export.

**Verification:**
- Read relevant Next.js 16.2 docs from `node_modules/next/dist/docs` in the main checkout:
  - App Router CSS guide;
  - layout file convention;
  - CSS chunking/import-order note.
- `npm ci` installed local worktree dependencies for reliable checks.
- `npm run lint -- src/components/GameChat.tsx src/components/StatsBar.tsx` — passed with existing `@next/next/no-img-element` warnings in `GameChat` only.
- `npm run build` — passed.
- `npm test` — 62/62 passed.
- Local Browser:
  - `http://localhost:3000` loads.
  - `/session/local-smoke` redirects to auth as expected because this local worktree has no `JWT_SECRET`/`DATABASE_URL`.
  - A browser-only `file://` visual harness was blocked by Browser policy, so no local visual screenshot of the actual chat was possible without auth+DB.

**Staging QA still needed:**
- Verify an active real session on `staging.barrigame.es` with:
  - desktop dossier left + transcript console right;
  - settings panel open;
  - inventory strip and multi-player queue;
  - pending virtual dice roll and physical dice hint;
  - read-only completed session/completion modal;
  - mobile bottom-sheet dossier.

## 2026-06-09 — ANT-114 staging deploy and QA login method

**Deploy:**
- Pushed `e339b35` (`ANT-114: restyle game chat like demo`) to remote `staging`.
- Deployed staging from `/opt/apps/barri-dev` with the documented VPS flow:
  `git pull --ff-only origin staging` and `docker compose --env-file /opt/apps/.env -f docker-compose.yml up -d --build barri-dev`.
- Verified `https://staging.barrigame.es` returns `200`, `/api/scenarios` returns scenario JSON, and `apps-barri-dev-1` is running the new build.

**Internal QA access:**
- Created a staging-only approved user `codex.qa@barrigame.es` in the `barri_dev` database.
- Stored the QA credentials locally in ignored `.env.codex.qa.local`:
  - `STAGING_QA_URL`
  - `STAGING_QA_EMAIL`
  - `STAGING_QA_PASSWORD`
- This gives Codex a repeatable way to log into staging through Browser and test inside the product without using Anton's personal account, production data, or admin access.

**Browser verification:**
- Logged into staging through Browser with the QA user and reached `/sessions`.
- Started a real session named `Codex QA ANT-114` and reached `/session/dcda2b14-8504-4142-855e-7ea8447ea8d7`.
- Verified the active full GameChat renders the new demo-style visual direction:
  - desktop dossier rail on the left and dark transcript console on the right;
  - stats, inventory strip, composer, and Keeper response visible in the active session;
  - settings panel still exposes Keeper style, autovoice, ambient, virtual dice, and volume controls.
- Mobile/narrow viewport still keeps the main chat focused and uses the existing sheet-style dossier behavior.

## 2026-06-09 — ANT-115 implementation: living case plan sidebar

**Ask:** Anton asked to remove the game-chat vignette and start the next task: dynamic side hints that behave like the demo plan, where items appear, complete, or get crossed out based on play.

**Implementation:**
- Created branch `feature/ANT-115` from current `origin/staging`.
- Moved Linear `ANT-115` to `In Progress`, assigned to Codex, and added an implementation-start comment.
- Removed the heavy radial vignette from the ANT-114 `chat-root::after` overlay while keeping the subtle dossier split-line texture.
- Added a backward-compatible `world_state.casePlan` shape:
  - `items: { id, label, status, note? }[]`
  - `status`: `hidden | available | completed | crossed_out`
- Added pure `src/lib/casePlanTags.ts`:
  - parses `[CASE_PLAN:{...}]` tags;
  - strips plan tags from narration;
  - upserts existing items by stable `id`;
  - ignores malformed/incomplete tags without leaking service text to players.
- Added prompt protocol in `buildSystemPromptBlocks()`:
  - Keeper should emit `[CASE_PLAN:{"id":"snake_case_id","label":"short action","status":"available|completed|crossed_out|hidden","note":"optional short reason"}]`;
  - available = newly revealed action/lead;
  - completed = players performed or closed the lead;
  - crossed_out = route lost, false, or bypassed;
  - hidden = prepared but not visible yet.
- Added current case-plan state to the dynamic prompt block so the Keeper can update existing ids instead of duplicating items.
- Preserved `casePlan` through periodic world-state summary merges so Haiku/Gemini summaries cannot clobber the authoritative plan.
- Rendered non-hidden plan items as the first section in the side dossier:
  - active items appear as open tasks;
  - completed items get a checked dossier marker;
  - crossed-out items are visibly struck through with a red mark;
  - collapsed rail now includes a plan count.

**Verification so far:**
- Read relevant Next.js 16.2 docs:
  - App Router CSS guide;
  - Route Handlers guide.
- `npm test -- tests/casePlanTags.test.ts tests/worldStateMerge.test.ts tests/prompts.test.ts` — 17/17 passed.
- `npm run lint -- src/components/GameChat.tsx src/app/api/ai/route.ts src/lib/casePlanTags.ts src/lib/prompts.ts src/lib/worldStateMerge.ts src/types/index.ts tests/casePlanTags.test.ts tests/prompts.test.ts tests/worldStateMerge.test.ts` — passed with only existing `@next/next/no-img-element` warnings in `GameChat`.
- `npm test` — 68/68 passed.
- `npm run build` — passed.

**Staging QA still needed:**
- Deploy to staging.
- Seed or generate a session with visible `casePlan` items and verify:
  - no vignette on desktop;
  - plan appears in the left dossier;
  - completed/crossed-out/hidden statuses render correctly;
  - mobile bottom-sheet dossier remains usable.

## 2026-06-09 — ANT-115 staging deploy and QA

**Deploy:**
- Pushed `1435732` (`ANT-115: add living case plan sidebar`) to remote `staging`.
- Deployed staging from `/opt/apps/barri-dev` with the documented VPS flow:
  `git pull --ff-only origin staging` and `docker compose --env-file /opt/apps/.env -f docker-compose.yml up -d --build barri-dev`.
- Verified `https://staging.barrigame.es` returns `200`, `/api/scenarios` returns scenario JSON, `apps-barri-dev-1` is running, and `/opt/apps/barri-dev` is at `1435732`.

**Browser/staging QA:**
- Seeded the QA session `dcda2b14-8504-4142-855e-7ea8447ea8d7` with test `world_state.casePlan` items:
  - `available`: "Перевірити креслення Гауді"
  - `completed`: "Допитати старшого майстра"
  - `crossed_out`: "Виламати бічну браму"
  - `hidden`: "Знайти підземний хід"
- Reloaded `https://staging.barrigame.es/session/dcda2b14-8504-4142-855e-7ea8447ea8d7` in Browser.
- DOM verification:
  - `План справи` is visible;
  - available/completed/crossed-out items render;
  - hidden item does not render;
  - `.chat-case-plan__item--completed` and `.chat-case-plan__item--crossed` are present.
- CSS verification:
  - `.chat-root::after` contains only the two subtle linear split-line overlays;
  - the radial vignette is gone.

**Screenshot note:**
- Browser `Page.captureScreenshot` timed out twice on this session after viewport resize.
- macOS `screencapture` also failed in this Codex environment with `could not create image from display`.
- Visual verification was therefore done via Browser DOM snapshot and computed CSS checks rather than an attached screenshot.

## 2026-06-09 — ANT-115 follow-up: remove landing vignette from game chat

**Issue:** Anton still saw a vignette in the staging game chat after the ANT-115 deploy.

**Cause:** ANT-115 removed the radial vignette from `.chat-root::after`, but the session page is wrapped in `.landing-root`. The global landing overlay `.landing-root::after` from `landing.css` still applied the landing-page "vignette + smoke wash" over the chat.

**Fix:** Added `.landing-root:has(.chat-root)::after { content: none; }` in `src/app/session/[id]/chat.css` so game-chat pages disable the landing overlay while keeping the landing page visuals intact.

## 2026-06-09 — ANT-115 follow-up: dice roller visual + pending roll lock

**Issue:** Anton noticed two GameChat bugs on staging:
- the d100 dice roller still used the old rounded stone-card design;
- while a roll was pending, the normal chat composer was still available, so a user could submit arbitrary text before resolving the roll.

**Fix:**
- Rebuilt `DiceRoller` markup around semantic `dice-roller__*` classes and styled it in `chat.css` to match the dossier/console visual language: square file-machine panels, typewriter labels, D100 stamp, dark console surface, and success/fail states.
- Added `composer-rail--roll-locked` / `composer-rail__roll-lock` state in `GameChat`.
- When `world_state.pendingRollResult` exists, GameChat now replaces the normal composer with the roll UI:
  - virtual dice mode shows only the d100 roller;
  - physical dice mode shows a dedicated numeric result form (`1–100`) and submit button;
  - textarea, voice input, queue button, send button, and inventory chips do not render during the pending roll.
- Added `submitRollResult()` / `submitPhysicalRoll()` helpers so both virtual and physical dice resolve through the same `sendMessage(result)` path and clear `pendingRollResult` locally.

**Verification:**
- `npm run lint -- src/components/GameChat.tsx src/components/DiceRoller.tsx` — passed with only existing `@next/next/no-img-element` warnings in `GameChat`.
- `npm test` — 68/68 passed.
- `npm run build` — passed.

## [2026-06-09 · Claude] — ANT-116: localize injected prompt sections for EN sessions

### Problem
Аудит core engine показав: ANT-64 локалізував основні блоки промпта, але все, що інжектиться в момент запиту, лишалось хардкод-українським незалежно від `session.language`. EN-сесії отримували змішаний промпт: `## ОЧІКУВАНИЙ КИДОК` / `## ПІДКАЗКА ДІЙ` (keeper activity), вся інструкція random events, інструкція "покажи" → [IMAGE:], Gemini split-cache преамбула (`[СТАН СЕСІЇ]` / `Зрозумів.`), summarize-промпт (Haiku писав український summary, який потім інжектився в англомовний dynamic block), кампанійний контекст (`Вечір N:`) і close-session summarizer. Додатково `isPassiveMessage()` мав лише українські active-патерни — будь-яка коротка англійська дія ("I run", "open it") < 20 символів рахувалась пасивною і збивала balanced Keeper на недоречні nudges.

### Solution
- `prompts.ts`: `buildSummarizePrompt(messages, lang)` — EN-варіант з вимогою "All text values must be in English".
- `randomEvents.ts`: `buildEventInstruction(..., lang)` — повний EN-варіант (4 типи подій + правила введення, тег-протокол незмінний).
- `route.ts` (api/ai): `buildKeeperActivitySection(..., lang)` — EN для pending-roll / action-nudge / passive-style; EN-варіант imageRequestInstruction; Gemini преамбула `[SESSION STATE]` / `Understood.`; `summarizeAndUpdateWorldState(..., lang)`; EN active/passive патерни в `isPassiveMessage()`.
- `campaigns.ts`: `getCampaignContext(campaignId, lang)` (`Evening N:`), `closeSession(..., lang)` + `buildCloseSessionPrompt(messages, lang)` + локалізований fallback summary.
- `complete/route.ts`: передає `session.language` у `closeSession`, локалізований fallback `'Session completed.'`.

### Key decisions
- Всі нові параметри мають дефолт `'uk'` — зворотна сумісність, жоден існуючий виклик не ламається.
- Тег-протокол ([SET_PENDING_ROLL], [RANDOM_EVENT], [IMAGE], [CLEAR_PENDING_ROLL]) не змінювався — тільки мова навколишніх інструкцій.
- Verification: tsc clean; tsx smoke-test — EN-варіанти не містять кирилиці, зберігають тег-інструкції, UK-дефолти незмінні; staging контейнер перезібрано (env -u ANTHROPIC_API_KEY), 200 OK.
- Це фікс №1 з аудиту консистентності кіпера (топ-5). Наступні: summarizer vs npcRelations race, matchAll для DELTA/LOCATION, dice-контракт, ruleset-aware roll protocol.
