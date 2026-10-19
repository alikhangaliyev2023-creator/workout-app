// Экраны приложения: анкета, «Сегодня», «План» (а позже — календарь и успехи).

import { BY_ID, DEFAULT_EXCLUDED, MUSCLES, PATTERNS, options } from "./exercises.js";
import {
  CYCLE_WEEKS, DEFAULT_DAYS, GOALS, INJURIES, LEVELS, RECOVERY, WEEKDAYS, WEEKDAYS_FULL,
  SPLIT_OPTIONS, cycleWeek, generatePlan, isoDate, splitFor, profileSummary, recoveryLevel, sessionMinutes, weekNote, weekdayIndex, workoutFor,
} from "./plan.js";
import * as store from "./store.js";

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

function toast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
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
    const s = sessionForDay(weekdayIndex(d));
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
function sessionCard(w, ref, { kicker, start = false, note = "" } = {}) {
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
        ${start ? `<button type="button" class="start-btn" data-start>${PLAY_ICON} Начать тренировку</button>` : ""}
        ${note ? `<p class="session-note">${note}</p>` : ""}
      </div>
    </section>`;
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
  const session = sessionForDay(weekdayIndex(now));

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
    workoutCard = sessionCard(w, w.light ? "light" : idx, {
      kicker: `Сегодня · неделя ${week} из ${CYCLE_WEEKS}`,
      start: true,
      note: w.light ? "Тяжёлую тренировку можно сделать завтра — переносы появятся вместе с календарём." : weekNote(week),
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
    ${workoutCard}`;
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
    <p class="hint-center">Листай тренировки вбок. Нажми на упражнение — техника и замена.</p>`;

  const scroller = document.getElementById("days");
  const cards = [...scroller.children];
  scroller.scrollLeft = cards[first].offsetLeft - 18;
  scroller.addEventListener("scroll", () => {
    const i = Math.round(scroller.scrollLeft / (cards[0].offsetWidth + 12));
    document.querySelectorAll("#dots i").forEach((d, j) => d.classList.toggle("on", j === i));
  }, { passive: true });
}

// ---------- Пока не готовые экраны ----------

function renderPlaceholder(emoji, title, text) {
  app.innerHTML = `<section class="placeholder"><div class="emoji">${emoji}</div><h2>${title}</h2><p>${text}</p></section>`;
}

// ---------- Шторка с упражнением ----------

function openExercise(ref) {
  const [sIdx, iIdx] = ref.split(":");
  const light = sIdx === "light";
  const session = light ? null : state.plan.sessions[Number(sIdx)];
  let item;
  if (light) {
    const w = workoutFor(state.plan, sessionForDay(weekdayIndex(new Date())), 1, "red");
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
    persist();
    sheet.hidden = true;
    render();
    toast(`Заменено: ${BY_ID[id].name}`);
  }
});

// ---------- Клики по экранам ----------

app.addEventListener("click", (e) => {
  if (!state.profile || app.querySelector(".onb")) return;
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
  if (e.target.closest("[data-start]")) { toast("Запись подходов и весов появится на шаге 3 🙂"); return; }
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

// ---------- Главная отрисовка ----------

function render() {
  if (!state.profile || !state.plan) { startOnboarding(); return; }
  app.classList.remove("no-tabbar");
  if (view === "today") renderToday();
  else if (view === "plan") renderPlan();
  else if (view === "calendar") renderPlaceholder("📅", "Календарь", "Появится на шаге 2: месяц с отметками тренировок, переносы и пропуски.");
  else if (view === "progress") renderPlaceholder("📈", "Успехи", "Появятся на шаге 4: серия, графики силы и веса тела, рекорды и достижения.");
  renderTabbar();
}

render();
