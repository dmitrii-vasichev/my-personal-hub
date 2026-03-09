# Design Brief: Personal Hub

## UI Framework
- Library: shadcn/ui (Radix UI primitives)
- CSS: Tailwind CSS v4
- Icons: Lucide React
- Drag & Drop: @dnd-kit

## Theme
- Mode: Both (dark default, light available via toggle)
- Style: Vibrant dashboard — colorful accents, soft dark surfaces
- Density: Compact, information-dense

## Reference
- Primary inspiration: Custom dashboard mockup (reports-dashboard-mockup.html)
- Key traits: multi-accent colors, colored top borders on cards, JetBrains Mono for labels, soft rounded corners, gradient chart fills

## Color Palette

### Dark Theme (default)
| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#0f1117` | Page background |
| `--surface` | `#171b26` | Cards, panels, sidebar |
| `--surface-hover` | `#1e2333` | Hover states on surfaces |
| `--surface-2` | `#252a3a` | Elevated surfaces, dropdowns |
| `--border` | `rgba(255,255,255,0.07)` | Subtle borders, dividers |
| `--border-strong` | `rgba(255,255,255,0.12)` | Focused/active borders |
| `--text-primary` | `#e8eaf0` | Headings, primary text |
| `--text-secondary` | `#6b7280` | Descriptions, labels |
| `--text-tertiary` | `#4b5563` | Placeholders, disabled, section labels |
| `--accent` | `#4f8ef7` | Primary actions, links, active states (blue) |
| `--accent-hover` | `#6ba3ff` | Accent hover |
| `--accent-muted` | `rgba(79,142,247,0.08)` | Accent backgrounds (active nav, badges) |
| `--accent-teal` | `#2dd4bf` | Secondary accent — success-like, badges |
| `--accent-violet` | `#a78bfa` | Tertiary accent — charts, financial data |
| `--accent-amber` | `#fbbf24` | Quaternary accent — warnings, highlights |
| `--danger` | `#f87171` | Errors, destructive actions, negative deltas |
| `--warning` | `#fbbf24` | Warnings, overdue (same as amber) |
| `--success` | `#34d399` | Completed, success states, positive deltas |
| `--info` | `#4f8ef7` | Informational (same as accent) |

### Light Theme
| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#f8f9fb` | Page background |
| `--surface` | `#ffffff` | Cards, panels, sidebar |
| `--surface-hover` | `#f0f1f5` | Hover states |
| `--surface-2` | `#e8eaef` | Elevated surfaces |
| `--border` | `rgba(0,0,0,0.08)` | Borders, dividers |
| `--border-strong` | `rgba(0,0,0,0.15)` | Focused/active borders |
| `--text-primary` | `#111827` | Headings, primary text |
| `--text-secondary` | `#6b7280` | Descriptions, labels |
| `--text-tertiary` | `#9ca3af` | Placeholders, disabled |
| `--accent` | `#3b7dd8` | Primary actions (slightly darker blue for contrast) |
| `--accent-hover` | `#2b6dc8` | Accent hover |
| `--accent-muted` | `rgba(59,125,216,0.08)` | Accent backgrounds |
| `--accent-teal` | `#0d9488` | Secondary accent |
| `--accent-violet` | `#7c3aed` | Tertiary accent |
| `--accent-amber` | `#d97706` | Quaternary accent |
| `--danger` | `#dc2626` | Errors |
| `--warning` | `#d97706` | Warnings |
| `--success` | `#059669` | Success |

## Typography
| Role | Font | Weight | Size |
|------|------|--------|------|
| Headings | Onest | 700 (bold) | 17-28px |
| Subheadings | Onest | 600 (semibold) | 13-15px |
| Body | Onest | 400 (regular) | 14px |
| Small / Labels | JetBrains Mono | 500 (medium) | 9-11px, uppercase, letter-spacing 1.5px |
| Mono (code, IDs, data) | JetBrains Mono | 400 | 12-13px |

- Line height: 1.5 for body, 1.3 for headings
- Letter spacing: -0.3px for headings, normal for body

