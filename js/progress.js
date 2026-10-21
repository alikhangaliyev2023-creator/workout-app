// Успехи: серия недель, рекорды, графики, цели и достижения.
//
// Всё считается из записанных данных:
//   days — отметки календаря («выполнена»), logs — записанные подходы,
//   body — вес тела [{ date, weight }], goals — цели, которые поставил сам.

import { isoDate, mondayOf } from "./plan.js";
import { FEELS } from "./workout.js";

const DAY = 86400000;
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

/** Сколько тренировок сделано за неделю, начиная с понедельника monday. */
function doneInWeek(days, monday) {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = days[isoDate(addDays(monday, i))];
    if (d && d.status === "done") n++;
  }
  return n;
}

/**
 * Недели для серии и графика: [{ monday, done, target, full }] от старых к новым.
 * weekTarget(monday) — сколько тренировок было запланировано на эту неделю.
 */
export function weeks(ctx, count) {
  const now = mondayOf(new Date());
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const monday = addDays(now, -7 * i);
    const done = doneInWeek(ctx.days, monday);
    const target = Math.max(1, ctx.weekTarget(monday));
    out.push({ monday, done, target, full: done >= target, current: i === 0 });
  }
  return out;
}

/** Серия: сколько недель подряд сделаны все тренировки. Текущая неделя серию не обрывает. */
export function streaks(ctx) {
  const first = Object.keys(ctx.days).filter((k) => ctx.days[k].status === "done").sort()[0];
  if (!first) return { current: 0, best: 0 };
  const total = Math.floor((mondayOf(new Date()) - mondayOf(new Date(first + "T00:00:00"))) / (7 * DAY)) + 1;
  const list = weeks(ctx, Math.min(total, 260));
  let best = 0, run = 0;
  for (const w of list) {
    if (w.full) { run++; best = Math.max(best, run); }
    else if (!w.current) run = 0;
  }
  return { current: run, best };
}

/** Лучший вес в упражнении по датам — для графика силы. */
export function liftSeries(logs, exerciseId) {
  const points = [];
  for (const log of logs) {
    const item = log.items.find((it) => it.exercise === exerciseId);
    if (!item) continue;
    const best = Math.max(0, ...item.sets.map((s) => s.w || 0));
    if (best) points.push({ date: log.date, value: best });
  }
  return points;
}

