"""
Migrate existing Planner markdown files from the Drive-synced folder into the
``daily_plans`` and ``plan_items`` tables.

The real markdown format is produced by the ``planner`` Claude skill
(see ``~/.claude/skills/planner/prompts/plan-day.md``). In ASCII-friendly
shorthand a file looks like this (U+00B7 middle-dot and U+2014 em-dash are
stripped in the comment below; see SLOT_HEADER_RE for the actual glyphs):

    ---
    date: 2026-04-17
    available_minutes: 300
    planned_minutes: 280
    completed_minutes: 120
    adherence_pct: null
    status: active
    created_at: 2026-04-17T09:00:00+02:00
    last_updated: 2026-04-17T13:30:00+02:00
    replans_count: 0
    categories_actual:
      language: 30
      career: 90
      home: 0
    ---

    # Plan for Friday, April 17

    **Available:** 5h ... **Planned:** 4h 40m ... **Energy peak:** morning

    ## Slot 1 -- Career ... 09:00-10:30 (90 min) ... career
    - [ ] Finalise cover letter for Acme (~45 min) [skill: career]
    - [x] Review applications queue (~30 min) [skill: career] -- done 10:00, actual 25min

    ## Slot 2 -- Language ... 11:00-11:30 (30 min) ... language
    - [ ] Anki review (~30 min) [skill: english]

    ## Free / buffer (20 min)
    Unallocated -- for overflows or short breaks.

    ## Completion log
    10:00 ... career ... Review applications queue ... planned 30min ... actual 25min ... -5min under

The script parses the YAML frontmatter, trusting the pre-computed aggregates
(``planned_minutes``, ``completed_minutes``, ``adherence_pct``,
``replans_count``, ``categories_actual``) and extracts the checkbox lines
from slot sections. Per-item ``status`` is always inserted as ``pending``:
the markdown format encodes per-item completion but historical reconciliation
is not the goal of this one-shot seed. The Drive file remains the
authoritative record of *what was done*; the DB gets the plan + items so
analytics has historical shape data.

Usage
-----

Run from ``backend/`` so ``app.*`` resolves on the import path:

    # Dry-run against the default Drive folder (does NOT touch the DB)
    python -m scripts.migrate_drive_plans_to_db --user-id 1 --dry-run

    # Real run
    python -m scripts.migrate_drive_plans_to_db --user-id 1

    # Custom source directory (useful for tests / fixtures)
    python -m scripts.migrate_drive_plans_to_db --user-id 1 --source-dir /tmp/plans

Idempotency: re-running against the same files will "update" rather than
"create" rows, and plan items are cleanly replaced (no duplicates).

Verification ("test"): run with ``--dry-run`` against the real folder, review
the per-file log lines and the summary counts, then drop the flag.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import re
from dataclasses import dataclass
from datetime import date as date_type
from pathlib import Path
from typing import Optional

import yaml
from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.daily_plan import DailyPlan, PlanItem, PlanItemStatus


DEFAULT_SOURCE = Path.home() / "Documents/Notes/Planner/daily-plans"

# File name must look like ``YYYY-MM-DD.md``.
DATE_RE = re.compile(r"^(\d{4}-\d{2}-\d{2})\.md$")

# Separators we expect between tokens inside a slot header. The planner
# skill emits U+00B7 (middle-dot) and U+2014 (em-dash); keep ASCII hyphen
# as a fallback in case a human edited the file.
_SEP_CHARS = "\u00b7\u2014\u2013\u2012\u2212\\-"

# Slot headers look like (middle-dot / em-dash glyphs intentional):
#   "## Slot 1 \u2014 Career \u00b7 09:00-10:30 (90 min) \u00b7 career"
# We only need the trailing "... category_key" token.
SLOT_HEADER_RE = re.compile(
    r"^##\s+Slot\b.*?\s[" + _SEP_CHARS + r"]\s+"
    r"(?P<category>[a-z_][a-z0-9_]*)\s*$",
    re.IGNORECASE,
)

# Checkbox item lines. Covers pending ``- [ ]``, done ``- [x]`` and the rare
# skipped form ``- [~]`` documented in the planner skill.
ITEM_RE = re.compile(
    r"^\s*[-*]\s+\[(?P<mark>[ xX~])\]\s+(?P<rest>.+?)\s*$",
)

# Pull the planned-minutes hint out of an item line, e.g. ``(~45 min)``.
MINUTES_RE = re.compile(r"\(~\s*(\d+)\s*min\s*\)", re.IGNORECASE)

# Pull the ``[skill: name]`` tag out of an item line (optional).
SKILL_RE = re.compile(r"\[skill:\s*(?P<skill>[^\]]+)\]", re.IGNORECASE)

# Strip a trailing completion tail from a done item: e.g.
# "... (~30 min) [skill: career] \u2014 done 10:00, actual 25min".
DONE_TAIL_RE = re.compile(
    r"\s+[" + _SEP_CHARS + r"]\s+done\b.*$",
    re.IGNORECASE,
)

# Sections that should NOT be scanned for items.
SKIP_SECTION_PREFIXES = (
    "## Free / buffer",
    "## Completion log",
)

DEFAULT_ITEM_MINUTES = 30  # fallback when the markdown omits ``(~N min)``

log = logging.getLogger(__name__)


@dataclass
class ParsedItem:
    title: str
    category: Optional[str]
    minutes_planned: int


@dataclass
class ParsedPlan:
    date: date_type
    available_minutes: int
    planned_minutes: int
    completed_minutes: int
    adherence_pct: Optional[float]
    replans_count: int
    categories_actual: dict
    items: list[ParsedItem]


def _coerce_int(value, default: int = 0) -> int:
    """Safely coerce a frontmatter value to int; fall back to ``default``."""
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _coerce_opt_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _clean_title(rest: str) -> str:
    """Strip annotations/tails from a checkbox item's payload."""
    rest = DONE_TAIL_RE.sub("", rest)
    rest = MINUTES_RE.sub("", rest)
    rest = SKILL_RE.sub("", rest)
    # Trim trailing separators that may be left behind.
    rest = re.sub(r"[\s" + _SEP_CHARS + r"]+$", "", rest)
    return rest.strip()


