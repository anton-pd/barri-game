# Barri Game / Cthulhu Keeper: повний опис архітектури

## 1. Що це за проєкт

Це вебзастосунок на `Next.js 16` + `React 19` для проведення текстових партій у стилі `Call of Cthulhu`, де роль Кіпера виконує LLM.

Ключова ідея:

- сценарій зберігається як JSON-файл у `scenarios/*.json`
- UI дозволяє створити сесію, вибрати сценарій, створити 1-4 персонажів і вести гру
- головний бекенд-мозок живе в `src/app/api/ai/route.ts`
- весь геймплей тримається на комбінації:
  - `scenario.systemPrompt`
  - структурованих блоків з NPC/локаціями/railguards/rules
  - поточного `world_state`
  - списку гравців
  - останніх повідомлень сесії

Проєкт не є "звичайним чатиком". Це stateful RPG engine, де LLM генерує не тільки текст, а й структуровані side effects через спеціальні теги.

## 2. Стек і залежності

`package.json`:

- `next@16.2.3`
- `react@19.2.4`
- `react-dom@19.2.4`
- `postgres`
- `jose`
- `bcryptjs`
- `@anthropic-ai/sdk`
- `resend`
- `tailwindcss@4`
- `typescript`

Ролі провайдерів:

- `Anthropic`:
  - основний LLM для геймплею через `claude-sonnet-4-6`
  - дешевша summarize-модель через `claude-haiku-4-5-20251001`
- `Google Gemini`:
  - альтернативні LLM-провайдери для тексту: `gemini-2.5-flash`, `gemini-2.5-pro`
  - TTS: `gemini-2.5-flash-preview-tts`
  - image generation: `gemini-2.5-flash-image`
- `OpenAI`:
  - STT: `whisper-1`
  - TTS: `tts-1`
  - image fallback: `dall-e-2`
- `Pollinations`:
  - fallback image provider
- `Resend`:
  - email verification

## 3. Високорівнева архітектура

Система складається з 7 шарів:

1. `Scenario layer`
   - JSON-сценарії є джерелом правди для лору, NPC, локацій, clue list, static images, briefing і базового системного промпта.

2. `Prompt orchestration layer`
   - `src/lib/prompts.ts` збирає system prompt з:
     - статичного блоку сценарію
     - динамічного блоку `world_state + players`
   - окремо генерує summarize prompt для оновлення `world_state`.

3. `Gameplay runtime`
   - `src/app/api/ai/route.ts`
   - перевіряє доступ
   - вантажить сесію і сценарій
   - формує розмовну історію
   - викликає LLM
   - парсить службові теги
   - зберігає повідомлення
   - оновлює гравців / world state / TTS / image metadata

4. `Persistence layer`
   - PostgreSQL через `src/lib/db.ts` + `src/lib/queries.ts`
   - сесії, повідомлення, користувачі
   - `players` і `world_state` зберігаються в `JSONB`

5. `Frontend runtime`
   - головний інтерактивний клієнт: `src/components/GameChat.tsx`
   - lobby/створення гри: `src/components/SessionList.tsx`
   - player state UI: `StatsBar`
   - voice input UI: `VoiceButton`

6. `Media layer`
   - TTS route, STT route, image route
   - статичні і динамічні зображення
   - ambient audio для location transitions

7. `Auth/Admin layer`
   - JWT cookie auth
   - email verification
   - admin panel для ролей і огляду всіх сесій

## 4. Структура директорій

Практично важливі директорії:

- `src/app`
  - сторінки, API routes, admin, auth
- `src/components`
  - весь клієнтський UI
- `src/lib`
  - prompt orchestration, auth, db, query layer, TTS helpers, roles
- `src/types`
  - основні типи домену
- `scenarios`
  - визначення сценаріїв JSON
- `public/scenarios`
  - згенеровані або збережені артефакти сценаріїв

Непрямо важливі:

- `src/proxy.ts`
  - auth gate на рівні route matching
- `Dockerfile`
  - production packaging
- `DEPLOY.md`
  - старі інструкції деплою

## 5. Доменна модель

Головні типи в `src/types/index.ts`:

### User

- `id`
- `email`
- `role: 'user' | 'admin'`
- `email_verified`
- timestamps

### WorldState

Це зведений state сесії, який LLM періодично переписує після summarize:

- `act`
- `visitedLocations`
- `discoveredClues`
- `npcRelations`
- `summary`
- `openThreads`
- `playerNotes`

