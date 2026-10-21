// Экраны приложения: анкета, «Сегодня», «План» (а позже — календарь и успехи).

import { BY_ID, DEFAULT_EXCLUDED, MUSCLES, PATTERNS, options } from "./exercises.js";
import {
  CYCLE_WEEKS, DEFAULT_DAYS, GOALS, INJURIES, LEVELS, RECOVERY, WEEKDAYS, WEEKDAYS_FULL,
  SPLIT_OPTIONS, cycleWeek, generatePlan, isoDate, splitFor, profileSummary, recoveryLevel, sessionMinutes, weekNote, weekdayIndex, workoutFor,
} from "./plan.js";
import * as store from "./store.js";
import { ENERGY, FEELS, fmt, lastFor, newWorkout, painTwice, parseNum, suggestion, summarize, toLog } from "./workout.js";
import { badges, bestLift, energyByRecovery, fatigueNote, feelWeeks, goalProgress, latestWeight, liftSeries, liftedExercises, stats, unlockedIds, weeks } from "./progress.js";

const app = document.getElementById("app");
const tabbar = document.getElementById("tabbar");
const sheet = document.getElementById("sheet");

let state = store.load();
let view = "today";

function persist() {
  if (!store.save(state)) toast("Не получилось сохранить — проверь, не включён ли режим «Частный доступ» в Safari");
}

