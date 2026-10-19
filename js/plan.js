// Генератор плана тренировок.
//
// По анкете выбираем схему (сплит) по числу дней в неделю, для каждой тренировки —
// набор типов движений, под каждый тип — упражнение (с учётом травм), а подходы,
// повторы и отдых — по цели и опыту. Потом подгоняем тренировку под нужную длительность.
//
// План идёт циклами по 6 недель: 5 недель нагрузка растёт, 6-я — разгрузочная.

import { BY_ID, MUSCLES, options } from "./exercises.js";

export const GOALS = {
  mass: "Набор мышц",
  cut: "Похудение / рельеф",
  recomp: "Масса + рельеф",
  strength: "Сила",
};
export const LEVELS = { novice: "Новичок", intermediate: "Средний", advanced: "Опытный" };
export const INJURIES = { shoulders: "Плечи", knees: "Колени", lowback: "Поясница" };
export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export const WEEKDAYS_FULL = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];
export const CYCLE_WEEKS = 6;

// Тренировки: название и список «слотов» — тип движения и его роль.
// main — главное базовое упражнение дня, secondary — второстепенное базовое, accessory — добивающее.
const SESSIONS = {
  full_a:  { name: "Всё тело А", focus: "Ноги, грудь, спина", slots: [["squat", "main"], ["hpress", "main"], ["hpull", "secondary"], ["lateral", "accessory"], ["legcurl", "accessory"], ["biceps", "accessory"], ["core", "accessory"]] },
  full_b:  { name: "Всё тело Б", focus: "Тяга, плечи, спина", slots: [["hinge", "main"], ["vpull", "main"], ["ipress", "secondary"], ["lunge", "secondary"], ["reardelt", "accessory"], ["triceps", "accessory"], ["calves", "accessory"]] },
  full_c:  { name: "Всё тело В", focus: "Ноги, спина, руки", slots: [["squat", "main", 2], ["hpull", "main", 1], ["vpress", "secondary"], ["legcurl", "accessory", 1], ["fly", "accessory"], ["biceps", "accessory", 1], ["triceps", "accessory", 1]] },
  upper_a: { name: "Верх тела А", focus: "Грудь, спина, плечи, руки", slots: [["hpress", "main"], ["hpull", "main"], ["vpress", "secondary"], ["vpull", "secondary"], ["lateral", "accessory"], ["triceps", "accessory"], ["biceps", "accessory"]] },
  upper_b: { name: "Верх тела Б", focus: "Спина, верх груди, руки", slots: [["vpull", "main", 1], ["ipress", "main"], ["hpull", "secondary", 1], ["fly", "accessory"], ["reardelt", "accessory"], ["biceps", "accessory", 1], ["triceps", "accessory", 1]] },
  lower_a: { name: "Низ тела А", focus: "Квадрицепс, ягодицы", slots: [["squat", "main"], ["hinge", "secondary"], ["lunge", "secondary"], ["legcurl", "accessory"], ["calves", "accessory"], ["core", "accessory"]] },
  lower_b: { name: "Низ тела Б", focus: "Задняя поверхность, ягодицы", slots: [["hinge", "main", 1], ["squat", "secondary", 2], ["legext", "accessory"], ["legcurl", "accessory", 1], ["calves", "accessory", 1], ["core", "accessory", 1]] },
  push:    { name: "Жимовая", focus: "Грудь, плечи, трицепс", slots: [["hpress", "main"], ["ipress", "secondary"], ["vpress", "secondary"], ["fly", "accessory"], ["lateral", "accessory"], ["triceps", "accessory"]] },
  pull:    { name: "Тяговая", focus: "Спина, задняя дельта, бицепс", slots: [["vpull", "main"], ["hpull", "main"], ["hpull", "secondary", 2], ["reardelt", "accessory"], ["biceps", "accessory"], ["biceps", "accessory", 1]] },
  legs:    { name: "Ноги", focus: "Ноги, ягодицы, пресс", slots: [["squat", "main"], ["hinge", "secondary"], ["lunge", "secondary"], ["legcurl", "accessory"], ["legext", "accessory"], ["calves", "accessory"], ["core", "accessory"]] },
  push_2:  { name: "Жимовая 2", focus: "Верх груди, плечи, трицепс", slots: [["ipress", "main", 1], ["hpress", "secondary", 1], ["vpress", "secondary", 1], ["fly", "accessory", 1], ["lateral", "accessory", 1], ["triceps", "accessory", 1]] },
  pull_2:  { name: "Тяговая 2", focus: "Спина в толщину, бицепс", slots: [["hpull", "main", 1], ["vpull", "main", 1], ["hpull", "secondary", 3], ["reardelt", "accessory", 1], ["biceps", "accessory", 2], ["biceps", "accessory", 3]] },
  legs_2:  { name: "Ноги 2", focus: "Задняя поверхность, ягодицы", slots: [["hinge", "main", 1], ["squat", "secondary", 2], ["lunge", "secondary", 1], ["legcurl", "accessory", 1], ["calves", "accessory", 1], ["core", "accessory", 1]] },
};

