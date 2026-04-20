export type Lang = "en" | "uk" | "es";

export const CONTENT = {
  en: {
    nav: {
      exhibits: "Exhibits",
      procedure: "Procedure",
      cases: "Case Files",
      testimony: "Testimony",
      enter: "Enter Dossier →",
    },
    hero: {
      caseNo: "Case Nº 1929 / CTH",
      filed: "Filed: 04 / 20 / 2026",
      t1: "The Keeper",
      t2: "is already",
      t3: "listening",
      lede: "An AI-run Call of Cthulhu investigation, played in your browser. Your party, your choices, your",
      redact: "unspeakable",
      ledeEnd: "failures — all recorded in a dossier that never forgets.",
      cta: "Open the Case File",
      ghost: "Read the Evidence",
    },
    dossier: {
      county: "Arkham County · Records",
      confidential: "Confidential",
      subject: "Subject: The Listener",
      rows: [
        { k: "Classification", v: "Keeper / Narrator" },
        { k: "Active since", v: "the small hours" },
        { k: "Known aliases", v: "Sonnet-4.6, Haiku-4.5" },
        { k: "Jurisdiction", v: "barrigame.es" },
      ],
      stamp: "Classified",
      stampSub: "Do Not Remove",
    },
    ticker: [
      "Dossier nº 1929 — reopened after ninety-seven years of silence",
      "Witness reports: voices in the static, none of them human",
      "The Keeper sees every die you roll. Even the ones you hide",
      "Three investigators entered. Two returned. One came back wrong",
      "Ambient phonographs recovered from the Elm Street property",
      "Do not read the file after sundown",
    ],
    exhibits: {
      label: "§ I · The Evidence",
      heading: ["What a Keeper ", "knows", ",\xa0a Keeper remembers."],
      desc: "Six exhibits, logged by the Bureau. Read each in full, and you begin to grasp why the Keeper never needs to sleep.",
      items: [
        {
          num: "I", tag: "Exhibit A",
          title: "The Keeper Never Sleeps.",
          body: "An AI game master narrates every scene in real time. It remembers the matchbook in your pocket, the name you gave the barkeep, and the lie you told three sessions ago.",
        },
        {
          num: "II", tag: "Exhibit B",
          title: "The Dice Don't Lie.",
          body: "A full Call of Cthulhu 7e ruleset runs under the hood. Roll d100 against your skills on the virtual table, or call it out and the Keeper will adjudicate on the spot.",
        },
        {
          num: "III", tag: "Exhibit C",
          title: "The Record Remembers.",
          body: "Multi-session campaigns persist between visits. NPCs carry grudges, locations stay changed, and the scars on your investigator follow them into the next case.",
        },
        {
          num: "IV", tag: "Exhibit D",
          title: "Voices from the Dark.",
          body: "Every character speaks in their own voice. Ambient gramophone loops and location-specific soundscapes turn your browser into a dimly-lit parlour at 2 a.m.",
        },
        {
          num: "V", tag: "Exhibit E",
          title: "No Two Runs the Same.",
          body: "Every session is a new investigation. Different choices, different suspects, different outcomes. The case is the same — the truth is always somewhere else.",
        },
        {
          num: "VI", tag: "Exhibit F",
          title: "Bring Your Party.",
          body: "One to four investigators at the same table. Assign roles — detective, scholar, reporter — and let the AI Keeper track injuries, sanity, and luck for everyone.",
        },
      ],
    },
    procedure: {
      label: "§ II · Procedure",
      heading: ["How an ", "investigation", " is run."],
      steps: [
        {
          n: "1", tag: "Intake",
          title: "Select a Case File",
          body: "Choose a scenario from the cabinet. Each one is a self-contained investigation with its own ruleset, locations, and suspects.",
        },
        {
          n: "2", tag: "Casting",
          title: "Assemble Your Party",
          body: "Name your investigators, pick their roles, and step into the era. The Keeper distributes skills, gear, and secrets accordingly.",
        },
        {
          n: "3", tag: "Session",
          title: "Begin the Interview",
          body: "Speak with NPCs, search rooms, follow leads. Voice or text — the Keeper hears you. Roll dice when she asks, or when your nerve fails you.",
        },
        {
          n: "4", tag: "Archive",
          title: "Close the Case",
          body: "Every session ends with a written summary in the campaign record. Come back for another run — a different approach, a different truth.",
        },
      ],
    },
    cases: {
      label: "§ III · The Cabinet",
      heading: ["Open ", "case files."],
      desc: "Two full investigations at your disposal. Each one is replayable — different choices lead to different suspects, different endings, different horrors.",
      files: [
        {
          id: "File № 01 · CoC 7e", badge: "Open", badgeSealed: false,
          cls: "case-1",
          title: "The Haunting",
          sub: "A draughty house on Elm Street.",
          meta: [
            { k: "Sessions", v: "1" }, { k: "Players", v: "1 – 4" },
            { k: "Tone", v: "Classic horror" }, { k: "Duration", v: "≈ 3 h" },
          ],
          brief: "A family hires you to certify the Corbitt house on Elm Street as fit for purchase. The previous tenants left in a hurry. Their belongings are still inside. Something in the cellar has been collecting them — and waiting. Every run reveals new angles: follow the priest's trail, dig into the cult's history, or risk the ritual room alone. The ending depends entirely on what you choose to believe.",
          replayable: "Fully replayable · outcome changes with every approach",
          cta: "Open the file",
          stamp: null,
        },
        {
          id: "File № 02 · CoC 7e · Campaign", badge: "Multi-Session", badgeSealed: true,
          cls: "case-2",
          title: "The Last Telegram",
          sub: "Four locations. One message from the dead.",
          meta: [
            { k: "Sessions", v: "3 – 5" }, { k: "Players", v: "2 – 4" },
            { k: "Tone", v: "Investigative" }, { k: "Duration", v: "≈ 12 h" },
          ],
          brief: "At 22:14 a telegram arrives at the Arkham bureau. The sender's name is on a headstone six miles east — interred eleven days prior. The wire contains three words and a grid reference. A multi-session investigation across four locations: follow the signals to find out who sent it, why they died, and whether the answer is worse than not knowing. Each run chooses different witnesses to trust — and pays a different price.",
          replayable: "Campaign · multiple paths to the truth",
          cta: "Open the file",
          stamp: "Campaign",
        },
        {
          id: "File № — · In Preparation", badge: "Sealed", badgeSealed: true,
          cls: "case-3",
          title: "The Red Vestments",
          sub: "Evidence gathered. Cataloguing ongoing.",
          meta: [
            { k: "Sessions", v: "—" }, { k: "Players", v: "—" },
            { k: "Tone", v: "Occult" }, { k: "Duration", v: "—" },
          ],
          brief: "A cathedral empties between matins and sundown. No bodies. No blood. Only a single red thread across every pew. Three confessionals sealed from the inside. The sacristan cannot be reached. The Bureau is not yet accepting investigators on this case.",
          replayable: "Coming soon · clearance pending",
          cta: null,
          stamp: "Coming Soon",
        },
      ],
    },
    testimony: {
      label: "§ IV · Sworn Testimony",
      heading: ["Statements ", "from the record."],
      notes: [
        {
          q: "Played four hours. The Keeper noticed my character was afraid of water six rooms ago and used it against me. My wife walked out of the kitchen to check if I was alright.",
          name: "J. Harwell",
          role: "Detective · Providence",
        },
        {
          q: "I have run Cthulhu for fifteen years. This is the first digital Keeper that let me stop running and start playing.",
          name: "Mrs. E. Orne",
          role: "Longtime Keeper · Arkham",
        },
        {
          q: "We ran the telegram case twice. Different suspects, different ending. The second run we trusted the wrong man on purpose — just to see. The Keeper obliged.",
          name: "Dr. A. Pettigrew",
          role: "Investigator · Kingsport",
        },
      ],
    },
    cta: {
      label: "§ V · Final Notice",
      h1: "The file is open.",
      h2: "Will you read it?",
      body: "No install. No download. Your browser is the parlour, the typewriter, and the door. Step inside — the Keeper has been expecting you.",
      btn: "Enter the Dossier",
    },
    footer: {
      credit1: "© 1929 – 2026 · Barri Bureau of Unspeakable Affairs",
      credit2: "No known investigators were harmed in the filing of this dossier.",
    },
  },

  /* ============================================================ */
  uk: {
    nav: {
      exhibits: "Докази",
      procedure: "Процедура",
      cases: "Справи",
      testimony: "Свідчення",
      enter: "Відкрити досьє →",
    },
    hero: {
      caseNo: "Справа №1929 / ЗГ",
      filed: "Подано: 20 / 04 / 2026",
      t1: "Хранитель",
      t2: "вже",
      t3: "слухає",
      lede: "Комп'ютерна гра у Call of Cthulhu з AI-Хранителем — у вашому браузері. Ваша команда, ваші вибори, ваші",
      redact: "жахливі",
      ledeEnd: "провали — всі вони записані в досьє, яке нічого не забуває.",
      cta: "Відкрити справу",
      ghost: "Читати докази",
    },
    dossier: {
      county: "Аркхем · Архів справ",
      confidential: "Таємно",
      subject: "Суб'єкт: Слухач",
      rows: [
        { k: "Класифікація", v: "Хранитель / Розповідач" },
        { k: "Активний з", v: "глибокої ночі" },
        { k: "Псевдоніми", v: "Sonnet-4.6, Haiku-4.5" },
        { k: "Юрисдикція", v: "barrigame.es" },
      ],
      stamp: "Таємно",
      stampSub: "Не виносити",
    },
    ticker: [
      "Досьє №1929 — відкрите після дев'яноста семи років тиші",
      "Показання свідків: голоси в ефірі — жодного людського",
      "Хранитель бачить кожен ваш кидок кубика. Навіть приховані",
      "Три слідчі увійшли. Двоє повернулись. Третій — вже не той",
      "Фонографічні записи вилучено з будинку на вулиці Елм",
      "Не читайте справу після заходу сонця",
    ],
    exhibits: {
      label: "§ I · Докази",
      heading: ["Що Хранитель ", "знає", ",\xa0Хранитель пам'ятає."],
      desc: "Шість доказів, внесених до реєстру. Прочитайте кожен — і ви почнете розуміти, чому Хранитель не потребує сну.",
      items: [
        {
          num: "I", tag: "Доказ А",
          title: "Хранитель не спить.",
          body: "AI-майстер гри веде розповідь у реальному часі. Він пам'ятає сірники у вашій кишені, ім'я, яке ви дали бармену, і брехню, яку ви сказали три сесії тому.",
        },
        {
          num: "II", tag: "Доказ Б",
          title: "Кубики не брешуть.",
          body: "Повна система правил Call of Cthulhu 7e працює під капотом. Кидайте d100 проти своїх навичок на віртуальному столі — Хранитель розсудить на місці.",
        },
        {
          num: "III", tag: "Доказ В",
          title: "Архів пам'ятає.",
          body: "Багатосесійні кампанії зберігаються між відвідуваннями. Персонажі тримають образи, локації залишаються зміненими, а шрами слідчого переходять у наступну справу.",
        },
        {
          num: "IV", tag: "Доказ Г",
          title: "Голоси з темряви.",
          body: "Кожен персонаж говорить власним голосом. Фонові петлі та звуки локацій перетворюють ваш браузер на тьмяно освітлений салон о другій ночі.",
        },
        {
          num: "V", tag: "Доказ Д",
          title: "Кожен раз — по-іншому.",
          body: "Кожна сесія — нове розслідування. Різні вибори, різні підозрювані, різні кінці. Справа та сама — правда щоразу деінде.",
        },
        {
          num: "VI", tag: "Доказ Е",
          title: "Беріть команду.",
          body: "Від одного до чотирьох слідчих за одним столом. Обирайте ролі — детектив, вчений, журналіст — Хранитель веде стан, здоров'я та удачу для кожного.",
        },
      ],
    },
    procedure: {
      label: "§ II · Процедура",
      heading: ["Як проводиться ", "розслідування", "."],
      steps: [
        {
          n: "1", tag: "Реєстрація",
          title: "Обрати справу",
          body: "Виберіть сценарій із шухляди. Кожен — самостійне розслідування з власними правилами, локаціями та підозрюваними.",
        },
        {
          n: "2", tag: "Склад",
          title: "Зібрати команду",
          body: "Назвіть слідчих, оберіть їхні ролі та зануртесь в епоху. Хранитель розподілить навички, спорядження та таємниці.",
        },
        {
          n: "3", tag: "Сесія",
          title: "Почати допит",
          body: "Розмовляйте з персонажами, обшукуйте кімнати, ідіть за слідами. Голос або текст — Хранитель чує. Кидайте кубики коли він просить або коли нерви здають.",
        },
        {
          n: "4", tag: "Архів",
          title: "Закрити справу",
          body: "Кожна сесія завершується письмовим підсумком у записах кампанії. Повертайтесь на новий run — інший підхід, інша правда.",
        },
      ],
    },
    cases: {
      label: "§ III · Шухляда",
      heading: ["Відкриті ", "справи."],
      desc: "Два повноцінних розслідування у вашому розпорядженні. Кожне перегравуване — різні вибори ведуть до різних підозрюваних, кінцівок та жахів.",
      files: [
        {
          id: "Справа № 01 · CoC 7e", badge: "Відкрита", badgeSealed: false,
          cls: "case-1",
          title: "Переслідування",
          sub: "Будинок із протягом на вулиці Елм.",
          meta: [
            { k: "Сесії", v: "1" }, { k: "Гравці", v: "1 – 4" },
            { k: "Тон", v: "Класичний жах" }, { k: "Тривалість", v: "≈ 3 год" },
          ],
          brief: "Родина Армітедж наймає вас, щоб перевірити будинок Корбіта на вулиці Елм перед покупкою. Попередні мешканці пішли поспіхом — їхні речі досі там. Щось у підвалі їх збирало. І чекало. Щоразу — новий маршрут: слідуйте за слідом священника, розкопайте історію культу або ризикуйте обрядовою кімнатою на самоті. Кінець залежить від того, чому ви вирішили вірити.",
          replayable: "Повністю перегравуване · кінець змінюється щоразу",
          cta: "Відкрити справу",
          stamp: null,
        },
        {
          id: "Справа № 02 · CoC 7e · Кампанія", badge: "Декілька сесій", badgeSealed: true,
          cls: "case-2",
          title: "Остання Телеграма",
          sub: "Чотири локації. Одне повідомлення від мертвого.",
          meta: [
            { k: "Сесії", v: "3 – 5" }, { k: "Гравці", v: "2 – 4" },
            { k: "Тон", v: "Розслідування" }, { k: "Тривалість", v: "≈ 12 год" },
          ],
          brief: "О 22:14 до аркхемського бюро надходить телеграма. Ім'я відправника на надгробку за шість миль — похований одинадцять днів тому. В повідомленні три слова і координати. Розслідування через чотири локації: хто надіслав, як загинув і чи є відповідь гіршою за незнання. Кожен run — різні свідки, яким ви довіряєте, різна ціна.",
          replayable: "Кампанія · кілька шляхів до правди",
          cta: "Відкрити справу",
          stamp: "Кампанія",
        },
        {
          id: "Справа № — · В підготовці", badge: "Засекречено", badgeSealed: true,
          cls: "case-3",
          title: "Червоні Ризи",
          sub: "Докази зібрано. Каталогізація триває.",
          meta: [
            { k: "Сесії", v: "—" }, { k: "Гравці", v: "—" },
            { k: "Тон", v: "Окультне" }, { k: "Тривалість", v: "—" },
          ],
          brief: "Собор спорожнів між заутренею та заходом сонця. Ні тіл. Ні крові. Лише червона нитка на кожній лаві. Три сповідальні заблоковані зсередини. Паламар недосяжний. Бюро поки не приймає слідчих у цю справу.",
          replayable: "Незабаром · дозвіл очікується",
          cta: null,
          stamp: "Скоро",
        },
      ],
    },
    testimony: {
      label: "§ IV · Свідчення під присягою",
      heading: ["Заяви ", "з протоколу."],
      notes: [
        {
          q: "Грав чотири години. Хранитель пам'ятав, що мій персонаж боїться води ще шість кімнат тому — і використав це проти нього. Дружина вийшла з кухні, щоб дізнатися чи все гаразд.",
          name: "Й. Харвелл",
          role: "Детектив · Провіденс",
        },
        {
          q: "Я провів п'ятнадцять років за кермом Call of Cthulhu. Це перший цифровий Хранитель, який дозволив мені зупинитись і просто грати.",
          name: "Пані Е. Орн",
          role: "Досвідчений Хранитель · Аркхем",
        },
        {
          q: "Ми пройшли справу з телеграмою двічі. Різні підозрювані, різна кінцівка. Другого разу навмисно довірились не тому — щоб подивитись. Хранитель не підвів.",
          name: "Д-р А. Петтіґрю",
          role: "Слідчий · Кінгспорт",
        },
      ],
    },
    cta: {
      label: "§ V · Фінальне повідомлення",
      h1: "Справа відкрита.",
      h2: "Ви готові читати?",
      body: "Жодного встановлення. Жодного завантаження. Ваш браузер — це зала, друкарська машинка і двері. Увійдіть — Хранитель вас вже чекає.",
      btn: "Відкрити досьє",
    },
    footer: {
      credit1: "© 1929 – 2026 · Barri — Бюро незрозумілих справ",
      credit2: "Жоден слідчий офіційно не постраждав під час складання цього досьє.",
    },
  },

  /* ============================================================ */
  es: {
    nav: {
      exhibits: "Pruebas",
      procedure: "Procedimiento",
      cases: "Expedientes",
      testimony: "Testimonios",
      enter: "Abrir expediente →",
    },
    hero: {
      caseNo: "Expediente Nº 1929 / CTH",
      filed: "Fechado: 20 / 04 / 2026",
      t1: "El Guardián",
      t2: "ya está",
      t3: "escuchando",
      lede: "Una investigación de Call of Cthulhu dirigida por IA, jugada en tu navegador. Tu grupo, tus decisiones, tus",
      redact: "indecibles",
      ledeEnd: "fracasos — todo registrado en un expediente que nunca olvida.",
      cta: "Abrir el expediente",
      ghost: "Leer las pruebas",
    },
    dossier: {
      county: "Condado de Arkham · Archivos",
      confidential: "Confidencial",
      subject: "Sujeto: El Oyente",
      rows: [
        { k: "Clasificación", v: "Guardián / Narrador" },
        { k: "Activo desde", v: "las horas pequeñas" },
        { k: "Alias conocidos", v: "Sonnet-4.6, Haiku-4.5" },
        { k: "Jurisdicción", v: "barrigame.es" },
      ],
      stamp: "Clasificado",
      stampSub: "No retirar",
    },
    ticker: [
      "Expediente nº 1929 — reabierto tras noventa y siete años de silencio",
      "Declaraciones de testigos: voces en la estática, ninguna humana",
      "El Guardián ve cada dado que tiras. Incluso los que escondes",
      "Tres investigadores entraron. Dos regresaron. El tercero volvió cambiado",
      "Fonógrafos ambientales recuperados de la propiedad en Elm Street",
      "No leas el expediente después del atardecer",
    ],
    exhibits: {
      label: "§ I · Las pruebas",
      heading: ["Lo que el Guardián ", "sabe", ",\xa0el Guardián lo recuerda."],
      desc: "Seis pruebas registradas por el Buró. Léelas todas y comenzarás a entender por qué el Guardián no necesita dormir.",
      items: [
        {
          num: "I", tag: "Prueba A",
          title: "El Guardián nunca duerme.",
          body: "Un director de juego IA narra cada escena en tiempo real. Recuerda las cerillas en tu bolsillo, el nombre que le diste al barman y la mentira que contaste hace tres sesiones.",
        },
        {
          num: "II", tag: "Prueba B",
          title: "Los dados no mienten.",
          body: "Un conjunto completo de reglas de CoC 7e funciona bajo el capó. Tira d100 contra tus habilidades en la mesa virtual — el Guardián juzgará en el acto.",
        },
        {
          num: "III", tag: "Prueba C",
          title: "El registro recuerda.",
          body: "Las campañas de varias sesiones persisten entre visitas. Los PNJ guardan rencores, las ubicaciones permanecen alteradas y las cicatrices de tu investigador le siguen al siguiente caso.",
        },
        {
          num: "IV", tag: "Prueba D",
          title: "Voces desde la oscuridad.",
          body: "Cada personaje habla con su propia voz. Los bucles de gramófono ambiental y los paisajes sonoros convierten tu navegador en un salón tenuemente iluminado a las 2 a.m.",
        },
        {
          num: "V", tag: "Prueba E",
          title: "Nunca hay dos partidas iguales.",
          body: "Cada sesión es una investigación nueva. Diferentes elecciones, diferentes sospechosos, diferentes desenlaces. El caso es el mismo — la verdad siempre está en otro lugar.",
        },
        {
          num: "VI", tag: "Prueba F",
          title: "Trae tu grupo.",
          body: "De uno a cuatro investigadores en la misma mesa. Elige roles — detective, erudito, periodista — y deja que el Guardián lleve el control de lesiones, cordura y suerte.",
        },
      ],
    },
    procedure: {
      label: "§ II · Procedimiento",
      heading: ["Cómo se conduce ", "una investigación", "."],
      steps: [
        {
          n: "1", tag: "Admisión",
          title: "Seleccionar expediente",
          body: "Elige un escenario del archivo. Cada uno es una investigación independiente con su propio reglamento, ubicaciones y sospechosos.",
        },
        {
          n: "2", tag: "Reparto",
          title: "Reunir al grupo",
          body: "Nombra a tus investigadores, elige sus roles y sumérgete en la época. El Guardián distribuirá habilidades, equipamiento y secretos.",
        },
        {
          n: "3", tag: "Sesión",
          title: "Comenzar la investigación",
          body: "Habla con los PNJ, registra habitaciones, sigue pistas. Voz o texto — el Guardián te escucha. Tira los dados cuando lo pida, o cuando los nervios te fallen.",
        },
        {
          n: "4", tag: "Archivo",
          title: "Cerrar el caso",
          body: "Cada sesión termina con un resumen escrito en el registro de campaña. Vuelve para otra partida — un enfoque diferente, una verdad diferente.",
        },
      ],
    },
    cases: {
      label: "§ III · El archivo",
      heading: ["Expedientes ", "abiertos."],
      desc: "Dos investigaciones completas a tu disposición. Cada una rejugable — diferentes elecciones llevan a diferentes sospechosos, desenlaces y horrores.",
      files: [
        {
          id: "Expediente № 01 · CoC 7e", badge: "Abierto", badgeSealed: false,
          cls: "case-1",
          title: "La Persecución",
          sub: "Una casa fría en Elm Street.",
          meta: [
            { k: "Sesiones", v: "1" }, { k: "Jugadores", v: "1 – 4" },
            { k: "Tono", v: "Terror clásico" }, { k: "Duración", v: "≈ 3 h" },
          ],
          brief: "La familia Armitage te contrata para certificar la casa Corbitt en Elm Street antes de comprarla. Los inquilinos anteriores se fueron a toda prisa — sus pertenencias siguen dentro. Algo en el sótano las ha estado coleccionando. Y esperando. Cada partida ofrece nuevas rutas: sigue el rastro del sacerdote, investiga la historia del culto o arriesga la sala del ritual en solitario. El final depende de lo que decidas creer.",
          replayable: "Totalmente rejugable · el desenlace cambia con cada enfoque",
          cta: "Abrir expediente",
          stamp: null,
        },
        {
          id: "Expediente № 02 · CoC 7e · Campaña", badge: "Multi-sesión", badgeSealed: true,
          cls: "case-2",
          title: "El Último Telegrama",
          sub: "Cuatro ubicaciones. Un mensaje del más allá.",
          meta: [
            { k: "Sesiones", v: "3 – 5" }, { k: "Jugadores", v: "2 – 4" },
            { k: "Tono", v: "Investigativo" }, { k: "Duración", v: "≈ 12 h" },
          ],
          brief: "A las 22:14 llega un telegrama a la oficina de Arkham. El nombre del remitente está en una lápida a diez kilómetros — enterrado hace once días. El mensaje contiene tres palabras y una referencia de cuadrícula. Una investigación de varias sesiones a través de cuatro ubicaciones: sigue las señales para descubrir quién lo envió, por qué murió y si la respuesta es peor que la ignorancia. Cada partida elige distintos testigos — y paga un precio diferente.",
          replayable: "Campaña · múltiples caminos hacia la verdad",
          cta: "Abrir expediente",
          stamp: "Campaña",
        },
        {
          id: "Expediente № — · En preparación", badge: "Sellado", badgeSealed: true,
          cls: "case-3",
          title: "Las Vestiduras Rojas",
          sub: "Pruebas reunidas. Catalogación en curso.",
          meta: [
            { k: "Sesiones", v: "—" }, { k: "Jugadores", v: "—" },
            { k: "Tono", v: "Ocultismo" }, { k: "Duración", v: "—" },
          ],
          brief: "Una catedral se vacía entre maitines y el ocaso. Sin cuerpos. Sin sangre. Solo un hilo rojo en cada banco. Tres confesionarios sellados desde dentro. El sacristán no puede ser localizado. El Buró aún no acepta investigadores para este caso.",
          replayable: "Próximamente · autorización pendiente",
          cta: null,
          stamp: "Próximamente",
        },
      ],
    },
    testimony: {
      label: "§ IV · Testimonio bajo juramento",
      heading: ["Declaraciones ", "del registro."],
      notes: [
        {
          q: "Jugué cuatro horas. El Guardián recordó que mi personaje tenía miedo al agua desde seis habitaciones atrás y lo usó en mi contra. Mi mujer salió de la cocina a preguntar si estaba bien.",
          name: "J. Harwell",
          role: "Detective · Providence",
        },
        {
          q: "Llevo quince años dirigiendo Cthulhu. Este es el primer Guardián digital que me permitió dejar de dirigir y empezar a jugar.",
          name: "Sra. E. Orne",
          role: "Guardiana veterana · Arkham",
        },
        {
          q: "Jugamos el caso del telegrama dos veces. Distintos sospechosos, distinto final. La segunda vez confiamos a propósito en el hombre equivocado — solo para ver. El Guardián cumplió.",
          name: "Dr. A. Pettigrew",
          role: "Investigador · Kingsport",
        },
      ],
    },
    cta: {
      label: "§ V · Aviso final",
      h1: "El expediente está abierto.",
      h2: "¿Lo leerás?",
      body: "Sin instalación. Sin descarga. Tu navegador es el salón, la máquina de escribir y la puerta. Entra — el Guardián lleva tiempo esperándote.",
      btn: "Entrar al expediente",
    },
    footer: {
      credit1: "© 1929 – 2026 · Barri — Buró de Asuntos Indecibles",
      credit2: "Ningún investigador conocido resultó herido durante la elaboración de este expediente.",
    },
  },
} as const;
