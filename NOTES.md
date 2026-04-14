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
- SSE streaming: реалізувати client-side reader в GameChat.tsx
- Wire-up generateImageExternal() до існуючої image generation логіки
- Track TTS/image API calls в costTracker
- Додати keeperStyle selector в session creation UI
- Тестування нових тегів в реальній грі
