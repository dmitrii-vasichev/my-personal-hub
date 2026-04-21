# HANDOFF — Personal Hub Redesign (Brutalist Direction)

Этот документ — **спецификация для Claude Code** (или любого другого агента/разработчика), чтобы применить новый дизайн к репозиторию `my-personal-hub`.

Дизайн-направление: **Brutalist / Terminal** — плотная моно-типографика, acid-lime акцент на тёмной теме, editorial-структура "газетного разворота" на главной.

---

## 1. Файлы в этой папке

```
handoff/
├── HANDOFF.md                         ← этот файл
├── TOKENS.md                          ← дизайн-токены (цвета, шрифты, отступы)
├── DATA-MAP.md                        ← откуда берутся данные для каждого блока Today
└── mockups/
    ├── hub-brutalist.html             ← мокап v1 (с Vitals, для референса)
    └── hub-brutalist-v2.html          ← мокап v2 — ФИНАЛЬНЫЙ, без Vitals ✓
```

**Главный референс — `mockups/hub-brutalist-v2.html`.** Открывайте его в браузере и сверяйте с ним.

---

## 2. Что меняем

### Scope: новая визуальная система + новая структура Today
- ✅ Все страницы: применить новые токены (цвета, шрифты, границы, spacing)
- ✅ Today: **переделать структуру** под макет (Hero Priority + Hero-cells + Timeline + Stats + Reminders + Signals)
- ✅ Tasks, Reminders, Job Hunt: применить новый визуал, сохранив текущий функционал
- ✅ Добавить ⌘K Command Palette (глобальный поиск + навигация)
- ✅ Поддержка двух тем (dark — по умолчанию, light — warm paper)
- ⏸ Vitals — **временно выключен** (Garmin не подключён). UI следы убраны.

### Что НЕ трогаем
- Бэкенд / API / модели данных — только фронт
- Модули Meetings, Notes, Pulse, Outreach — оставляем как есть, только применяем токены (детальные макеты сделаем потом)

---

## 3. Дизайн-токены

См. `TOKENS.md`. Кратко:

**Шрифты:**
- Mono: `JetBrains Mono` (body, UI, числа)
- Display: `Space Grotesk` (заголовки, h1–h3)

**Цвета (dark — дефолт):**
- `--bg: #0e0e0c` — почти чёрный тёплый
- `--ink: #f1efe6` — off-white
- `--accent: #d9ff3d` — acid lime (главный акцент)
- `--accent-2: #ff6b35` — orange (предупреждения, P1)
- `--accent-3: #00e0c6` — teal (успех, ответы)
- `--line: #2a2a26` — тонкие разделители

**Цвета (light — warm paper):**
- `--bg: #f3f2ec`
- `--ink: #0e0e0c`
- `--accent: #0e0e0c` (чёрный вместо acid lime — читается на бумаге)
- `--accent-2: #b23a0e` (rust)
- `--accent-3: #1d5c54` (forest)

**Принципы:**
- Границы: `1.5px solid var(--line)` (не радиусы — острые углы)
- Углы: **без `border-radius`** (кроме индикаторов-точек `border-radius: 50%`)
- Тени: **без них**, кроме модалок (cmd palette) и акцент-свечения на индикаторах
- Uppercase + wide letter-spacing для меток, категорий, кнопок
- Таблицы/списки без zebra, только линии
- Плотность: компактная, 13px body, 10.5px meta

---

## 4. Структура Today (главная страница)

Порядок блоков **сверху вниз**:

### 4.1 Top bar (breadcrumb + global stats)
```
HUB / Today                MON 19 APR 26 · W16 · 10:42   FOCUS 2h14   INBOX 12   STREAK 9d   ◐ THEME
```
- Слева: `HUB / <current page>`
- Справа: дата/время + 3 глобальных метрики + переключатель темы
- Метрики должны быть безопасные (не Vitals): Focus hours сегодня, Inbox count, Streak (дни активности)

### 4.2 Hero — приоритет дня
Две колонки (1.4fr / 1fr):