// Раздельные тренировки: в один день — одна-две группы мышц, грудь и спина — в разные дни
Object.assign(SESSIONS, {
  chest_tri:  { name: "Грудь + трицепс", focus: "Грудь, трицепс", slots: [["hpress", "main"], ["ipress", "secondary"], ["hpress", "secondary", 1], ["fly", "accessory"], ["triceps", "accessory"], ["triceps", "accessory", 1]] },
  back_bi:    { name: "Спина + бицепс", focus: "Спина, бицепс", slots: [["vpull", "main"], ["hpull", "main"], ["hpull", "secondary", 2], ["vpull", "secondary", 1], ["biceps", "accessory"], ["biceps", "accessory", 1]] },
  // Номер варианта — среди ещё не выбранных в этот день упражнений; руки берём другие, чем в днях груди и спины
  shoulders_arms: { name: "Плечи + руки", focus: "Плечи, бицепс, трицепс", slots: [["vpress", "main"], ["vpress", "secondary", 1], ["lateral", "accessory"], ["reardelt", "accessory"], ["biceps", "accessory", 3], ["triceps", "accessory", 3], ["biceps", "accessory", 1], ["triceps", "accessory", 1]] },
  legs_shoulders: { name: "Ноги + плечи", focus: "Ноги, плечи", slots: [["squat", "main"], ["hinge", "secondary"], ["vpress", "secondary"], ["legcurl", "accessory"], ["lateral", "accessory"], ["calves", "accessory"]] },
  chest:      { name: "Грудь", focus: "Грудь со всех углов", slots: [["hpress", "main"], ["ipress", "main"], ["hpress", "secondary", 1], ["ipress", "secondary", 1], ["fly", "accessory"], ["fly", "accessory", 1]] },
  back:       { name: "Спина", focus: "Ширина и толщина спины", slots: [["vpull", "main"], ["hpull", "main"], ["hpull", "secondary", 2], ["vpull", "secondary", 1], ["hpull", "secondary", 3], ["reardelt", "accessory"]] },
  shoulders:  { name: "Плечи", focus: "Передняя, средняя и задняя дельта", slots: [["vpress", "main"], ["vpress", "secondary", 1], ["lateral", "accessory"], ["lateral", "accessory", 1], ["reardelt", "accessory"], ["reardelt", "accessory", 1], ["core", "accessory"]] },
  arms:       { name: "Руки", focus: "Бицепс и трицепс", slots: [["biceps", "secondary"], ["triceps", "secondary"], ["biceps", "accessory", 1], ["triceps", "accessory", 1], ["biceps", "accessory", 2], ["triceps", "accessory", 2]] },
});

