# Інструкція зі створення сценаріїв — barrigame.es

Цей файл пояснює як створити сценарій для системи. Дотримуйся структури точно — всі поля важливі.

---

## 1. Де зберігати файл

```
/opt/apps/cthulhu/scenarios/<id>.json
```

`id` — унікальний, лише латинські літери та дефіси. Приклади: `the-haunting`, `the-last-telegram`, `death-on-the-orient`.

---

## 2. Мінімальна структура (обов'язкові поля)

```json
{
  "id": "scenario-id",
  "title": "English Title",
  "titleUk": "Назва Українською",
  "era": "1920s",
  "difficulty": "beginner",
  "rulesetId": "coc_7e",
  "description": "Короткий опис сценарію. 2-3 речення. Де, коли, в чому суть.",
  "systemPrompt": "...",
  "railguards": [...],
  "criticalSuccessRules": { "investigation": "...", "combat": "...", "persuasion": "..." },
  "mustHappenEvents": [...],
  "npcs": [...],
  "locations": [...]
}
```

**`difficulty`**: `"beginner"` | `"intermediate"` | `"advanced"`  
**`era`**: зазвичай `"1920s"`, можна `"1890s"`, `"1930s"`, `"modern"` тощо  
**`rulesetId`**: завжди `"coc_7e"` (поки що єдиний рулсет)

---

## 3. systemPrompt

Головна інструкція для Кіпера (LLM). Обов'язково містить:

1. **Хто ти** — Кіпер для CoC, назва сценарію, місце і час
2. **Природа жаху** — що насправді відбувається, правда яку гравці ще не знають
3. **Головний принцип** — "Реагуй на дії — не веди. Описуй лише те що персонаж відчуває."
4. **Стиль нарації** — атмосфера, сенсорні деталі, темп
5. **Як грати NPC** — загальна вказівка (голос, темп, прихована мотивація)

**Шаблон:**

```
Ти — Кіпер (Keeper of Arcane Lore) для Call of Cthulhu 7th Edition. Ведеш сценарій «[Назва]». [Місто, рік].

ПРИРОДА ЖАХУ: [Що насправді відбувається — повна правда для LLM. Хто/що є антагоністом, яка його природа, яка мотивація або її відсутність.]

ГОЛОВНИЙ ПРИНЦИП: Реагуй на дії гравців — не веди їх.
- Описуй лише те, що персонаж бачить, чує, відчуває просто зараз.
- Ніколи не пропонуй дії, варіанти або «ти міг би...».
- Ніколи не питай «що ви робите далі?».
- Перевірку навички проси ТІЛЬКИ коли гравець явно намагається щось зробити з ризиком провалу.
- Підказки відкриваються лише через активні дії: огляд, обшук, розмову.

СТИЛЬ НАРАЦІЇ:
- [Атмосфера: звуки, запахи, відчуття. Конкретні деталі епохи.]
- [Темп жаху: повільний/нагнітання/шок — залежно від сценарію]
- [Особливий елемент: напр. "телеграми від Сутності стають зв'язнішими з часом"]

КОЛИ NPC ГОВОРИТЬ: одним реченням передай манеру і темп перед прямою мовою.
```

---

## 4. railguards

Відповіді на типові "зупинки" гравців. Мінімум 3-4. Не забороняють дію — дають наслідки або перешкоди.

```json
{
  "trigger": "гравці намагаються [небажана дія]",
  "response": "Кіпер робить [конкретний наслідок або перешкода, яка зупиняє але не ламає гру]"
}
```

Типові тригери для будь-якого сценарію:
- Гравці хочуть одразу піти до поліції
- Гравці хочуть покинути місто/справу
- Гравці намагаються знищити ключовий об'єкт до розслідування
- Гравці намагаються залучити занадто багато сторонніх (журналісти, армія)

---

## 5. criticalSuccessRules

```json
{
  "investigation": "Hard success: додаткова деталь. Extreme: відкриває прихований шлях або справжню мотивацію.",
  "combat": "Hard success: максимальна шкода. Extreme: max шкода + противник нейтралізований на раунд.",
  "persuasion": "Hard success: NPC відповідає щиро. Extreme: розкриває один секрет добровільно."
}
```

---

## 6. mustHappenEvents

Мінімум 4-5 сюжетних вузлів які МАЮТЬ відбутися незалежно від дій гравців. Кіпер знаходить можливість.

```json
[
  "Знаходять тіло/артефакт/першу підказку яка запускає сюжет",
  "Перша зустріч з головним NPC або його слідом",
  "Відкриття ключового місця (будинок, лабораторія, тощо)",
  "Момент revelation — правда стає зрозумілою",
  "Фінальний вибір — дію яку треба прийняти"
]
```

---

## 7. npcs