**Слева (Priority_01):**
- Kicker: `● PRIORITY_01 · T-03:18:00` (таймер до дедлайна)
- H1: название задачи с `<em>` на ключевом слове (`Ship the <em>Acme</em> letter before 14:00.`)
- Deck: 1–2 предложения контекста + связанные события
- Кнопки: `▶ OPEN TASK` (acc) / `✎ JUMP TO DRAFT` / `◷ SNOOZE 1H`

**Логика выбора Priority_01:**
1. `tasks where due_date = today AND priority = 'P1' AND status != 'done'` → первая по времени
2. Иначе: `tasks where due_date = today AND status != 'done'` → с ближайшим дедлайном
3. Иначе: ближайшая встреча/напоминание сегодня
4. Иначе: fallback-блок `Today is quiet — nothing urgent.`

**Справа (Hero-cells, 2×2):**
- Open tasks · `count(tasks where status != 'done')`
- Interviews this week · `count(job_events where type='interview' AND week=current)`
- Apps live · `count(jobs where status IN ('applied','screen','interview'))`
- Pulse unread · `count(pulse_items where read=false)`

### 4.3 Timeline — агрегатор дня
Одна лента, **union view** из четырёх источников:
- `tasks where due_datetime = today` → метка `TASK`/`P1`/`P2`
- `meetings where start_date = today` → метка `MEET`/`INTERVIEW`
- `reminders where trigger = today` → метка `RECUR`/`REMINDER`
- Активный focus-блок → строка с меткой `NOW` и классом `.row.now`

Сортировка: по времени. Строки с классами:
- `.done` — прошедшие (opacity .6, line-through)
- `.now` — текущий момент (acid-lime акцент, пульсирующая точка)
- `.p1` — красный акцент слева, orange теги

### 4.4 Stats-grid (правая колонка под Hero-cells)
4 ячейки в 2×2:
1. **Focus · today** — часы фокус-времени (или pomodoro count)
2. **Notes · 30d** — количество заметок за 30 дней + дельта за неделю
3. **Overdue tasks** — `count(tasks where due < today AND status != 'done')` — с alert-оттенком
4. **Response rate · 30d** — `replied / applied * 100` за 30 дней в Job Hunt

> **Когда Garmin/Vitals подключится**, можно заменить любые 2 ячейки на `Sleep · 7d avg` и `Body battery`.

### 4.5 Reminders · today (под Stats-grid)
Короткий срез — 3–5 напоминаний на сегодня. Каждая строка: `HH:MM  ·  Текст  ·  [RECUR]`.

### 4.6 Signals · background (низ страницы)
AI-дайджест "тихих новостей" — новости, которые НЕ требуют немедленного действия. 4 колонки:
1. **PULSE** — новые интересные вакансии / статьи / DM
2. **JOBS** — «silent N days», «stage moved», подсказки по follow-up
3. **OUTREACH** — «N leads crossed to proposal», батчи на отправку
4. **NOTES** — «N new captures this week», драфты готовые к weekly review

Правило: 1 item на модуль, только новое/изменившееся за 24 часа.

---

## 5. Остальные страницы

### 5.1 Tasks
- Page header (`.ph`): kicker `Module · Tasks` + H1 `TASKS_` + sub + actions (Filter / Sort / **+ NEW TASK** acc)
- Табы: KANBAN / TABLE / BACKLOG / ANALYTICS + фильтры по тегам справа
- Kanban: 4 колонки — TODAY / THIS WEEK / LATER / DONE
- Карточка: `p1/p2/p3` с цветным border-left · название · meta (DUE · проект) · теги

### 5.2 Job Hunt
- Hero 2-колонки: слева — главная мысль («3 <em>interviews</em> this week…»), справа — 4 метрики (Apps live / Interviews wk / Offers / Response rate)
- Kanban 5 колонок: APPLIED / SCREEN / INTERVIEW / OFFER / PASS
- Карточка компании: `.jcc.hot` (orange border) — активная · `.jcc.warn` — silent N дней · `.jcc.off` — оффер

### 5.3 Reminders
- Quick-add input сверху (dashed border)
- Список строк: checkbox + время + body + actions (появляются на hover)
- Справа — блок «Birthdays & anniversaries» с цветными инициалами