// Схемы (сплиты) для каждого числа дней. mixes — бывают ли грудь и спина в один день.
export const SPLIT_OPTIONS = {
  2: [
    { id: "full2", name: "Всё тело ×2", desc: "Каждая тренировка — всё тело", mixes: true, sessions: ["full_a", "full_b"] },
    { id: "ul2", name: "Верх / низ", desc: "День верха, день ног", mixes: true, sessions: ["upper_a", "lower_a"] },
  ],
  3: [
    { id: "ppl3", name: "Жим / тяга / ноги", desc: "Грудь + плечи + трицепс · спина + бицепс · ноги", mixes: false, sessions: ["push", "pull", "legs"] },
    { id: "split3", name: "Раздельный", desc: "Грудь + трицепс · спина + бицепс · ноги + плечи", mixes: false, sessions: ["chest_tri", "back_bi", "legs_shoulders"] },
    { id: "full3", name: "Всё тело ×3", desc: "Каждая тренировка — всё тело", mixes: true, sessions: ["full_a", "full_b", "full_c"] },
  ],
  4: [
    { id: "split4", name: "Раздельный", desc: "Грудь + трицепс · спина + бицепс · ноги · плечи + руки", mixes: false, sessions: ["chest_tri", "back_bi", "legs", "shoulders_arms"] },
    { id: "ul4", name: "Верх / низ", desc: "Верх тела ×2 и ноги ×2 — каждая мышца дважды в неделю", mixes: true, sessions: ["upper_a", "lower_a", "upper_b", "lower_b"] },
  ],
  5: [
    { id: "bro5", name: "Раздельный", desc: "Грудь · спина · ноги · плечи · руки — каждой мышце свой день", mixes: false, sessions: ["chest", "back", "legs", "shoulders", "arms"] },
    { id: "split5", name: "Раздельный + ноги ×2", desc: "Грудь + трицепс · спина + бицепс · ноги · плечи + руки · ноги", mixes: false, sessions: ["chest_tri", "back_bi", "legs", "shoulders_arms", "legs_2"] },
    { id: "pplul5", name: "Жим / тяга / ноги + верх / низ", desc: "Каждая мышца почти дважды в неделю", mixes: true, sessions: ["push", "pull", "legs", "upper_a", "lower_b"] },
  ],
  6: [
    { id: "ppl6", name: "Жим / тяга / ноги ×2", desc: "Грудь + плечи + трицепс · спина + бицепс · ноги, дважды", mixes: false, sessions: ["push", "pull", "legs", "push_2", "pull_2", "legs_2"] },
    { id: "split6", name: "Раздельный ×2", desc: "Грудь + трицепс · спина + бицепс · ноги + плечи, дважды", mixes: false, sessions: ["chest_tri", "back_bi", "legs_shoulders", "chest_tri", "back_bi", "legs_shoulders"] },
  ],
};

/** Схема из анкеты; если её нет или она не подходит к числу дней — первая для этого числа дней. */
export function splitFor(profile) {
  const list = SPLIT_OPTIONS[profile.days.length];
  return list.find((o) => o.id === profile.split) || list[0];
}

// Подходы, повторы и отдых (секунды) по цели и роли упражнения
const DOSES = {
  mass:     { main: [4, 6, 8, 150],  secondary: [3, 8, 10, 120], accessory: [3, 10, 15, 75] },
  recomp:   { main: [4, 6, 8, 150],  secondary: [3, 8, 12, 105], accessory: [3, 10, 15, 60] },
  cut:      { main: [3, 6, 8, 150],  secondary: [3, 8, 12, 90],  accessory: [3, 12, 15, 60] },
  strength: { main: [5, 3, 5, 210],  secondary: [3, 6, 8, 150],  accessory: [3, 8, 12, 90] },
};

// Кардио в конце тренировки: сколько минут и в скольких тренировках недели
const CARDIO = { mass: [0, 0], recomp: [20, 2], cut: [25, 99], strength: [0, 0] };

// Дни недели по умолчанию (0 — понедельник)
export const DEFAULT_DAYS = { 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };

const WARMUP_MIN = 6;
const SET_WORK_SECONDS = 40;   // сам подход, в среднем

/** Примерная длительность тренировки в минутах. Суперсет — два упражнения подряд с одним отдыхом. */
export function sessionMinutes(items) {
  let seconds = WARMUP_MIN * 60;
  for (const it of items) {
    if (it.cardio) seconds += it.minutes * 60;
    else if (it.superset) seconds += it.sets * SET_WORK_SECONDS;   // отдых уже посчитан у пары
    else seconds += it.sets * (SET_WORK_SECONDS + it.rest);
  }
  return Math.round(seconds / 60 / 5) * 5;
}

function hitsPriority(exercise, priority) {
  // Считаем только главную мышцу: жим лёжа — это грудь, хотя трицепс в нём тоже работает
  return priority.length > 0 && priority.includes(exercise.muscles[0]);
}

/** Собирает одну тренировку. */
function buildSession(key, profile) {
  const template = SESSIONS[key];
  const dose = DOSES[profile.goal];
  const used = new Set();
  const items = [];
  for (const [pattern, role, variant = 0] of template.slots) {
    const choices = options(pattern, profile.injuries, profile.excluded).filter((e) => !used.has(e.id));
    if (!choices.length) continue;  // все варианты нельзя из-за травм — пропускаем движение
    // Для базовых ролей сначала базовые упражнения; вариант — чтобы в разные дни были разные упражнения
    const pool = role === "accessory" ? choices : choices.filter((e) => e.type === "compound").concat(choices.filter((e) => e.type !== "compound"));
    const exercise = pool[variant % pool.length];
    used.add(exercise.id);

    let [sets, lo, hi, rest] = dose[role];
    if (profile.level === "novice" && role !== "accessory") sets = Math.max(2, sets - 1);
    if (profile.level === "advanced" && hitsPriority(exercise, profile.priority)) sets += 1;
    const plank = exercise.id === "plank";
    if (plank) { lo = 30; hi = 60; }  // планка — в секундах
    items.push({ exercise: exercise.id, pattern, role, sets, reps: [lo, hi], rest, unit: plank ? "сек" : "повт" });
  }
  return { key, name: template.name, focus: template.focus, items };
}

