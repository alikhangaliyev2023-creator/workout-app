// Запись тренировки: подходы, веса, подсказки «когда добавлять вес», итоги и рекорды.
//
// state.active — тренировка, которая идёт сейчас (сохраняется, даже если закрыть приложение).
// state.logs   — завершённые тренировки: дата, название и только выполненные подходы.

import { BY_ID } from "./exercises.js";

/** Новая тренировка из карточки дня (уже с поправкой на восстановление и неделю цикла). */
export function newWorkout(w, { date, sessionIdx }) {
  return {
    date,
    sessionIdx,
    name: w.name,
    key: w.light ? "light" : w.key,
    light: !!w.light,
    startedAt: Date.now(),
    rest: null,
    items: w.items.map((it, i) => ({
      ...it,
      ref: w.light ? `light:${i}` : `${sessionIdx}:${i}`,
      sets: Array.from({ length: it.cardio ? 1 : it.sets }, () => ({ w: "", r: "", done: false })),
    })),
  };
}

// Как зашло упражнение — спрашиваем после последнего подхода. score — для графика усталости.
export const FEELS = {
  easy: { emoji: "😴", label: "Легко", hint: "4+ повт. в запасе", score: 1 },
  ok:   { emoji: "🙂", label: "Норм", hint: "2–3 в запасе", score: 2 },
  hard: { emoji: "😤", label: "Тяжело", hint: "1 в запасе", score: 3 },
  fail: { emoji: "💀", label: "Отказ", hint: "больше ни одного", score: 4 },
};
// Как тренировка в целом — спрашиваем при завершении
export const ENERGY = [
  [1, "😵", "Выжат"], [2, "😮‍💨", "Тяжело"], [3, "🙂", "Норм"], [4, "💪", "Хорошо"], [5, "⚡️", "Огонь"],
];

/** Последний раз, когда делал это упражнение: { date, sets: [{ w, r }], feel, pain } или null. */
export function lastFor(logs, exerciseId) {
  for (let i = logs.length - 1; i >= 0; i--) {
    const item = logs[i].items.find((it) => it.exercise === exerciseId && it.sets.length);
    if (item) return { date: logs[i].date, sets: item.sets, feel: item.feel || null, pain: !!item.pain };
  }
  return null;
}

/** Болело ли упражнение два последних раза подряд — тогда советуем заменить. */
export function painTwice(logs, exerciseId) {
  const recent = logs.flatMap((l) => l.items.filter((it) => it.exercise === exerciseId && it.sets.length)).slice(-2);
  return recent.length === 2 && recent.every((it) => it.pain);
}

// Шаг прибавки веса: в базовых упражнениях — 2,5 кг, в изолирующих — 1 кг (или следующая гантель)
const stepFor = (exerciseId) => (BY_ID[exerciseId].type === "compound" ? 2.5 : 1);
const fmt = (n) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * Подсказка к упражнению: какой вес взять сегодня. { weight, text }
 * Учитывает, как зашло в прошлый раз: «легко» — прибавка вдвое больше, «до отказа» — вес не растёт.
 */
export function suggestion(item, last, week = null) {
  if (item.cardio) return null;
  const [lo, hi] = item.reps;
  if (!last) {
    return { weight: null, text: item.unit === "сек" ? `Держи ${lo}–${hi} сек` : `Первый раз — подбери вес, чтобы вышло ${lo}–${hi} повт. и оставалось пару в запасе` };
  }
  const weights = last.sets.map((s) => s.w).filter((w) => w != null);
  const top = weights.length ? Math.max(...weights) : null;
  // «Все подходы по верху диапазона» — значит, пора добавлять вес
  const allTop = last.sets.length >= item.sets.length && last.sets.every((s) => s.r >= hi);
  if (item.unit === "сек") return { weight: top, text: allTop ? `В прошлый раз всё по ${hi} сек — держи дольше` : `Цель — ${hi} сек в каждом подходе` };
  if (top == null) return { weight: null, text: allTop ? `Все подходы по ${hi}+ — добавь повторов или вес` : `Цель — ${hi} повт. в каждом подходе` };
  const peakEasy = week === 5 && last.feel === "easy" ? " Пиковая неделя, а было легко — смело добавляй." : "";
  if (allTop && last.feel === "fail") {
    return { weight: top, text: `💀 В прошлый раз до отказа — повтори ${fmt(top)} кг, пусть станет увереннее. Потом прибавим` };
  }
  if (allTop) {
    const easy = last.feel === "easy";
    const next = top + stepFor(item.exercise) * (easy ? 2 : 1);
    return { weight: next, text: easy ? `🚀 В прошлый раз было легко — пробуй сразу ${fmt(next)} кг` : `📈 В прошлый раз все подходы по ${hi}+ — пробуй ${fmt(next)} кг` };
  }
  if (last.feel === "easy") return { weight: top, text: `😴 Было легко — сегодня дожми до ${hi} повт. с ${fmt(top)} кг.${peakEasy}` };
  return { weight: top, text: `Тот же вес ${fmt(top)} кг — добери до ${hi} повт. во всех подходах, потом прибавим${peakEasy ? "." + peakEasy : ""}` };
}

export const parseNum = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Превращает идущую тренировку в запись для истории: только выполненные подходы. */
export function toLog(active) {
  return {
    date: active.date,
    name: active.name,
    key: active.key,
    energy: active.energy || null,
    startedAt: active.startedAt,
    finishedAt: Date.now(),
    items: active.items.map((it) => ({
      exercise: it.exercise,
      unit: it.unit || (it.cardio ? "мин" : "повт"),
      cardio: !!it.cardio,
      feel: it.feel || null,
      pain: !!it.pain,
      sets: it.sets.filter((s) => s.done).map((s) => ({ w: parseNum(s.w), r: parseNum(s.r) })),
    })).filter((it) => it.sets.length),
  };
}

/** Итоги тренировки и новые рекорды (лучший вес в упражнении за всё время). */
export function summarize(log, previousLogs) {
  let sets = 0, volume = 0;
  const records = [];
  for (const it of log.items) {
    if (it.cardio) continue;
    sets += it.sets.length;
    for (const s of it.sets) if (s.w && s.r && it.unit !== "сек") volume += s.w * s.r;
    const best = Math.max(0, ...it.sets.map((s) => s.w || 0));
    if (!best) continue;
    const before = previousLogs.flatMap((l) => l.items.filter((x) => x.exercise === it.exercise).flatMap((x) => x.sets.map((s) => s.w || 0)));
    if (before.length && best > Math.max(...before)) records.push({ exercise: it.exercise, weight: best, was: Math.max(...before) });
  }
  return { minutes: Math.max(1, Math.round((log.finishedAt - log.startedAt) / 60000)), sets, volume, records };
}

export { fmt };
