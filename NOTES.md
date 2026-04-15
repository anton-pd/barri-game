# Barri Game — Нотатки по змінах

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