// ---------- Мелочи ----------

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Всплывающее сообщение. action — кнопка в нём, например { label: "Отменить", run }. */
function toast(text, action = null) {
  const el = document.getElementById("toast");
  el.innerHTML = `<span>${esc(text)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
  el.hidden = false;
  if (action) el.querySelector("button").onclick = () => { el.hidden = true; action.run(); };
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, action ? 6000 : 2600);
}

function dose(item) {
  if (item.cardio) return `${item.minutes} мин, ровный темп`;
  const [lo, hi] = item.reps;
  const unit = item.unit === "сек" ? " сек" : "";
  if (item.pairStart) return `${item.sets} × ${lo}–${hi}${unit} · суперсет ↓ сразу следующее`;
  return `${item.sets} × ${lo}–${hi}${unit} · отдых ${restLabel(item.rest)}`;
}
function restLabel(sec) {
  return sec >= 60 ? `${Math.floor(sec / 60)}${sec % 60 ? ":" + String(sec % 60).padStart(2, "0") : ""} мин` : `${sec} с`;
}

const todayIso = () => isoDate(new Date());

// ---------- Иконки нижнего меню ----------

const ICONS = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>',
  plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5h11M9 12h11M9 19h11"/><circle cx="4.5" cy="5" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="19" r="1.2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V11M10 19V5M16 19v-6M22 19H2"/></svg>',
};
const TABS = [["today", "Сегодня"], ["plan", "План"], ["calendar", "Календарь"], ["progress", "Успехи"]];

function renderTabbar() {
  tabbar.hidden = false;
  tabbar.innerHTML = TABS.map(([key, label]) =>
    `<button type="button" data-tab="${key}" class="${view === key ? "active" : ""}">${ICONS[key]}<span>${label}</span></button>`).join("");
}
tabbar.addEventListener("click", (e) => {
  const button = e.target.closest("button[data-tab]");
  if (!button) return;
  view = button.dataset.tab;
  cal.pick = null;
  render();
  window.scrollTo(0, 0);
});

// ---------- Анкета ----------

const draft = {};
let step = 0;

const STEPS = [
  { key: "welcome" },
  {
    key: "goal", title: "Какая у тебя цель?", hint: "От цели зависят подходы, повторы, отдых и кардио.",
    choices: [
      ["mass", "💪", GOALS.mass, "Больше объём мышц"],
      ["recomp", "⚡️", GOALS.recomp, "Растим мышцы и убираем жир одновременно"],
      ["cut", "🔥", GOALS.cut, "Сжечь жир и сохранить мышцы"],
      ["strength", "🏋️", GOALS.strength, "Поднимать больше в базовых упражнениях"],
    ],
  },
  {
    key: "level", title: "Твой опыт", hint: "Опытным — больше объёма, новичкам — проще техника.",
    choices: [
      ["novice", "🌱", LEVELS.novice, "Меньше полугода регулярных тренировок"],
      ["intermediate", "📈", LEVELS.intermediate, "Полгода – 2 года, знаю базу"],
      ["advanced", "🏆", LEVELS.advanced, "Больше 2 лет"],
    ],
  },
  { key: "days", title: "В какие дни тренируешься?", hint: "Выбери от 2 до 6 дней. От их числа зависит схема программы." },
  { key: "split", title: "Как делить мышцы по дням?", hint: "Варианты зависят от числа дней. В раздельной схеме грудь и спина — в разные дни." },
  {
    key: "duration", title: "Сколько длится тренировка?", hint: "Включая разминку и кардио.",
    chips: [[45, "45 мин"], [60, "1 час"], [75, "1 ч 15 мин"], [90, "1,5 часа"]],
  },
  {
    key: "priority", multi: true, max: 2, title: "Что подтянуть в первую очередь?", hint: "До двух групп — им достанется больше подходов. Можно пропустить.",
    chips: Object.entries(MUSCLES).filter(([k]) => k !== "core"),
  },
  {
    key: "injuries", multi: true, title: "Есть что-то, что болит?", hint: "Уберём упражнения, которые нагружают эти места. Можно пропустить.",
    chips: Object.entries(INJURIES),
  },
  {
    key: "cardio", title: "Добавить кардио?", hint: "Для рельефа кардио помогает сжигать жир, а мышцам почти не мешает.",
    choices: [
      [true, "🚴", "Да", "15–25 минут в конце части тренировок"],
      [false, "🙅", "Нет", "Только силовые"],
    ],
  },
  { key: "body", title: "Немного о тебе", hint: "Нужно для графика успехов. Можно пропустить." },
];

function startOnboarding(fromProfile) {
  Object.assign(draft, fromProfile || { goal: "recomp", level: "advanced", days: DEFAULT_DAYS[4], duration: 60, priority: [], injuries: [], cardio: true, weight: "", height: "", excluded: DEFAULT_EXCLUDED });
  draft.days = [...draft.days];
  draft.priority = [...draft.priority];
  draft.injuries = [...draft.injuries];
  draft.excluded = [...(draft.excluded || DEFAULT_EXCLUDED)];
  step = fromProfile ? 1 : 0;
  renderOnboarding();
}

function renderOnboarding() {
  tabbar.hidden = true;
  app.classList.add("no-tabbar");
  const s = STEPS[step];

  if (s.key === "welcome") {
    app.innerHTML = `
      <div class="blobs"><i></i><i></i><i></i></div>
      <section class="onb welcome">
        <h1>Тренировки, которые подстраиваются под тебя</h1>
        <p class="hint">9 коротких вопросов — и готова программа под твою цель, время и зал.</p>
        <div class="features">
          <div><span>🧠</span>План подбирается сам — по цели, опыту и дням</div>
          <div><span>💚</span>Учитывает восстановление из WHOOP</div>
          <div><span>📈</span>Веса растут по циклу из 6 недель</div>
        </div>
        <button class="btn" data-next>Начать</button>
        <button class="btn link" data-restore>Есть копия? Восстановить данные</button>
      </section>`;
    return;
  }

  let body = "";
  if (s.choices) {
    body = `<div class="choices">${s.choices.map(([value, emoji, label, desc]) => `
      <button type="button" class="choice ${draft[s.key] === value ? "active" : ""}" data-value='${JSON.stringify(value)}'>
        <span class="emoji">${emoji}</span><span><b>${esc(label)}</b><small>${esc(desc)}</small></span>
      </button>`).join("")}</div>`;
  } else if (s.chips) {
    const isActive = (v) => (s.multi ? draft[s.key].includes(v) : draft[s.key] === v);
    body = `<div class="chips">${s.chips.map(([value, label]) =>
      `<button type="button" class="chip ${isActive(value) ? "active" : ""}" data-value='${JSON.stringify(value)}'>${esc(label)}</button>`).join("")}</div>`;
  } else if (s.key === "days") {
    body = `<div class="days-grid">${WEEKDAYS.map((d, i) =>
      `<button type="button" class="chip ${draft.days.includes(i) ? "active" : ""}" data-value="${i}">${d}</button>`).join("")}</div>
      <p class="hint" style="margin-top:14px">${daysHint(draft.days.length)}</p>`;
  } else if (s.key === "split") {
    const current = splitFor(draft).id;
    body = `<div class="choices">${SPLIT_OPTIONS[draft.days.length].map((o) => `
      <button type="button" class="choice ${o.id === current ? "active" : ""}" data-value='${JSON.stringify(o.id)}'>
        <span><b>${esc(o.name)}</b><small>${esc(o.desc)}</small>
        <small class="${o.mixes ? "" : "ok"}">${o.mixes ? "Грудь и спина бывают в один день" : "✓ Грудь и спина — в разные дни"}</small></span>
      </button>`).join("")}</div>`;
  } else if (s.key === "body") {
    body = `
      <label class="field"><span>Вес, кг</span><input type="number" inputmode="decimal" name="weight" value="${esc(draft.weight)}" placeholder="—"></label>
      <label class="field"><span>Рост, см</span><input type="number" inputmode="numeric" name="height" value="${esc(draft.height)}" placeholder="—"></label>`;
  }

  const last = step === STEPS.length - 1;
  const canNext = s.key !== "days" || (draft.days.length >= 2 && draft.days.length <= 6);
  app.innerHTML = `
    <section class="onb">
      <div class="onb-top">
        <button type="button" class="onb-back" data-back ${step <= 1 && !state.profile ? "disabled" : ""} aria-label="Назад">‹</button>
        <div class="progress"><i style="width:${(step / (STEPS.length - 1)) * 100}%"></i></div>
      </div>
      <h1>${esc(s.title)}</h1>
      <p class="hint">${esc(s.hint)}</p>
      ${body}
      <div class="onb-footer">
        <button type="button" class="btn" data-next ${canNext ? "" : "disabled"}>${last ? "Составить план" : "Далее"}</button>
      </div>
    </section>`;
}

function daysHint(n) {
  return n >= 2 && n <= 6 ? `${n} дн. в неделю — схему тренировок выберешь на следующем шаге` : "Выбери от 2 до 6 дней";
}

app.addEventListener("click", (e) => {
  if (state.profile && !app.querySelector(".onb")) return;  // клики по экранам — ниже, в onScreenClick
  const s = STEPS[step];
  if (e.target.closest("[data-back]")) {
    if (step <= 1 && state.profile) { render(); return; }  // вернуться из повторной анкеты без изменений
    step = Math.max(0, step - 1);
    renderOnboarding();
    return;
  }
  if (e.target.closest("[data-next]")) {
    if (s.key === "body") {
      draft.weight = app.querySelector("[name=weight]").value;
      draft.height = app.querySelector("[name=height]").value;
    }
    if (step === STEPS.length - 1) { finishOnboarding(); return; }
    step += 1;
    renderOnboarding();
    window.scrollTo(0, 0);
    return;
  }
  const option = e.target.closest("[data-value]");
  if (!option) return;
  const value = JSON.parse(option.dataset.value);
  if (s.key === "days") {
    draft.days = draft.days.includes(value) ? draft.days.filter((d) => d !== value) : [...draft.days, value].sort();
    if (draft.days.length > 6) draft.days = draft.days.filter((d) => d !== value);
  } else if (s.multi) {
    const list = draft[s.key];
    if (list.includes(value)) draft[s.key] = list.filter((v) => v !== value);
    else if (!s.max || list.length < s.max) draft[s.key] = [...list, value];
    else toast(`Можно выбрать не больше ${s.max}`);
  } else {
    draft[s.key] = value;
    if (s.key === "goal") draft.cardio = value === "recomp" || value === "cut";
  }
  renderOnboarding();
});

function finishOnboarding() {
  app.innerHTML = `<section class="building"><div class="spinner"></div><h2>Собираю план…</h2><p class="hint">Подбираю упражнения под цель и время</p></section>`;
  const profile = { ...draft, split: splitFor(draft).id, weight: draft.weight ? Number(draft.weight) : null, height: draft.height ? Number(draft.height) : null };
  setTimeout(() => {
    state.profile = profile;
    state.plan = generatePlan(profile);
    dropFutureMoves();
    persist();
    view = "plan";
    render();
    toast("План готов 💪");
  }, 900);
}

// ---------- Экран «Сегодня» ----------

function sessionForDay(dayIdx) {
  return state.plan.sessions.find((s) => s.weekday === dayIdx);
}

function nextSession(from) {
  for (let i = 1; i <= 7; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const s = sessionOn(d);
    if (s) return { session: s, date: d, inDays: i };
  }
  return null;
}

// ---------- Цвета тренировок и кольцо восстановления ----------

// У каждой группы мышц свой цвет — тренировка дня окрашена в цвет своих мышц
const THEMES = {
  chest: ["#ff5f6d", "#ff9a5c"],
  back: ["#3a5bff", "#6f8cff"],
  legs: ["#7c4dff", "#b07cff"],
  shoulders: ["#ff9f1c", "#ffc94a"],
  arms: ["#00a99d", "#3fd4bf"],
  upper: ["#3a5bff", "#ff5f6d"],
  full: ["#12b76a", "#4fd1a5"],
  light: ["#38bdf8", "#7dd3fc"],
};
function themeOf(session) {
  const key = session.light ? "light" : session.key;
  const name = /^(chest|push)/.test(key) ? "chest" : /^(back|pull)/.test(key) ? "back"
    : /^(legs|lower)/.test(key) ? "legs" : /^shoulders/.test(key) ? "shoulders"
    : key === "arms" ? "arms" : /^upper/.test(key) ? "upper" : key === "light" ? "light" : "full";
  const [c1, c2] = THEMES[name];
  return `--c1:${c1};--c2:${c2}`;
}

function ring(level, pct) {
  const r = 50, full = 2 * Math.PI * r;
  const value = pct != null ? pct : { green: 85, yellow: 50, red: 20 }[level] || 0;
  return `<svg class="ring" viewBox="0 0 120 120" style="--full:${full.toFixed(1)}">
    <circle class="ring-bg" cx="60" cy="60" r="${r}"/>
    ${level ? `<circle class="ring-fg" cx="60" cy="60" r="${r}" stroke-dasharray="${full.toFixed(1)}" stroke-dashoffset="${(full * (1 - value / 100)).toFixed(1)}"/>` : ""}
  </svg>`;
}

const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>';

function exerciseList(items, sessionIndex) {
  return `<ul class="ex-list">${items.map((it, i) => {
    const ex = BY_ID[it.exercise];
    return `<li><button type="button" class="ex ${it.role}" data-ex="${sessionIndex}:${i}">
      <span class="ex-num">${it.cardio ? "♥" : it.superset ? "+" : i + 1}</span>
      <span class="ex-body"><span class="ex-name">${esc(ex.name)}</span><span class="ex-dose">${dose(it)}</span></span>
      <span class="ex-chev">›</span></button></li>`;
  }).join("")}</ul>`;
}

/** Цветная карточка тренировки: шапка в цветах мышц и список упражнений. */
function sessionCard(w, ref, { kicker, start = false, note = "", extra = "" } = {}) {
  const startLabel = state.active ? "Продолжить тренировку" : "Начать тренировку";
  return `
    <section class="card session rise" style="${themeOf(w)}">
      <div class="session-head">
        <div class="kicker">${esc(kicker)}</div>
        <h2>${esc(w.name)}</h2>
        <p>${esc(w.focus)}</p>
        <div class="chips">
          <span class="pill">⏱ ~${sessionMinutes(w.items)} мин</span>
          <span class="pill">${w.items.length} упр.</span>
          ${w.reduced ? '<span class="pill">−1 подход</span>' : ""}
          ${w.deload ? '<span class="pill">Разгрузка</span>' : ""}
        </div>
      </div>
      <div class="session-body">
        ${exerciseList(w.items, ref)}
        ${start ? `<button type="button" class="start-btn" data-start>${PLAY_ICON} ${startLabel}</button>` : ""}
        ${extra}
        ${note ? `<p class="session-note">${note}</p>` : ""}
      </div>
    </section>`;
}

/** Плашка «тренировка засчитана» — с итогами, если подходы записаны в приложении. */
function todayDone() {
  const log = [...state.logs].reverse().find((l) => l.date === todayIso());
  if (!log) return `<div class="today-done">🎉 Тренировка засчитана<button type="button" data-today-done>Снять</button></div>`;
  const sum = summarize(log, state.logs.filter((l) => l !== log));
  return `<div class="today-done">🎉 Засчитана · ${sum.minutes} мин · ${sum.sets} подх.</div>`;
}

function greeting(now) {
  const h = now.getHours();
  return h < 5 ? "Доброй ночи" : h < 12 ? "Доброе утро" : h < 18 ? "Добрый день" : "Добрый вечер";
}

function renderToday() {
  const now = new Date();
  const longDate = now.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  const dateLabel = longDate.charAt(0).toUpperCase() + longDate.slice(1);
  const week = cycleWeek(state.plan);
  const rec = state.recovery[todayIso()];
  const level = rec ? rec.level : null;
  const session = sessionOn(now);
  const dayMark = state.days[todayIso()] || {};

  const recoveryCard = `
    <section class="card recovery rise ${level || ""}">
      <div class="rec-top">
        <div class="ring-wrap">${ring(level, rec && rec.pct)}
          <div class="ring-label"><b>${rec && rec.pct != null ? rec.pct + "%" : level ? RECOVERY[level].emoji : "?"}</b><small>WHOOP</small></div>
        </div>
        <div class="rec-text">
          <small>Восстановление</small>
          <h2>${level ? RECOVERY[level].label : "Не отмечено"}</h2>
          <p>${level ? RECOVERY[level].note : "Посмотри процент в WHOOP и отметь его — тренировка подстроится."}</p>
        </div>
      </div>
      <div class="rec-controls">
        ${Object.entries(RECOVERY).map(([key, r]) => `
          <button type="button" class="rec-btn ${key} ${level === key ? "active" : ""}" data-rec="${key}"><i></i>${r.label}</button>`).join("")}
        <input class="rec-pct" type="number" inputmode="numeric" min="0" max="100" id="rec-pct" value="${rec && rec.pct != null ? rec.pct : ""}" placeholder="%" aria-label="Процент восстановления">
      </div>
    </section>`;

  let workoutCard;
  if (session) {
    const idx = state.plan.sessions.indexOf(session);
    const w = workoutFor(state.plan, session, week, level);
    w.reduced = level === "yellow" && !w.deload;
    const done = dayMark.status === "done";
    workoutCard = sessionCard(w, w.light ? "light" : idx, {
      kicker: done ? "Сегодня · выполнено ✓" : `Сегодня · неделя ${week} из ${CYCLE_WEEKS}`,
      start: !done,
      extra: done
        ? todayDone()
        : `<div class="today-actions">
            <button type="button" class="act" data-today-done>✓ Уже сделал</button>
            <button type="button" class="act" data-today-move>↪ Перенести</button>
          </div>`,
      note: done ? "" : w.light ? `Тяжёлую «${esc(session.name)}» лучше перенести на день с хорошим восстановлением — нажми «Перенести».` : weekNote(week),
    });
  } else {
    const next = nextSession(now);
    workoutCard = `
      <section class="card rest rise">
        <div class="emoji">😌</div>
        <h2>День отдыха</h2>
        <p class="sub">Мышцы растут, пока ты отдыхаешь. Выспись и добери белок.</p>
        ${next ? `<div class="next" style="${themeOf(next.session)}"><i></i><div>
          <small>${next.inDays === 1 ? "Завтра" : WEEKDAYS_FULL[weekdayIndex(next.date)]}</small>
          <b>${esc(next.session.name)}</b></div></div>` : ""}
      </section>`;
  }

  app.innerHTML = `
    <header class="large-title"><small>${esc(dateLabel)}</small><h1>${greeting(now)}</h1></header>
    ${recoveryCard}
    ${workoutCard}
    ${backupDue() ? `<button type="button" class="card backup-nudge rise" data-backup><span>💾</span><div><b>Сохрани копию данных</b><small>${state.lastBackup ? "Последней копии больше 2 недель" : "Тренировки хранятся только в телефоне"}</small></div><i>›</i></button>` : ""}`;
}

function setRecovery(level, pct = null) {
  const today = todayIso();
  const current = state.recovery[today];
  if (current && current.level === level && pct == null) delete state.recovery[today];  // повторное нажатие — снять отметку
  else state.recovery[today] = { level, pct };
  persist();
  render();
}

// ---------- Экран «План» ----------

function renderPlan() {
  const plan = state.plan;
  const p = state.profile;
  const summary = profileSummary(p);
  const week = cycleWeek(plan);
  const todayIdx = weekdayIndex(new Date());

  const cycle = Array.from({ length: CYCLE_WEEKS }, (_, i) => {
    const n = i + 1;
    const now = n === week ? "now" : "";
    const cls = [n === CYCLE_WEEKS ? "deload" : "", n < week ? "done" : "", now].join(" ");
    return `<div><i class="${cls}"></i><span class="${now}">${n === CYCLE_WEEKS ? "Р" : n}</span></div>`;
  }).join("");

  // Карточки начинаются с ближайшей тренировки
  const order = plan.sessions.map((s, idx) => ({ s, idx }));
  const first = Math.max(0, order.findIndex(({ s }) => s.weekday >= todayIdx));

  app.innerHTML = `
    <header class="large-title"><small>${esc(plan.split)}</small><h1>План</h1></header>

    <div class="summary rise">
      <span class="pill">🎯 ${esc(summary.goal)}</span>
      <span class="pill">📅 ${plan.sessions.length} <span>в неделю</span></span>
      <span class="pill">⏱ до ${p.duration} <span>мин</span></span>
      <span class="pill">⭐️ ${esc(summary.priority)}</span>
      <span class="pill">${p.cardio ? "🚴 с кардио" : "🏋️ без кардио"}</span>
    </div>

    <h3 class="section-title">Цикл · неделя ${week} из ${CYCLE_WEEKS}</h3>
    <section class="card rise">
      <div class="cycle">${cycle}</div>
      <p class="cycle-note">${weekNote(week)}</p>
    </section>

    <h3 class="section-title">Неделя</h3>
    <div class="week-strip">${WEEKDAYS.map((d, i) => {
      const s = plan.sessions.find((x) => x.weekday === i);
      return `<button type="button" class="wd ${s ? "train" : ""} ${i === todayIdx ? "today" : ""}" ${s ? `style="${themeOf(s)}" data-goto="${plan.sessions.indexOf(s)}"` : ""}>${d}<i></i></button>`;
    }).join("")}</div>

    <h3 class="section-title">Тренировки</h3>
    <div class="days-scroller" id="days">
      ${order.map(({ s, idx }) => sessionCard(s, idx, { kicker: WEEKDAYS_FULL[s.weekday] })).join("")}
    </div>
    <div class="dots" id="dots">${order.map((_, i) => `<i class="${i === first ? "on" : ""}"></i>`).join("")}</div>

    <button type="button" class="btn secondary" data-redo>Изменить анкету и пересобрать план</button>

    <h3 class="section-title">Мои данные</h3>
    <section class="card backup-card">
      <p>Все тренировки хранятся только в этом телефоне. Сохраняй копию в «Файлы» или iCloud — если удалить приложение или сменить телефон, из неё всё восстановится.</p>
      <p class="backup-when">${state.lastBackup ? `Последняя копия: ${new Date(state.lastBackup).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}` : "Копию ещё не сохраняли"}</p>
      <button type="button" class="btn" data-backup>Сохранить копию</button>
      <button type="button" class="btn secondary" data-restore>Восстановить из копии</button>
    </section>
    <p class="hint-center">Листай тренировки вбок. Нажми на упражнение — техника и замена.</p>`;

  const scroller = document.getElementById("days");
  const cards = [...scroller.children];
  scroller.scrollLeft = cards[first].offsetLeft - 18;
  scroller.addEventListener("scroll", () => {
    const i = Math.round(scroller.scrollLeft / (cards[0].offsetWidth + 12));
    document.querySelectorAll("#dots i").forEach((d, j) => d.classList.toggle("on", j === i));
  }, { passive: true });
}

// ---------- Календарь: что стоит на конкретную дату ----------

// state.days[дата] = { session: номер тренировки или null (перенесена / убрана),
//                      status: "done" | "skipped", name и key — какая тренировка была сделана }
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

const fromIso = (iso) => new Date(iso + "T00:00:00");
function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const longDay = (d) => capitalize(d.toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" }));

/**
 * Тренировка по шаблону недели (без учёта переносов отдельных дней).
 * shifts — сдвиги очереди: после переноса на занятый день все тренировки дальше идут на один день позже.
 */
function plannedIdx(iso) {
  if (iso < state.plan.startDate) return null;
  const s = sessionForDay(weekdayIndex(fromIso(iso)));
  if (!s) return null;
  const len = state.plan.sessions.length;
  const shift = (state.plan.shifts || []).reduce((n, x) => n + (x.from <= iso ? x.n : 0), 0);
  return (((state.plan.sessions.indexOf(s) - shift) % len) + len) % len;
}
/** Номер тренировки на дату с учётом переносов, или null — отдых. */
function sessionIdxOn(iso) {
  const d = state.days[iso];
  if (d && "session" in d) return d.session != null && d.session < state.plan.sessions.length ? d.session : null;
  return plannedIdx(iso);
}
function sessionOn(date) {
  const idx = sessionIdxOn(isoDate(date));
  return idx == null ? null : state.plan.sessions[idx];
}

/** Меняет отметку дня; пустые записи и переносы «как по плану» убирает. */
function setDay(iso, patch) {
  const d = { ...state.days[iso], ...patch };
  for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];
  if ("session" in d && d.session === plannedIdx(iso)) delete d.session;
  delete d.pair;   // от старой версии переносов
  if (Object.keys(d).length) state.days[iso] = d;
  else delete state.days[iso];
}

/**
 * Переносит тренировку с одного дня на другой.
 * Свободный день — просто ставим туда. Занятый день — тренировки не меняются местами, а сдвигаются:
 *   вперёд — занятая тренировка уходит на следующий тренировочный день, и так весь календарь дальше;
 *   назад — сдвигаются только тренировки между этими днями.
 */
function moveSession(from, to) {
  const x = sessionIdxOn(from);
  const busy = sessionIdxOn(to);
  if (busy == null) {
    setDay(to, { session: x, status: undefined });
    setDay(from, { session: null, status: undefined });
    return;
  }
  if (to > from) {
    setDay(from, { session: null, status: undefined });
    setDay(to, { session: x, status: undefined });
    // С дня после переноса каждая тренировка по плану сдвигается на один тренировочный день вперёд
    state.plan.shifts = [...(state.plan.shifts || []), { from: isoDate(addDays(fromIso(to), 1)), n: 1 }];
    return;
  }
  const slots = [];
  for (let d = fromIso(to); isoDate(d) <= from; d = addDays(d, 1)) {
    const iso = isoDate(d);
    if (sessionIdxOn(iso) != null && (state.days[iso] || {}).status !== "done") slots.push(iso);
  }
  const seq = slots.map(sessionIdxOn);
  slots.forEach((iso, i) => setDay(iso, { session: i === 0 ? x : seq[i - 1], status: undefined }));
}

/** Возвращает весь календарь с сегодняшнего дня как по плану: без переносов и сдвигов. */
function resetCalendar() {
  const today = todayIso();
  for (const iso of Object.keys(state.days)) {
    if (iso >= today && "session" in state.days[iso]) setDay(iso, { session: undefined });
  }
  // Сдвиги до сегодня оставляем для прошлых дней, а с сегодня компенсируем их
  const past = (state.plan.shifts || []).filter((s) => s.from < today);
  const sum = past.reduce((n, s) => n + s.n, 0);
  state.plan.shifts = sum ? [...past, { from: today, n: -sum }] : past;
}

// Отмена последнего переноса: снимок календаря до него
let undoMove = null;
function snapshotCalendar() {
  return JSON.stringify({ days: state.days, shifts: state.plan.shifts || [] });
}
function restoreCalendar(snap) {
  const s = JSON.parse(snap);
  state.days = s.days;
  state.plan.shifts = s.shifts;
}

/** Группа мышц тренировки — чтобы предупредить, если одни и те же мышцы два дня подряд. */
function groupOf(session) {
  const key = session.key;
  return /^(chest|push)/.test(key) ? "chest" : /^(back|pull)/.test(key) ? "back"
    : /^(legs|lower)/.test(key) ? "legs" : /^shoulders/.test(key) ? "shoulders"
    : key === "arms" ? "arms" : /^upper/.test(key) ? "upper" : "full";
}

/** Есть ли в ближайшие 3 недели одни и те же мышцы два дня подряд. */
function backToBack(fromIsoDate) {
  let prev = null;
  for (let i = 0; i < 21; i++) {
    const iso = isoDate(addDays(fromIso(fromIsoDate), i));
    const idx = sessionIdxOn(iso);
    const s = idx == null ? null : state.plan.sessions[idx];
    if (s && prev && groupOf(s) === groupOf(prev.s)) return { a: prev.iso, b: iso, name: s.name };
    prev = s ? { s, iso } : null;
  }
  return null;
}

function markDay(iso, status) {
  const d = state.days[iso] || {};
  if (d.status === status) { setDay(iso, { status: undefined, name: undefined, key: undefined }); return; }
  const s = state.plan.sessions[sessionIdxOn(iso)];
  setDay(iso, status === "done" && s ? { status, name: s.name, key: s.key } : { status, name: undefined, key: undefined });
}

/** Состояние дня для календаря. */
function dayState(iso, today) {
  const d = state.days[iso] || {};
  const idx = sessionIdxOn(iso);
  const session = idx == null ? null : state.plan.sessions[idx];
  let status = "rest";
  if (d.status === "done") status = "done";
  else if (session && d.status === "skipped") status = "skipped";
  else if (session) status = iso < today ? "missed" : "planned";
  const theme = status === "done" && d.key ? themeOf({ key: d.key }) : session ? themeOf(session) : "";
  return { idx, session, status, theme, moved: "session" in d, name: d.name || (session && session.name) };
}

// Старые переносы ссылаются на номера тренировок прошлого плана — при новом плане сбрасываем их с сегодняшнего дня
function dropFutureMoves() {
  const today = todayIso();
  for (const iso of Object.keys(state.days)) {
    if (iso >= today && "session" in state.days[iso]) setDay(iso, { session: undefined });
  }
}

// ---------- Экран «Календарь» ----------

const cal = { month: null, sel: null, pick: null };   // pick — день, тренировку с которого сейчас переносим

function renderCalendar() {
  const today = todayIso();
  if (!cal.month) { const n = new Date(); cal.month = new Date(n.getFullYear(), n.getMonth(), 1); }
  if (!cal.sel) cal.sel = today;
  const y = cal.month.getFullYear(), m = cal.month.getMonth();
  const first = addDays(cal.month, -weekdayIndex(cal.month));
  const last = new Date(y, m + 1, 0);

  const stats = { done: 0, missed: 0, planned: 0 };
  let weeks = "";
  for (let start = first; start <= last; start = addDays(start, 7)) {
    const deload = isoDate(addDays(start, 6)) >= state.plan.startDate && cycleWeek(state.plan, start) === CYCLE_WEEKS;
    let cells = "";
    for (let i = 0; i < 7; i++) {
      const date = addDays(start, i);
      const iso = isoDate(date);
      const inMonth = date.getMonth() === m;
      const ds = dayState(iso, today);
      if (inMonth) {
        if (ds.status === "done") stats.done++;
        else if (ds.status === "missed" || ds.status === "skipped") stats.missed++;
        else if (ds.status === "planned") stats.planned++;
      }
      const target = cal.pick && iso !== cal.pick && iso >= today && ds.status !== "done";
      const cls = ["cd", ds.status, inMonth ? "" : "out", iso === today ? "today" : "", iso === (cal.pick || cal.sel) ? "sel" : "", ds.moved ? "moved" : "",
        cal.pick ? (target ? "target" : iso === cal.pick ? "source" : "dim") : ""].join(" ");
      cells += `<button type="button" class="${cls}" data-day="${iso}" style="${ds.theme}"><span>${date.getDate()}</span></button>`;
    }
    weeks += `<div class="cal-week ${deload ? "deload" : ""}">${cells}</div>`;
  }

  app.innerHTML = `
    <header class="large-title"><small>Неделя ${cycleWeek(state.plan)} из ${CYCLE_WEEKS}</small><h1>Календарь</h1></header>

    ${cal.pick ? `<div class="pick-banner" style="${themeOf(state.plan.sessions[sessionIdxOn(cal.pick)])}">
      <div><b>Куда перенести «${esc(state.plan.sessions[sessionIdxOn(cal.pick)].name)}»?</b><small>Нажми на день. Если там уже тренировка — она и все следующие сдвинутся дальше.</small></div>
      <button type="button" data-pick-cancel>Отмена</button></div>` : ""}

    <section class="card cal-card ${cal.pick ? "picking" : "rise"}">
      <div class="cal-nav">
        <button type="button" data-cal-shift="-1" aria-label="Предыдущий месяц">‹</button>
        <b>${MONTHS[m]} ${y}</b>
        <button type="button" data-cal-shift="1" aria-label="Следующий месяц">›</button>
      </div>
      <div class="cal-head">${WEEKDAYS.map((d) => `<span>${d}</span>`).join("")}</div>
      <div class="cal-grid" id="cal-grid">${weeks}</div>
      <div class="cal-legend">
        <span><i class="lg done"></i>Сделано</span>
        <span><i class="lg planned"></i>Впереди</span>
        <span><i class="lg missed"></i>Пропуск</span>
        <span><i class="lg deload"></i>Разгрузка</span>
      </div>
    </section>

    <div class="cal-stats rise">
      <div><b>${stats.done}</b><span>сделано</span></div>
      <div><b>${stats.missed}</b><span>пропущено</span></div>
      <div><b>${stats.planned}</b><span>впереди</span></div>
    </div>

    <p class="hint-center">Нажми на день — откроется меню: перенести, отметить, добавить.</p>
    ${Object.keys(state.days).some((k) => k >= today && "session" in state.days[k]) || (state.plan.shifts || []).reduce((n, x) => n + x.n, 0) % state.plan.sessions.length
      ? `<button type="button" class="btn danger" data-cal-reset>Вернуть календарь как по плану</button>` : ""}`;
}

/** Как назвать день относительно сегодня: «сегодня», «завтра», «пт 24». */
function relDay(iso, today) {
  const diff = Math.round((fromIso(iso) - fromIso(today)) / 86400000);
  if (diff === 0) return "сегодня";
  if (diff === 1) return "завтра";
  if (diff === 2) return "послезавтра";
  const d = fromIso(iso);
  return `${WEEKDAYS[weekdayIndex(d)].toLowerCase()} ${d.getDate()}`;
}

/** Меню дня: открывается снизу сразу по нажатию на день. */
function openDaySheet(iso) {
  const today = todayIso();
  const date = fromIso(iso);
  const ds = dayState(iso, today);
  const started = isoDate(addDays(date, 6 - weekdayIndex(date))) >= state.plan.startDate;
  const week = started ? cycleWeek(state.plan, date) : null;
  const weekLabel = week ? (week === CYCLE_WEEKS ? " · разгрузочная неделя" : ` · неделя ${week} из ${CYCLE_WEEKS}`) : "";
  const future = iso >= today;
  const STATUS = { done: "✓ Выполнена", skipped: "Пропущена", missed: "Не отмечена", planned: "По плану" };
  const s = ds.session;

  let body;
  if (s || ds.status === "done") {
    // Быстрый перенос: два ближайших дня после этого (или с сегодня, если тренировка в прошлом)
    let quick = "";
    if (s && ds.status !== "done") {
      const base = iso < today ? addDays(fromIso(today), -1) : date;
      quick = [1, 2].map((n) => {
        const t = isoDate(addDays(base, n));
        const busy = dayState(t, today);
        const sub = busy.status === "done" ? "уже сделано" : busy.session ? `там «${esc(busy.session.name)}» — сдвинется дальше` : "свободно";
        return busy.status === "done" ? "" : `<button type="button" class="move-btn" data-move-to="${t}"><b>↪ На ${relDay(t, today)}</b><small>${sub}</small></button>`;
      }).join("") + `<button type="button" class="move-btn other" data-pick><b>📅 Другой день</b><small>выбрать в календаре</small></button>`;
    }
    body = `
      <div class="day-session" style="${ds.theme}">
        <i></i>
        <div><b>${esc(ds.name)}</b><small>${s ? `${esc(s.focus)} · ~${sessionMinutes(s.items)} мин` : "Выполнена"}</small></div>
        <span class="tag ${ds.status}">${STATUS[ds.status]}${ds.moved ? " · перенесена" : ""}</span>
      </div>
      ${quick ? `<div class="move-grid">${quick}</div>` : ""}
      ${s ? `<details class="day-ex"><summary>Упражнения (${s.items.length})</summary>${exerciseList(s.items, ds.idx)}</details>` : ""}
      <div class="day-actions">
        ${iso <= today && s ? `
          <button type="button" class="act ${ds.status === "done" ? "on done" : ""}" data-mark="done">✓ Выполнена</button>
          <button type="button" class="act ${ds.status === "skipped" ? "on skipped" : ""}" data-mark="skipped">✕ Пропустил</button>` : ""}
        ${s && future && ds.status !== "done" ? `<button type="button" class="act" data-remove>Убрать</button>` : ""}
        ${ds.status === "done" && !s ? `<button type="button" class="act on done" data-mark="done">✓ Снять отметку</button>` : ""}
      </div>`;
  } else {
    body = `<p class="day-rest">😌 День отдыха</p>
      ${future ? `<p class="picker-hint">Поставить тренировку на этот день:</p>
        ${state.plan.sessions.map((x, i) => `<button type="button" class="alt add-alt" data-add="${i}" style="${themeOf(x)}"><i></i><b>${esc(x.name)}</b><span>${esc(x.focus)}</span></button>`).join("")}` : ""}`;
  }

  cal.sel = iso;
  sheet.innerHTML = `
    <div class="sheet day-sheet" role="dialog" aria-label="${esc(longDay(date))}">
      <div class="sheet-grip"></div>
      <div class="eyebrow">${capitalize(relDay(iso, today))}${weekLabel}</div>
      <h2>${esc(longDay(date))}</h2>
      ${body}
      <button type="button" class="btn secondary" data-close>Закрыть</button>
    </div>`;
  sheet.hidden = false;
}

/** Переносит выбранную тренировку и показывает «Отменить» + предупреждение про одни мышцы подряд. */
function doMove(from, to) {
  const name = state.plan.sessions[sessionIdxOn(from)].name;
  const cascade = sessionIdxOn(to) != null;
  const snap = snapshotCalendar();
  moveSession(from, to);
  persist();
  undoMove = snap;
  cal.pick = null;
  cal.sel = to;
  const d = fromIso(to);
  cal.month = new Date(d.getFullYear(), d.getMonth(), 1);
  sheet.hidden = true;
  renderCalendar();
  const clash = backToBack(todayIso() < from ? todayIso() : from);
  const warn = clash ? ` ⚠️ «${clash.name}» два дня подряд (${relDay(clash.a, todayIso())} и ${relDay(clash.b, todayIso())}) — лучше с днём отдыха между` : "";
  toast(`«${name}» → ${relDay(to, todayIso())}${cascade ? ", остальные сдвинулись" : ""}.${warn}`, {
    label: "Отменить",
    run: () => { restoreCalendar(undoMove); undoMove = null; persist(); renderCalendar(); toast("Перенос отменён"); },
  });
}

function calendarClick(e) {
  const day = e.target.closest("[data-day]");
  if (day) {
    const iso = day.dataset.day;
    if (cal.pick) {
      // Выбираем, куда перенести
      if (iso === cal.pick) { cal.pick = null; renderCalendar(); return true; }
      if (iso < todayIso()) { toast("Можно перенести только на сегодня или позже"); return true; }
      if ((state.days[iso] || {}).status === "done") { toast("В этот день тренировка уже сделана"); return true; }
      doMove(cal.pick, iso);
      return true;
    }
    const d = fromIso(iso);
    if (d.getMonth() !== cal.month.getMonth()) cal.month = new Date(d.getFullYear(), d.getMonth(), 1);
    cal.sel = iso;
    renderCalendar();
    openDaySheet(iso);
    return true;
  }
  const shift = e.target.closest("[data-cal-shift]");
  if (shift) { shiftMonth(Number(shift.dataset.calShift)); return true; }
  if (e.target.closest("[data-pick-cancel]")) { cal.pick = null; renderCalendar(); return true; }
  if (e.target.closest("[data-cal-reset]")) {
    if (!confirm("Вернуть календарь с сегодняшнего дня как по плану? Все переносы и сдвиги отменятся.")) return true;
    const snap = snapshotCalendar();
    resetCalendar(); persist(); renderCalendar();
    undoMove = snap;
    toast("Календарь как по плану", { label: "Отменить", run: () => { restoreCalendar(undoMove); persist(); renderCalendar(); } });
    return true;
  }

  // Кнопки из меню дня
  const to = e.target.closest("[data-move-to]");
  if (to) { doMove(cal.sel, to.dataset.moveTo); return true; }
  if (e.target.closest("[data-pick]")) {
    cal.pick = cal.sel;
    sheet.hidden = true;
    renderCalendar();
    document.querySelector(".cal-card").scrollIntoView({ behavior: "smooth", block: "start" });
    return true;
  }
  const mark = e.target.closest("[data-mark]");
  if (mark) {
    markDay(cal.sel, mark.dataset.mark);
    persist(); renderCalendar(); openDaySheet(cal.sel);
    if (state.days[cal.sel] && state.days[cal.sel].status === "done") toast("Отмечено 💪");
    return true;
  }
  const add = e.target.closest("[data-add]");
  if (add) { setDay(cal.sel, { session: Number(add.dataset.add) }); persist(); sheet.hidden = true; renderCalendar(); toast("Тренировка добавлена"); return true; }
  if (e.target.closest("[data-remove]")) {
    if (!confirm("Убрать тренировку с этого дня? Она не перенесётся на другой день.")) return true;
    const snap = snapshotCalendar();
    setDay(cal.sel, { session: null, status: undefined }); persist(); sheet.hidden = true; renderCalendar();
    undoMove = snap;
    toast("Тренировка убрана", { label: "Отменить", run: () => { restoreCalendar(undoMove); persist(); renderCalendar(); } });
    return true;
  }
  return false;
}

function shiftMonth(n) {
  cal.month = new Date(cal.month.getFullYear(), cal.month.getMonth() + n, 1);
  renderCalendar();
}

// Свайп по месяцу — листать месяцы
let touchX = null;
app.addEventListener("touchstart", (e) => { touchX = e.target.closest("#cal-grid") ? e.touches[0].clientX : null; }, { passive: true });
app.addEventListener("touchend", (e) => {
  if (touchX == null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 60) shiftMonth(dx < 0 ? 1 : -1);
}, { passive: true });

// ---------- Тренировка: запись подходов и таймер отдыха ----------

let audio = null;     // звук окончания отдыха (на iPhone его можно включить только по нажатию)
let wakeLock = null;  // чтобы экран не гас во время тренировки
let lastSummary = null;

function unlockAudio() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch (e) { audio = null; }
}
function beep() {
  if (!audio) return;
  [0, 0.25, 0.5].forEach((t) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, audio.currentTime + t);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + t + 0.18);
    o.connect(g).connect(audio.destination);
    o.start(audio.currentTime + t);
    o.stop(audio.currentTime + t + 0.2);
  });
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) wakeLock = await navigator.wakeLock.request("screen");
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && view === "workout") { wakeLock = null; keepAwake(true); } });

const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.max(0, sec) % 60).padStart(2, "0")}`;

function startWorkout() {
  unlockAudio();
  if (!state.active) {
    const now = new Date();
    const session = sessionOn(now);
    if (!session) return;
    const rec = state.recovery[todayIso()];
    const w = workoutFor(state.plan, session, cycleWeek(state.plan), rec ? rec.level : null);
    state.active = newWorkout(w, { date: todayIso(), sessionIdx: state.plan.sessions.indexOf(session) });
    persist();
  }
  view = "workout";
  render();
  window.scrollTo(0, 0);
}

function renderWorkout() {
  const a = state.active;
  if (!a) { view = "today"; render(); return; }
  tabbar.hidden = true;
  app.classList.add("no-tabbar");
  keepAwake(true);
  const total = a.items.reduce((n, it) => n + it.sets.length, 0);
  const done = a.items.reduce((n, it) => n + it.sets.filter((s) => s.done).length, 0);

  const cards = a.items.map((it, i) => {
    const ex = BY_ID[it.exercise];
    const finished = it.sets.every((s) => s.done);
    if (it.cardio) {
      const s = it.sets[0];
      return `<section class="card wk-ex ${finished ? "finished" : ""}">
        <div class="wk-title"><span class="ex-num cardio">♥</span><button type="button" data-ex="${it.ref}"><b>${esc(ex.name)}</b><small>${it.minutes} мин, ровный темп</small></button></div>
        <button type="button" class="wk-cardio ${s.done ? "done" : ""}" data-set="${i}:0">${s.done ? "✓ Сделано" : `Отметить ${it.minutes} мин`}</button>
      </section>`;
    }
    const last = lastFor(state.logs, it.exercise);
    const sug = suggestion(it, last, cycleWeek(state.plan, fromIso(a.date)));
    const hurt = painTwice(state.logs, it.exercise);
    const secs = it.unit === "сек";
    const rows = it.sets.map((s, j) => {
      const prev = last && last.sets[j];
      // Подсказка веса: что ввёл в прошлом подходе сегодня → совет приложения → вес с прошлого раза
      const before = j > 0 && it.sets[j - 1].w !== "" ? it.sets[j - 1].w : null;
      const phW = before != null ? before : sug && sug.weight != null ? fmt(sug.weight) : prev && prev.w != null ? fmt(prev.w) : "";
      const phR = prev && prev.r != null ? prev.r : it.reps[1];
      return `<div class="wk-set ${s.done ? "done" : ""}">
        <span class="wk-n">${j + 1}</span>
        ${secs ? `<span class="wk-dash">—</span>` : `<input class="wk-in" inputmode="decimal" data-w="${i}:${j}" value="${esc(s.w)}" placeholder="${phW || "кг"}" aria-label="Вес, кг">`}
        <input class="wk-in" inputmode="numeric" data-r="${i}:${j}" value="${esc(s.r)}" placeholder="${phR}" aria-label="${secs ? "Секунды" : "Повторы"}">
        <button type="button" class="wk-check" data-set="${i}:${j}" aria-label="Подход сделан">✓</button>
      </div>`;
    }).join("");
    return `<section class="card wk-ex ${finished ? "finished" : ""}" style="${themeOf(a.light ? { light: true } : { key: a.key })}">
      <div class="wk-title"><span class="ex-num">${it.superset ? "+" : i + 1}</span>
        <button type="button" data-ex="${it.ref}"><b>${esc(ex.name)}</b><small>${it.sets.length} × ${it.reps[0]}–${it.reps[1]}${secs ? " сек" : ""} · ${it.pairStart ? "суперсет ↓" : "отдых " + restLabel(it.rest)}</small></button>
        ${it.feel ? `<button type="button" class="feel-tag" data-ask="${i}" aria-label="Изменить ощущения">${FEELS[it.feel].emoji}${it.pain ? "🤕" : ""}</button>` : ""}</div>
      ${last ? `<p class="wk-last">Прошлый раз: ${last.sets.map((s) => (s.w != null ? fmt(s.w) + "×" : "") + s.r).join(", ")}</p>` : ""}
      ${sug ? `<p class="wk-hint">${sug.text}</p>` : ""}
      ${hurt ? `<p class="wk-hint pain">🤕 Два последних раза что-то болело — лучше заменить: нажми на название упражнения</p>` : ""}
      <div class="wk-head"><span>#</span><span>${secs ? "" : "кг"}</span><span>${secs ? "сек" : "повт"}</span><span></span></div>
      ${rows}
      <button type="button" class="wk-add" data-add-set="${i}">＋ подход</button>
    </section>`;
  }).join("");

  app.innerHTML = `
    <div class="wk-top" style="${themeOf(a.light ? { light: true } : { key: a.key })}">
      <button type="button" class="wk-back" data-wk-hide aria-label="Свернуть">‹</button>
      <div class="wk-name"><b>${esc(a.name)}</b><small><span id="wk-elapsed">${clock(Math.floor((Date.now() - a.startedAt) / 1000))}</span> · ${done} из ${total} подх.</small></div>
      <button type="button" class="wk-finish" data-wk-finish>Готово</button>
      <div class="wk-progress"><i style="width:${total ? (done / total) * 100 : 0}%"></i></div>
    </div>
    ${cards}
    <button type="button" class="btn danger" data-wk-cancel>Отменить тренировку</button>
    <div class="rest-bar" id="rest-bar" hidden></div>`;
  tick();
}

function tick() {
  const a = state.active;
  if (!a || view !== "workout") return;
  const el = document.getElementById("wk-elapsed");
  if (el) el.textContent = clock(Math.floor((Date.now() - a.startedAt) / 1000));
  const bar = document.getElementById("rest-bar");
  if (!bar) return;
  let left = null;
  if (a.rest) {
    left = Math.ceil((a.rest.until - Date.now()) / 1000);
    if (left <= 0 && !a.rest.rang) { a.rest.rang = true; persist(); beep(); }
    if (left <= -60) { a.rest = null; left = null; persist(); }
  }
  const ask = a.ask != null && a.items[a.ask] ? a.ask : null;
  if (left == null && ask == null) { bar.hidden = true; bar.dataset.layout = ""; return; }
  bar.hidden = false;

  // Кнопки пересобираем, только когда меняется вид панели — иначе нажатие может «потеряться»
  const layout = `${ask}|${left == null ? "none" : left > 0 ? "rest" : "go"}|${ask != null && a.items[ask].pain}`;
  if (bar.dataset.layout !== layout) {
    bar.dataset.layout = layout;
    bar.className = `rest-bar ${left != null && left <= 0 ? "go" : ""} ${ask != null ? "asking" : ""}`;
    const it = ask != null ? a.items[ask] : null;
    const question = it ? `
      <div class="feel-ask">
        <div class="feel-q"><span>Как зашло «${esc(BY_ID[it.exercise].name)}»?</span><button type="button" data-feel-skip aria-label="Не отвечать">✕</button></div>
        <div class="feel-row">${Object.entries(FEELS).map(([k, f]) => `
          <button type="button" class="${it.feel === k ? "on" : ""}" data-feel="${k}"><span>${f.emoji}</span><b>${f.label}</b><small>${f.hint}</small></button>`).join("")}</div>
        <button type="button" class="feel-pain ${it.pain ? "on" : ""}" data-pain>🤕 Что-то болело${it.pain ? " ✓" : ""}</button>
      </div>` : "";
    const timer = left == null ? "" : left > 0
      ? `<div class="rest-row"><div class="rest-fill" id="rest-fill"></div>
           <button type="button" data-rest="-15">−15</button>
           <div class="rest-mid"><small>Отдых</small><b id="rest-time"></b></div>
           <button type="button" data-rest="15">+15</button>
           <button type="button" data-rest="skip" class="rest-skip">Дальше</button></div>`
      : `<div class="rest-row"><div class="rest-mid"><small>Отдых закончился</small><b>Следующий подход 💪</b></div>
           <button type="button" data-rest="skip" class="rest-skip">OK</button></div>`;
    bar.innerHTML = question + timer;
  }
  if (left != null && left > 0) {
    const t = document.getElementById("rest-time"), f = document.getElementById("rest-fill");
    if (t) t.textContent = clock(left);
    if (f) f.style.width = `${Math.max(0, Math.min(100, (left / a.rest.total) * 100))}%`;
  }
}
setInterval(tick, 500);

function setDone(i, j) {
  const a = state.active;
  const it = a.items[i];
  const s = it.sets[j];
  if (s.done) { s.done = false; persist(); renderWorkout(); return; }
  // Пустые поля — берём подсказку (серый текст в поле)
  const row = app.querySelector(`[data-set="${i}:${j}"]`).closest(".wk-set");
  if (row) {
    const wIn = row.querySelector("[data-w]"), rIn = row.querySelector("[data-r]");
    if (wIn && s.w === "" && /\d/.test(wIn.placeholder)) s.w = wIn.placeholder;
    if (rIn && s.r === "") s.r = rIn.placeholder;
  }
  s.done = true;
  // Последний подход упражнения — спрашиваем, как зашло (если ещё не отвечал)
  if (!it.cardio && !it.feel && it.sets.every((x) => x.done)) a.ask = i;
  if (it.cardio) a.rest = null;
  else if (it.pairStart) { a.rest = null; toast(`Суперсет: сразу ${BY_ID[a.items[i + 1].exercise].name}`); }
  else a.rest = { until: Date.now() + it.rest * 1000, total: it.rest, rang: false };
  persist();
  const y = window.scrollY;
  renderWorkout();
  window.scrollTo(0, y);
}

function finishWorkout() {
  const a = state.active;
  const done = a.items.some((it) => it.sets.some((s) => s.done));
  if (!done) { toast("Отметь хотя бы один подход ✓ — или отмени тренировку"); return; }
  const left = a.items.reduce((n, it) => n + it.sets.filter((s) => !s.done).length, 0);
  if (left && !confirm(`Осталось ${left} подх. — всё равно завершить?`)) return;
  askEnergy();
}

/** Последний вопрос: как тренировка в целом. Потом — итоги. */
function askEnergy() {
  sheet.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Как тренировка?">
      <div class="sheet-grip"></div>
      <h2>Как тренировка в целом?</h2>
      <p class="muted small">Вместе с восстановлением WHOOP это покажет, в какие дни ты реально в форме.</p>
      <div class="energy-row">${ENERGY.map(([n, emoji, label]) => `<button type="button" data-energy="${n}"><span>${emoji}</span><b>${label}</b></button>`).join("")}</div>
      <button type="button" class="btn secondary" data-energy="0">Пропустить</button>
    </div>`;
  sheet.hidden = false;
}

function completeWorkout() {
  const a = state.active;
  a.ask = null;
  const log = toLog(a);
  const before = unlockedIds(stats(progressCtx()));
  lastSummary = { ...summarize(log, state.logs), name: a.name, key: a.key, light: a.light };
  state.logs.push(log);
  setDay(a.date, { status: "done", name: a.name, key: a.key });
  lastSummary.badges = badges(stats(progressCtx())).filter((b) => b.done && !before.includes(b.id));
  state.active = null;
  persist();
  keepAwake(false);
  view = "summary";
  render();
  window.scrollTo(0, 0);
}

function renderSummary() {
  tabbar.hidden = true;
  app.classList.add("no-tabbar");
  const s = lastSummary;
  if (!s) { view = "today"; render(); return; }
  const tons = s.volume >= 1000 ? `${fmt(Math.round(s.volume / 100) / 10)} т` : `${Math.round(s.volume)} кг`;
  app.innerHTML = `
    <section class="summary-screen" style="${themeOf(s.light ? { light: true } : { key: s.key })}">
      <div class="confetti">${"<i></i>".repeat(14)}</div>
      <div class="emoji">${s.records.length ? "🏆" : "🎉"}</div>
      <h1>Тренировка готова!</h1>
      <p class="hint">${esc(s.name)} · отмечено в календаре</p>
      <div class="sum-grid">
        <div><b>${s.minutes}</b><span>минут</span></div>
        <div><b>${s.sets}</b><span>подходов</span></div>
        <div><b>${tons}</b><span>поднято</span></div>
      </div>
      ${s.records.length ? `<h3 class="section-title">Новые рекорды</h3>
        <section class="card">${s.records.map((r) => `<div class="record"><span>🏅 ${esc(BY_ID[r.exercise].name)}</span><b>${fmt(r.weight)} кг <small>было ${fmt(r.was)}</small></b></div>`).join("")}</section>` : ""}
      ${s.badges && s.badges.length ? `<h3 class="section-title">Новые достижения</h3>
        <div class="badges">${s.badges.map((b) => `<div class="badge done pop"><span>${b.emoji}</span><b>${esc(b.title)}</b><small>${esc(b.desc)}</small></div>`).join("")}</div>` : ""}
      <button type="button" class="btn" data-sum-close>Готово</button>
    </section>`;
}

function workoutClick(e) {
  const set = e.target.closest("[data-set]");
  if (set) { const [i, j] = set.dataset.set.split(":").map(Number); setDone(i, j); return true; }
  const add = e.target.closest("[data-add-set]");
  if (add) {
    const it = state.active.items[Number(add.dataset.addSet)];
    it.sets.push({ w: "", r: "", done: false });
    persist();
    const y = window.scrollY; renderWorkout(); window.scrollTo(0, y);
    return true;
  }
  const feel = e.target.closest("[data-feel]");
  if (feel) {
    const a = state.active;
    a.items[a.ask].feel = feel.dataset.feel;
    a.ask = null;
    persist();
    const y = window.scrollY; renderWorkout(); window.scrollTo(0, y);
    return true;
  }
  if (e.target.closest("[data-pain]")) {
    const it = state.active.items[state.active.ask];
    it.pain = !it.pain;
    persist(); tick();
    return true;
  }
  if (e.target.closest("[data-feel-skip]")) { state.active.ask = null; persist(); tick(); return true; }
  const askAgain = e.target.closest("[data-ask]");
  if (askAgain) { state.active.ask = Number(askAgain.dataset.ask); persist(); tick(); return true; }
  const rest = e.target.closest("[data-rest]");
  if (rest) {
    const a = state.active;
    if (rest.dataset.rest === "skip") a.rest = null;
    else { a.rest.until += Number(rest.dataset.rest) * 1000; a.rest.rang = false; }
    persist(); tick();
    return true;
  }
  if (e.target.closest("[data-wk-hide]")) { view = "today"; keepAwake(false); render(); window.scrollTo(0, 0); return true; }
  if (e.target.closest("[data-wk-finish]")) { finishWorkout(); return true; }
  if (e.target.closest("[data-wk-cancel]")) {
    if (!confirm("Отменить тренировку? Записанные подходы не сохранятся.")) return true;
    state.active = null; persist(); keepAwake(false);
    view = "today"; render(); window.scrollTo(0, 0);
    return true;
  }
  return false;
}

// Вес и повторы сохраняем сразу, как только вводишь — без перерисовки экрана
app.addEventListener("input", (e) => {
  const key = e.target.dataset.w ? "w" : e.target.dataset.r ? "r" : null;
  if (!key || !state.active) return;
  const [i, j] = e.target.dataset[key].split(":").map(Number);
  state.active.items[i].sets[j][key] = e.target.value.trim();
  persist();
});

// ---------- Экран «Успехи» ----------

/** Данные для подсчёта успехов. На неделю план — сколько тренировок стоит в календаре. */
function progressCtx() {
  return {
    logs: state.logs, days: state.days, body: state.body, goals: state.goals,
    weekTarget: (monday) => {
      let n = 0;
      for (let i = 0; i < 7; i++) if (sessionIdxOn(isoDate(addDays(monday, i))) != null) n++;
      return n || state.plan.sessions.length;   // недели до начала плана — по числу тренировок в неделю
    },
  };
}

const prog = { ex: null };
const shortDate = (iso) => { const [, m, d] = iso.split("-"); return `${Number(d)}.${m}`; };
const kgLabel = (kg) => (kg >= 1000 ? `${fmt(Math.round(kg / 100) / 10)} т` : `${fmt(Math.round(kg))} кг`);

/** Линейный график: точки [{ date, value }]. */
function lineChart(points, unit) {
  if (points.length < 2) {
    return `<div class="chart-empty">${points.length ? `Пока одна запись: <b>${fmt(points[0].value)} ${unit}</b>. После следующей появится график.` : "Пока нет записей"}</div>`;
  }
  const W = 320, H = 150, P = 14;
  const values = points.map((p) => p.value);
  let lo = Math.min(...values), hi = Math.max(...values);
  if (hi - lo < 1) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  lo -= pad; hi += pad;
  const x = (i) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v) => H - P - ((v - lo) * (H - 2 * P)) / (hi - lo);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;
  const lastP = points[points.length - 1];
  const change = lastP.value - points[0].value;
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".25"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#cg)"/>
      <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="chart-dots">${points.map((p, i) => `<i style="left:${(x(i) / W) * 100}%;top:${(y(p.value) / H) * 100}%"></i>`).join("")}</div>
    <div class="chart-foot"><span>${shortDate(points[0].date)}</span>
      <b class="${change > 0 ? "up" : change < 0 ? "down" : ""}">${change > 0 ? "+" : ""}${fmt(change)} ${unit}</b>
      <span>${shortDate(lastP.date)}</span></div>`;
}

function renderProgress() {
  const ctx = progressCtx();
  const st = stats(ctx);
  // Недели до начала плана без тренировок — пустые, а не «пропущенные»
  const list = weeks(ctx, 8).map((w) => ({ ...w, before: !w.done && isoDate(addDays(w.monday, 6)) < state.plan.startDate }));
  const lifts = liftedExercises(state.logs);
  if (!prog.ex || !lifts.some((l) => l.id === prog.ex)) prog.ex = lifts[0] ? lifts[0].id : null;
  const allBadges = badges(st);
  const unlocked = allBadges.filter((b) => b.done).length;
  const weight = latestWeight(state.body);

  const goals = state.goals.map((g, i) => {
    const pr = goalProgress(g, ctx);
    const title = g.type === "lift" ? `${BY_ID[g.exercise].name}` : "Вес тела";
    const now = pr.current == null ? "нет записей" : `сейчас ${fmt(pr.current)} кг`;
    const left = pr.current == null ? "" : ` · осталось ${fmt(Math.abs(g.target - pr.current))} кг`;
    return `<div class="goal ${pr.done ? "done" : ""}">
      <div class="goal-top"><span>${g.type === "lift" ? "🏋️" : "⚖️"}</span>
        <div><b>${esc(title)} — ${fmt(g.target)} кг</b><small>${pr.done ? "✓ Цель достигнута!" : now + left}</small></div>
        <button type="button" class="goal-del" data-goal-del="${i}" aria-label="Удалить цель">×</button></div>
      <div class="goal-bar"><i style="width:${Math.round(pr.pct * 100)}%"></i></div>
    </div>`;
  }).join("");

  app.innerHTML = `
    <header class="large-title"><small>${st.workouts} ${plural(st.workouts, "тренировка", "тренировки", "тренировок")} всего</small><h1>Успехи</h1></header>

    <section class="card streak-card rise">
      <div class="streak-fire">🔥</div>
      <div><b>${st.streak}</b><span>${plural(st.streak, "неделя", "недели", "недель")} подряд без пропусков</span>
        <small>Лучшая серия: ${st.bestStreak}</small></div>
    </section>

    <div class="cal-stats rise">
      <div><b>${st.workouts}</b><span>тренировок</span></div>
      <div><b>${kgLabel(st.tonnage)}</b><span>поднято</span></div>
      <div><b>${st.records}</b><span>рекордов</span></div>
    </div>

    <h3 class="section-title">Последние 8 недель</h3>
    <section class="card rise">
      <div class="week-bars">${list.map((w) => `
        <div class="${w.full ? "full" : ""} ${w.current ? "now" : ""} ${w.before ? "before" : ""}">
          <div class="bar"><i style="height:${Math.min(100, (w.done / w.target) * 100)}%"></i></div>
          <b>${w.before ? "—" : `${w.done}/${w.target}`}</b><span>${w.current ? "эта" : shortDate(isoDate(w.monday))}</span>
        </div>`).join("")}</div>
    </section>

    ${feelCard()}

    <h3 class="section-title">Мои цели</h3>
    <section class="card rise">
      ${goals || '<p class="muted small">Поставь цель — например, «жим лёжа 100 кг» или «вес тела 78 кг» — и следи, сколько осталось.</p>'}
      <button type="button" class="btn secondary add-goal" data-goal-new>＋ Новая цель</button>
    </section>

    <h3 class="section-title">Сила</h3>
    <section class="card rise">
      ${lifts.length ? `
        <div class="lift-chips">${lifts.map((l) => `<button type="button" class="chip ${l.id === prog.ex ? "active" : ""}" data-lift="${l.id}">${esc(BY_ID[l.id].name)}</button>`).join("")}</div>
        <div class="lift-best"><span>Лучший вес</span><b>${fmt(bestLift(state.logs, prog.ex))} кг</b></div>
        <div class="chart-wrap">${lineChart(liftSeries(state.logs, prog.ex), "кг")}</div>`
      : '<p class="muted small">Запиши первую тренировку с весами — тут появятся графики силы по каждому упражнению.</p>'}
    </section>

    <h3 class="section-title">Вес тела</h3>
    <section class="card rise">
      <div class="body-row">
        <div><span>Сейчас</span><b>${weight != null ? fmt(weight) + " кг" : "—"}</b></div>
        <input class="wk-in" id="body-in" inputmode="decimal" placeholder="${weight != null ? fmt(weight) : "кг"}" aria-label="Вес тела, кг">
        <button type="button" class="btn" data-body-save>Записать</button>
      </div>
      <p class="muted small">Взвешивайся раз в неделю утром натощак — так цифры честнее.</p>
      ${state.body.length ? `<div class="chart-wrap">${lineChart(state.body.map((b) => ({ date: b.date, value: b.weight })), "кг")}</div>` : ""}
    </section>

    <h3 class="section-title">Достижения · ${unlocked} из ${allBadges.length}</h3>
    <div class="badges rise">${allBadges.map((b) => `
      <div class="badge ${b.done ? "done" : ""}">
        <span>${b.emoji}</span><b>${esc(b.title)}</b><small>${esc(b.desc)}</small>
        ${b.done ? "" : `<div class="goal-bar"><i style="width:${Math.min(100, (b.have / b.need) * 100)}%"></i></div>`}
      </div>`).join("")}</div>`;
}

/** Самочувствие: как тяжело заходили тренировки по неделям и энергия при разном восстановлении. */
function feelCard() {
  const list = feelWeeks(state.logs, 8);
  if (!list.some((w) => w.feel != null || w.energy != null)) {
    return `<h3 class="section-title">Самочувствие</h3>
      <section class="card"><p class="muted small">После каждого упражнения отмечай, как зашло (😴 🙂 😤 💀) — тут появится, копится ли усталость.</p></section>`;
  }
  const note = fatigueNote(list);
  const rec = energyByRecovery(state.logs, state.recovery);
  const recLine = ["green", "yellow", "red"].filter((k) => rec[k]).map((k) => `<span><i class="dot ${k}"></i>${fmt(Math.round(rec[k].avg * 10) / 10)} из 5</span>`).join("");
  return `<h3 class="section-title">Самочувствие</h3>
    <section class="card rise">
      <div class="feel-bars">${list.map((w) => {
        const emoji = w.feel == null ? "" : FEELS[w.feel < 1.5 ? "easy" : w.feel < 2.5 ? "ok" : w.feel < 3.5 ? "hard" : "fail"].emoji;
        return `<div class="${w.current ? "now" : ""}">
          <div class="bar"><i style="height:${w.feel == null ? 0 : (w.feel / 4) * 100}%" class="lvl${w.feel == null ? 0 : Math.round(w.feel)}"></i></div>
          <span class="fe">${emoji || "·"}</span><span>${w.current ? "эта" : shortDate(isoDate(w.monday))}</span></div>`;
      }).join("")}</div>
      <p class="feel-legend">Выше столбик — тяжелее заходили упражнения</p>
      ${note ? `<p class="feel-note ${note.tone}">${note.text}</p>` : ""}
      ${recLine ? `<div class="energy-rec"><small>Энергия на тренировке при восстановлении WHOOP</small><div>${recLine}</div></div>` : ""}
    </section>`;
}

// Шторка «Новая цель»
const goalDraft = { type: "lift" };

function openGoalSheet() {
  const exercises = [...new Set([...state.plan.sessions.flatMap((s) => s.items.filter((it) => !it.cardio && it.unit !== "сек").map((it) => it.exercise)), ...liftedExercises(state.logs).map((l) => l.id)])];
  if (!goalDraft.exercise || !exercises.includes(goalDraft.exercise)) goalDraft.exercise = exercises[0];
  const best = bestLift(state.logs, goalDraft.exercise);
  const weight = latestWeight(state.body);
  sheet.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Новая цель">
      <div class="sheet-grip"></div>
      <h2>Новая цель</h2>
      <div class="seg">
        <button type="button" class="${goalDraft.type === "lift" ? "on" : ""}" data-goal-type="lift">🏋️ Вес в упражнении</button>
        <button type="button" class="${goalDraft.type === "body" ? "on" : ""}" data-goal-type="body">⚖️ Вес тела</button>
      </div>
      ${goalDraft.type === "lift" ? `
        <label class="field"><span>Упражнение</span>
          <select id="goal-ex">${exercises.map((id) => `<option value="${id}" ${id === goalDraft.exercise ? "selected" : ""}>${esc(BY_ID[id].name)}</option>`).join("")}</select></label>
        <p class="muted small">${best ? `Твой лучший вес сейчас: ${fmt(best)} кг` : "Записей с этим упражнением пока нет"}</p>`
      : `<p class="muted small">${weight != null ? `Последний вес: ${fmt(weight)} кг` : "Сначала запиши текущий вес на экране «Успехи» — от него будет считаться прогресс."}</p>`}
      <label class="field"><span>Цель, кг</span><input id="goal-target" inputmode="decimal" placeholder="${goalDraft.type === "lift" ? (best ? fmt(best + 10) : "100") : weight != null ? fmt(weight - 4) : "78"}"></label>
      <button type="button" class="btn" data-goal-save>Поставить цель</button>
      <button type="button" class="btn secondary" data-close>Отмена</button>
    </div>`;
  sheet.hidden = false;
}

function goalSheetClick(e) {
  const type = e.target.closest("[data-goal-type]");
  if (type) { goalDraft.type = type.dataset.goalType; openGoalSheet(); return true; }
  if (!e.target.closest("[data-goal-save]")) return false;
  const target = parseNum(document.getElementById("goal-target").value);
  if (!target || target <= 0) { toast("Введи цель в килограммах"); return true; }
  if (goalDraft.type === "lift") {
    const exercise = document.getElementById("goal-ex").value;
    state.goals.push({ type: "lift", exercise, target, from: bestLift(state.logs, exercise), createdAt: todayIso() });
  } else {
    const from = latestWeight(state.body);
    if (from == null) { toast("Сначала запиши текущий вес тела"); return true; }
    state.goals.push({ type: "body", target, from, createdAt: todayIso() });
  }
  persist();
  sheet.hidden = true;
  render();
  toast("Цель поставлена 🎯");
  return true;
}
sheet.addEventListener("change", (e) => {
  if (e.target.id === "goal-ex") { goalDraft.exercise = e.target.value; openGoalSheet(); }
});

function progressClick(e) {
  const lift = e.target.closest("[data-lift]");
  if (lift) { prog.ex = lift.dataset.lift; const y = window.scrollY; renderProgress(); window.scrollTo(0, y); return true; }
  if (e.target.closest("[data-goal-new]")) { openGoalSheet(); return true; }
  const del = e.target.closest("[data-goal-del]");
  if (del) {
    if (!confirm("Удалить эту цель?")) return true;
    state.goals.splice(Number(del.dataset.goalDel), 1);
    persist(); const y = window.scrollY; renderProgress(); window.scrollTo(0, y);
    return true;
  }
  if (e.target.closest("[data-body-save]")) {
    const w = parseNum(document.getElementById("body-in").value);
    if (!w || w < 30 || w > 300) { toast("Введи вес в килограммах"); return true; }
    const today = todayIso();
    state.body = state.body.filter((b) => b.date !== today).concat({ date: today, weight: w }).sort((a, b) => (a.date < b.date ? -1 : 1));
    persist(); const y = window.scrollY; renderProgress(); window.scrollTo(0, y);
    toast("Вес записан ⚖️");
    return true;
  }
  return false;
}

// Вес из анкеты — первая точка на графике веса тела
if (state.profile && state.plan && !state.body.length && state.profile.weight) {
  state.body.push({ date: state.plan.createdAt.slice(0, 10), weight: state.profile.weight });
  persist();
}

// ---------- Шторка с упражнением ----------

function openExercise(ref) {
  const [sIdx, iIdx] = ref.split(":");
  const light = sIdx === "light";
  const session = light ? null : state.plan.sessions[Number(sIdx)];
  let item;
  if (light) {
    const w = workoutFor(state.plan, sessionOn(new Date()), 1, "red");
    item = w.items[Number(iIdx)];
  } else {
    item = session.items[Number(iIdx)];
  }
  const ex = BY_ID[item.exercise];
  const used = session ? session.items.map((it) => it.exercise) : [];
  const alts = light ? [] : options(item.pattern, state.profile.injuries, state.profile.excluded).filter((e) => !used.includes(e.id));

  const doseBlocks = item.cardio
    ? `<div><span>Время</span><b>${item.minutes} мин</b></div><div><span>Темп</span><b>Ровный</b></div><div><span>Пульс</span><b>Можно говорить</b></div>`
    : `<div><span>Подходы</span><b>${item.sets}</b></div><div><span>${item.unit === "сек" ? "Секунды" : "Повторы"}</span><b>${item.reps[0]}–${item.reps[1]}</b></div><div><span>Отдых</span><b>${restLabel(item.rest)}</b></div>`;

  sheet.innerHTML = `
    <div class="sheet" role="dialog" aria-label="${esc(ex.name)}">
      <div class="sheet-grip"></div>
      <div class="eyebrow">${esc(PATTERNS[ex.pattern])}${item.role === "main" ? " · главное упражнение дня" : ""}</div>
      <h2>${esc(ex.name)}</h2>
      <div class="meta-row">${ex.muscles.map((m) => `<span class="pill">${MUSCLES[m]}</span>`).join("")}</div>
      <div class="dose-grid">${doseBlocks}</div>
      <p class="tip">${esc(ex.tip)}</p>
      ${alts.length ? `<h3 class="section-title">Заменить на</h3>
        ${alts.map((a) => `<button type="button" class="alt" data-swap="${ref}:${a.id}"><b>${esc(a.name)}</b><span>Выбрать</span></button>`).join("")}` : ""}
      ${light ? "" : `<button type="button" class="btn danger" data-exclude="${ex.id}">Нет в моём зале — убрать из плана</button>`}
      <button type="button" class="btn secondary" data-close>Закрыть</button>
    </div>`;
  sheet.hidden = false;
}

sheet.addEventListener("click", (e) => {
  if (e.target === sheet || e.target.closest("[data-close]")) { sheet.hidden = true; return; }
  const energy = e.target.closest("[data-energy]");
  if (energy) {
    if (Number(energy.dataset.energy)) state.active.energy = Number(energy.dataset.energy);
    sheet.hidden = true;
    completeWorkout();
    return;
  }
  if (goalSheetClick(e)) return;
  if (view === "calendar" && sheet.querySelector(".day-sheet")) {
    const ex = e.target.closest("[data-ex]");
    if (ex) { openExercise(ex.dataset.ex); return; }
    if (calendarClick(e)) return;
  }
  const exclude = e.target.closest("[data-exclude]");
  if (exclude) {
    const name = BY_ID[exclude.dataset.exclude].name;
    if (!confirm(`Убрать «${name}» из плана навсегда? Приложение подберёт замену.`)) return;
    excludeExercise(exclude.dataset.exclude);
    persist();
    sheet.hidden = true;
    render();
    toast(`«${name}» больше не будет в плане`);
    return;
  }
  const swap = e.target.closest("[data-swap]");
  if (swap) {
    const [sIdx, iIdx, id] = swap.dataset.swap.split(":");
    state.plan.sessions[Number(sIdx)].items[Number(iIdx)].exercise = id;
    const live = state.active && state.active.items.find((it) => it.ref === `${sIdx}:${iIdx}`);
    if (live && !live.sets.some((s) => s.done)) live.exercise = id;
    persist();
    sheet.hidden = true;
    render();
    toast(`Заменено: ${BY_ID[id].name}`);
  }
});

// ---------- Клики по экранам ----------

app.addEventListener("click", (e) => {
  if (!state.profile || app.querySelector(".onb")) return;
  if (view === "calendar" && calendarClick(e)) return;
  if (view === "workout" && workoutClick(e)) return;
  if (view === "progress" && progressClick(e)) return;
  const ex = e.target.closest("[data-ex]");
  if (ex) { openExercise(ex.dataset.ex); return; }
  const rec = e.target.closest("[data-rec]");
  if (rec) { setRecovery(rec.dataset.rec); return; }
  const goto = e.target.closest("[data-goto]");
  if (goto) {
    const card = document.getElementById("days").children[Number(goto.dataset.goto)];
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    return;
  }
  if (e.target.closest("[data-today-done]")) {
    markDay(todayIso(), "done");
    persist(); render();
    if (state.days[todayIso()]) toast("Отмечено в календаре 💪");
    return;
  }
  if (e.target.closest("[data-today-move]")) {
    view = "calendar";
    cal.sel = todayIso(); cal.pick = null; cal.month = null;
    render();
    openDaySheet(todayIso());
    return;
  }
  if (e.target.closest("[data-start]")) { startWorkout(); return; }
  if (e.target.closest("[data-sum-close]")) { lastSummary = null; view = "today"; render(); window.scrollTo(0, 0); return; }
  if (e.target.closest("[data-redo]")) {
    if (confirm("Пройти анкету заново? План пересоберётся, замены упражнений сбросятся.")) startOnboarding(state.profile);
  }
});

app.addEventListener("change", (e) => {
  if (e.target.id !== "rec-pct") return;
  const pct = Math.max(0, Math.min(100, Math.round(Number(e.target.value))));
  if (e.target.value === "" || Number.isNaN(pct)) return;
  setRecovery(recoveryLevel(pct), pct);
});

// ---------- Упражнения, которых нет в зале ----------

/** Убирает упражнение из плана навсегда: везде ставит замену того же типа (или убирает, если замены нет). */
function excludeExercise(id) {
  const profile = state.profile;
  if (!profile.excluded.includes(id)) profile.excluded.push(id);
  for (const session of state.plan.sessions) {
    for (let i = session.items.length - 1; i >= 0; i--) {
      const item = session.items[i];
      if (item.exercise !== id) continue;
      const used = session.items.map((it) => it.exercise);
      const replacement = options(item.pattern, profile.injuries, profile.excluded).find((e) => !used.includes(e.id));
      if (replacement) item.exercise = replacement.id;
      else session.items.splice(i, 1);
    }
  }
}

// Планы, составленные до появления списка «нет в зале», — убираем из них упражнения на турнике
if (state.profile && !state.profile.excluded) {
  state.profile.excluded = [];
  if (state.plan) DEFAULT_EXCLUDED.forEach(excludeExercise);
  persist();
}

// ---------- Резервная копия ----------

const BACKUP_EVERY_DAYS = 14;

/** 1 тренировка, 2 тренировки, 5 тренировок. */
function plural(n, one, few, many) {
  const d = n % 10, dd = n % 100;
  return d === 1 && dd !== 11 ? one : d >= 2 && d <= 4 && (dd < 12 || dd > 14) ? few : many;
}

/** Пора ли напомнить о копии: есть записанные тренировки, а копии нет или она старше 2 недель. */
function backupDue() {
  if (!state.logs.length) return false;
  return !state.lastBackup || Date.now() - new Date(state.lastBackup) > BACKUP_EVERY_DAYS * 86400000;
}

async function exportBackup() {
  state.lastBackup = new Date().toISOString();
  const data = { app: "workout-app", version: 1, savedAt: state.lastBackup, state };
  const name = `workout-backup-${todayIso()}.json`;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const file = new File([blob], name, { type: "application/json" });
  try {
    // На iPhone откроется меню «Поделиться» → «Сохранить в Файлы»
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  } catch (e) {
    if (e.name === "AbortError") { state.lastBackup = null; return; }  // передумал сохранять
    toast("Не получилось сохранить копию");
    return;
  }
  persist();
  render();
  toast("Копия сохранена 💾");
}

const fileInput = Object.assign(document.createElement("input"), { type: "file", accept: ".json,application/json", hidden: true });
document.body.appendChild(fileInput);

fileInput.addEventListener("change", async () => {
  const file = fileInput.files[0];
  fileInput.value = "";
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { data = null; }
  if (!data || data.app !== "workout-app" || !data.state || !data.state.profile || !data.state.plan) {
    toast("Это не копия из приложения «Тренировки»");
    return;
  }
  const when = new Date(data.savedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const count = (data.state.logs || []).length;
  if (!confirm(`Восстановить копию от ${when}? В ней ${count} ${plural(count, "записанная тренировка", "записанные тренировки", "записанных тренировок")}. Текущие данные в телефоне заменятся.`)) return;
  state = { ...store.blank(), ...data.state };
  persist();
  view = state.active ? "workout" : "today";
  render();
  window.scrollTo(0, 0);
  toast("Данные восстановлены ✅");
});

// Кнопки копии есть и на приветствии (там своя обработка кликов), поэтому слушаем весь документ
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-backup]")) exportBackup();
  else if (e.target.closest("[data-restore]")) fileInput.click();
});

// ---------- Офлайн-режим ----------

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
// Просим браузер не удалять данные приложения, даже если места мало
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------- Главная отрисовка ----------

function render() {
  if (!state.profile || !state.plan) { startOnboarding(); return; }
  app.classList.remove("no-tabbar");
  if (view === "workout") { renderWorkout(); return; }
  if (view === "summary") { renderSummary(); return; }
  if (view === "today") renderToday();
  else if (view === "plan") renderPlan();
  else if (view === "calendar") renderCalendar();
  else if (view === "progress") renderProgress();
  renderTabbar();
}

// Если приложение закрылось посреди тренировки — сразу возвращаемся в неё
if (state.active && Date.now() - state.active.startedAt < 4 * 3600 * 1000) view = "workout";

render();