Кожен NPC:

```json
{
  "id": "unique_id",
  "name": "Ім'я Прізвище",
  "description": "Вік, роль, фізичний опис. Що відчувається при першій зустрічі.",
  "voiceStyle": "nervous | deep | mystic | шепіт | [будь-яка режисерська вказівка]",
  "gender": "male | female",
  "secrets": [
    "Що знає але не скаже відразу",
    "Прихована мотивація або минуле",
    "Ключова інформація яку відкриє при довірі або тиску"
  ]
}
```

**voiceStyle** — вказівка для TTS та нарації:
- `"nervous"` — тривожний, уривчастий
- `"deep"` — низький, авторитетний
- `"mystic"` — етеричний, повільний
- `"шепіт"` — ледь чутний, примарний
- Можна писати будь-що: `"elderly academic"`, `"drunk dockworker"`, `"cold and precise"`

**Скільки NPC:** 3-6 для one-shot, 5-10 для кампанії. У кожного — мінімум 2 секрети.

---

## 8. locations

Кожна локація:

```json
{
  "id": "unique_id",
  "name": "Назва Локації",
  "description": "Сенсорний опис — що бачать, чують, відчувають при вході. 2-4 речення.",
  "clues": [
    "Підказка 1 — конкретна деталь яку можна знайти активною дією",
    "Підказка 2 — веде до наступної локації або NPC",
    "Підказка 3 — розкриває частину правди"
  ],
  "soundPrompt": "short english description for ambient audio generation",
  "ambientFile": null
}
```

**Правило підказок (Clue Trail):**
- Мінімум 2 підказки у кожній локації
- Кожна підказка веде до чогось: іншої локації, NPC, події
- Підказки не самооткриваються — потрібна активна дія гравця

**soundPrompt** — кілька іменників/прикметників англійською для генерації амбієнту:
```
"old victorian house creaking, rain outside, distant footsteps, eerie silence"
"harbor docks at night, waves, foghorn, distant shouting"
"hospital ward 1920s, disinfectant smell, soft moaning, trolley wheels"
```

`ambientFile: null` завжди — заповнюється автоматично після генерації.

---

## 9. locationGroups

Групує локації для спільного амбієнту. Обов'язково якщо є `soundPrompt` у локаціях.

```json
{
  "id": "group_id",
  "name": "Назва Групи",
  "locationIds": ["loc_id_1", "loc_id_2"],
  "soundPrompt": "ambient description for the whole area",
  "ambientFile": null
}
```

**Правило:** Одна локація — одна група. Одна група — один ambient файл.

---

## 10. eventHints

Підказки для движка випадкових подій (BASE=5%, MAX=60%). Мінімум 2 на тип.

```json
{
  "positive": [
    "Знаходять лист/нотатку/деталь яка дає підказку",
    "Союзник несподівано ділиться важливою інформацією"
  ],
  "negative": [
    "Важливий предмет зник або був пошкоджений",
    "Хтось стежить — слідчі помітили слідкувача"
  ],
  "neutral": [
    "Дивна деталь без очевидного значення (годинник зупинився, дзеркало)",
    "Відволікаюча подія яка створює напругу"
  ],
  "roll_event": [
    "Фізична перешкода → Навичка (Спритність / Сила)",
    "Небезпека бути почутим → Навичка (Стелс / Слухати)"
  ]
}
```

---

## 11. staticImages

Зображення для сесії — генеруються один раз і кешуються.

```json
{
  "id": "image_id",
  "type": "photo | newspaper | map | letter | artifact | scene",
  "prompt": "English description for image generation. Be specific. Include era, style, content.",
  "label": "Підпис Українською"
}
```

**Типи і стиль:**
| type | Стиль генерації |
|------|----------------|
| `photo` | vintage sepia photograph, grainy, aged |
| `newspaper` | black and white newspaper clipping, period typography |
| `map` | hand-drawn on aged parchment, ink marks |
| `letter` | handwritten on yellowed paper, ink |
| `artifact` | mysterious object, detailed, atmospheric lighting |
| `scene` | dark illustration, horror atmosphere |

**Рекомендовано:** 3-6 зображень на сценарій. Одне — ключовий об'єкт або місце, одне — газетна вирізка або документ.

---

## 12. sessionConfig

```json
{
  "minPlayers": 1,
  "maxPlayers": 4,
  "estimatedSessions": 1,
  "isCampaign": false,
  "defaultKeeperStyle": "balanced"
}
```

- `estimatedSessions: 1` → one-shot
- `estimatedSessions: 2+` + `isCampaign: true` → кампанія з session summaries
- `defaultKeeperStyle`: `"passive"` | `"balanced"` | `"active"`

---

## 13. briefing (рекомендовано завжди)