def parse_file(path: Path) -> Optional[ParsedPlan]:
    """Parse a single daily-plan markdown file.

    Returns ``None`` when the file is unparseable (unexpected name, missing
    frontmatter, malformed YAML). Callers treat that as a SKIP.
    """
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        log.warning("Cannot read %s: %s", path.name, exc)
        return None

    name_match = DATE_RE.match(path.name)
    if not name_match:
        log.warning("Filename does not match YYYY-MM-DD.md: %s", path.name)
        return None

    # DATE_RE only checks digit count; reject filenames that look like dates
    # but aren't real ones (e.g. ``2026-13-01.md`` or ``2026-02-30.md``).
    try:
        plan_date = date_type.fromisoformat(name_match.group(1))
    except ValueError:
        log.warning(
            "Filename looks like a date but is not a valid calendar date: %s",
            path.name,
        )
        return None

    stripped = text.lstrip()
    if not stripped.startswith("---"):
        log.warning("No YAML frontmatter in %s", path.name)
        return None

    # Split on the fence markers.
    parts = stripped.split("---", 2)
    if len(parts) < 3:
        log.warning("Malformed frontmatter fences in %s", path.name)
        return None
    _, fm_text, body = parts

    try:
        meta = yaml.safe_load(fm_text) or {}
    except (yaml.YAMLError, ValueError) as exc:
        # ValueError is raised by yaml.constructor.construct_yaml_timestamp
        # for impossible calendar dates like ``2026-13-99``.
        log.warning("Invalid YAML in %s: %s", path.name, exc)
        return None

    if not isinstance(meta, dict):
        log.warning("Frontmatter is not a mapping in %s", path.name)
        return None

    categories_actual = meta.get("categories_actual") or {}
    if not isinstance(categories_actual, dict):
        categories_actual = {}

    # ``available_minutes`` is NOT NULL in the DB. Missing key is almost
    # certainly a data bug in the source file; warn so the user notices, but
    # still write a row (best-effort historical migration — the user can
    # audit the 0s afterwards).
    if "available_minutes" not in meta or meta.get("available_minutes") in (None, ""):
        log.warning(
            "Missing 'available_minutes' in frontmatter of %s; writing 0",
            path.name,
        )

    items: list[ParsedItem] = []
    current_category: Optional[str] = None
    in_skipped_section = False

    for raw in body.splitlines():
        line = raw.rstrip()

        if line.startswith("## "):
            # Heading boundary: figure out whether we care about the coming
            # lines. Slot headers carry the category; other headings reset.
            in_skipped_section = any(
                line.startswith(prefix) for prefix in SKIP_SECTION_PREFIXES
            )
            slot_match = SLOT_HEADER_RE.match(line)
            current_category = (
                slot_match.group("category") if slot_match else None
            )
            continue

        if in_skipped_section:
            continue

        item_match = ITEM_RE.match(line)
        if not item_match:
            continue

        rest = item_match.group("rest")
        minutes_match = MINUTES_RE.search(rest)
        minutes_planned = (
            int(minutes_match.group(1)) if minutes_match else DEFAULT_ITEM_MINUTES
        )

        title = _clean_title(rest)
        if not title:
            continue

        items.append(
            ParsedItem(
                title=title[:500],
                category=current_category,
                minutes_planned=minutes_planned,
            )
        )

    return ParsedPlan(
        date=plan_date,
        available_minutes=_coerce_int(meta.get("available_minutes")),
        planned_minutes=_coerce_int(meta.get("planned_minutes")),
        completed_minutes=_coerce_int(meta.get("completed_minutes")),
        adherence_pct=_coerce_opt_float(meta.get("adherence_pct")),
        replans_count=_coerce_int(meta.get("replans_count")),
        categories_actual=categories_actual,
        items=items,
    )


