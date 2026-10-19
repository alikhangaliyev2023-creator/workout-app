// База упражнений для зала.
//
// pattern — «тип движения». План собирается из типов движений (например, «горизонтальный жим»),
//           а под каждый тип подбирается конкретное упражнение. Так упражнение легко заменить
//           на другое того же типа.
// type    — "compound" (базовое, несколько суставов) или "isolation" (изолирующее).
// avoid   — при каких проблемах упражнение лучше не делать: "shoulders", "knees", "lowback".
// muscles — какие мышцы работают (ключи из MUSCLES).

export const MUSCLES = {
  chest: "Грудь",
  back: "Спина",
  shoulders: "Плечи",
  arms: "Руки",
  legs: "Ноги",
  glutes: "Ягодицы",
  core: "Пресс",
};

export const PATTERNS = {
  squat: "Приседания",
  hinge: "Тяга / наклоны",
  lunge: "Выпады",
  legcurl: "Задняя поверхность бедра",
  legext: "Передняя поверхность бедра",
  calves: "Икры",
  hpress: "Жим лёжа",
  ipress: "Жим на наклонной",
  vpress: "Жим над головой",
  hpull: "Горизонтальная тяга",
  vpull: "Вертикальная тяга",
  fly: "Сведения на грудь",
  lateral: "Средняя дельта",
  reardelt: "Задняя дельта",
  biceps: "Бицепс",
  triceps: "Трицепс",
  core: "Пресс",
  cardio: "Кардио",
};