```json
{
  "setting": "Місто, місяць рік. Одне атмосферне речення.",
  "premise": "Що сталося. Як гравці опиняються в ситуації. Що відомо на старті.",
  "objective": "Що треба з'ясувати або зробити. Формулюй відкрито — гравці несуть наслідки вибору."
}
```

---

## 14. supportedRoles / defaultRoles / rolePresets

```json
"supportedRoles": ["detective", "journalist", "doctor"],
"defaultRoles": ["detective", "doctor"]
```

`defaultRoles` — ролі для нової сесії якщо гравець не вибрав вручну.

### rolePresets — сценарій-специфічні ролі (рекомендовано)

Якщо сценарій має `rolePresets`, вони мають пріоритет над глобальними ролями з `roles.ts`.
`supportedRoles` і `defaultRoles` мають посилатись на id з `rolePresets`.

```json
"rolePresets": [
  {
    "id": "occult_historian",
    "name": "Окультний Історик",
    "description": "Професор університету, чиї дослідження зайшли занадто далеко.",
    "rulesetId": "coc_7e",
    "hp": 8,
    "sanity": 60,
    "luck": 50,
    "skills": {
      "Occultism": 80,
      "Library Use": 75,
      "History": 70,
      "Languages": 55,
      "Spot Hidden": 50,
      "Psychology": 45,
      "First Aid": 30,
      "Dodge": 30
    },
    "background": "Три речення хто і чому тут. ПЕРК — унікальна наративна перевага.",
    "inventory": [
      { "id": "grimoire", "name": "Заборонений трактат", "description": "+бонус до Occultism при розпізнаванні ритуалів.", "uses": -1 },
      { "id": "binding_seal", "name": "Печать Зв'язування", "description": "Тематичний унікальний предмет для цього сценарію.", "uses": 1 }
    ]
  }
]
```

**Правила:**
- 2–5 ролей для one-shot; 3–6 для campaign
- Ролі мають доповнювати одна одну: мінімум одна соціальна, одна дослідницька, одна з тематичними знаннями
- Назви навичок — англійською (game engine використовує їх як ключі)
- HP 8–14, Sanity 50–75, Luck 45–65
- Кожна роль: 3–4 предмети, один унікальний/тематичний для сценарію
- `uses: -1` = необмежено, `uses: N` = витратний з N зарядами
- background — мова контенту сценарію; включає ПЕРК

Глобальні presets (якщо не задано `rolePresets`): `detective`, `journalist`, `doctor`, `antiquarian`, `soldier`, `private_investigator`, `telegraph_reporter`.

---

## 15. startingLocation

```json
"startingLocation": "location_id"
```

ID першої локації де починається гра. Має бути в масиві `locations`.
Використовується як fallback якщо `variants` відсутні.

---

## 16. variants (рекомендовано)

Дозволяє перегравати сценарій з різними точками входу — основний сюжет той самий, але початкова локація і тон відрізняються.

```json
"variants": [
  {
    "id": "standard",
    "label": "Стандартний",
    "startingLocation": "investigators_office",
    "introHint": "Гравці починають в офісі — клієнт приходить з проханням. Звичайний детективний старт."
  },
  {
    "id": "in_medias_res",
    "label": "Відразу в справу",
    "startingLocation": "crime_scene",
    "introHint": "Гравці вже на місці події. Щось пішло не так. Починай з напруженої сцени."
  }
]
```

- `id` — унікальний, snake_case
- `label` — показується в майбутньому UI вибору варіанту
- `startingLocation` — має бути ID з масиву `locations`
- `introHint` — одне речення для Кіпера; передається в перший запит і очищається після інтро

**При створенні сесії** система обирає варіант випадково. `variantId` зберігається у `world_state` для довідки.

Мінімум 2 варіанти. Не потрібні для кампаній де є чіткий старт.

---

## 17. Після створення — генерація зображень

Щоб згенерувати зображення після додавання сценарію:

```bash
POST /api/scenarios/<id>/images
```

Або відкрий сторінку сценарію в UI — там є кнопка генерації.

Зображення зберігаються у `/opt/apps/cthulhu/public/scenarios/<id>/`.  
Після додавання нових файлів у `public/` — потрібен рестарт:

```bash
docker compose restart cthulhu
```

---

## 17. One-shot vs Кампанія

### One-shot (1 вечір)
- `estimatedSessions: 1`, `isCampaign: false`
- 4-6 локацій, 3-5 NPC
- Чіткий початок → розслідування → фінал
- `mustHappenEvents`: 4-5 подій, всі досяжні за 2-3 години
- Жах через одну revelation, не через лор
- Складність: `"beginner"` або `"intermediate"`