Це не повна транзакційна модель світу. Це compressed memory layer для LLM.

### Player

- `name`
- `role`
- `roleId`
- `hp/maxHp`
- `sanity/maxSanity`
- `luck/maxLuck`
- `skills`
- `inventory`
- `background`

### GameSession

- `scenario_id`
- `name`
- `act`
- `status`
- `world_state`
- `players`
- `user_id`

### Message

- `role: user | assistant`
- `content`
- `player_idx`

### Scenario

Сценарій має таку форму:

- `id`
- `title`, `titleUk`
- `era`
- `difficulty`
- `description`
- `briefing`
- `systemPrompt`
- `railguards`
- `criticalSuccessRules`
- `mustHappenEvents`
- `npcs`
- `locations`
- `staticImages`

## 6. База даних

Все створюється в коді через `ensureSchema()` / `initializeSchema()` в `src/lib/queries.ts`.

### Таблиці

#### users

- email/password_hash
- role
- email_verified
- verify_token / verify_expires

#### game_sessions

- scenario_id
- name
- act
- status
- world_state JSONB
- players JSONB
- user_id

#### messages

- session_id
- role
- content
- player_idx
- created_at

### Важливі архітектурні наслідки

- схема ініціалізується lazy при API викликах
- немає окремого migration framework
- `players` і `world_state` не нормалізовані, а лежать як JSONB
- це спрощує швидку розробку, але означає, що логіка інвентарю/характеристик живе переважно в застосунку, а не в SQL

## 7. Auth і контроль доступу

### Механіка

- JWT створюється в `src/lib/auth.ts`
- зберігається в `httpOnly` cookie `auth_token`
- lifetime: `7d`
- секрет: `JWT_SECRET`

### Потоки

#### Реєстрація

`/api/auth/register`

- валідовує email/password
- хешує пароль через bcrypt
- створює verify token
- надсилає email через Resend

#### Верифікація

`/api/auth/verify?token=...`

- підтверджує email
- одразу логінить користувача
- редіректить на `/`

#### Логін

`/api/auth/login`

- bcrypt compare
- блокує вхід без `email_verified`
- ставить auth cookie

#### Поточний користувач

`/api/auth/me`

- читає cookie
- звіряє JWT
- дочитує актуальну роль з БД

### Proxy layer

`src/proxy.ts`:

- пропускає `/auth/*`, `/api/auth/*`, `_next`, `favicon`
- для page routes редіректить неавторизованих на `/auth/login`
- додає `x-user-id`, `x-user-role` headers
- ці headers не є security boundary, лише допоміжні

### Доступ до сесій

Сесія доступна якщо:

- користувач є owner
- або admin
- або це legacy session з `user_id = null`

## 8. Головний gameplay flow

Основний runtime живе в `src/app/api/ai/route.ts`.

### Вхідні дані

Route приймає:

- `sessionId`
- `message`
- `playerIdx`
- `allActions?`
- `aiProvider?`
- `autoVoiceEnabled?`

### Основний алгоритм

1. Перевіряє auth cookie.
2. Завантажує `GameSession`.
3. Перевіряє ownership/admin access.
4. Вантажить сценарій з `scenarios/<id>.json`.
5. Читає останні `30` повідомлень.
6. Формує `userContent`:
   - якщо `__intro__`, то просить LLM почати гру
   - інакше додає префікс `[Ім'я]: ...`
7. Викликає вибраний LLM.
8. Парсить службові теги.
9. Очищає текст від тегів для збереження/відображення.
10. Зберігає user messages і assistant message в БД.
11. Кожні `20` повідомлень асинхронно запускає summarize.
12. Якщо є `[DELTA]`, оновлює stats гравців.
13. Якщо є `[ITEM]`, видає нові предмети в inventory.
14. Якщо ввімкнено auto voice, запускає prefetch TTS.
15. Повертає клієнту:
   - `response`
   - `voiceStyle`
   - `segments`
   - `players`
   - `world_state`
   - `imagePrompt/imageType`
   - `location/locationName`

## 9. Prompt architecture

Це найважливіший шар для переносу в іншу LLM.

### 9.1. Джерела системного промпта

`src/lib/prompts.ts` збирає system prompt з двох блоків:

#### Static block

Включає:

- `scenario.systemPrompt`
- список NPC з voice style і secret list
- список локацій з id, description і clue list
- railguards
- must-happen events
- critical success rules
- універсальні правила кубиків
- формат службових тегів

