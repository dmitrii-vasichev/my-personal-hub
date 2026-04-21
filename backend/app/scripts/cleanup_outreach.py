"""Cleanup outreach data for demo user. Run with: python -m app.scripts.cleanup_outreach
"""
from __future__ import annotations

import asyncio
from sqlalchemy import select, delete

from app.core.database import async_session_factory
from app.models.outreach import Lead, Industry, LeadActivity, LeadStatusHistory
from app.models.user import User

DEMO_EMAIL = "demo@personalhub.app"

async def cleanup_outreach() -> None:
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == DEMO_EMAIL))
        user = result.scalar_one_or_none()
        if not user:
            print("Demo user not found.")
            return

        user_id = user.id
        print(f"Cleaning up outreach for user: {user_id}")

        stmt_leads = select(Lead.id).where(Lead.user_id == user_id)
        lead_ids = (await session.execute(stmt_leads)).scalars().all()
        
        if lead_ids:
            await session.execute(delete(LeadActivity).where(LeadActivity.lead_id.in_(lead_ids)))
            await session.execute(delete(LeadStatusHistory).where(LeadStatusHistory.lead_id.in_(lead_ids)))
            await session.execute(delete(Lead).where(Lead.user_id == user_id))
            
        await session.execute(delete(Industry).where(Industry.user_id == user_id))
        await session.commit()
        print("Cleanup completed.")

if __name__ == "__main__":
    asyncio.run(cleanup_outreach())