/** Подгоняет тренировку под длительность — как сделал бы тренер, по шагам от самого безболезненного.
 *  Приоритетные мышцы защищены: их упражнения убираются последними. */
function fitDuration(session, profile) {
  const items = session.items;
  const limit = profile.duration;
  const over = () => sessionMinutes(items) > limit;
  const lifts = () => items.filter((it) => !it.cardio);
  const isPriority = (it) => !it.cardio && hitsPriority(BY_ID[it.exercise], profile.priority);
  const remove = (filter) => {
    // Убираем одно упражнение с конца тренировки, подходящее под условие
    for (let i = items.length - 1; i >= 0; i--) {
      if (filter(items[i])) { items.splice(i, 1); fixSupersets(items); return true; }
    }
    return false;
  };

  const steps = [
    // 1. Кардио покороче
    () => items.filter((it) => it.cardio && it.minutes > 15).forEach((it) => { it.minutes = 15; }),
    // 2. Мелкие мышцы — суперсетами: два упражнения подряд, один отдых
    () => pairSupersets(items),
    // 3. Отдых покороче
    () => lifts().forEach((it) => {
      if (it.role === "accessory") it.rest = Math.min(it.rest, 45);
      if (it.role === "secondary") it.rest = Math.min(it.rest, 90);
      if (it.role === "main") it.rest = Math.min(it.rest, 120);
    }),
    // 4. В добивающих по 2 подхода (кроме приоритетных мышц)
    () => lifts().filter((it) => it.role === "accessory" && !isPriority(it)).forEach((it) => { it.sets = Math.min(it.sets, 2); }),
    // 5. Во второстепенных по 3 подхода, в главных — по 4
    () => lifts().forEach((it) => {
      if (it.role === "secondary") it.sets = Math.min(it.sets, 3);
      if (it.role === "main") it.sets = Math.min(it.sets, 4);
    }),
  ];
  for (const step of steps) {
    if (!over()) break;
    step();
  }
  // 6. Всё ещё не помещается — убираем по одному: сначала обычные добивающие, потом второстепенные,
  //    и только в самом конце — упражнения на приоритетные мышцы
  const removalOrder = [
    (it) => it.role === "accessory" && !isPriority(it),
    (it) => it.role === "secondary" && !isPriority(it),
    (it) => it.role === "accessory",
  ];
  for (const filter of removalOrder) {
    while (over() && remove(filter)) { /* убираем дальше */ }
  }
  // 7. Если осталось время — по подходу по кругу: сначала приоритетные, потом базовые (не больше 4–5)
  const growable = lifts().filter((it) => !it.superset && !it.pairStart);
  const queue = growable.filter(isPriority).concat(growable.filter((it) => !isPriority(it) && it.role !== "accessory"));
  for (let round = 0; round < 2; round++) {
    for (const it of queue) {
      const cap = it.role === "main" ? 5 : 4;
      if (it.sets >= cap) continue;
      it.sets += 1;
      if (over()) { it.sets -= 1; return; }
    }
  }
}

/** Объединяет соседние добивающие упражнения в пары-суперсеты (второе в паре помечено superset). */
function pairSupersets(items) {
  for (let i = 0; i < items.length - 1; i++) {
    const a = items[i], b = items[i + 1];
    if (a.role === "accessory" && b.role === "accessory" && !a.superset && !a.pairStart && !b.cardio && a.pattern !== "core") {
      b.superset = true;
      b.sets = a.sets;
      a.pairStart = true;
      i += 1;
    }
  }
}

/** После удаления упражнения пара могла «разорваться» — убираем пометки у одиночек. */
function fixSupersets(items) {
  items.forEach((it, i) => {
    if (it.superset && !(items[i - 1] && items[i - 1].pairStart)) delete it.superset;
    if (it.pairStart && !(items[i + 1] && items[i + 1].superset)) delete it.pairStart;
  });
}

