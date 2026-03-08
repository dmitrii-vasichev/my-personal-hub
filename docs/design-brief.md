# Design Brief: Personal Hub

## UI Framework
- Library: shadcn/ui (Radix UI primitives)
- CSS: Tailwind CSS v4
- Icons: Lucide React
- Drag & Drop: @dnd-kit

## Theme
- Mode: Both (dark default, light available via toggle)
- Style: Strict minimalism — Linear-inspired
- Density: Compact, information-dense

## Reference
- Primary inspiration: [Linear](https://linear.app) — clean, fast, minimal dark UI
- Key traits: no visual noise, subtle borders, muted secondary text, compact spacing

## Color Palette

### Dark Theme (default)
| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#0A0A0B` | Page background |
| `--surface` | `#131316` | Cards, panels, sidebar |
| `--surface-hover` | `#1A1A1F` | Hover states on surfaces |
| `--border` | `#232329` | Subtle borders, dividers |
| `--border-strong` | `#2E2E36` | Focused/active borders |
| `--text-primary` | `#EDEDEF` | Headings, primary text |
| `--text-secondary` | `#8B8B93` | Descriptions, labels |
| `--text-tertiary` | `#5C5C66` | Placeholders, disabled |
| `--accent` | `#5B6AD0` | Primary actions, links, active states |
| `--accent-hover` | `#6E7CE0` | Accent hover |
| `--accent-muted` | `rgba(91,106,208,0.15)` | Accent backgrounds (badges, highlights) |
| `--danger` | `#E5484D` | Errors, destructive actions |
| `--warning` | `#F5A623` | Warnings, overdue |
| `--success` | `#30A46C` | Completed, success states |
| `--info` | `#5B6AD0` | Informational (same as accent) |

### Light Theme
| Token | Hex | Usage |
|-------|-----|-------|
| `--background` | `#FFFFFF` | Page background |
| `--surface` | `#F8F8F9` | Cards, panels, sidebar |
| `--surface-hover` | `#F0F0F2` | Hover states |
| `--border` | `#E4E4E8` | Borders, dividers |
| `--border-strong` | `#D1D1D8` | Focused/active borders |
| `--text-primary` | `#131316` | Headings, primary text |
| `--text-secondary` | `#6B6B76` | Descriptions, labels |
| `--text-tertiary` | `#9C9CA8` | Placeholders, disabled |
| `--accent` | `#5B6AD0` | Same accent across themes |
| `--accent-hover` | `#4A59BF` | Accent hover (darker in light mode) |
| `--accent-muted` | `rgba(91,106,208,0.10)` | Accent backgrounds |
| `--danger` | `#E5484D` | Errors |
| `--warning` | `#F5A623` | Warnings |
| `--success` | `#30A46C` | Success |

## Typography
| Role | Font | Weight | Size |
|------|------|--------|------|
| Headings | Inter | 600 (semibold) | 20-28px |
| Subheadings | Inter | 500 (medium) | 14-16px |
| Body | Inter | 400 (regular) | 14px |
| Small / Labels | Inter | 500 (medium) | 12px |
| Mono (code, IDs) | JetBrains Mono | 400 | 13px |

- Line height: 1.5 for body, 1.3 for headings
- Letter spacing: -0.01em for headings, normal for body

## Layout
- Navigation: Collapsible sidebar (left), 240px expanded / 48px collapsed
- Content max width: 1200px (centered with auto margins)
- Page padding: 24px (desktop), 16px (mobile)
- Sidebar background: `--surface`
- Sidebar active item: `--accent-muted` background with `--accent` text

## Spacing & Sizing
- Base unit: 4px
- Common gaps: 4px, 8px, 12px, 16px, 24px, 32px
- Border radius: 6px (default), 8px (cards/modals), 4px (small elements like badges)
- Icon size: 16px (inline), 20px (nav items)

## Component Standards

### Buttons
- Primary: `--accent` background, white text, 6px radius, 32px height
- Secondary: transparent background, `--border` border, `--text-primary` text
- Ghost: no border, `--text-secondary` text, hover → `--surface-hover` background
- Destructive: `--danger` background, white text
- Sizing: sm (28px), default (32px), lg (36px)

### Cards
- Background: `--surface`
- Border: 1px solid `--border`
- Radius: 8px
- Padding: 16px
- No shadow (flat design)

### Forms / Inputs
- Height: 32px
- Background: `--background`
- Border: 1px solid `--border`, focus → `--accent`
- Radius: 6px
- Label: `--text-secondary`, 12px, medium weight, uppercase optional

### Tables
- Header: `--text-secondary`, 12px, uppercase, medium weight
- Rows: `--surface` background, hover → `--surface-hover`
- Borders: horizontal only, `--border`
- Compact row height: 40px

### Kanban Board
- Column background: transparent (no column cards)
- Column header: `--text-secondary`, 12px, uppercase, with count badge
- Task card: same as Cards standard
- Drag handle: subtle, appears on hover

### Sidebar Navigation
- Section labels: `--text-tertiary`, 11px, uppercase, letter-spacing 0.05em
- Nav items: `--text-secondary`, 14px, 32px height
- Active item: `--accent` text, `--accent-muted` background, 6px radius
- Hover: `--surface-hover` background
- Icons: 16px, same color as text

### Badges / Status Pills
- Radius: 4px
- Padding: 2px 8px
- Font: 12px, medium weight
- Priority colors: urgent → `--danger`, high → `#F76B15`, medium → `--warning`, low → `--text-tertiary`
- Status colors: contextual per module

### Modals / Dialogs
- Background: `--surface`
- Border: 1px solid `--border`
- Radius: 8px
- Overlay: black 60% opacity
- Max width: 480px (default), 640px (large)

### Toasts / Notifications
- Position: bottom-right
- Background: `--surface`
- Border: 1px solid `--border`
- Radius: 8px
- Auto-dismiss: 5 seconds