### 5.4 Meetings / Notes / Pulse / Outreach
На этом этапе — **просто заглушки в новом стиле**. Переиспользуйте `.ph` хедер и `.panel` контейнер. Детали — в следующей итерации.

---

## 6. Навигация (Sidebar)

```
HUB_
─────── DAILY ───────
◉ Today       [5]
▦ Tasks       [7]
◷ Reminders   [3]
◧ Meetings
─────── PROJECTS ───────
▤ Job Hunt    [12]
◈ Outreach
▨ Notes
─────── SIGNALS ───────
◐ Pulse       [47]
                          ← Vitals скрыт, пока Garmin не подключён
─────────
⌕ search    ⌘K
● synced · 3m ago    v0.4.2
```

- Badge `[N]` — счётчик «требует внимания» для модуля
- Активный пункт: acid-lime border-left, bg-2 фон
- `⌘K` внизу — открывает command palette

---

## 7. Command Palette (⌘K)

- Глобальный поиск + навигация
- Открывается по `⌘K` / `Ctrl+K` / клику по пункту в sidebar
- Секции: **JUMP TO** (страницы), **ACTIONS** (+ new task, + new reminder…), **RECENT**
- Стрелки ↑↓ навигация, Enter подтверждение, Esc закрытие
- Стиль: 2px acid-lime border, blur background

---

## 8. Адаптив

Брейкпоинт `@media (max-width:960px)`:
- Sidebar → горизонтальный скроллируемый tab-bar сверху
- `.hero`, `.cols`, `.rem-grid`, `.jobs-hero` → одна колонка
- Kanban → 2 колонки вместо 4–5
- `.stats-grid` → 2×2 остаётся

Детальный мобильный макет придёт в следующей итерации (сейчас — fluid responsive).

---

## 9. Рекомендуемый план миграции (для Claude Code)

### Этап 1 — токены и базовый shell
1. Добавить Google Fonts: JetBrains Mono + Space Grotesk
2. Создать `tokens.css` (или обновить существующий theme-файл) с переменными из `TOKENS.md`
3. Обновить глобальные стили: body font, базовые border/line стили, `html.light` overrides
4. Переверстать Sidebar под новый стиль (разделители `rail-sect`, иконки, счётчики)
5. Переверстать Top bar (breadcrumb + global stats + theme toggle)

### Этап 2 — Today
1. Создать компонент `<HeroPriority />` — берёт первую P1 на сегодня
2. Создать компонент `<HeroCells />` — 2×2 метрики
3. Создать компонент `<DayTimeline />` — union view задач/встреч/напоминаний/focus-блока
4. Создать компонент `<StatsGrid />` с 4 метриками (Focus / Notes / Overdue / Response rate)
5. Перенести Reminders-today и Signals-feed в новый layout
6. Убрать все ссылки на Vitals с главной

### Этап 3 — Tasks / Reminders / Jobs
1. Переверстать Tasks в новый Kanban стиль
2. Переверстать Reminders
3. Переверстать Job Hunt Kanban + hero

### Этап 4 — Command Palette + Tweaks
1. Реализовать ⌘K с keyboard shortcuts
2. Light/Dark theme toggle с persist в localStorage

### Этап 5 — Adaptive + QA
1. Мобильные стили
2. Проверка контрастов (особенно light-тема)
3. Смоук-тест всех flow

---

## 10. Что я прошу у разработчика / Claude Code на выходе

- [ ] PR с новой design system (tokens + global styles)
- [ ] Today полностью перевёрстана по макету `hub-brutalist-v2.html`
- [ ] Tasks / Reminders / Job Hunt — переведены на новые токены
- [ ] Vitals скрыт/отключён (не удалён из кода — просто не виден в UI)
- [ ] ⌘K работает
- [ ] Dark/Light toggle работает и persists
- [ ] Нет регрессий по данным (CRUD работает как раньше)

**Если что-то неясно — писать вопросы списком, не импровизировать. Дизайн-токены и структуру Today не менять без согласования.**