/** Главная функция: анкета → план. */
export function generatePlan(profile) {
  const days = [...profile.days].sort((a, b) => a - b);
  const split = splitFor(profile);
  const [cardioMinutes, cardioSessions] = profile.cardio ? CARDIO[profile.goal].map((v, i) => (v || (i === 0 ? 15 : 1))) : [0, 0];
  const cardioPick = options("cardio", profile.injuries, profile.excluded)[0];

  const sessions = split.sessions.map((key, i) => {
    const session = buildSession(key, profile);
    // Кардио — в конце тренировок через одну (при похудении — в каждой)
    const withCardio = cardioMinutes > 0 && (cardioSessions >= split.sessions.length || i % Math.max(1, Math.round(split.sessions.length / cardioSessions)) === 0);
    if (withCardio) session.items.push({ exercise: cardioPick.id, pattern: "cardio", role: "cardio", cardio: true, minutes: cardioMinutes, sets: 1, rest: 0 });
    fitDuration(session, profile);
    return { ...session, weekday: days[i] };
  });

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    startDate: isoDate(mondayOf(new Date())),
    split: split.name,
    sessions,
  };
}

// ---------- Неделя цикла и восстановление ----------

export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function mondayOf(d) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}
export function weekdayIndex(d) {
  return (d.getDay() + 6) % 7;  // 0 — понедельник
}

/** Какая сейчас неделя цикла (1–6). */
export function cycleWeek(plan, date = new Date()) {
  const start = new Date(plan.startDate + "T00:00:00");
  const weeks = Math.floor((mondayOf(date) - start) / (7 * 24 * 3600 * 1000));
  return (((weeks % CYCLE_WEEKS) + CYCLE_WEEKS) % CYCLE_WEEKS) + 1;
}

// Сколько повторов «в запасе» оставлять (RIR) — по неделе цикла: нагрузка растёт к 5-й неделе
const WEEK_RIR = { 1: "3", 2: "2", 3: "2", 4: "1", 5: "0–1", 6: "4" };

export function weekNote(week) {
  if (week === CYCLE_WEEKS) return "Разгрузочная неделя: веса −10%, подходов меньше. Мышцы растут, пока отдыхают.";
  if (week === 1) return "Начало цикла: оставляй 3 повтора в запасе, привыкай к весам.";
  if (week === 5) return "Пиковая неделя: работай почти до отказа, пробуй рекорды.";
  return `Оставляй ${WEEK_RIR[week]} повт. в запасе. Сделал верх диапазона во всех подходах — добавь вес.`;
}

export const RECOVERY = {
  green:  { label: "Хорошее", range: "67–100%", emoji: "🟢", note: "Организм готов — тренируйся по плану, можно пробовать рекорды." },
  yellow: { label: "Среднее", range: "34–66%", emoji: "🟡", note: "План как есть, но на 1 подход меньше и без рекордов." },
  red:    { label: "Низкое",  range: "0–33%",  emoji: "🔴", note: "Сегодня лёгкий день: кардио и растяжка. Тяжёлую тренировку лучше перенести." },
};

export function recoveryLevel(pct) {
  return pct >= 67 ? "green" : pct >= 34 ? "yellow" : "red";
}

/** Тренировка на конкретный день с поправкой на неделю цикла и восстановление. */
export function workoutFor(plan, session, week, recovery) {
  if (recovery === "red") {
    return {
      ...session,
      name: "Восстановительная",
      focus: `Вместо «${session.name}»`,
      light: true,
      items: [
        { exercise: "bike", pattern: "cardio", role: "cardio", cardio: true, minutes: 30, sets: 1, rest: 0 },
        { exercise: "face_pull", pattern: "reardelt", role: "accessory", sets: 2, reps: [15, 20], rest: 60, unit: "повт" },
        { exercise: "plank", pattern: "core", role: "accessory", sets: 2, reps: [30, 45], rest: 60, unit: "сек" },
      ],
    };
  }
  const deload = week === CYCLE_WEEKS;
  const items = session.items.map((it) => {
    if (it.cardio) return it;
    let sets = it.sets;
    if (deload) sets = Math.max(2, Math.round(sets * 0.6));
    else if (recovery === "yellow") sets = Math.max(2, sets - 1);
    return { ...it, sets };
  });
  return { ...session, items, deload };
}

export function profileSummary(profile) {
  const pr = profile.priority.length ? profile.priority.map((m) => MUSCLES[m]).join(", ") : "равномерно";
  return { goal: GOALS[profile.goal], level: LEVELS[profile.level], priority: pr };
}
