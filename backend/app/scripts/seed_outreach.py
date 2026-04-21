"""Seed outreach data for demo user. Run with: python -m app.scripts.seed_outreach
Idempotent for outreach tables: clears only outreach data for the demo user.
"""
from __future__ import annotations

import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete

from app.core.database import async_session_factory
from app.models.outreach import (
    Lead,
    LeadStatus,
    Industry,
    LeadActivity,
    ActivityType,
    LeadStatusHistory,
)
from app.models.user import User

DEMO_EMAIL = "demo@personalhub.app"
ADMIN_EMAIL = "admin@example.com"


async def seed_outreach(use_admin: bool = False) -> None:
    target_email = ADMIN_EMAIL if use_admin else DEMO_EMAIL
    async with async_session_factory() as session:
        # 1. Find target user
        result = await session.execute(select(User).where(User.email == target_email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"User {target_email} not found.")
            return

        user_id = user.id
        print(f"Seeding outreach for user: {user_id}")

        # 2. Cleanup existing outreach data
        stmt_leads = select(Lead.id).where(Lead.user_id == user_id)
        lead_ids = (await session.execute(stmt_leads)).scalars().all()

        if lead_ids:
            await session.execute(
                delete(LeadActivity).where(LeadActivity.lead_id.in_(lead_ids))
            )
            await session.execute(
                delete(LeadStatusHistory).where(
                    LeadStatusHistory.lead_id.in_(lead_ids)
                )
            )
            await session.execute(delete(Lead).where(Lead.user_id == user_id))

        await session.execute(delete(Industry).where(Industry.user_id == user_id))
        await session.commit()
        print("  Cleanup completed")

        # ── Industries ───────────────────────────────────────────────
        industries_data = [
            {
                "name": "Private Dental Clinics",
                "slug": "dental-clinics",
                "description": "High-end dental services, implants, and orthodontics.",
                "prompt_instructions": (
                    "Focus on ROI of high-ticket services like veneers and implants. "
                    "Professional, clinical yet welcoming tone."
                ),
                "cases": [
                    {
                        "title": "Implants ROI",
                        "description": "How a local clinic added $50k/mo revenue by optimizing implant follow-ups.",
                    }
                ],
            },
            {
                "name": "Corporate Law Firms",
                "slug": "law-firms",
                "description": "B2B legal services, IP law, and corporate litigation.",
                "prompt_instructions": (
                    "Focus on risk mitigation and specialized expertise. "
                    "Formal, authoritative, and data-backed tone."
                ),
                "cases": [
                    {
                        "title": "IP Protection",
                        "description": "Helping firms secure intellectual property in multi-state jurisdictions.",
                    }
                ],
            },
            {
                "name": "Real Estate Development",
                "slug": "real-estate-development",
                "description": "Luxury residential and commercial developments.",
                "prompt_instructions": (
                    "Focus on market positioning and high-value project management. "
                    "Visionary, ambitious tone."
                ),
                "cases": [
                    {
                        "title": "Luxury Condos",
                        "description": "Increasing pre-sale velocity for high-end developments via strategic data analysis.",
                    }
                ],
            },
            {
                "name": "Commercial HVAC Services",
                "slug": "hvac-commercial",
                "description": "Commercial climate control and large-scale residential systems.",
                "prompt_instructions": (
                    "Focus on operational efficiency and long-term maintenance ROI. "
                    "Reliable, technical, and efficient tone."
                ),
                "cases": [
                    {
                        "title": "Energy Efficiency",
                        "description": "Saving $12k/year in utility costs for a warehouse via smart HVAC scheduling.",
                    }
                ],
            },
            {
                "name": "SaaS & Tech Startups",
                "slug": "saas-startups",
                "description": "Early-stage B2B SaaS, dev-tools, and AI-first products.",
                "prompt_instructions": (
                    "Focus on growth metrics and product-market fit. "
                    "Direct, founder-friendly, data-driven tone."
                ),
                "cases": [
                    {
                        "title": "PLG Analytics",
                        "description": "Building a self-serve analytics layer that cut churn by 18% in 3 months.",
                    }
                ],
            },
        ]

        industries = []
        for ind in industries_data:
            industry = Industry(
                user_id=user_id,
                name=ind["name"],
                slug=ind["slug"],
                description=ind["description"],
                prompt_instructions=ind["prompt_instructions"],
                cases=ind["cases"],
            )
            session.add(industry)
            industries.append(industry)

        await session.flush()
        print(f"  Created {len(industries)} industries")

        # ── Leads ─────────────────────────────────────────────────────
        now = datetime.now(timezone.utc)

        leads_data = [
            # ── Dental (4 leads) ──
            {
                "business_name": "Smile Perfection Clinic",
                "industry_idx": 0,
                "contact_person": "Dr. Sarah Miller",
                "email": "sarah@smileperfection.com",
                "website": "https://smileperfection.com",
                "status": LeadStatus.negotiating,
                "service_description": "Premier restorative dentistry in Denver.",
                "notes": "Interested in AI-powered patient follow-ups for high-ticket implant cases.",
                "proposal_subject": "Strategic Growth: Optimizing Restorative Case Conversion",
                "proposal_text": (
                    "Dear Dr. Miller,\n\n"
                    "I've analyzed your current clinic's positioning in the Denver market. "
                    "While your patient satisfaction is top-tier, there's a significant "
                    "opportunity in capturing the 'middle-funnel' for dental implants.\n\n"
                    "By integrating a specialized data layer for patient education and "
                    "automated ROI-tracking for high-ticket cases, we can increase "
                    "conversion rates by an estimated 15-20% without adding headcount.\n\n"
                    "Let's discuss how we can bridge your clinical excellence with "
                    "strategic tech.\n\nBest regards,\nAlex"
                ),
                "source": "linkedin_outreach",
                "source_detail": "Direct Outreach Campaign",
            },
            {
                "business_name": "Bright Dental Denver",
                "industry_idx": 0,
                "contact_person": "James Wilson",
                "email": "james@brightdental.com",
                "status": LeadStatus.follow_up,
                "notes": "Sent initial proposal. Follow up on Tuesday.",
                "source": "referral",
                "source_detail": "Referred by Dr. Miller",
            },
            {
                "business_name": "Rocky Mountain Orthodontics",
                "industry_idx": 0,
                "contact_person": "Dr. Emily Stone",
                "email": "emily@rmortho.com",
                "status": LeadStatus.contacted,
                "notes": "Discovery call scheduled for Friday.",
                "source": "linkedin_outreach",
                "source_detail": "LinkedIn Campaign — Q1",
            },
            {
                "business_name": "Peak Smile Studio",
                "industry_idx": 0,
                "contact_person": "Dr. Kevin Tran",
                "email": "kevin@peaksmile.co",
                "status": LeadStatus.new,
                "service_description": "Cosmetic dentistry and veneers.",
                "notes": "Found via Google. Large practice, 4 locations.",
                "source": "website",
                "source_detail": "Google Maps search",
            },
            # ── Law (3 leads) ──
            {
                "business_name": "Justice & Partners LLP",
                "industry_idx": 1,
                "contact_person": "Marcus Thorne",
                "email": "m.thorne@justicepartners.com",
                "status": LeadStatus.responded,
                "service_description": "Full-service corporate litigation firm.",
                "notes": "Looking for data security compliance and internal knowledge management tools.",
                "proposal_text": (
                    "Dear Mr. Thorne,\n\n"
                    "Our proposed solution focuses on secure, private AI agents that "
                    "index your case files while maintaining strict SOC2 compliance. "
                    "This system would reduce time spent on precedent research by 30%.\n\n"
                    "I'd like to walk you through a brief demo tailored to your firm's "
                    "practice areas.\n\nBest regards,\nAlex"
                ),
                "source": "linkedin_outreach",
                "source_detail": "LinkedIn Campaign — Q1",
            },
            {
                "business_name": "Westfield Legal Group",
                "industry_idx": 1,
                "contact_person": "Catherine Blake",
                "email": "c.blake@westfieldlegal.com",
                "status": LeadStatus.contacted,
                "service_description": "IP law and patent prosecution.",
                "notes": "Sent intro email. Waiting for response.",
                "source": "referral",
                "source_detail": "From Marcus Thorne",
            },
            {
                "business_name": "Summit Ridge Attorneys",
                "industry_idx": 1,
                "contact_person": "Daniel Ortiz",
                "email": "d.ortiz@summitridge.law",
                "status": LeadStatus.lost,
                "notes": "Budget constraints. Revisit in Q3.",
                "source": "linkedin_outreach",
                "source_detail": "Cold outreach",
            },
            # ── Real Estate (4 leads) ──
            {
                "business_name": "Mile High Developments",
                "industry_idx": 2,
                "contact_person": "Jessica Vance",
                "email": "jessica@milehighdev.com",
                "status": LeadStatus.new,
                "service_description": "Residential luxury developer.",
                "notes": "New lead from LinkedIn. High potential for sales tracking system.",
                "source": "linkedin_outreach",
                "source_detail": "Inbound from LinkedIn post",
            },
            {
                "business_name": "Front Range Properties",
                "industry_idx": 2,
                "contact_person": "Michael Torres",
                "email": "m.torres@frontrangeprop.com",
                "status": LeadStatus.negotiating,
                "service_description": "Mixed-use commercial development.",
                "notes": "Second meeting done. Preparing SOW for analytics dashboard.",
                "proposal_subject": "Analytics Platform for Pre-Sale Performance",
                "proposal_text": (
                    "Dear Michael,\n\n"
                    "Following our conversation, I've outlined a phased approach for "
                    "your pre-sale analytics platform.\n\n"
                    "Phase 1: Lead tracking dashboard with real-time pipeline metrics.\n"
                    "Phase 2: Automated market comp analysis for pricing decisions.\n"
                    "Phase 3: Buyer persona segmentation for targeted marketing.\n\n"
                    "The estimated timeline is 8 weeks for Phase 1.\n\n"
                    "Looking forward to your feedback.\nAlex"
                ),
                "source": "referral",
                "source_detail": "Referred by Jessica Vance",
            },
            {
                "business_name": "Alpine Vista Homes",
                "industry_idx": 2,
                "contact_person": "Laura Chen",
                "email": "laura@alpinevista.com",
                "status": LeadStatus.won,
                "service_description": "Luxury mountain residential projects.",
                "notes": "Signed. Starting with buyer analytics dashboard in April.",
                "source": "website",
                "source_detail": "Contact form submission",
            },
            {
                "business_name": "Crestline Realty Group",
                "industry_idx": 2,
                "contact_person": "Brandon Hayes",
                "email": "b.hayes@crestlinerealty.com",
                "status": LeadStatus.on_hold,
                "notes": "Interested but new project delayed until Q3.",
                "source": "linkedin_outreach",
                "source_detail": "Cold outreach",
            },
            # ── HVAC (3 leads) ──
            {
                "business_name": "Cooling Pro Industrial",
                "industry_idx": 3,
                "contact_person": "Robert Chen",
                "email": "r.chen@coolingpro.com",
                "status": LeadStatus.won,
                "service_description": "Industrial HVAC and cooling solutions.",
                "notes": "Closed last week. Implementing predictive maintenance dashboard.",
                "source": "linkedin_outreach",
                "source_detail": "Direct Outreach Campaign",
            },
            {
                "business_name": "Summit Climate Solutions",
                "industry_idx": 3,
                "contact_person": "Greg Patterson",
                "email": "greg@summitclimate.com",
                "status": LeadStatus.follow_up,
                "service_description": "Commercial HVAC for office buildings.",
                "notes": "Proposal sent. He wants to loop in his operations manager.",
                "proposal_text": (
                    "Dear Greg,\n\n"
                    "Based on our discussion, the key opportunity is in predictive "
                    "maintenance scheduling. By analyzing sensor data from your existing "
                    "BMS, we can reduce emergency calls by an estimated 25%.\n\n"
                    "I've attached a case study from a similar engagement.\n\n"
                    "Best regards,\nAlex"
                ),
                "source": "referral",
                "source_detail": "Met at Denver HVAC Expo",
            },
            {
                "business_name": "AirFlow Masters",
                "industry_idx": 3,
                "contact_person": "Tony Reeves",
                "email": "tony@airflowmasters.com",
                "status": LeadStatus.new,
                "notes": "Found on Google. Mid-size, 15 technicians. Good fit for scheduling tool.",
                "source": "website",
                "source_detail": "Google search",
            },
            # ── SaaS & Tech (4 leads) ──
            {
                "business_name": "DataPulse.io",
                "industry_idx": 4,
                "contact_person": "Megan Li",
                "email": "megan@datapulse.io",
                "website": "https://datapulse.io",
                "status": LeadStatus.responded,
                "service_description": "Real-time analytics SaaS for e-commerce.",
                "notes": "Founder replied. Wants to discuss custom dashboard integration.",
                "source": "linkedin_outreach",
                "source_detail": "Inbound after LinkedIn post",
            },
            {
                "business_name": "NexGen DevTools",
                "industry_idx": 4,
                "contact_person": "Alex Romero",
                "email": "alex@nexgendev.io",
                "status": LeadStatus.contacted,
                "service_description": "Developer productivity tools.",
                "notes": "Initial email sent. Pre-seed stage, strong founding team.",
                "source": "linkedin_outreach",
                "source_detail": "Cold outreach",
            },
            {
                "business_name": "CloudMetrics AI",
                "industry_idx": 4,
                "contact_person": "Priya Sharma",
                "email": "priya@cloudmetrics.ai",
                "status": LeadStatus.negotiating,
                "service_description": "AI-powered infrastructure monitoring.",
                "notes": "Deep in talks. They need a BI layer on top of their telemetry data.",
                "proposal_subject": "BI Analytics Layer for CloudMetrics Telemetry",
                "proposal_text": (
                    "Dear Priya,\n\n"
                    "Here's my proposed approach for the analytics layer:\n\n"
                    "1. PostgreSQL materialized views for aggregated telemetry.\n"
                    "2. Interactive Next.js dashboard with drill-down capabilities.\n"
                    "3. Alerting rules engine with Slack/PagerDuty integration.\n\n"
                    "This gives your customers self-serve insights without "
                    "overloading your core infrastructure.\n\n"
                    "Happy to walk through the architecture in detail.\nAlex"
                ),
                "source": "referral",
                "source_detail": "Introduced by Megan Li",
            },
            {
                "business_name": "Stacklane",
                "industry_idx": 4,
                "contact_person": "Jordan Kim",
                "email": "jordan@stacklane.dev",
                "status": LeadStatus.new,
                "service_description": "No-code backend for agencies.",
                "notes": "Met at AI Tinkerers Denver meetup. Exchanged cards.",
                "source": "referral",
                "source_detail": "AI Tinkerers Denver meetup",
            },
        ]

        for ld in leads_data:
            lead = Lead(
                user_id=user_id,
                business_name=ld["business_name"],
                industry_id=industries[ld["industry_idx"]].id,
                contact_person=ld.get("contact_person"),
                email=ld.get("email"),
                website=ld.get("website"),
                status=ld["status"],
                service_description=ld.get("service_description"),
                notes=ld.get("notes"),
                proposal_subject=ld.get("proposal_subject"),
                proposal_text=ld.get("proposal_text"),
                source=ld.get("source", "linkedin_outreach"),
                source_detail=ld.get("source_detail", "Direct Outreach Campaign"),
            )
            session.add(lead)
            await session.flush()

            # -- Activity history --------------------------------------------------
            # All leads get a creation note
            session.add(
                LeadActivity(
                    lead_id=lead.id,
                    activity_type=ActivityType.note,
                    subject="Lead added",
                    body=f"Added {ld['business_name']} to pipeline.",
                )
            )

            # Leads past "new" get an outbound email activity
            if ld["status"] != LeadStatus.new:
                session.add(
                    LeadActivity(
                        lead_id=lead.id,
                        activity_type=ActivityType.outbound_email,
                        subject=f"Intro email to {ld.get('contact_person', 'contact')}",
                        body="Sent personalized intro based on industry profile.",
                    )
                )

            # Responded / negotiating / won get an inbound reply
            if ld["status"] in (
                LeadStatus.responded,
                LeadStatus.negotiating,
                LeadStatus.won,
            ):
                session.add(
                    LeadActivity(
                        lead_id=lead.id,
                        activity_type=ActivityType.inbound_email,
                        subject=f"Reply from {ld.get('contact_person', 'contact')}",
                        body="Positive response. Wants to schedule a call.",
                    )
                )

            # Negotiating / won get a meeting
            if ld["status"] in (LeadStatus.negotiating, LeadStatus.won):
                session.add(
                    LeadActivity(
                        lead_id=lead.id,
                        activity_type=ActivityType.meeting,
                        subject="Discovery call",
                        body="30-min Zoom. Discussed requirements and timeline.",
                    )
                )

            # Won leads get a proposal_sent activity
            if ld["status"] == LeadStatus.won:
                session.add(
                    LeadActivity(
                        lead_id=lead.id,
                        activity_type=ActivityType.proposal_sent,
                        subject="Final proposal sent",
                        body="SOW and pricing approved.",
                    )
                )

            # -- Status transitions ------------------------------------------------
            transitions = _build_transitions(ld["status"])
            prev_status = LeadStatus.new.value
            for i, st in enumerate(transitions):
                session.add(
                    LeadStatusHistory(
                        lead_id=lead.id,
                        old_status=prev_status,
                        new_status=st,
                        comment="Pipeline progression",
                        changed_at=now - timedelta(days=len(transitions) - i),
                    )
                )
                prev_status = st

        await session.commit()
        print(f"  Created {len(leads_data)} leads with activities and history")


def _build_transitions(target: LeadStatus) -> list[str]:
    """Return the status chain from 'new' to the target status."""
    pipeline = [
        LeadStatus.contacted,
        LeadStatus.follow_up,
        LeadStatus.responded,
        LeadStatus.negotiating,
        LeadStatus.won,
    ]
    chain: list[str] = []
    if target == LeadStatus.new:
        return chain
    if target == LeadStatus.lost:
        return [LeadStatus.contacted.value, LeadStatus.lost.value]
    if target == LeadStatus.on_hold:
        return [LeadStatus.contacted.value, LeadStatus.on_hold.value]
    for s in pipeline:
        chain.append(s.value)
        if s == target:
            break
    return chain


async def cleanup_outreach(use_admin: bool = False) -> None:
    """Remove all outreach data for target user (for post-screenshot cleanup)."""
    target_email = ADMIN_EMAIL if use_admin else DEMO_EMAIL
    async with async_session_factory() as session:
        result = await session.execute(
            select(User).where(User.email == target_email)
        )
        user = result.scalar_one_or_none()
        if not user:
            return
        stmt = select(Lead.id).where(Lead.user_id == user.id)
        lead_ids = (await session.execute(stmt)).scalars().all()
        if lead_ids:
            await session.execute(
                delete(LeadActivity).where(LeadActivity.lead_id.in_(lead_ids))
            )
            await session.execute(
                delete(LeadStatusHistory).where(
                    LeadStatusHistory.lead_id.in_(lead_ids)
                )
            )
            await session.execute(delete(Lead).where(Lead.user_id == user.id))
        await session.execute(delete(Industry).where(Industry.user_id == user.id))
        await session.commit()
        print(f"Outreach data cleaned up for {target_email}.")


if __name__ == "__main__":
    import sys

    use_admin = "--admin" in sys.argv
    if "--cleanup" in sys.argv:
        asyncio.run(cleanup_outreach(use_admin=use_admin))
    else:
        asyncio.run(seed_outreach(use_admin=use_admin))