/** Упражнения, в которых есть записанный вес: [{ id, best }] — самые частые первыми. */
export function liftedExercises(logs) {
  const map = new Map();
  for (const log of logs) {
    for (const it of log.items) {
      const best = Math.max(0, ...it.sets.map((s) => s.w || 0));
      if (!best) continue;
      const cur = map.get(it.exercise) || { id: it.exercise, best: 0, times: 0 };
      cur.best = Math.max(cur.best, best);
      cur.times++;
      map.set(it.exercise, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.times - a.times || b.best - a.best);
}

export const bestLift = (logs, exerciseId) => Math.max(0, ...liftSeries(logs, exerciseId).map((p) => p.value));

/** Все цифры для экрана и достижений. */
export function stats(ctx) {
  const workouts = Object.values(ctx.days).filter((d) => d.status === "done").length;
  let tonnage = 0, records = 0, maxLift = 0, early = false, night = false;
  const best = {};
  for (const log of ctx.logs) {
    const hour = new Date(log.startedAt).getHours();
    if (log.startedAt && hour < 8) early = true;
    if (log.startedAt && hour >= 21) night = true;
    for (const it of log.items) {
      if (it.cardio) continue;
      let top = 0;
      for (const s of it.sets) {
        if (s.w && s.r && it.unit !== "сек") tonnage += s.w * s.r;
        top = Math.max(top, s.w || 0);
      }
      maxLift = Math.max(maxLift, top);
      if (top && best[it.exercise] && top > best[it.exercise]) records++;
      if (top) best[it.exercise] = Math.max(best[it.exercise] || 0, top);
    }
  }
  const { current, best: bestStreak } = streaks(ctx);
  const goalsDone = ctx.goals.filter((g) => goalProgress(g, ctx).done).length;
  return { workouts, tonnage, records, maxLift, early, night, streak: current, bestStreak, bodyEntries: ctx.body.length, goalsDone };
}

// ---------- Самочувствие ----------

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/** По неделям: насколько тяжело заходили упражнения (1 — легко … 4 — отказ) и энергия (1–5). */
export function feelWeeks(logs, count) {
  const now = mondayOf(new Date());
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const from = isoDate(addDays(now, -7 * i)), to = isoDate(addDays(now, -7 * i + 6));
    const inWeek = logs.filter((l) => l.date >= from && l.date <= to);
    const feel = avg(inWeek.flatMap((l) => l.items.filter((it) => it.feel).map((it) => FEELS[it.feel].score)));
    const energy = avg(inWeek.map((l) => l.energy).filter(Boolean));
    out.push({ monday: addDays(now, -7 * i), feel, energy, current: i === 0 });
  }
  return out;
}

/** Совет по усталости за последние 2 недели с оценками. */
export function fatigueNote(list) {
  const rated = list.filter((w) => w.feel != null).slice(-2);
  if (!rated.length) return null;
  const f = avg(rated.map((w) => w.feel));
  if (f >= 3.3) return { tone: "red", text: "Тренировки даются всё тяжелее — организм копит усталость. Если так и дальше, сделай разгрузочную неделю раньше." };
  if (f <= 1.7) return { tone: "green", text: "Последнее время всё легко — значит, пора добавлять вес смелее." };
  return { tone: "", text: "Нагрузка в норме: тяжело, но с запасом. Так и продолжай." };
}

/** Средняя энергия на тренировке при разном восстановлении WHOOP. */
export function energyByRecovery(logs, recovery) {
  const out = {};
  for (const level of ["green", "yellow", "red"]) {
    const list = logs.filter((l) => l.energy && recovery[l.date] && recovery[l.date].level === level).map((l) => l.energy);
    out[level] = list.length ? { avg: avg(list), n: list.length } : null;
  }
  return out;
}

// ---------- Цели ----------

export function latestWeight(body) {
  return body.length ? body[body.length - 1].weight : null;
}

/** Прогресс цели: { current, pct, done }. */
export function goalProgress(goal, ctx) {
  if (goal.type === "lift") {
    const current = bestLift(ctx.logs, goal.exercise);
    const from = goal.from || 0;
    const pct = goal.target > from ? (current - from) / (goal.target - from) : current >= goal.target ? 1 : 0;
    return { current, pct: clamp(pct), done: current >= goal.target };
  }
  const current = latestWeight(ctx.body);
  if (current == null) return { current: null, pct: 0, done: false };
  const losing = goal.target < goal.from;
  const pct = goal.from === goal.target ? 1 : (goal.from - current) / (goal.from - goal.target);
  return { current, pct: clamp(pct), done: losing ? current <= goal.target : current >= goal.target };
}
const clamp = (v) => Math.max(0, Math.min(1, v));

// ---------- Достижения ----------

// key — какую цифру из stats() смотреть, need — сколько нужно
export const BADGES = [
  { id: "w1", emoji: "👟", title: "Первый шаг", desc: "Первая тренировка", key: "workouts", need: 1 },
  { id: "w10", emoji: "🔥", title: "Разогрелся", desc: "10 тренировок", key: "workouts", need: 10 },
  { id: "w25", emoji: "💪", title: "В ритме", desc: "25 тренировок", key: "workouts", need: 25 },
  { id: "w50", emoji: "🦾", title: "Полсотни", desc: "50 тренировок", key: "workouts", need: 50 },
  { id: "w100", emoji: "👑", title: "Сотка", desc: "100 тренировок", key: "workouts", need: 100 },
  { id: "s2", emoji: "📅", title: "Две недели", desc: "2 недели подряд без пропусков", key: "bestStreak", need: 2 },
  { id: "s4", emoji: "🗓️", title: "Месяц дисциплины", desc: "4 недели подряд без пропусков", key: "bestStreak", need: 4 },
  { id: "s6", emoji: "🔁", title: "Полный цикл", desc: "6 недель подряд — весь цикл", key: "bestStreak", need: 6 },
  { id: "s12", emoji: "🧱", title: "Железная воля", desc: "12 недель подряд без пропусков", key: "bestStreak", need: 12 },
  { id: "r1", emoji: "🏅", title: "Первый рекорд", desc: "Побить свой лучший вес", key: "records", need: 1 },
  { id: "r10", emoji: "🥇", title: "Рекордсмен", desc: "10 личных рекордов", key: "records", need: 10 },
  { id: "r25", emoji: "🏆", title: "Машина рекордов", desc: "25 личных рекордов", key: "records", need: 25 },
  { id: "t10", emoji: "🪨", title: "10 тонн", desc: "Поднять 10 тонн за всё время", key: "tonnage", need: 10000 },
  { id: "t100", emoji: "🏔️", title: "100 тонн", desc: "Поднять 100 тонн за всё время", key: "tonnage", need: 100000 },
  { id: "t500", emoji: "🌋", title: "500 тонн", desc: "Поднять 500 тонн за всё время", key: "tonnage", need: 500000 },
  { id: "kg100", emoji: "💯", title: "Клуб 100 кг", desc: "Подход со 100 кг и больше", key: "maxLift", need: 100 },
  { id: "early", emoji: "🌅", title: "Ранняя пташка", desc: "Тренировка до 8 утра", key: "early", need: 1 },
  { id: "night", emoji: "🌙", title: "Ночная смена", desc: "Тренировка после 9 вечера", key: "night", need: 1 },
  { id: "body4", emoji: "⚖️", title: "На контроле", desc: "4 раза записать вес тела", key: "bodyEntries", need: 4 },
  { id: "goal1", emoji: "🎯", title: "Цель достигнута", desc: "Выполнить свою цель", key: "goalsDone", need: 1 },
];

/** Достижения с прогрессом: [{ ...badge, have, done }]. */
export function badges(st) {
  return BADGES.map((b) => {
    const have = Number(st[b.key]) || 0;
    return { ...b, have, done: have >= b.need };
  });
}

export const unlockedIds = (st) => badges(st).filter((b) => b.done).map((b) => b.id);

