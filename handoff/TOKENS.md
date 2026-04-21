# Design Tokens — Brutalist Direction

Скопируйте в `tokens.css` / `theme.ts` / Tailwind config.

## CSS Variables

```css
:root {
  /* ─── Colors · DARK (default) ─── */
  --bg:       #0e0e0c;   /* page background, almost-black warm */
  --bg-2:     #141412;   /* elevated surface (cards, hover) */
  --line:     #2a2a26;   /* hairline dividers */
  --line-2:   #3c3c36;   /* stronger dividers */
  --ink:      #f1efe6;   /* primary text, off-white */
  --ink-2:    #b3b0a4;   /* secondary text */
  --ink-3:    #74716a;   /* tertiary text, meta */
  --ink-4:    #4d4b46;   /* quaternary, ascii art */

  /* ─── Accents ─── */
  --accent:   #d9ff3d;   /* acid lime — primary accent, CTA, active */
  --accent-2: #ff6b35;   /* orange — P1, warnings, deadlines */
  --accent-3: #00e0c6;   /* teal — success, replies, offers */
  --danger:   #ff4b4b;   /* red — destructive only */

  /* ─── Typography ─── */
  --mono:    'JetBrains Mono', ui-monospace, monospace;
  --display: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
}

/* ─── LIGHT theme overrides (warm paper) ─── */
html.light {
  --bg:       #f3f2ec;
  --bg-2:     #e7e5db;
  --line:     #1a1a17;
  --line-2:   #b8b5a8;
  --ink:      #0e0e0c;
  --ink-2:    #2a2a26;
  --ink-3:    #67645a;
  --ink-4:    #8f8c82;
  --accent:   #0e0e0c;   /* black — acid lime unreadable on paper */
  --accent-2: #b23a0e;   /* rust */
  --accent-3: #1d5c54;   /* forest */
}
```

## Typography Scale

| Token | Size | Weight | Font | Usage |
|---|---|---|---|---|
| `display-xl` | 44–52px | 700 | Space Grotesk | Hero H1 on Today |
| `display-lg` | 36px | 700 | Space Grotesk | Page H1 (Tasks_, Reminders_) |
| `display-md` | 22–28px | 700 | Space Grotesk | Panel titles, Job Hero H2 |
| `display-sm` | 13.5px | 600 | Space Grotesk | Card titles |
| `body` | 13px | 400 | JetBrains Mono | Default body |
| `body-sm` | 11.5–12.5px | 400 | JetBrains Mono | Secondary body |
| `meta` | 10.5px | 500 | JetBrains Mono | Labels, kickers (uppercase, tracking 1.5–2.5px) |
| `micro` | 9.5px | 500 | JetBrains Mono | Chips, counters (uppercase, tracking 2px) |

**Letter-spacing:**
- Display H1: `-1.2px` to `-1.6px` (tight)
- Display H2: `-0.9px`
- Meta/micro uppercase: `+1.5px` to `+2.5px`

## Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `xs` | 4px | Tag gaps, inline chips |
| `sm` | 8px | Button padding, card internal gaps |
| `md` | 12px | Card padding |
| `lg` | 16–18px | Panel padding, section gaps |
| `xl` | 24px | Page gutter, hero inner |
| `2xl` | 32–40px | Section separation |

## Borders & Radii

- **Radii: 0** everywhere. Only `border-radius: 50%` for status dots.
- Border weights: `1.5px solid var(--line)` — standard · `2px solid var(--accent)` — emphasis (cmd palette) · `1px` — inner row dividers
- Accent borders: **left-border 4px** for priority indication (`.tc.p1` → `border-left: 4px solid var(--accent-2)`)

## Shadows

Almost none. Exceptions:
- Command palette modal: `box-shadow: 0 0 40px rgba(217,255,61,0.15)`
- Active "now" indicator: `box-shadow: 0 0 6px var(--accent)`

## Iconography

**No icon library.** Use Unicode geometric glyphs only:
- `◉` ◷ ◧ ◐ ◈ — nav
- `▦` ▤ ▨ — content modules
- `▸ ▶ ◀ ▪` — arrows, bullets
- `⌕` — search
- `⌘ ⌥ ⇧` — shortcuts
- `✎` — edit
- `♡ ●` — state

This keeps vibe consistent and removes icon-library dependency.

## Tags/Chips

```css
.tag      { font: 9.5px/1 var(--mono); letter-spacing: 1.5px; text-transform: uppercase;
            padding: 3px 7px; border: 1px solid var(--line-2); color: var(--ink-2); }
.tag.acc  { background: var(--accent); color: #0e0e0c; border-color: var(--accent); }
.tag.warn { border-color: var(--accent-2); color: var(--accent-2); }
.tag.teal { border-color: var(--accent-3); color: var(--accent-3); }
.tag.ghost{ color: var(--ink-3); border-color: var(--line); }
```

## Buttons

```css
.btn     { font: 11px var(--mono); letter-spacing: 1px; text-transform: uppercase;
           padding: 7px 12px; border: 1.5px solid var(--line-2); background: transparent;
           color: var(--ink); cursor: pointer; transition: all 0.1s; }
.btn:hover { border-color: var(--ink); background: var(--bg-2); }
.btn.acc { background: var(--accent); color: #0e0e0c; border-color: var(--accent); font-weight: 600; }
.btn.acc:hover { filter: brightness(0.95); }
```
