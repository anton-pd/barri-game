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

**gemini-2.0-flash:**
- В GEMINI_MODELS є `'gemini-pro': 'gemini-2.0-flash'` — але AI_PROVIDERS у GameChat.tsx має тільки `claude-sonnet` та `gemini-flash`. Gemini Pro з UI незвідний.

### Технічний борг та потенційні проблеми

**1. `updateSession` — подвійний запит до БД на кожен AI turn**
```
route.ts L608: await updateSession(session.id, { players: updatedPlayers });
route.ts L610: await updateSession(session.id, { world_state: updatedWorldState });
```
Кожен виклик робить окремий UPDATE + SELECT. Разом 2 UPDATE + 2 SELECT за один хід.
→ Краще: `updateSession` з обома полями в одному запиті.

**2. `extractLocationFromMessages` — вторинний parse LOCATION з тексту повідомлень**
- `api/ai/route.ts` L353-355: перед побудовою промпту сервер сканує 3 останніх повідомлення на `[LOCATION:]` тег щоб визначити `newLocationId` для `evaluateRandomEvent`
- Але `[LOCATION:]` зберігається в DB тільки якщо він НЕ stripped (реально він і є stripped — `textForDB` видаляє `[LOCATION:]` на L515-516)
- Тобто `extractLocationFromMessages` завжди повертає `undefined`, бо LOCATION тегів вже немає в збережених повідомленнях
- Реальне поточне місцезнаходження вже є в `worldState.currentLocation` — функція зайва

**3. `parseInventoryTags` — strips all inventory tags але `segments.ts` не знає про них**
- `parseSegments()` у `segments.ts` L41-47 прибирає DELTA/ITEM/LOCATION/IMAGE теги, але НЕ прибирає `USE_ITEM`, `REMOVE_ITEM`, `EQUIP`, `BREAK_ITEM`
- `parseInventoryTags()` в `api/ai/route.ts` прибирає їх на сервері, але до того передає вже-stripped text у `parseSegments()`
- Порядок виконання: L468 `parseInventoryTags()` → L510 `parseSegments()` — порядок правильний ✓

**4. `GameChat.tsx` — 1236 рядків, один монолітний компонент**
- Можна декомпозувати: `useAudio()` хук (TTS логіка), `useInventory()` хук (item use), `useSse()` хук (streaming reader), `MessageList` компонент, `SettingsPanel` компонент
- Не критично, але збільшує cognitive load при внесенні змін

**5. `segments.ts::parseSegments` — НЕ strips `USE_ITEM`, `EQUIP`, `BREAK_ITEM` tags**
- Вже fixed на сервері через `parseInventoryTags`, але `parseSegments` викликається і на клієнті (при reload initialMessages, L454-458 у GameChat.tsx)
- Якщо LLM іноді не дотримується порядку тегів і залишає їх у середині тексту, клієнт побачить сирі теги в bubble
- Low risk (теги зазвичай в кінці відповіді), але варто додати strip у `segments.ts`

**6. `costTracker.ts` — `gemini-2.5-flash` і `gemini-2.0-flash` мають однакову ціну**
- `gemini-2.5-flash: { inputPer1M: 0.10, outputPer1M: 0.40 }` — ймовірно застарілі ціни
- Станом на 2026 ціни Gemini 2.5 Flash вищі за 2.0 Flash
- Варто перевірити актуальний прайс

**7. `Dockerfile` / standalone — `public/scenarios/dynamic` кешування зображень**
- `api/image/route.ts` кешує зображення в `public/scenarios/dynamic/`
- Для Next.js standalone потрібно монтувати цю папку як volume в Docker, інакше при rebuild кеш втрачається
- PROJECT_CONTEXT.md про це мовчить

**8. `proxy.ts` — невикористаний?**
- `src/proxy.ts` присутній, але не знайдений в жодному import
- Варто перевірити чи він потрібен

**9. `gemini-2.0-flash` як `gemini-pro`**
- `GEMINI_MODELS['gemini-pro'] = 'gemini-2.0-flash'` в `api/ai/route.ts`
- Але в `AI_PROVIDERS` (GameChat) немає `gemini-pro` опції → `modelId` буде `''` якщо хтось передасть `gemini-pro`
- Мертвий код: провайдер недоступний з UI

**10. `isPassiveMessage()` — тільки українські патерни**
- L162-166 в `api/ai/route.ts`: regex тільки для українських слів
- Якщо гравець пише англійською ("I search the room") — завжди буде passiveMessage через `message.length < 20` умову (якщо коротке)
- Прийнятно для поточної аудиторії (україномовна гра), але варто задокументувати

### Речі що добре спроектовані

1. **Tag protocol** — чистий, розширюваний, server-authoritative. LLM — виконавець, сервер — джерело правди.
2. **Three-tier prompt caching** — ruleset кешується найдовше, static поки сценарій не змінюється, dynamic щоразу новий. Економить ~70% токенів на кешованих запитах.
3. **Non-blocking side effects** — `trackAPICall()` і NPC registration через `.catch(console.error)` — не блокують stream.
4. **Optimistic SSE bubbles** — порожній bubble з'являється одразу, наповнюється chunk за chunk. UX відразу responsivе.
5. **Partial NPC name matching** — `segments.ts` знаходить NPC по частковому збігу імені (ANT-11 fix).
6. **Image disk cache** — SHA256 ключ від (prompt+type), 7 днів HTTP cache. Повторні `[IMAGE:]` теги з однаковим промптом безкоштовні.
7. **Fallback chain для зображень**: Gemini → Pollinations (free). Resilient.
8. **Auto-fallback TTS**: Gemini → OpenAI при 429/502.
9. **DiceRoller key prop** — `key={skillName-threshold-idx}` гарантує remount на кожен новий roll, скидає стан анімації.
10. **`dynamicNpcs` в WorldState** — improvised NPCs, яких немає в сценарії, auto-реєструються і показуються в CaseFilesPanel.

### Пріоритетні покращення

| Пріоритет | Зміна | Складність |
|-----------|-------|------------|
| High | Fix `extractLocationFromMessages` — прибрати або замінити на `worldState.currentLocation` | Trivial |
| High | `updateSession` batch — один UPDATE замість двох | Low |
| Medium | `segments.ts` strip inventory tags на клієнтській стороні | Low |
| Medium | Додати `gemini-pro` в `AI_PROVIDERS` або видалити з `GEMINI_MODELS` | Trivial |
| Medium | Оновити PRICING в costTracker (перевірити актуальні ціни Gemini 2.5) | Trivial |
| Low | Декомпозиція `GameChat.tsx` на хуки + менші компоненти | High |
| Low | Документувати `dynamicNpcs`, `IMAGE_PROVIDER` env, image cache path в PROJECT_CONTEXT | Low |
| Low | Перевірити та прибрати `src/proxy.ts` якщо невикористаний | Trivial |
| Low | Додати keeperStyle до SessionList (session creation modal) | Low |
