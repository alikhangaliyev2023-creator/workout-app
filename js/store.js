// Хранение данных прямо в телефоне (localStorage). Сервера нет — всё твоё остаётся у тебя.

const KEY = "workout-app";

// days — отметки календаря по датам: переносы тренировок и «выполнена / пропущена»
// logs — завершённые тренировки, active — тренировка, которая идёт прямо сейчас,
// body — записи веса тела, goals — свои цели
const EMPTY = { profile: null, plan: null, recovery: {}, days: {}, logs: [], active: null, body: [], goals: [] };

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...structuredClone(EMPTY), ...JSON.parse(raw) } : structuredClone(EMPTY);
  } catch (e) {
    return structuredClone(EMPTY);
  }
}

/** Пустые данные — основа для загрузки и для восстановления из копии. */
export function blank() {
  return structuredClone(EMPTY);
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