async def seed_one(
    session, user_id: int, parsed: ParsedPlan, dry_run: bool
) -> str:
    """Upsert a single ``DailyPlan`` + its items.

    Returns one of ``created``, ``updated``, ``would_create`` or
    ``would_update``.
    """
    result = await session.execute(
        select(DailyPlan).where(
            DailyPlan.user_id == user_id,
            DailyPlan.date == parsed.date,
        )
    )
    existing = result.scalar_one_or_none()

    if dry_run:
        return "would_update" if existing else "would_create"

    if existing is not None:
        # Drop stale items via the ORM (cascade would handle it too, but
        # being explicit keeps intent obvious in the log output).
        for stale in list(existing.items):
            await session.delete(stale)
        existing.available_minutes = parsed.available_minutes
        existing.planned_minutes = parsed.planned_minutes
        existing.completed_minutes = parsed.completed_minutes
        existing.adherence_pct = parsed.adherence_pct
        existing.replans_count = parsed.replans_count
        existing.categories_actual = parsed.categories_actual
        plan = existing
        outcome = "updated"
    else:
        plan = DailyPlan(
            user_id=user_id,
            date=parsed.date,
            available_minutes=parsed.available_minutes,
            planned_minutes=parsed.planned_minutes,
            completed_minutes=parsed.completed_minutes,
            adherence_pct=parsed.adherence_pct,
            replans_count=parsed.replans_count,
            categories_actual=parsed.categories_actual,
        )
        session.add(plan)
        await session.flush()
        outcome = "created"

    for i, item in enumerate(parsed.items):
        session.add(
            PlanItem(
                plan_id=plan.id,
                order=i,
                title=item.title,
                category=item.category,
                minutes_planned=item.minutes_planned,
                status=PlanItemStatus.pending,
            )
        )

    return outcome


async def main(args: argparse.Namespace) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    source = Path(args.source_dir).expanduser() if args.source_dir else DEFAULT_SOURCE

    if not source.exists():
        log.error("Source directory does not exist: %s", source)
        return 2
    if not source.is_dir():
        log.error("Source path is not a directory: %s", source)
        return 2

    files = sorted(source.glob("*.md"))
    log.info("Found %d .md files in %s", len(files), source)
    if not files:
        log.info("Nothing to migrate; exiting.")
        return 0

    counts = {
        "created": 0,
        "updated": 0,
        "would_create": 0,
        "would_update": 0,
        "skipped": 0,
        "error": 0,
    }

    async with async_session_factory() as session:
        for path in files:
            parsed = parse_file(path)
            if parsed is None:
                counts["skipped"] += 1
                log.info("  SKIP %s (unparseable)", path.name)
                continue
            try:
                outcome = await seed_one(
                    session, args.user_id, parsed, args.dry_run
                )
            except Exception as exc:  # noqa: BLE001 - log + continue
                counts["error"] += 1
                log.exception("  ERROR %s: %s", path.name, exc)
                # Rollback the current transaction so subsequent files aren't
                # poisoned by a half-applied state.
                await session.rollback()
                continue
            counts[outcome] += 1
            log.info(
                "  %s %s (%d items)",
                outcome.upper(),
                path.name,
                len(parsed.items),
            )

        if args.dry_run:
            log.info("Dry-run: skipping commit.")
        else:
            await session.commit()
            log.info("Committed.")

    log.info("Summary: %s", counts)
    return 0


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Seed existing Planner markdown files into the database.",
    )
    parser.add_argument(
        "--user-id",
        type=int,
        required=True,
        help="Target user id (owner of the daily plans).",
    )
    parser.add_argument(
        "--source-dir",
        default=None,
        help=f"Override source directory (default: {DEFAULT_SOURCE}).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and report counts, but do not write to the database.",
    )
    return parser


if __name__ == "__main__":
    args = _build_arg_parser().parse_args()
    exit_code = asyncio.run(main(args))
    raise SystemExit(exit_code)