### Кампанія (2+ сесії)
- `estimatedSessions: 2+`, `isCampaign: true`
- 8-15 локацій, 6-12 NPC
- Кожна сесія — окрема "глава" з власним питанням/конфліктом
- `mustHappenEvents`: 8-12 подій розподілених по сесіях
- Лор накопичується між сесіями через session summaries
- NPC змінюються залежно від дій гравців (враховується через worldState)
- Складність: `"intermediate"` або `"advanced"`

---

## 18. Принципи хорошого сценарію (CoC 7e)

1. **Clue trail** — кожна підказка веде до наступної, мінімум 2 шляхи до кожного відкриття
2. **Horror through revelation** — страшно коли розумієш, не коли бачиш
3. **NPCs мають власне життя** — вони щось хочуть, щось ховають, реагують на дії гравців
4. **Cosmic indifference** — антагоніст не Evil, він просто Other
5. **Meaningful choices** — фінальне рішення має наслідки, немає "правильної" відповіді
6. **Атмосфера через деталі** — запах, звук, текстура важливіші за прямий опис жаху

---

## 19. Чеклист перед збереженням

- [ ] `id` унікальний і відповідає імені файлу (`<id>.json`)
- [ ] `rulesetId: "coc_7e"` вказано
- [ ] `systemPrompt` містить природу жаху і головний принцип
- [ ] Мінімум 3 `railguards`
- [ ] Мінімум 4 `mustHappenEvents`
- [ ] Кожен NPC має мінімум 2 секрети і `gender`
- [ ] Кожна локація має мінімум 2 `clues`
- [ ] `startingLocation` вказує на існуючу локацію
- [ ] `sessionConfig` заповнено
- [ ] `locationGroups` покривають всі локації з `soundPrompt`
- [ ] `eventHints` мають мінімум 2 елементи кожного типу
- [ ] `staticImages` мають унікальні `id`
- [ ] `ambientFile: null` у всіх локаціях і групах

---

## 20. Мінімальний приклад (one-shot skeleton)

```json
{
  "id": "the-fog-of-innsmouth",
  "title": "The Fog of Innsmouth",
  "titleUk": "Туман Інсмута",
  "era": "1920s",
  "difficulty": "intermediate",
  "rulesetId": "coc_7e",
  "description": "Інсмут, Массачусетс, 1922. Журналіст приїжджає розслідувати занепад колись процвітаючого рибальського міста. Жителі дивні. Риба надходить рясно. Ніхто не відповідає на запитання.",
  "briefing": {
    "setting": "Інсмут, Массачусетс, вересень 1922. Туманний ранок, від моря тягне водоростями.",
    "premise": "Редакція отримала листа від місцевого жителя який невдовзі зник. Тебе відправили розібратись.",
    "objective": "З'ясуй що сталось з Робертом Мартіном і що відбувається з містом."
  },
  "sessionConfig": {
    "minPlayers": 1,
    "maxPlayers": 3,
    "estimatedSessions": 1,
    "isCampaign": false,
    "defaultKeeperStyle": "balanced"
  },
  "supportedRoles": ["journalist", "detective", "doctor"],
  "defaultRoles": ["journalist"],
  "startingLocation": "bus_station",
  "systemPrompt": "Ти — Кіпер для CoC 7e. Ведеш сценарій «Туман Інсмута». Інсмут, 1922.\n\nПРИРОДА ЖАХУ: ...\n\nГОЛОВНИЙ ПРИНЦИП: Реагуй на дії — не веди...",
  "railguards": [
    {
      "trigger": "гравці намагаються покинути місто не розібравшись",
      "response": "..."
    }
  ],
  "criticalSuccessRules": {
    "investigation": "Hard success: додаткова деталь. Extreme: відкриває прихований шлях.",
    "combat": "Hard success: максимальна шкода. Extreme: max шкода + противник нейтралізований.",
    "persuasion": "Hard success: NPC відповідає щиро. Extreme: розкриває секрет."
  },
  "mustHappenEvents": [
    "Зустріч з першим жителем який веде себе дивно",
    "Знаходять кімнату Мартіна в готелі",
    "Нічний інцидент що змушує залишитись",
    "Відкриття правди про Орден Дагона",
    "Фінальний вибір: тікати або знищити докази"
  ],
  "npcs": [...],
  "locations": [...],
  "locationGroups": [...],
  "eventHints": {
    "positive": ["...", "..."],
    "negative": ["...", "..."],
    "neutral": ["...", "..."],
    "roll_event": ["...", "..."]
  },
  "staticImages": [
    {
      "id": "innsmouth_docks",
      "type": "photo",
      "prompt": "Innsmouth harbor 1920s foggy morning, old fishing boats, decaying docks, eerie atmosphere sepia photograph",
      "label": "Порт Інсмута"
    }
  ]
}
```