#### Dynamic block

Включає:

- поточний `world_state`
- усіх гравців
- їхні точні значення навичок
- inventory
- background

### 9.2. Prompt split для Anthropic caching

Для сценарію `the-last-telegram` використовується split prompt:

- static block кешується через `cache_control: ephemeral`
- dynamic block передається окремо

Це зроблено для prompt caching в Anthropic і зменшення вартості при довгих сесіях.

Для інших сценаріїв використовується legacy single-string prompt.

### 9.3. Критичні інваріанти промпта

Промпт вимагає:

- не вести гравців за руку
- не пропонувати варіанти дій
- не говорити від імені гравців
- використовувати точні skill values конкретного гравця
- відповідати тільки українською
- тримати відповіді короткими, бо вони озвучуються

### 9.4. DSL службових тегів

LLM не просто пише текст. Воно повертає ігрові side effects через теги.

#### `[DELTA:{...}]`

Оновлення HP/SAN/Luck.

Приклад:

```text
[DELTA:{"0":{"hp":-3,"sanity":-5}}]
```

#### `[ITEM:playerIdx:Назва:Опис:uses]`

Видача предмета конкретному гравцю.

#### `[IMAGE:type:short English description]`

Просить клієнт/бекенд згенерувати динамічне ілюстративне зображення.

#### `[LOCATION:location_id]`

Означає фізичний перехід до іншої локації.

#### `[NPC:Ім'я]репліка[/NPC]`

Позначає пряму мову NPC для multi-speaker TTS і спеціального UI rendering.

### 9.5. Summarize prompt

`buildSummarizePrompt()`:

- бере весь transcript сесії
- просить модель повернути лише валідний JSON `WorldState`
- summarize викликається кожні `20` збережених повідомлень
- summarize є async side job, не блокує основну відповідь

## 10. LLM-провайдери і моделі

### Gameplay text

Підтримується 3 AI провайдери:

- `claude-sonnet`
  - модель: `claude-sonnet-4-6`
- `gemini-flash`
  - модель: `gemini-2.5-flash`
- `gemini-pro`
  - модель: `gemini-2.5-pro`

### Summarization

- для Claude: `claude-haiku-4-5-20251001`
- для Gemini: `gemini-2.5-flash`

### Важлива деталь

Gemini викликається напряму через REST API, а не через офіційний SDK.

## 11. Frontend: сторінки і компоненти

### `src/app/page.tsx`

- домашня сторінка
- якщо нема auth -> redirect на login
- якщо auth є -> рендерить `SessionList`

### `src/app/session/[id]/page.tsx`

- SSR-сторінка сесії
- читає cookie
- перевіряє користувача і роль
- завантажує session + messages
- читає `briefing` зі сценарію
- рендерить `GameChat`

### `src/components/SessionList.tsx`

Функції:

- fetch `/api/sessions`
- fetch `/api/scenarios`
- показ списку активних сесій користувача
- модальне створення нової гри:
  - вибір сценарію
  - назва сесії
  - 1-4 гравці
  - вибір role preset

### `src/components/GameChat.tsx`

Це головний клієнтський runtime.

Відповідає за:

- локальний стан сесії
- transcript
- replay audio
- сегментацію NPC speech
- dynamic images
- case files drawer
- settings panel
- pending action queue для мультигравця
- ambient audio по location
- voice input
- intro generation

#### Особливо важливі механіки `GameChat`

##### 1. Intro bootstrap

Якщо `initialMessages.length === 0`, компонент автоматично викликає `/api/ai` з `message: '__intro__'`.

##### 2. Pending actions

Для кількох гравців є черга дій:

- кожен гравець може додати дію
- потім усе відправляється одним пакетом `allActions`
- UI показує окремі user bubbles
- бекенд зберігає кожну дію окремим message row

##### 3. Item use

- `StatsBar` може підставити використання предмета в input
- після відповіді AI предмети з finite uses декрементяться на клієнті
- далі клієнт патчить `players` через `/api/sessions/[id]`

##### 4. Message rendering

Assistant message може бути:

- простим single bubble
- multi-segment з narration + NPC speech

Сегментація робиться через `src/lib/segments.ts`.

##### 5. Auto voice

`autoVoiceEnabled` зберігається в `localStorage`.

Якщо увімкнено:

