// Хранение данных прямо в телефоне (localStorage). Сервера нет — всё твоё остаётся у тебя.

const KEY = "workout-app";

const EMPTY = { profile: null, plan: null, recovery: {} };

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : structuredClone(EMPTY);
  } catch (e) {
    return structuredClone(EMPTY);
  }
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
