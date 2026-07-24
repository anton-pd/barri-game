import type { ScenarioPlayerLocalization } from '@/types';

type ItemTuple = [id: string, name: string, description: string];
type LocationTuple = [id: string, name: string];

function inventory(items: ItemTuple[]) {
  return items.map(([id, name, description]) => ({ id, name, description }));
}

function locations(items: LocationTuple[]) {
  return items.map(([id, name]) => ({ id, name }));
}

/**
 * English player-facing overlays for legacy/live scenarios whose canonical
 * JSON predates the `localizations.en` field. New scenarios should store this
 * data in their scenario JSON; these entries keep deployed shared-volume
 * scenarios backward compatible.
 */
export const BUILT_IN_ENGLISH_SCENARIO_CONTENT: Record<
  string,
  ScenarioPlayerLocalization
> = {
  'the-haunting': {
    description: "Boston, the 1920s. An inexpensive house on Elm Street has a reputation for sending tenants fleeing in the middle of the night. Its owner asks you to uncover the truth, but nothing human has remained in that truth for a very long time.",
    briefing: {
      setting: "Boston on a cold, rainy evening in the 1920s. Wet stone, grinding streetcars, tobacco smoke, and damp air.",
      premise: "Alex Knott owns an old house on Elm Street that no tenant can endure for more than a few weeks. Its residents flee, fall ill, or lose their minds. Knott hires you to investigate quietly before the newspapers discover the house again.",
      objective: "Find out what is really happening inside the house. Locate the source of the horror and decide whether it can be ended without claiming more victims.",
    },
    rolePresets: [
      {
        id: 'private_investigator',
        name: 'Private Investigator',
        description: 'A former police officer who now takes the cases the authorities prefer to dismiss.',
        background: "You spent ten years with the Boston police before realizing that the worst cases survive only between the lines of official reports. Since opening a small agency, you have made a living investigating what others call superstition. PERK — Tell-Tale Motion: you quickly notice when someone lies through small movements rather than words.",
        inventory: inventory([
          ['revolver', 'Service Revolver', 'A reliable revolver from your police days. It offers a sense of control when the situation provides none.'],
          ['case_notebook', 'Case Notebook', 'A battered notebook in your private shorthand, useful for joining contradictory testimony and finding gaps.'],
          ['skeleton_keys', 'Set of Old Lock Picks', 'An illegal but useful kit for doors and drawers in old Boston houses.'],
        ]),
      },
      {
        id: 'war_nurse',
        name: 'War Nurse',
        description: 'A nurse with front-line experience who recognizes fear before anyone speaks of it.',
        background: "You returned from Europe with hands trained to save lives and eyes that had seen too much. You do not believe in ghosts, but you know trauma, obsession, and the things that break people. PERK — Steady Voice: you can calm a frightened person until they speak more clearly than they intended.",
        inventory: inventory([
          ['medical_case', 'Field Medical Bag', 'Bandages, antiseptic, syringes, and instruments for acting quickly in a crisis.'],
          ['morphine_ampoules', 'Morphine Ampoules', 'For severe pain or traumatic shock. Effective, but dangerous without care.'],
          ['hospital_pass', 'Hospital Credentials', 'Opens certain doors and lends authority when dealing with officials or police.'],
        ]),
      },
      {
        id: 'society_reporter',
        name: 'Society Reporter',
        description: 'A journalist who learned that the loudest scandals often begin inside quiet houses.',
        background: "You cover marriages, inheritances, and scandals for a Boston newspaper while hunting for the story that will make you a serious reporter. Cheap rent, a silent landlord, and tenants fleeing one address smell like a story someone wants buried. PERK — Confessional Tone: you know how to turn a guarded conversation into a confession.",
        inventory: inventory([
          ['press_notebook', "Reporter's Notebook", 'A slim book of addresses and contacts that gives you reason to ask uncomfortable questions.'],
          ['pocket_camera', 'Kodak Pocket Camera', 'A compact camera for evidence you may later need to show an editor or the police.'],
          ['society_invitation', "Invitation to Knott's Charity Gala", "A relic of an earlier society piece that may help you play upon the landlord's vanity."],
        ]),
      },
      {
        id: 'antiquarian',
        name: 'Antiquarian',
        description: 'A dealer in rare objects who knows the scent of genuine age—and when it carries something worse than dust.',
        background: "You buy and sell objects with histories, and sometimes with bad reputations. Experience taught you to separate legend from fraud, except for the few objects that fit neither category. PERK — Wrong for the Room: you immediately notice when an object does not belong to the history of its surroundings.",
        inventory: inventory([
          ['reference_catalogue', 'Catalogue of Occult Symbols', 'Your collection of diagrams, notes, and clippings about ritual marks and amulets.'],
          ['magnifying_lens', "Jeweller's Loupe", 'Reveals engravings, fractures, and concealed marks on small objects.'],
          ['blessed_salt', 'Monastery Salt', 'No guarantee of a miracle, though the protective ritual can give frightened people courage.'],
        ]),
      },
    ],
    locations: locations([
      ['investigators_office', "Investigators' Office"],
      ['elm_street_exterior', 'Elm Street House — Exterior'],
      ['front_parlor', 'Front Parlour'],
      ['upstairs_bedroom', 'Main Bedroom'],
      ['child_nursery', "Former Child's Nursery"],
      ['cellar_shrine', 'Cellar Shrine'],
      ['public_library', 'Boston Public Library'],
    ]),
  },

  'the-black-ledger': {
    description: "In a port city in 1931, people disappear after their names appear in a black ledger taken from a pawnshop. The investigators must discover who keeps the account—and whether a debt measured in something other than money can ever be settled.",
    briefing: {
      setting: "The port city of Arden, 1931. Rain, tram wires, cheap hotels, pawnshops, and presses running through the night.",
      premise: "After moneylender Marek Wolf died, a black ledger vanished from his safe. The following night, three debtors received invoices bearing their own names in ink that never dries.",
      objective: "Find the ledger, understand its rules, and stop the next debt from being collected before dawn.",
    },
    rolePresets: [
      {
        id: 'debt_investigator',
        name: 'Debt Investigator',
        description: 'A former insurance inspector who knows how people lie through receipts and fine print.',
        background: "You spent years investigating insurance fraud and debt agreements before learning that the worst schemes are perfectly legal on paper. In Arden, you are known as the person who reads every line. PERK — Audit: once per scene, ask which detail in a document looks too neat or too new.",
        inventory: inventory([
          ['audit_notebook', "Auditor's Notebook", 'Debt lists, annotations, and fine print for comparing financial evidence.'],
          ['folding_loupe', 'Folding Loupe', 'Useful for examining ink, seals, signatures, and altered documents.'],
          ['service_pistol', 'Old Service Pistol', 'A reliable but noisy argument when negotiations are over.'],
          ['banker_cards', "Bankers' Calling Cards", 'Three contacts who can be spent to gain access to financial records.'],
        ]),
      },
      {
        id: 'night_reporter',
        name: 'Night Reporter',
        description: 'A crime reporter who knows the printing houses better than the police do.',
        background: "You report night fires, disappearances, and miscarriages of justice as though the paper might close tomorrow. Printers admit you among the hot metal and wet pages when you bring coffee and a convincing lie. PERK — Protected Source: turn a rumour into access to a scene by promising someone anonymity.",
        inventory: inventory([
          ['press_camera', 'Pocket Camera', 'Records documents, symbols, and scenes before someone changes or removes them.'],
          ['press_card', 'Night-Shift Press Card', 'Opens doors at the newsroom, morgue, station, or crime scene when used sparingly.'],
          ['carbon_sheets', 'Carbon Paper', 'Can lift an impression from a suspicious page or receipt.'],
          ['silver_flask', 'Flask of Coffee and Rum', 'Gets you through the night or loosens the tongue of someone cold.'],
        ]),
      },
      {
        id: 'former_clerk',
        name: 'Former Archivist',
        description: 'A former city archivist dismissed for finding the wrong file.',
        background: "You remember where the cases that officially never existed were kept. You were dismissed after finding the same signature in documents dated thirty years apart. PERK — Missing Register: in an archive or office, you can identify which register ought to exist even when someone has hidden it.",
        inventory: inventory([
          ['archive_keys', 'Ring of Old Archive Keys', 'Not all still fit, but enough of them do to justify the risk.'],
          ['index_cards', 'Old Case Index Cards', 'Names, dates, and cross-references for archival searches.'],
          ['wax_paper', 'Waxed Paper', 'Can preserve a trace of ink or take the impression of a seal.'],
          ['nerve_drops', 'Nerve Tonic', 'Helps you endure one scene of overwhelming pressure.'],
        ]),
      },
      {
        id: 'street_doctor',
        name: 'Street Doctor',
        description: 'A physician of the night districts who sees what never reaches hospital records.',
        background: "You treat dockworkers, printers, and everyone unable to afford a hospital. Recently, several patients developed ink beneath their fingernails despite never handling paper. PERK — Differential Diagnosis: tell whether a symptom is physical injury, psychological shock, or something only disguised as illness.",
        inventory: inventory([
          ['doctor_bag', "Doctor's Bag", 'Bandages, alcohol, needles, and basic medicine for first aid.'],
          ['sedative_ampoules', 'Sedative Ampoules', 'Temporarily stops panic or tremors without removing their cause.'],
          ['morgue_tag_book', 'Book of Morgue Tags', 'Provides access to bodies and hospital corridors if carried with confidence.'],
          ['black_stain_sample', 'Vial of Black Residue', "A sample from an earlier patient that turns cold near the ledger's pages."],
        ]),
      },
    ],
    locations: locations([
      ['pawnshop_front', "Wolf's Pawnshop — Showroom"],
      ['pawnshop_office', "Marek Wolf's Office"],
      ['boarding_room', "Debtor's Boarding-House Room"],
      ['newspaper_print_room', 'Night Printing House'],
      ['city_archive', 'City Archive'],
      ['tram_depot', 'Harbour Tram Depot'],
      ['old_counting_house', 'Old Counting House'],
    ]),
  },

  'whisper-in-the-well': {
    description: "The Carpathians, 1912. An ethnographic expedition from Lviv arrives in a mountain village to record its songs during the week its old molfar dies. Now the well beyond the village whispers names at dusk, and those it names vanish before morning.",
    briefing: {
      setting: "The Hutsul village of Cheremoshna in the Carpathians, August 1912. Mountains, fog, and a silence burdened with things left unsaid.",
      premise: "Your ethnographic expedition from Lviv came to record songs and customs. Instead, the village greets you with half-empty gatherings: the old molfar died a week ago, and a young shepherd vanished two nights ago. Doors are barred before sunset and salt is scattered across thresholds. No one will discuss the old well outside the village.",
      objective: "Discover what is happening in the village and where the missing people have gone. They may still be saved, but little time remains before the next dusk, and every choice will carry a price.",
    },
    rolePresets: [
      {
        id: 'ethnographer',
        name: 'Ethnographer',
        description: 'A researcher from the Scientific Society in Lviv who came seeking songs and found what the songs refuse to name.',
        background: "You have spent years collecting rituals in mountain villages and learned to hear where folklore ends and genuine belief begins. PERK — Ear for Song: after hearing any fragment of a song or charm once, you remember and reproduce it perfectly.",
        inventory: inventory([
          ['field_journal', 'Field Journal', 'Rituals gathered from dozens of villages; useful when recognizing old customs.'],
          ['phonograph', 'Edison Phonograph', 'A cylinder phonograph that can record and replay any voice.'],
          ['letter_recommendation', 'Letter of Recommendation', 'A Society letter that opens doors and loosens official tongues.'],
        ]),
      },
      {
        id: 'expedition_doctor',
        name: 'Expedition Doctor',
        description: 'A physician who joined the expedition for mountain practice, bringing sober judgement where others see devils.',
        background: "One of the few women in your graduating class, you learned to prove every conclusion twice and check it three times. PERK — Cool Head: once per session, reroll your first failed Sanity check.",
        inventory: inventory([
          ['medical_bag', 'Medical Case', 'Instruments and dressings; restores 2 HP when used.'],
          ['smelling_salts', 'Smelling Salts', 'Revives someone unconscious or frozen with fear; restores 3 Sanity.'],
          ['laudanum', 'Laudanum', 'An opium tincture that induces sleep or dulls pain.'],
        ]),
      },
      {
        id: 'photographer',
        name: 'Photographer',
        description: 'A master of light with a camera of his own, able to see through a lens what the naked eye misses.',
        background: "You have photographed weddings, funerals, and things clients begged you never to show. Plates do not lie, even when you wish they would. PERK — Light Writing: once per session, a developed photograph reveals a detail no one saw directly.",
        inventory: inventory([
          ['camera', 'Plate Camera', 'A folding camera; every exposure becomes evidence once developed.'],
          ['magnesium_flash', 'Magnesium Flash', 'A blinding burst that lights the dark—or blinds whatever waits within it.'],
          ['developing_kit', 'Portable Developing Box', 'Chemicals for developing glass plates in the field.'],
        ]),
      },
      {
        id: 'mountain_guide',
        name: 'Mountain Guide',
        description: 'A local Hutsul hired to lead the expedition through the mountains, born here and mindful of what is never done after sunset.',
        background: "You grew up two ridges away and once drove timber rafts down the Cheremosh. You are an outsider in Cheremoshna but belong to the mountains, and villagers speak differently to you than to visitors from Lviv. PERK — One of Our Own: villagers tell you what they would conceal from the rest of the expedition.",
        inventory: inventory([
          ['bartka', 'Bartka Axe', 'A Hutsul axe: weapon, tool, and mark of status.'],
          ['rope_coil', 'Coil of Rope', 'Thirty metres of good hemp rope.'],
          ['tarred_torches', 'Tarred Torches', 'Torches that burn even in mountain wind.'],
        ]),
      },
    ],
    locations: locations([
      ['village_square', 'Village Square and Church'],
      ['molfar_khata', "Molfar's Cottage"],
      ['polonyna', 'Mountain Meadow'],
      ['old_well', 'Old Well'],
      ['flooded_cave', 'Flooded Cave Beneath the Well'],
    ]),
  },

  'barcelona-stones-of-the-unfinished': {
    description: "Barcelona, 1926. Workers are vanishing from the unfinished Sagrada Família, while symbols absent from every blueprint spread through its stone. The investigators must learn what has awakened beneath Gaudí's foundations before the basilica becomes something else.",
    briefing: {
      setting: "Barcelona, 1926. The unfinished Sagrada Família rises above scaffolds, cranes, limestone dust, and the relentless ring of chisels.",
      premise: "Six workers have vanished from the construction site. New symbols are appearing inside columns that no mason remembers carving, and alterations spread through stone faster than the crews can remove them. Officials call the disappearances accidents; the workers' families know better.",
      objective: "Trace the impossible changes through the basilica, discover what has awakened below its foundations, and stop the unfinished church from completing a design no human architect drew.",
    },
    rolePresets: [
      {
        id: 'architect',
        name: "Architect's Assistant",
        description: "A young architect asked to review the Sagrada Família's plans after a series of 'accidents.'",
        background: "You studied in Madrid and dreamed of working under Gaudí, though the master barely notices you in his workshop. The disappearances brought you onto the site to inspect the unfinished towers. PERK — Architect's Eye: you instantly distinguish stone placed according to the plans from work shaped by another design.",
        inventory: inventory([
          ['blueprints', 'Original Sagrada Família Blueprints', 'Reveal deviations from the approved design at a glance.'],
          ['plumb_line', 'Plumb Line and Measuring Tape', 'Useful when inspecting the structure of walls and columns.'],
          ['field_notebook', 'Sketchbook', 'Captures what you see faster than you can understand it.'],
          ['carbide_lamp', 'Carbide Lamp', 'A steady blue light for vaults and crypts.'],
        ]),
      },
      {
        id: 'journalist',
        name: 'La Vanguardia Reporter',
        description: 'A scandal-hardened journalist digging into the disappearances at the construction site.',
        background: "After five years covering corruption on the docks, your editor assigned you to 'something lighter—the church.' You know the official accident story is false, and the widows will speak to you before they speak to police. PERK — Trusted by the Street: ordinary people trust you faster than authorities or clergy.",
        inventory: inventory([
          ['press_badge', 'Press Credentials', 'Opens institutional doors and attracts attention when you least need it.'],
          ['folding_camera', 'Folding Kodak Camera', 'Sometimes the developed film reveals more than the eye saw.'],
          ['flask', 'Flask of Sherry', 'Loosens the tongues of silent witnesses.'],
          ['archive_key', 'Newspaper Archive Key', "Night access to thirty years of La Vanguardia's files."],
        ]),
      },
      {
        id: 'inspector',
        name: 'Police Inspector',
        description: "A veteran officer ordered to 'quietly close' the case of the missing workers.",
        background: "Twenty years in the Barcelona police taught you when superiors want the truth and when they want silence. This time they demanded silence, but six people are missing and one widow is your former partner's sister. PERK — Reading the Record: you spot lies in reports and recognize when a witness speaks under fear.",
        inventory: inventory([
          ['service_revolver', 'Star Service Revolver', 'Six shots. The last argument.'],
          ['badge', 'Police Badge', 'Makes witnesses speak—or run.'],
          ['case_file', 'Missing-Workers Case File', 'Six names, six dates, and not one body.'],
          ['handcuffs', 'Handcuffs', 'Not everyone you meet will come willingly.'],
        ]),
      },
      {
        id: 'occultist',
        name: 'Occult Researcher',
        description: 'An independent scholar of sacred geometry and ancient Mediterranean cults.',
        background: "You came from a private collection in Marseille to investigate rumours of pre-Christian symbols on the basilica's scaffolds. Your theory is that Gaudí is not a heretic but a witness to something far older than Catholicism. PERK — Dangerous Ornament: you recognize symbols others dismiss as decoration and know which words should not be spoken aloud.",
        inventory: inventory([
          ['symbol_compendium', 'Compendium of Sacred Symbols', 'Compares signs with Phoenician, Cathar, and Gnostic sources.'],
          ['silver_pendant', 'Silver Salt Pendant', 'A family charm whose effectiveness you have never dared test.'],
          ['latin_grimoire', 'Latin Requerimiento', 'A translated exorcism formula from a sixteenth-century Spanish tribunal.'],
          ['chalk', 'Consecrated Chalk', 'For protective circles, though rain washes them away.'],
        ]),
      },
    ],
    locations: locations([
      ['construction_site', 'Sagrada Família Construction Site'],
      ['gaudi_workshop', "Gaudí's Workshop"],
      ['workers_tavern', 'El Vell Port Tavern'],
      ['puig_home', 'Puig Family Home'],
      ['archaeological_museum', 'Barcelona Archaeological Museum'],
      ['chapel_of_assumption', 'Chapel of the Assumption — Lower Level'],
      ['lower_crypt', 'Lower Crypt — Stone of Dagon'],
    ]),
  },

  'catacombs-of-memory': {
    description: "Odesa, 1926, at the height of the New Economic Policy. An entire crew of smugglers vanished in the catacombs beneath Moldavanka, along with their cargo. The only man who crawled back forgot his own name—and how to speak. You are hired to recover the cargo. No one will tell you what it is.",
    briefing: {
      setting: "Odesa, September 1926. Above ground: the NEP, Privoz Market, and beer halls. Below: a limestone darkness no one has ever measured.",
      premise: "A week ago, Madame Tsypa's seven-person smuggling crew vanished beneath Moldavanka with a cargo no one names aloud. The sole survivor crawled out grey-haired, unable to remember his name or speak. Tsypa offers gold if you descend, find her people, and bring back the cargo—or at least the cargo.",
      objective: "Descend, discover what happened to the crew, and decide the cargo's fate. The first rule of the catacombs: count your steps, guard your light, and if you begin to forget, turn back while you still remember the way.",
    },
    rolePresets: [
      {
        id: 'smuggler_guide',
        name: 'Smuggler',
        description: "A Moldavanka native who has crossed the upper tunnels dozens of times. She owes Tsypa, which is why she is here.",
        background: "You carried everything from stockings to morphine through the catacombs. You know the upper marks by heart, but have never gone below the Maw: 'only fools go there—and only once.' PERK — Our Marks: read smugglers' signs without a roll and always know whether a mark is fresh.",
        inventory: inventory([
          ['carbide_lamp', 'Carbide Lamp', 'Bright white light: the greatest treasure underground.'],
          ['chalk_pouch', 'Pouch of Chalk', 'For marking the route. Down here, that means life.'],
          ['fin_knife', 'Finnish Knife', "Moldavanka's quiet argument."],
        ]),
      },
      {
        id: 'ex_officer',
        name: 'Former Staff Captain',
        description: 'An officer without an army or papers, surviving by keeping formation, shooting straight, and refusing to panic.',
        background: "You survived two wars and missed the evacuation that should have saved you. Darkness does not frighten you; forgetting the faces of those you lost does. PERK — Hold the Line: in a moment of panic, your command gives the entire group a bonus on its next Sanity check.",
        inventory: inventory([
          ['mauser', 'Mauser Pistol', 'An immaculate officer’s weapon with ten rounds.'],
          ['trench_spade', 'Entrenching Tool', 'A sharpened tool and weapon.'],
          ['medal_photo', 'Platoon Photograph', 'Twenty-three faces from the war that you can still name.'],
        ]),
      },
      {
        id: 'cartographer',
        name: 'Cartographer',
        description: "A city archivist obsessed with the blank spaces beneath Odesa—and the only person who copied Yarchuk's map.",
        background: "For years you assembled quarry plans, court cases, and missing-person reports. You draw from the memory of your hand rather than your mind, a habit the darkness cannot easily steal. PERK — The Hand Remembers: once per scene, restore an erased detail of the route from your maps or notes.",
        inventory: inventory([
          ['yarchuk_copy', "Copy of Yarchuk's Map", "The only chart of the deep levels; its lowest third ends at the word 'core.'"],
          ['field_desk', 'Survey Board and Instruments', 'Compass, curvimeter, and pencils for underground navigation.'],
          ['string_ball', 'Ball of Twine', 'Three hundred metres: the oldest and most reliable way not to become lost.'],
        ]),
      },
      {
        id: 'psychiatrist',
        name: 'Psychiatrist',
        description: 'A doctor from the Slobidka clinic where Silent Senya was taken, entering the catacombs for a diagnosis rather than cargo.',
        background: "You have treated shell shock, aphasia, and amnesia, but never language erased while the hand stayed steady and the eyes remained clear. Senya is the kind of case that ruins a career or puts a name in textbooks. PERK — Case History: once per scene, determine exactly what a person has forgotten and whether it can be restored.",
        inventory: inventory([
          ['doctor_bag', "Doctor's Case", 'Instruments and morphine; restores 2 HP when used.'],
          ['senya_sketchbook', "Senya's Sketchbook", "The patient's bound drawings: spirals, silhouettes, and perhaps a route."],
          ['ammonia_vial', 'Smelling Salts', 'Snaps someone awake and restores 2 Sanity.'],
        ]),
      },
    ],
    locations: locations([
      ['two_karls_tavern', 'Two Karls Tea House'],
      ['upper_galleries', 'Upper Galleries'],
      ['smugglers_depot', "Smugglers' Camp"],
      ['erased_gallery', 'Erased Gallery'],
      ['nacre_chamber', 'Nacre Chamber'],
    ]),
  },

  'barrows-dont-sleep': {
    description: "The Poltava steppe, summer 1928. An archaeological expedition excavates Lysa Mohyla, a barrow that nearby villages have ploughed around for centuries without ever touching. Beneath the Scythian gold there are no bones. There is only what the gold was holding down. A three-evening campaign.",
    briefing: {
      setting: "The Poltava steppe near the village of Krasnosillia, July 1928. Heat, the coming harvest, and a barrow visible from every yard.",
      premise: "Professor Rohovtsev's expedition is excavating Lysa Mohyla, a barrow encircled every spring by a closed furrow 'because it must be.' Five golden discs have already been removed. Since then the dogs have fallen silent, wells are drying, rye blackens in spirals, and villagers dream of the steppe from a bird's height. Yesterday a living man withered to a husk in the trench within minutes. Officially: sunstroke. The village says the barrow is waking.",
      objective: "Discover what Lysa Mohyla contains, why the circular furrow and golden suns matter, and make a choice before the seventh sun is removed. This campaign lasts three evenings; time advances, and every day without a decision has a cost.",
    },
    rolePresets: [
      {
        id: 'junior_archaeologist',
        name: 'Junior Archaeologist',
        description: 'The second postgraduate on the expedition and its latest arrival—the only scholar who has not yet signed any official record.',
        background: "You trained in Leningrad under the school that publicly demolished Rohovtsev's work last year, and were sent here 'for objectivity.' You read each layer of earth like a page. PERK — Stratigraphy: once per scene, determine the exact age and burial sequence of anything interred without a roll.",
        inventory: inventory([
          ['field_tools', 'Excavation Kit', 'Knives, brushes, and trowels for exposing a find without damaging it.'],
          ['reference_plates', 'Atlas of Antiquities', 'Reference plates of ornaments and dates for identifying finds.'],
          ['leningrad_mandate', 'Academy Mandate', "A stamped order to 'assist in every way,' effective even on Professor Rohovtsev."],
        ]),
      },
      {
        id: 'expedition_photographer',
        name: 'Expedition Photographer',
        description: 'Hired by the Academy to document the dig; her plates are the only objective witnesses to what is happening—for now.',
        background: "You photographed the front, famine, and congresses, learning to see through a viewfinder what others refuse to see. Rohovtsev has already rejected two plates from the excavation, so you print secret duplicates. PERK — Second Plate: once per session, one photograph captures a detail invisible to the eye.",
        inventory: inventory([
          ['camera_steppe', 'Tripod Camera', 'An expedition camera; every frame becomes a document.'],
          ['rejected_plates', 'Rejected Plates', 'Photographs Rohovtsev ordered destroyed: evidence that the dig journal was falsified.'],
          ['red_lamp', 'Red Darkroom Lamp', 'For developing plates—and the only light in which the wrong shadows disappear.'],
        ]),
      },
      {
        id: 'feldsher_steppe',
        name: 'Rural Feldsher',
        description: "A medical practitioner serving three villages, called to a supposed sunstroke and the first person to write the truth before tearing it up.",
        background: "You have crossed every mile of the steppe delivering babies, draining wounds, and burying the dead. The worker from the dig was the first body for which you could not write a cause: a living person cannot dehydrate in twelve minutes. PERK — Country Practice: village NPCs trust you and answer your first question honestly.",
        inventory: inventory([
          ['medbag_steppe', "Feldsher's Bag", 'Instruments, bandages, and camphor; restores 2 HP when used.'],
          ['horse_steppe', 'Sirko the Horse', "A hardy steppe horse that turns a day's journey into half a day."],
          ['true_report', 'Torn Medical Report', 'A reconstructed examination record with the true figures—dangerous evidence in the right hands.'],
        ]),
      },
      {
        id: 'coop_inspector',
        name: 'Cooperative Inspector',
        description: 'A district cooperative inspector reviewing the collective before harvest, with papers that open every door and orders to notice nothing unusual.',
        background: "Ten years counting other people's grain taught you that numbers do not lie—ledgers do. Bondarenko's records show something stranger than theft: the grain remains, but its weight vanishes. PERK — Audit: once per scene, find the discrepancy in any paperwork and what it conceals.",
        inventory: inventory([
          ['inspector_papers', "Inspector's Credentials", 'Opens the village council, storehouse, smithy, and official mouths.'],
          ['abacus_files', 'Portfolio of Statements', 'Three years of cooperative records for finding discrepancies.'],
          ['district_telephone', 'District Telephone Authority', 'One call can start or stop a single official intervention.'],
        ]),
      },
      {
        id: 'kobzar',
        name: 'Kobzar',
        description: "A travelling bard led to Krasnosillia by an unfinished duma. Blind in one eye, he sees more than most sighted people.",
        background: "For forty years you have carried songs across the steppe, including three never sung at fairs: of a breathing grave, ploughmen linked by belts, and seven suns 'not in the sky.' The old kobzars taught that these are instructions, not songs. PERK — The Duma Knows: once per scene, your song offers a clue about the barrow's rules.",
        inventory: inventory([
          ['bandura', 'Kobza', 'An old cherrywood instrument under whose music even wary villagers speak.'],
          ['three_dumas', 'Three Unfinished Dumas', 'An inherited memory of the grave, the ploughmen, and seven suns—the rite revealed verse by verse.'],
          ['red_wool_skein', 'Skein of Red Wool', "A fortune-teller's gift; a thread around the wrist turns aside the gaze of dreams."],
        ]),
      },
    ],
    locations: locations([
      ['dig_camp', 'Expedition Camp'],
      ['excavation_trench', 'Excavation Trench'],
      ['burial_chamber', 'Central Chamber'],
      ['village_street', 'Krasnosillia Street and Square'],
      ['smithy', "Ostap's Smithy"],
      ['panas_khata', "Grandfather Panas's Cottage"],
      ['kylyna_khata', "Widow Kylyna's Cottage"],
      ['circle_field', 'Encircling Furrow'],
      ['night_steppe', 'Steppe at Night'],
    ]),
  },

  'shadows-over-dnipro': {
    description: "Kyiv, 1921. Bodies are being pulled from the Dnipro at Podil with dry lungs and smiles on their faces. The trail runs from a fishing cooperative that pays a 'water tithe' to an island village upstream—and a flooded monastery where something sleeps beneath black water, still receiving the offerings carried to it for centuries. A three-evening campaign.",
    briefing: {
      setting: "Kyiv, August 1921. After years of war, the city lives by the river: the Dnipro feeds, carries—and has begun collecting old debts.",
      premise: "Five drowned bodies have surfaced in a month, each with dry lungs and a smile. The militia closed the cases, the morgue has been pressured into silence, and Podil whispers that the dead visit their families at night, wet and gentle. Investigator Derii seeks people willing to follow the thread unofficially. It leads to a fishing cooperative, an island village upstream, and then beneath the water.",
      objective: "Discover the source of the smiling drowned, learn what Podil pays for the river's peace, and decide what to do with the thing awakening below a flooded monastery. This campaign lasts three evenings; every choice pulls the next one behind it.",
    },
    rolePresets: [
      {
        id: 'criminal_investigator',
        name: 'Criminal Investigator',
        description: "Derii's colleague from criminal investigation—officially on leave, unofficially pursuing a case that does not exist.",
        background: "You served in criminal investigation before the revolution and survived every government because each one needed you. You do not fear the dead; you fear the living who make them. This case breaks both habits. PERK — Reconstruction: once per scene, read the traces and have the Curator describe what happened without a roll.",
        inventory: inventory([
          ['nagant_ci', 'Nagant Revolver', 'A service revolver with seven rounds.'],
          ['badge_ci', 'Criminal Investigation Credentials', 'Opens doors and closes mouths until someone checks with your superiors.'],
          ['case_folder', 'Drowned-Persons File', "Copies of reports from five cases that 'do not exist,' useful for finding links among the victims."],
        ]),
      },
      {
        id: 'journalist_visti',
        name: 'Journalist',
        description: "A reporter for Kyiv's Visti who began with a short item about a drowned man and could not stop digging.",
        background: "You publish under a man's name because that is what editors print. You can draw out a tavern keeper, docker, or widow in the language each trusts. PERK — A Friend Nearby: once per Podil location, recall a local contact who saw something useful.",
        inventory: inventory([
          ['press_pass_v', 'Visti Press Card', 'When doors stay closed, it helps you talk your way through them.'],
          ['notebook_v', "Reporter's Notebook", 'A month of Podil rumours, names, and cross-references.'],
          ['bribe_stash', 'Bribe Purse', 'Small coins, sugar, and cigarettes—the currencies of 1921.'],
        ]),
      },
      {
        id: 'ship_mechanic',
        name: 'Ship Mechanic',
        description: 'A Dnipro steamship mechanic who knows the river from its engine rooms and must now learn its other face.',
        background: "Twenty years on the Dnipro taught you every shoal from Kyiv to the rapids and every river tale, all of which you called lies. Last month a stoker left your steamer smiling; he did not fall—he stepped overboard. PERK — Mechanical Heart: understand any mechanism by touch and make technical checks without a roll.",
        inventory: inventory([
          ['wrench_big', 'Adjustable Wrench', 'A heavy tool and an equally heavy argument.'],
          ['diving_rig', 'Homemade Diving Rig', 'A pump-fed helmet that permits up to half an hour of underwater work.'],
          ['boat_keys', 'Service Launch Keys', "A steamship-company launch faster than any cooperative boat."],
        ]),
      },
      {
        id: 'folklorist',
        name: 'Ethnographer and Folklorist',
        description: 'An Academy researcher collecting Dnipro legends—and the first to notice that new Podil rumours are old stories coming alive.',
        background: "Your dissertation called water spirits and rusalkas survivals of animism—until records from 1845 matched case reports from 1921 exactly. Now you are writing a different study and hoping to finish it. PERK — Old Tales: once per scene, recognize a folkloric pattern and learn whether it reveals one of the river god's rules.",
        inventory: inventory([
          ['legend_archive', 'Legend Index', 'Three centuries of notes on water spirits, the Taken, and submerged churches.'],
          ['acad_letter', 'Academy of Sciences Letter', 'Opens archives, consistories, and offices while official paper still commands respect.'],
          ['silver_cross_old', 'Old Silver Cross', 'Recovered from a flooded village; the Taken will not touch its bearer once.'],
        ]),
      },
      {
        id: 'feldsher',
        name: 'Feldsher',
        description: 'A medical practitioner from the Podil clinic who treats the docks and Kurenivka—and first heard about the visitors who come at night.',
        background: "You survived typhus, hunger, and three governments with the same medical bag. Patients tell you what they would never tell priest or militia, and their stories have kept you awake for a month. PERK — Trusted in Podil: after treating a wounded or terrified NPC, they answer one question honestly.",
        inventory: inventory([
          ['medbag_f', "Feldsher's Bag", 'Bandages, iodine, and instruments; restores 2 HP when used.'],
          ['patient_log', 'Patient Call Register', "A record of who fell ill, vanished, or received a 'visitor'—a map of the strange in Podil."],
          ['veronal', 'Veronal', 'A sleeping draught that can quiet someone or earn the gratitude of an exhausted witness.'],
        ]),
      },
    ],
    locations: locations([
      ['podil_docks', 'Podil Docks'],
      ['morgue', 'City Morgue'],
      ['artel_office', 'Dnipro Wave Cooperative Office'],
      ['pid_bakenom_tavern', 'Under the Beacon Tavern'],
      ['horpyna_pier', "Horpyna's Landing"],
      ['tykhyi_pier', 'Tykhyi Island Pier'],
      ['shrine_oak', 'Shrine Oak'],
      ['musiy_house', "Elder Musii's Cottage"],
      ['flooded_monastery', 'Flooded Monastery'],
      ['crypt', 'Underwater Crypt'],
    ]),
  },

  'the-last-reel': {
    description: "Kyiv, November 1918. The city lives between governments, under curfew and failing electric light. The Illusion cinema on Khreshchatyk screens a film no studio ever made at midnight—and members of the audience recognize people in its frames who die within the week.",
    briefing: {
      setting: "Kyiv, November 1918. Governments change faster than theatre bills; evenings bring curfew and blacked-out windows.",
      premise: "The Illusion cinema shows a midnight film made by no known studio. People say the audience recognizes living men and women in its frames, who die within a week exactly as the film showed. The projectionist vanished during a screening. A film canister reaches you with a note: 'Do not watch alone. Count who is in the hall.'",
      objective: "Discover what the film is, where it comes from, and what happened to the projectionist. Stop the screenings—if that is possible—before the film shows one of you.",
    },
    rolePresets: [
      {
        id: 'reporter',
        name: 'Reporter',
        description: "A crime reporter for Last News who writes about deaths—and first noticed that they had begun to rhyme.",
        background: "For three years you have chronicled a city where the government changes every week. Your death index has become an unofficial police archive. PERK — Chronicle: once per session, recall a newspaper fact connecting two apparently separate events.",
        inventory: inventory([
          ['press_card', 'Press Credentials', 'Opens the doors that still function; every government needs a press eventually.'],
          ['death_files', 'Death Index', 'Six months of clippings and notes, useful when checking coincidences.'],
          ['flask_spirit', 'Flask of Spirits', 'Loosens tongues and disinfects wounds, one swallow at a time.'],
        ]),
      },
      {
        id: 'projectionist_engineer',
        name: 'Projectionist',
        description: "A mechanic from another cinema who trained with Arkadii, knows projectors to the last screw, and knows his friend was not mad.",
        background: "You have run film since the travelling fairground shows. A month ago Arkadii wrote: 'Come. I assembled something that must not be assembled.' You arrived too late. PERK — To the Last Screw: understand the technical truth of any mechanism or strip of film after one inspection.",
        inventory: inventory([
          ['tool_roll', 'Roll of Tools', 'Screwdrivers, pliers, and oil for dismantling and rebuilding any projector.'],
          ['splice_kit', 'Film-Splicing Kit', 'Glue, press, and razor for removing—or inserting—a frame.'],
          ['arkadii_letter', "Arkadii's Letter", "Your friend's final note: dates, hints, and the line 'count who is in the hall.'"],
        ]),
      },
      {
        id: 'retired_detective',
        name: 'Retired Detective',
        description: 'A former detective of a police force that no longer exists, in a city that still needs investigators.',
        background: "You served in criminal investigation until 1917 and now take private cases involving disappearances and blackmail. Solomiia Lange hired you to find the projectionist without saying why. PERK — Old Connections: despite three changes of government, you still know whom to ask, bribe, or trust.",
        inventory: inventory([
          ['nagant', 'Nagant Revolver', "A seven-shot service weapon you 'forgot' to surrender."],
          ['old_badge', 'Old Detective Badge', 'The government is gone, but the reflex remains in anyone old enough to remember it.'],
          ['lockpick_set', 'Lock Picks', 'Confiscated during an old case and good for simple locks.'],
        ]),
      },
      {
        id: 'false_medium',
        name: 'Medium',
        description: "A Lipky salon spiritualist who made a living staging other people's grief until the performances became real.",
        background: "Table-rapping is your trade: you are a keen psychologist and an honest fraud. During the last month candles began dying without your tricks, and the 'voices' all speak of the same cinema. PERK — Sensitive: you sense the Watcher's presence one round before anyone else.",
        inventory: inventory([
          ['seance_kit', 'Séance Props', 'Candles, a bell, and planchette for a performance—or for what is no longer performance.'],
          ['client_book', 'Client Book', "Half of wealthy Kyiv, indexed by fear and secret."],
          ['silver_mirror', 'Silver Hand Mirror', "Your grandmother's; the voices refuse to appear in it."],
        ]),
      },
    ],
    locations: locations([
      ['cinema_hall', 'Illusion Cinema Auditorium'],
      ['projection_booth', 'Projection Booth'],
      ['arkadii_flat', "Arkadii's Podil Flat"],
      ['korvin_shop', "Korvin's Antiquities Shop"],
      ['flooded_basement', "Illusion Cinema's Flooded Basement"],
    ]),
  },

  'the-last-telegram': {
    description: "Boston, November 1923. After a retired telegraph operator dies, telegrams asking for help continue to arrive at his address. Whatever is speaking through the wires is learning human language faster than anyone can understand its purpose.",
    briefing: {
      setting: "Boston on a raw November morning. Rain will not stop, telegraph wires sing in the wind, and damp cold works beneath every collar.",
      premise: "Each of you received an anonymous telegram asking you to come to Kowalska's boarding house in the South End and save Edgar Whitmore. When you arrive, Whitmore is dead, his room is locked from within, and police are hurrying to call it natural causes. Yet the telegraph keeps working, and new messages arrive after the official time of death.",
      objective: "Discover what Whitmore found in his experiments, who or what is answering through his equipment, and decide whether the channel should be closed, used, or simply survived.",
    },
    rolePresets: [
      {
        id: 'private_investigator',
        name: 'Private Investigator',
        description: 'A former detective with a keen sense for official explanations that are far too convenient.',
        background: "You left the force after several major cases were closed by pressure rather than truth. Whitmore's telegram caught you because it sounded like the final plea of someone no one believed in time. PERK — Timeline: quickly assemble a sequence of events from fragments even when witnesses contradict one another.",
        inventory: inventory([
          ['service_revolver', 'Service Revolver', 'An old, well-maintained weapon that helps you remain calm when a room begins behaving incorrectly.'],
          ['case_file_wallet', 'Leather Case Wallet', 'Notes, calling cards, and blank forms that make you look more official than you are.'],
          ['evidence_tags', 'Evidence Tags', 'Paper labels that keep small but important discoveries from vanishing into the confusion.'],
        ]),
      },
      {
        id: 'telegraph_operator',
        name: 'Telegraph Operator',
        description: 'A communications operator who hears more than routine code in the rhythm of Morse.',
        background: "Six years on the network taught you the difference between ordinary line trouble and something strange. Whitmore once helped you solve an impossible technical fault and treated signals almost like living things. PERK — Second Meaning: instantly recognize a hidden pattern or double message in a transmission's rhythm.",
        inventory: inventory([
          ['signal_notebook', 'Signal Notebook', 'Codes, abbreviations, and your observations about strange noise on the network.'],
          ['coil_tester', 'Pocket Coil Tester', 'A small instrument for checking contacts and power.'],
          ['insulated_gloves', 'Rubber Gloves', "Work gloves that protect against burns—and sometimes against direct contact with someone else's circuit."],
        ]),
      },
      {
        id: 'field_doctor',
        name: 'Field Doctor',
        description: 'A physician who has seen the human mind break under things the body cannot yet explain.',
        background: "You returned to Boston after the war convinced that fear has a biology, even when people call it mysticism. Whitmore's death resembles recent cases of paralysis, collapse, and heart failure without a clear cause. PERK — Genuine Shock: quickly distinguish trauma from deceit or theatrical hysteria.",
        inventory: inventory([
          ['doctor_bag', "Doctor's Case", 'Instruments, bandages, and medicine for emergency treatment.'],
          ['sedative_vials', 'Sedative Vials', 'Provide a few quiet minutes when panic makes examination or conversation impossible.'],
          ['morgue_authorization', 'Morgue Access Letter', 'A friendly pathologist’s signature opens extra doors and reassures attendants.'],
        ]),
      },
      {
        id: 'crime_reporter',
        name: 'Crime Reporter',
        description: 'A journalist who has seen enough of Boston at night to distrust simple explanations.',
        background: "Years covering murders, accidents, and disappearances taught you to hear the hole in a police report. Telegrams arriving after the recipient's death are either a brilliant fraud or the story that will outlive you. PERK — Rumour Network: identify the person through whom a city's rumours are flowing before anyone gives you a name.",
        inventory: inventory([
          ['press_camera', 'Graflex Press Camera', 'Heavy, but it produces evidence no one can dismiss as gossip.'],
          ['contact_rollodex', 'Contact File', 'Police, archivists, morgue workers, dispatchers, and a few people who owe you favours.'],
          ['night_press_pass', 'Night Press Pass', 'A reason to ask questions where an ordinary citizen would be thrown out.'],
        ]),
      },
      {
        id: 'electrical_lecturer',
        name: 'Electrical Engineering Lecturer',
        description: 'A scientist for whom a strange signal is not proof of the occult, but a reason to investigate more deeply.',
        background: "You lecture on current, resonance, and signal transmission while privately collecting reports from the border between science and obsession. Months ago Whitmore asked whether a signal could leave a trace in the human mind; you did not answer in time. PERK — Practical Theory: turn a complex electrical phenomenon into a simple plan under pressure.",
        inventory: inventory([
          ['field_diagrams', 'Field-Diagram Portfolio', 'Formulae and drawings concerning shielding, grounding, and unstable circuits.'],
          ['copper_wire_spool', 'Spool of Copper Wire', 'Useful for a temporary defence or a dangerous improvisation.'],
          ['portable_multimeter', 'Portable Meter', 'A simple instrument for checking whether electricity is still behaving like electricity.'],
        ]),
      },
    ],
    locations: locations([
      ['boarding_house', "Kowalska's Boarding House"],
      ['whitmores_room', "Whitmore's Room"],
      ['city_morgue', 'City Morgue'],
      ['telegraph_exchange', 'Boston Telegraph Exchange'],
      ['public_library', 'Boston Public Library'],
      ['evening_courier_archive', 'Evening Courier Archive'],
      ['szabo_apartment', "Szabo's Apartment"],
      ['harbor_relay_station', 'Abandoned Harbour Relay Station'],
    ]),
  },
};
