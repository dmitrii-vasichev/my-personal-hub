"""Remove duplicate leads, keeping the earliest created record for each group.

Duplicates are identified by matching (user_id, lower(business_name), digits-only phone).

Usage:
    # Dry run (default) — show what would be deleted
    python -m scripts.remove_duplicate_leads

    # Actually delete
    python -m scripts.remove_duplicate_leads --apply
"""

import asyncio
import sys

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory as async_session
from app.models.outreach import Lead


async def find_and_remove_duplicates(apply: bool = False):
    async with async_session() as db:
        # Find duplicate groups by (user_id, normalized business_name, digits-only phone)
        stmt = text("""
            SELECT id, user_id, business_name, phone, created_at,
                   ROW_NUMBER() OVER (
                       PARTITION BY user_id,
                                    LOWER(TRIM(business_name)),
                                    REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g')
                       ORDER BY created_at ASC, id ASC
                   ) AS rn
            FROM leads
        """)
        result = await db.execute(stmt)
        rows = result.fetchall()

        duplicates = [r for r in rows if r.rn > 1]

        if not duplicates:
            print("No duplicates found.")
            return

        print(f"Found {len(duplicates)} duplicate(s) to remove:\n")
        for r in duplicates:
            print(f"  ID={r.id}  business={r.business_name!r}  phone={r.phone}  created={r.created_at}")

        if not apply:
            print(f"\nDry run — pass --apply to actually delete these {len(duplicates)} records.")
            return

        ids_to_delete = [r.id for r in duplicates]

        # Delete related records first
        await db.execute(text("DELETE FROM lead_status_history WHERE lead_id = ANY(:ids)"), {"ids": ids_to_delete})
        await db.execute(text("DELETE FROM lead_activities WHERE lead_id = ANY(:ids)"), {"ids": ids_to_delete})
        await db.execute(text("DELETE FROM leads WHERE id = ANY(:ids)"), {"ids": ids_to_delete})
        await db.commit()

        print(f"\nDeleted {len(ids_to_delete)} duplicate leads.")


if __name__ == "__main__":
    apply = "--apply" in sys.argv
    asyncio.run(find_and_remove_duplicates(apply=apply))