- AI route prefetch'ить Gemini TTS
- клієнт після отримання відповіді одразу відтворює аудіо

##### 6. Dynamic images

Якщо відповідь має `[IMAGE:...]`, `GameChat` показує inline image через `/api/image`.

##### 7. Ambient

`[LOCATION:...]` викликає:

- `setCurrentLocation`
- `setCurrentLocationName`
- `playAmbient(locationId)`

Файли ambient лежать у `public/scenarios/<scenario>/sounds/<location>.mp3`.

### `src/components/StatsBar.tsx`

- компактна панель гравців
- ручне редагування `HP / SAN / LCK`
- перегляд навичок
- перегляд inventory
- кнопка `вжити` для item usage

### `src/components/VoiceButton.tsx`

- `MediaRecorder`
- відправка `audio.webm` на `/api/stt`
- отриманий transcript одразу відправляється як user action

### `src/components/AuthBar.tsx`

- показ email
- logout
- посилання на admin для admin-користувачів

## 12. API surface

### Gameplay

- `GET /api/scenarios`
  - читає всі сценарії з файлової системи

- `POST /api/ai`
  - головний gameplay endpoint

- `GET/POST /api/messages`
  - читання / пряме збереження повідомлень

- `GET/POST /api/sessions`
  - список сесій / створення сесії

- `GET/PATCH/DELETE /api/sessions/[id]`
  - читання / оновлення / видалення сесії

### Media

- `POST /api/tts`
  - OpenAI або Gemini TTS

- `POST /api/stt`
  - Whisper transcription

- `GET /api/image`
  - on-demand dynamic image generation + disk cache