## Layout
- Navigation: Collapsible sidebar (left), 220px expanded / 48px collapsed
- Content max width: 1200px (centered with auto margins)
- Page padding: 24px 28px (desktop), 16px (mobile)
- Sidebar background: `--surface`
- Sidebar active item: `--accent-muted` background with `--accent` text, 2px right border

## Spacing & Sizing
- Base unit: 4px
- Common gaps: 4px, 8px, 12px, 14px, 16px, 22px, 24px, 28px
- Border radius: 8px (default), 14px (cards/modals), 6px (small elements like badges/tags)
- Icon size: 16px (inline), 16px (nav items)

## Component Standards

### Buttons
- Primary: `--accent` background at 15% opacity, `--accent` text, `--accent` border at 30%, 8px radius
- Secondary: `--surface` background, `--border` border, `--text-secondary` text
- Ghost: no border, `--text-secondary` text, hover → `--surface-hover` background
- Destructive: `--danger` background, white text
- Sizing: sm (28px), default (32px), lg (36px)
- Font: Onest, 13px

### Cards
- Background: `--surface`
- Border: 1px solid `--border`
- Radius: 14px
- Padding: 18px 20px
- Optional: 2px colored top border (blue/teal/violet/amber per context)
- No shadow (flat design)

### KPI Cards
- Same as Cards but with colored top border accent
- Value: 28px, bold, colored to match accent
- Label: 12px, `--text-secondary`
- Delta indicator: JetBrains Mono, 11.5px, green (up) / red (down)
- Footer: delta + comparison text

### Forms / Inputs
- Height: 32px
- Background: `--background`
- Border: 1px solid `--border`, focus → `--accent`
- Radius: 8px
- Label: `--text-secondary`, 12px, medium weight

### Tables
- Header: `--text-tertiary`, 10.5px, uppercase, JetBrains Mono, letter-spacing 0.5px
- Header background: `--surface-hover`
- Rows: transparent background, hover → `--surface-hover`
- Borders: horizontal only, `rgba(255,255,255,0.03)`
- Row padding: 10px 16px
- Data columns: JetBrains Mono for numbers/money/dates

### Kanban Board
- Column background: transparent (no column cards)
- Column header: `--text-secondary`, 12px, uppercase, with count badge
- Task card: same as Cards standard
- Drag handle: subtle, appears on hover

### Sidebar Navigation
- Section labels: `--text-tertiary`, 9px, uppercase, letter-spacing 1.5px, JetBrains Mono
- Nav items: `--text-secondary`, 13.5px, Onest, 32px height, gap 9px
- Active item: `--accent` text, `--accent-muted` background, 2px right border solid `--accent`
- Hover: `--surface-hover` background, `--text-primary` text
- Icons: 16px, opacity 0.8, active → opacity 1

### Badges / Status Pills
- Radius: 6px
- Padding: 3px 9px
- Font: JetBrains Mono, 11px
- Border: 1px solid with matching color at 20% opacity
- Background: matching color at 10% opacity
- Example (teal): bg `rgba(45,212,191,0.1)`, text `--accent-teal`, border `rgba(45,212,191,0.2)`

### Date/Period Filter
- Container: `--surface` background, `--border` border, 10px radius, 4px padding
- Buttons: 12.5px Onest, 5px 14px padding, 7px radius
- Active: `--accent` background, white text
- Inactive: transparent, `--text-secondary` text

### Modals / Dialogs
- Background: `--surface`
- Border: 1px solid `--border`
- Radius: 14px
- Overlay: black 60% opacity
- Max width: 480px (default), 640px (large)

### Toasts / Notifications
- Position: bottom-right
- Background: `--surface`
- Border: 1px solid `--border`
- Radius: 14px
- Auto-dismiss: 5 seconds

## Animations
- `fadeUp`: opacity 0 → 1, translateY(12px → 0), 0.4s ease
- Staggered delays: 0.05s increments for card grids
- `pulse`: opacity 1 → 0.35 → 1, 2s ease-in-out infinite (for status dots)
- Transitions: all 0.15s for interactive elements
