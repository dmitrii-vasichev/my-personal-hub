# Data Map — Today page

Откуда брать данные для каждого блока на главной. Используйте как чеклист при подключении модели данных.

---

## Top Bar — Global Stats

| Metric | Source | Formula |
|---|---|---|
| Date/time | client | `MON 19 APR 26 · W${isoWeek} · ${HH:MM}` |
| `FOCUS` | `focus_sessions` | `sum(duration where date = today)` |
| `INBOX` | `notifications` + `emails` (если подключены) | `count(unread where date >= today-1d)` |
| `STREAK` | `daily_activity` | `consecutive days with >= 1 completed task` |

> Если что-то из этого пока не реализовано — скрыть индикатор полностью (не показывать «0» или «—»).

---

## Hero — Priority_01

**Алгоритм выбора задачи:**

```python
def pick_priority_one():
    # 1. P1 today, earliest deadline
    p1 = query(tasks,
               status != 'done',
               due_date == today,
               priority == 'P1',
               order_by=due_datetime).first()
    if p1: return p1

    # 2. Any task today, earliest deadline
    any_today = query(tasks,
                      status != 'done',
                      due_date == today,
                      order_by=due_datetime).first()
    if any_today: return any_today

    # 3. Next important meeting today
    meet = query(meetings,
                 start_date == today,
                 start_time >= now,
                 order_by=start_time).first()
    if meet: return meet.as_priority()

    # 4. Fallback — "Today is quiet"
    return None
```

**Рендер блока:**

| Slot | Source field |
|---|---|
| Kicker timer `T-HH:MM:SS` | `task.due_datetime - now` (live countdown) |
| H1 | `task.title` (с `<em>` на выделенном слове — опционально, вручную) |
| Deck | `task.description[:200]` + если есть `task.linked_meeting` → приписать её |
| `▶ OPEN TASK` | navigate to task detail |
| `✎ JUMP TO DRAFT` | только если есть `task.linked_document` |
| `◷ SNOOZE 1H` | bump `due_datetime += 1h` |

---

## Hero-Cells (2×2)

| Cell | Source | Query |
|---|---|---|
| Open tasks | tasks | `count(status != 'done')` |
| Interviews wk | meetings/job_events | `count(type='interview' AND week=current_iso_week)` |
| Apps live | jobs | `count(status IN ('applied','screen','interview'))` |
| Pulse unread | pulse_items | `count(read = false)` |

**Delta line (под значением):**
- Open tasks → `N overdue` где `N = count(due < today AND status != 'done')`
- Interviews wk → `+/-N vs last` vs прошлая неделя
- Apps live → `↑ X% reply rate` = `replied / applied * 100` за 30 дней
- Pulse unread → `N urgent` где `urgent = items tagged urgent`

---

## Timeline Today (union view)

**Это НЕ отдельная таблица.** Это агрегированный view на UI-стороне из 4 источников:

```python
def build_timeline(date):
    rows = []

    # 1. Tasks due today
    for t in query(tasks, due_date == date):
        rows.append({
            'time': t.due_time or '—',
            'title': t.title,
            'sub': f"{progress}% · {linked_refs}",
            'tag': t.priority,           # P1 / P2 / P3
            'kind': 'task',
            'done': t.status == 'done',
        })

    # 2. Meetings today
    for m in query(meetings, start_date == date):
        rows.append({
            'time': m.start_time,
            'title': m.title,
            'sub': f"{m.duration} · {m.location}",
            'tag': 'INTERVIEW' if m.type == 'interview' else 'MEET',
            'kind': 'meeting',
            'done': m.end_time < now,
        })

    # 3. Reminders today
    for r in query(reminders, trigger_date == date):
        rows.append({
            'time': r.trigger_time,
            'title': r.title,
            'sub': r.note,
            'tag': 'RECUR' if r.recurring else 'REMIND',
            'kind': 'reminder',
            'done': r.completed,
        })

    # 4. Current focus block (if active)
    if focus := active_focus_session():
        rows.append({
            'time': 'NOW',
            'title': focus.title,
            'sub': f"Focus until {focus.end_time} · notifications muted",
            'tag': 'FOCUS',
            'kind': 'focus',
            'now': True,
        })

    return sorted(rows, key=lambda r: (r['time'] == 'NOW', r['time']))
```

**Стилевые модификаторы:**
- `kind=task, priority=P1` → класс `.row.p1` (orange accent)
- `kind=meeting, type=interview` → tag `INTERVIEW` (warn)
- `done=True` → класс `.done` (opacity, line-through)
- `now=True` → класс `.now` (acid lime, pulsing dot)

---

## Stats Grid (4 cells)

| Cell | Source | Query / Formula |
|---|---|---|
| Focus · today | `focus_sessions` | `sum(duration where date=today)` / goal `4h` |
| Notes · 30d | `notes` | `count(created_at >= today-30d)` + дельта vs предыдущие 30d |
| Overdue tasks | `tasks` | `count(due_date < today AND status != 'done')` — класс `.alert` если > 0 |
| Response rate · 30d | `jobs` + `job_events` | `count(events where type='reply' last 30d) / count(applied last 30d)` |

> Когда Garmin подключится → заменить `Focus · today` и `Notes · 30d` на `Sleep · 7d avg` и `Body battery`.

---

## Reminders · today (правая колонка)

Прямой срез:
```python
query(reminders,
      trigger_date == today,
      order_by=trigger_time,
      limit=5)
```

Формат строки: `HH:MM  ·  Текст  ·  [RECUR?]`

---

## Signals · background (AI-digest)

**Правила для всех источников:**
- Только новое/изменившееся за последние 24 часа
- Максимум 1 item на модуль (иначе Feed загрязняется)
- Если источник молчит — не показывать совсем (нет placeholder-ов)

### PULSE
Триггеры:
- Новые вакансии, матчащие сохранённые фильтры
- Неотвеченные DM от рекрутёров > 24ч
Rendering: заголовок + summary + счётчик unread

### JOBS
Триггеры:
- Компания не двигалась ≥ 7 дней → «{Company} has been quiet for N days.»
- Stage change → «{Company} moved to {new_stage}.»
- Новый интервью на этой неделе → «{N} interviews scheduled this week.»

### OUTREACH
Триггеры:
- Батч leads перешёл в `proposal` → «{N} leads crossed into proposal this week.»
- Pending replies > 3 дня

### NOTES
Триггеры:
- Capture count выше среднего → «{N} new captures this week — highest since {month}.»
- Draft notes готовые к weekly review

---

## Когда Vitals вернётся

В момент подключения Garmin:
1. Раскомментировать пункт `Vitals` в Sidebar (`Signals` секция)
2. Добавить обратно 3 метрики в Top bar: `SLEPT`, `RHR`, `BATT`
3. В Timeline добавить строку `07:15 · Morning run · 7.2km in 42min · tag BODY`
4. В Stats grid: заменить `Focus · today` и `Notes · 30d` на `Sleep · 7d avg` и `Body battery`
5. В Signals feed добавить карточку `VITALS`

Полный рабочий вариант с Vitals — в `mockups/hub-brutalist.html` (v1).