export const EXERCISES = [
  // ---------- Ноги ----------
  { id: "back_squat", name: "Приседания со штангой", pattern: "squat", type: "compound", muscles: ["legs", "glutes"], avoid: ["knees", "lowback"],
    tip: "Штанга на трапециях, колени идут по направлению носков, спина ровная. Опускайся до параллели бедра с полом или чуть ниже." },
  { id: "hack_squat", name: "Гакк-приседания", pattern: "squat", type: "compound", muscles: ["legs"], avoid: ["knees"],
    tip: "Спина плотно прижата к спинке, стопы на ширине плеч. Опускайся подконтрольно, внизу без пауз и «отбива»." },
  { id: "leg_press", name: "Жим ногами", pattern: "squat", type: "compound", muscles: ["legs", "glutes"], avoid: [],
    tip: "Поясница прижата к спинке. Опускай платформу, пока таз не начнёт отрываться. Колени не выпрямляй до щелчка." },
  { id: "goblet_squat", name: "Приседания с гантелью у груди", pattern: "squat", type: "compound", muscles: ["legs", "glutes"], avoid: [],
    tip: "Держи гантель у груди, локти между коленями. Корпус вертикальный — бережёт поясницу." },

  { id: "rdl", name: "Румынская тяга", pattern: "hinge", type: "compound", muscles: ["legs", "glutes", "back"], avoid: ["lowback"],
    tip: "Ноги чуть согнуты, таз уводи назад, гриф скользит по бёдрам. Опускайся до растяжения задней поверхности бедра." },
  { id: "deadlift", name: "Становая тяга", pattern: "hinge", type: "compound", muscles: ["back", "legs", "glutes"], avoid: ["lowback"],
    tip: "Гриф над серединой стопы, спина прямая, тянешь за счёт ног и таза. Не округляй поясницу." },
  { id: "hip_thrust", name: "Ягодичный мост со штангой", pattern: "hinge", type: "compound", muscles: ["glutes", "legs"], avoid: [],
    tip: "Лопатки на скамье, подбородок к груди. Вверху сожми ягодицы и задержись на секунду." },
  { id: "back_ext", name: "Гиперэкстензия", pattern: "hinge", type: "isolation", muscles: ["glutes", "back"], avoid: [],
    tip: "Поднимайся до прямой линии корпуса, не прогибайся выше. Можно держать блин у груди." },

  { id: "bulgarian", name: "Болгарские выпады", pattern: "lunge", type: "compound", muscles: ["legs", "glutes"], avoid: ["knees"],
    tip: "Задняя нога на скамье, корпус чуть наклонён вперёд. Колено передней ноги не заваливай внутрь." },
  { id: "db_lunge", name: "Выпады с гантелями", pattern: "lunge", type: "compound", muscles: ["legs", "glutes"], avoid: ["knees"],
    tip: "Широкий шаг, оба колена сгибаются примерно до 90°. Отталкивайся пяткой передней ноги." },
  { id: "step_up", name: "Зашагивания на платформу", pattern: "lunge", type: "compound", muscles: ["legs", "glutes"], avoid: [],
    tip: "Вся стопа на платформе, поднимайся за счёт передней ноги, не отталкивайся задней." },

  { id: "lying_curl", name: "Сгибания ног лёжа", pattern: "legcurl", type: "isolation", muscles: ["legs"], avoid: [],
    tip: "Таз прижат к скамье. Внизу не разгибай ноги полностью — держи напряжение." },
  { id: "seated_curl", name: "Сгибания ног сидя", pattern: "legcurl", type: "isolation", muscles: ["legs"], avoid: [],
    tip: "Наклонись чуть вперёд — так бицепс бедра растягивается сильнее и лучше растёт." },

  { id: "leg_ext", name: "Разгибания ног", pattern: "legext", type: "isolation", muscles: ["legs"], avoid: ["knees"],
    tip: "Вверху задержись на секунду, опускай медленно, за 2–3 секунды." },
  { id: "sissy_machine", name: "Разгибания ног одной ногой", pattern: "legext", type: "isolation", muscles: ["legs"], avoid: ["knees"],
    tip: "Работай каждой ногой отдельно с лёгким весом — помогает выровнять силу ног." },

  { id: "standing_calf", name: "Подъёмы на носки стоя", pattern: "calves", type: "isolation", muscles: ["legs"], avoid: [],
    tip: "Опускай пятки максимально вниз, вверху пауза 1 секунда. Без пружинящих движений." },
  { id: "seated_calf", name: "Подъёмы на носки сидя", pattern: "calves", type: "isolation", muscles: ["legs"], avoid: [],
    tip: "Полная амплитуда и медленное опускание — икрам нужна растяжка под нагрузкой." },

  // ---------- Грудь ----------
  { id: "bench", name: "Жим штанги лёжа", pattern: "hpress", type: "compound", muscles: ["chest", "arms", "shoulders"], avoid: ["shoulders"],
    tip: "Лопатки сведены, ноги упираются в пол. Опускай гриф на низ груди, локти под углом ~45° к корпусу." },
  { id: "db_bench", name: "Жим гантелей лёжа", pattern: "hpress", type: "compound", muscles: ["chest", "arms", "shoulders"], avoid: [],
    tip: "Опускай гантели до растяжения груди, вверху не стукай их друг о друга." },
  { id: "machine_press", name: "Жим в тренажёре на грудь", pattern: "hpress", type: "compound", muscles: ["chest", "arms"], avoid: [],
    tip: "Рукояти на уровне середины груди, лопатки прижаты к спинке." },

  { id: "incline_db", name: "Жим гантелей на наклонной скамье", pattern: "ipress", type: "compound", muscles: ["chest", "shoulders", "arms"], avoid: [],
    tip: "Угол скамьи 30°. Опускай гантели к верху груди, локти чуть ниже плеч." },
  { id: "incline_bench", name: "Жим штанги на наклонной скамье", pattern: "ipress", type: "compound", muscles: ["chest", "shoulders", "arms"], avoid: ["shoulders"],
    tip: "Угол 30°, гриф опускай на верх груди, лопатки сведены." },
  { id: "incline_machine", name: "Жим в тренажёре на верх груди", pattern: "ipress", type: "compound", muscles: ["chest", "shoulders"], avoid: [],
    tip: "Спокойный темп, полная амплитуда, вверху руки не выпрямляй до упора." },

  { id: "cable_fly", name: "Сведения рук в кроссовере", pattern: "fly", type: "isolation", muscles: ["chest"], avoid: [],
    tip: "Руки чуть согнуты и не меняют угол. Своди перед собой, будто обнимаешь бочку." },
  { id: "pec_deck", name: "Сведения в тренажёре «бабочка»", pattern: "fly", type: "isolation", muscles: ["chest"], avoid: [],
    tip: "Плечи опущены, не дай им подниматься к ушам. В точке сведения пауза." },

  // ---------- Плечи ----------
  { id: "ohp", name: "Жим штанги стоя", pattern: "vpress", type: "compound", muscles: ["shoulders", "arms"], avoid: ["shoulders", "lowback"],
    tip: "Ягодицы и пресс напряжены, не прогибайся в пояснице. Гриф идёт вертикально мимо лица." },
  { id: "db_shoulder", name: "Жим гантелей сидя", pattern: "vpress", type: "compound", muscles: ["shoulders", "arms"], avoid: ["shoulders"],
    tip: "Спинка почти вертикально, локти чуть впереди корпуса. Опускай гантели до уровня ушей." },
  { id: "machine_shoulder", name: "Жим в тренажёре на плечи", pattern: "vpress", type: "compound", muscles: ["shoulders", "arms"], avoid: [],
    tip: "Подбери сиденье так, чтобы рукояти были на уровне плеч. Спокойный темп." },

  { id: "lateral_raise", name: "Махи гантелями в стороны", pattern: "lateral", type: "isolation", muscles: ["shoulders"], avoid: [],
    tip: "Небольшой вес, поднимай до уровня плеч, мизинец чуть выше большого пальца. Без раскачки." },
  { id: "cable_lateral", name: "Махи в стороны на блоке", pattern: "lateral", type: "isolation", muscles: ["shoulders"], avoid: [],
    tip: "Одной рукой, трос идёт за спиной или перед собой. Блок держит нагрузку по всей амплитуде." },

  { id: "rear_fly", name: "Разведения на заднюю дельту в тренажёре", pattern: "reardelt", type: "isolation", muscles: ["shoulders", "back"], avoid: [],
    tip: "Руки почти прямые, разводи в стороны за счёт плеч, а не лопаток." },
  { id: "face_pull", name: "Тяга каната к лицу", pattern: "reardelt", type: "isolation", muscles: ["shoulders", "back"], avoid: [],
    tip: "Тяни канат к глазам, разводя концы в стороны. Полезно для здоровья плеч." },

  // ---------- Спина ----------
  { id: "barbell_row", name: "Тяга штанги в наклоне", pattern: "hpull", type: "compound", muscles: ["back", "arms"], avoid: ["lowback"],
    tip: "Наклон ~45°, спина ровная. Тяни гриф к низу живота, сводя лопатки." },
  { id: "chest_row", name: "Тяга в тренажёре с упором в грудь", pattern: "hpull", type: "compound", muscles: ["back", "arms"], avoid: [],
    tip: "Грудь прижата к упору — поясница отдыхает. Тяни локтями назад, в конце сведи лопатки." },
  { id: "db_row", name: "Тяга гантели одной рукой", pattern: "hpull", type: "compound", muscles: ["back", "arms"], avoid: [],
    tip: "Упор рукой и коленом в скамью. Тяни гантель к поясу, а не к груди." },
  { id: "cable_row", name: "Тяга горизонтального блока", pattern: "hpull", type: "compound", muscles: ["back", "arms"], avoid: [],
    tip: "Корпус почти неподвижен, тяни рукоять к животу, плечи опущены." },

  { id: "pullup", name: "Подтягивания", pattern: "vpull", type: "compound", muscles: ["back", "arms"], avoid: [],
    tip: "Хват чуть шире плеч. Тянись грудью к перекладине, внизу полностью выпрямляй руки. Если легко — добавь вес на пояс." },
  { id: "lat_pulldown", name: "Тяга верхнего блока", pattern: "vpull", type: "compound", muscles: ["back", "arms"], avoid: [],
    tip: "Тяни рукоять к верху груди, локти идут вниз и назад. Не раскачивайся корпусом." },
  { id: "close_pulldown", name: "Тяга верхнего блока узким хватом", pattern: "vpull", type: "compound", muscles: ["back", "arms"], avoid: [],
    tip: "Параллельная рукоять, тяни к груди, в нижней точке сведи лопатки." },

  // ---------- Руки ----------
  { id: "barbell_curl", name: "Подъём штанги на бицепс", pattern: "biceps", type: "isolation", muscles: ["arms"], avoid: [],
    tip: "Локти прижаты к корпусу и не двигаются. Без раскачки спиной." },
  { id: "hammer_curl", name: "Молотки с гантелями", pattern: "biceps", type: "isolation", muscles: ["arms"], avoid: [],
    tip: "Ладони смотрят друг на друга. Поднимай поочерёдно или обе сразу." },
  { id: "incline_curl", name: "Сгибания с гантелями на наклонной скамье", pattern: "biceps", type: "isolation", muscles: ["arms"], avoid: ["shoulders"],
    tip: "Руки свисают за корпусом — бицепс растянут. Поднимай без движения локтей вперёд." },
  { id: "preacher_curl", name: "Сгибания на скамье Скотта", pattern: "biceps", type: "isolation", muscles: ["arms"], avoid: [],
    tip: "Внизу не разгибай руку до конца резко — опускай подконтрольно." },

  { id: "rope_pushdown", name: "Разгибания на блоке с канатом", pattern: "triceps", type: "isolation", muscles: ["arms"], avoid: [],
    tip: "Локти прижаты к бокам. Внизу разводи концы каната в стороны." },
  { id: "overhead_ext", name: "Разгибания из-за головы на блоке", pattern: "triceps", type: "isolation", muscles: ["arms"], avoid: ["shoulders"],
    tip: "Стоя спиной к блоку, локти смотрят вперёд. Длинная головка трицепса растягивается — лучше растёт." },
  { id: "dips", name: "Отжимания на брусьях", pattern: "triceps", type: "compound", muscles: ["arms", "chest"], avoid: ["shoulders"],
    tip: "Корпус вертикально — больше трицепса. Опускайся до 90° в локтях, не глубже." },
  { id: "skullcrusher", name: "Французский жим с EZ-грифом", pattern: "triceps", type: "isolation", muscles: ["arms"], avoid: [],
    tip: "Опускай гриф за голову, локти смотрят в потолок и не расходятся." },

  // ---------- Пресс ----------
  { id: "cable_crunch", name: "Скручивания на блоке", pattern: "core", type: "isolation", muscles: ["core"], avoid: [],
    tip: "На коленях, канат у головы. Скручивайся, приближая рёбра к тазу, бёдра неподвижны." },
  { id: "hanging_raise", name: "Подъёмы ног в висе", pattern: "core", type: "isolation", muscles: ["core"], avoid: [],
    tip: "Подкручивай таз вверх, а не просто поднимай ноги. Без раскачки." },
  { id: "plank", name: "Планка", pattern: "core", type: "isolation", muscles: ["core"], avoid: [],
    tip: "Тело прямое от головы до пяток, пресс и ягодицы напряжены. Вместо повторов — секунды." },

  // ---------- Кардио ----------
  { id: "incline_walk", name: "Ходьба на дорожке в горку", pattern: "cardio", type: "cardio", muscles: ["legs"], avoid: [],
    tip: "Наклон 8–12%, скорость 5–6 км/ч. Пульс — когда можешь говорить, но не петь." },
  { id: "bike", name: "Велотренажёр", pattern: "cardio", type: "cardio", muscles: ["legs"], avoid: [],
    tip: "Ровный темп, умеренное сопротивление. Не нагружает колени и поясницу." },
  { id: "elliptical", name: "Эллипс", pattern: "cardio", type: "cardio", muscles: ["legs"], avoid: [],
    tip: "Работай и руками, и ногами, держи ровный темп." },
];

export const BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

/** Подходящие упражнения для типа движения: без тех, что нельзя при травмах, и тех, которых нет в зале. */
export function options(pattern, injuries = [], excluded = []) {
  return EXERCISES.filter((e) => e.pattern === pattern && !excluded.includes(e.id) && !e.avoid.some((a) => injuries.includes(a)));
}

// Для них нужен турник — в зале его нет, поэтому по умолчанию не предлагаем
export const DEFAULT_EXCLUDED = ["pullup", "hanging_raise"];