- `GET/POST /api/scenarios/[id]/images`
  - генерація / перелік static scenario images

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/verify`
- `POST /api/auth/resend-verify`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Admin

- `GET /api/admin/users`
- `PATCH /api/admin/users/[id]/role`

## 13. Media architecture

### TTS

#### OpenAI branch

- route: `/api/tts`
- модель: `tts-1`
- voice mapping у `src/lib/voices.ts`

#### Gemini branch

- route: `/api/tts`
- raw PCM через `fetchGeminiPcm()`
- перетворення в WAV через `pcmToWav()`
- multi-speaker режим, якщо є `[NPC]` сегменти

### TTS prefetch cache

`src/lib/ttsPrefetch.ts`:

- in-memory `Map`
- key: перші 300 символів тексту
- AI route стартує prefetch одразу після відповіді
- TTS route намагається взяти готовий WAV з кешу
- eviction: `10 min`

### STT

`/api/stt`:

- приймає `FormData`
- шле blob в OpenAI Whisper
- мова: `uk`

### Images

Є два типи:

#### Static scenario images

- описані у `scenario.staticImages`
- генеруються один раз
- зберігаються в `public/scenarios/<scenarioId>/<imageId>.jpg`

#### Dynamic inline images

- тригеряться тегом `[IMAGE:...]`
- кешуються в `public/scenarios/dynamic/<hash>.jpg`

### Стилізація image prompt

Для `newspaper`, `map`, `letter`, `photo`, `artifact`, `scene` є свій style map.

## 14. Сценарії, що зараз є в проєкті

На цей момент у репозиторії є 2 сценарії.

### 14.1. `the-haunting`

Українська назва: `Привид`

Характер:

- beginner scenario
- класичний haunted house
- більше про дослідження будинку, привида, підвал, ритуали

Особливості:

- system prompt сильно підкреслює "реагуй на дії, не веди"
- набір railguards стримує:
  - передчасний підпал будинку
  - втечу з міста
  - раннє звернення до поліції
- набір must-happen events тримає головні сюжетні вузли
- має static images:
  - будинок
  - газетна вирізка
  - карта кварталу
  - фото підвалу

NPC-профіль:

- Корбіт
- Кнотт
- Лопес
- Ельза Шрьодер
- детектив Моррісон

Локаційний профіль:

- exterior
- living room
- bedroom
- basement
- library

### 14.2. `the-last-telegram`

Українська назва: `Остання Телеграма`

Це зараз найпросунутіший сценарій у проєкті.

Чому він особливо важливий:

- тільки він використовує split system prompt для Anthropic caching
- має `briefing`, який показується у case files drawer
- має `soundPrompt` у локацій
- має глибше прописаний psychological/revelation horror
- під нього додані спеціальні role presets у `src/lib/roles.ts`

Основний сюжет:

- Бостон, листопад 1923
- Едгар Вітмор, телеграфіст, мертвий у замкненій кімнаті
- телеграми продовжують надходити після його смерті
- у центрі не "злий монстр", а сутність між передачами

Особливо сильні промптові якорі сценарію:

- horror через revelation, не через монстра
- телеграми стають дедалі зв'язнішими
- сенсорна атмосфера: дощ, озон, клацання апарату, холод металу
- NPC мають власний ритм мови і приховані мотиви

Railguards тут жорсткіші й технічніші:

- раннє знищення обладнання
- рання поліція
- втеча з Бостона
- спроба "простого" екзорцизму

Must-happen beats:

- перша телеграма після смерті
- знаходження модифікованого обладнання
- щоденник Вітмора
- зустріч з доктором Сабо
- фінальний вибір: знищення або контакт

Архітектурно цей сценарій є шаблоном для майбутніх складних сценаріїв.

## 15. Role presets

`src/lib/roles.ts` містить готові архетипи персонажів.

Базові:

- `detective`
- `journalist`
- `doctor`
- `antiquarian`
- `soldier`
- `private_investigator`

Сценарно-специфічні:

- `telegraph_reporter`

Кожен preset задає:

- стартові stats
- skills
- inventory
- background

Це важливо: тут закладено початкову mechanical balance персонажів.

## 16. Admin area

### `src/app/admin/page.tsx`

Показує:

- всіх користувачів
- кількість активних сесій
- verified status
- усі сесії системи з owner email

### `RoleToggle`

- дозволяє admin/user switch
- не дозволяє змінювати власну роль

## 17. Runtime і деплой

### Docker

`Dockerfile`:

- stage `deps`: `npm ci`
- stage `builder`: `npm run build`
- stage `runner`: запускає `.next/standalone`

У production контейнер копіюються:

- `.next/standalone`
- `.next/static`
- `public`
- `scenarios`

### Наслідок

Сценарії вантажаться з файлової системи і тому мають фізично бути присутні в контейнері.

## 18. Environment variables

Мінімально потрібні:

- `DATABASE_URL`
- `JWT_SECRET`
- `APP_URL`

Для auth email:

- `RESEND_API_KEY`
- `RESEND_FROM`

Для gameplay/media:

- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `IMAGE_PROVIDER`

## 19. Що є джерелом правди в цьому проєкті

Якщо переносити архітектуру в інший LLM або інший стек, головне не втратити ці інваріанти:

1. `Scenario JSON` є source of truth для narrative content.
2. `buildSystemPromptBlocks()` є source of truth для prompt composition.
3. `api/ai/route.ts` є source of truth для gameplay side effects.
4. `WorldState` є compressed memory, а не повний state machine.
5. Службові теги `[DELTA] [ITEM] [IMAGE] [LOCATION] [NPC]` є контрактом між LLM і застосунком.
6. `GameChat.tsx` є source of truth для UX-логіки партії.

## 20. Як переносити цей проєкт в інший LLM

Якщо інший LLM має відтворити проєкт, потрібно зберегти саме таку послідовність:

1. Відтворити доменні типи:
   - User, Player, InventoryItem, WorldState, Message, Scenario
2. Відтворити схему БД:
   - users, game_sessions, messages
3. Відтворити JSON schema сценарію.
4. Відтворити prompt builder:
   - static block
   - dynamic block
   - summarize prompt
5. Відтворити gameplay route:
   - auth
   - load session
   - load scenario
   - build prompt
   - call LLM
   - parse tags
   - persist transcript
   - update players/world state
6. Відтворити frontend runtime:
   - session list
   - game chat
   - stats bar
   - voice button
7. Відтворити media routes:
   - tts, stt, image, scenario images
8. Відтворити auth/admin.

## 21. Найважливіше коротко

Цей репозиторій треба мислити так:

- це не просто Next.js app
- це сценарно-керований RPG engine
- сценарії задають narrative skeleton
- prompt builder задає правила поведінки LLM
- `api/ai` конвертує текст LLM у реальні мутації game state
- фронтенд лише візуалізує і допомагає керувати сесією, але головна логіка гри живе в prompt contract + AI route

Якщо переносити проєкт в іншу модель або інший стек, критично зберегти не дизайн UI, а:

- структуру сценарію
- prompt DSL
- side-effect tags
- модель session/world_state/players/messages
- короткий український стиль відповіді
- мультигравцеву семантику `[Ім'я]:`

