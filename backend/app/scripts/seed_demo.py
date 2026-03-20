"""Seed demo user with realistic data. Run with: python -m app.scripts.seed_demo

Idempotent: deletes existing demo user data and recreates everything.
"""
from __future__ import annotations

import asyncio
import os
import random
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session_factory
from app.core.security import hash_password
from app.models.calendar import CalendarEvent, EventNote
from app.models.garmin import (
    GarminConnection,
    VitalsActivity,
    VitalsBriefing,
    VitalsDailyMetric,
    VitalsSleep,
)
from app.models.job import ApplicationStatus, Job, StatusHistory
from app.models.knowledge_base import AiKnowledgeBase
from app.models.note import Note
from app.models.profile import UserProfile
from app.models.tag import Tag, TaskTag
from app.models.task import Task, TaskPriority, TaskSource, TaskStatus, Visibility
from app.models.telegram import PulseDigest, PulseDigestItem, PulseSource
from app.models.user import User, UserRole

DEMO_EMAIL = "demo@personalhub.app"
DEMO_DISPLAY_NAME = "Alex Demo"


async def cleanup_demo_user(session) -> None:
    """Delete existing demo user and all cascaded data."""
    result = await session.execute(select(User).where(User.email == DEMO_EMAIL))
    user = result.scalar_one_or_none()
    if user:
        await session.delete(user)
        await session.commit()
        print(f"Deleted existing demo user: {DEMO_EMAIL}")


async def create_demo_user(session) -> User:
    """Create the demo user."""
    password = os.environ.get("DEMO_PASSWORD", settings.DEMO_PASSWORD)
    user = User(
        email=DEMO_EMAIL,
        password_hash=hash_password(password),
        display_name=DEMO_DISPLAY_NAME,
        role=UserRole.demo,
        must_change_password=False,
        is_blocked=False,
        theme="dark",
    )
    session.add(user)
    await session.flush()
    print(f"Created demo user: {DEMO_EMAIL} (id={user.id})")
    return user


async def create_profile(session, user_id: int) -> None:
    """Create a realistic user profile."""
    profile = UserProfile(
        user_id=user_id,
        summary="Full-stack developer with 5+ years of experience in Python, TypeScript, and cloud infrastructure. Passionate about building developer tools and data-intensive applications.",
        skills=[
            "Python", "TypeScript", "React", "Next.js", "FastAPI",
            "PostgreSQL", "Docker", "AWS", "Git", "CI/CD",
            "REST APIs", "GraphQL", "TDD", "Agile",
        ],
        experience=[
            {
                "company": "TechFlow Inc.",
                "title": "Senior Software Engineer",
                "start_date": "2022-03",
                "end_date": None,
                "description": "Lead backend development for the analytics platform. Designed microservices architecture handling 10M+ events/day. Mentored 3 junior developers.",
            },
            {
                "company": "DataPulse",
                "title": "Software Engineer",
                "start_date": "2020-01",
                "end_date": "2022-02",
                "description": "Built data pipeline using Python and Apache Kafka. Reduced processing latency by 60%. Developed internal dashboards with React.",
            },
            {
                "company": "WebCraft Studio",
                "title": "Junior Developer",
                "start_date": "2018-06",
                "end_date": "2019-12",
                "description": "Full-stack web development with Node.js and React. Shipped 15+ client projects.",
            },
        ],
        education=[
            {
                "institution": "State University of Technology",
                "degree": "B.Sc. Computer Science",
                "year": 2018,
            },
        ],
        contacts={
            "email": "alex.demo@example.com",
            "linkedin": "linkedin.com/in/alexdemo",
            "github": "github.com/alexdemo",
            "phone": "+1 (555) 012-3456",
        },
    )
    session.add(profile)
    print("  Created profile")


async def create_tags(session, user_id: int) -> list[Tag]:
    """Create 8 tags and return them."""
    tag_data = [
        ("Work", "#4f8ef7"),
        ("Personal", "#a855f7"),
        ("Learning", "#f59e0b"),
        ("Health", "#10b981"),
        ("Finance", "#ef4444"),
        ("Home", "#f97316"),
        ("Career", "#3b82f6"),
        ("Side Project", "#8b5cf6"),
    ]
    tags = []
    for name, color in tag_data:
        tag = Tag(user_id=user_id, name=name, color=color)
        session.add(tag)
        tags.append(tag)
    await session.flush()
    print(f"  Created {len(tags)} tags")
    return tags


async def create_tasks(session, user_id: int, tags: list[Tag]) -> None:
    """Create 12 tasks across all statuses with checklists and updates."""
    now = datetime.now(timezone.utc)
    tasks_data = [
        {
            "title": "Set up CI/CD pipeline for the new microservice",
            "description": "Configure GitHub Actions for automated testing, linting, and deployment to staging.",
            "status": TaskStatus.done,
            "priority": TaskPriority.high,
            "deadline": now - timedelta(days=3),
            "tag_indices": [0, 6],
            "checklist": [
                {"id": "1", "text": "Create workflow YAML", "completed": True},
                {"id": "2", "text": "Add test stage", "completed": True},
                {"id": "3", "text": "Configure deploy to staging", "completed": True},
            ],
        },
        {
            "title": "Review and update resume for senior roles",
            "description": "Tailor resume to highlight leadership experience and system design skills.",
            "status": TaskStatus.in_progress,
            "priority": TaskPriority.high,
            "deadline": now + timedelta(days=5),
            "tag_indices": [6],
            "checklist": [
                {"id": "1", "text": "Update work experience section", "completed": True},
                {"id": "2", "text": "Add recent project metrics", "completed": False},
                {"id": "3", "text": "Get peer review", "completed": False},
            ],
        },
        {
            "title": "Complete Advanced TypeScript course",
            "description": "Finish remaining modules on generics, conditional types, and mapped types.",
            "status": TaskStatus.in_progress,
            "priority": TaskPriority.medium,
            "deadline": now + timedelta(days=14),
            "tag_indices": [2],
            "checklist": [
                {"id": "1", "text": "Module 5: Advanced Generics", "completed": True},
                {"id": "2", "text": "Module 6: Conditional Types", "completed": True},
                {"id": "3", "text": "Module 7: Template Literals", "completed": False},
                {"id": "4", "text": "Final project", "completed": False},
            ],
        },
        {
            "title": "Fix authentication token refresh bug",
            "description": "Users are getting logged out randomly. Likely race condition in token refresh logic.",
            "status": TaskStatus.review,
            "priority": TaskPriority.urgent,
            "deadline": now + timedelta(days=1),
            "tag_indices": [0],
            "checklist": [],
        },
        {
            "title": "Grocery shopping for the week",
            "description": "Buy vegetables, fruits, chicken, rice, and snacks.",
            "status": TaskStatus.new,
            "priority": TaskPriority.low,
            "deadline": now + timedelta(days=2),
            "tag_indices": [1, 5],
            "checklist": [
                {"id": "1", "text": "Vegetables and fruits", "completed": False},
                {"id": "2", "text": "Chicken and fish", "completed": False},
                {"id": "3", "text": "Rice and pasta", "completed": False},
            ],
        },
        {
            "title": "Schedule dentist appointment",
            "description": "Annual checkup overdue. Call Dr. Smith's office.",
            "status": TaskStatus.backlog,
            "priority": TaskPriority.medium,
            "deadline": None,
            "tag_indices": [3],
            "checklist": [],
        },
        {
            "title": "Research investment options for Q2",
            "description": "Compare index funds, bonds, and high-yield savings accounts.",
            "status": TaskStatus.backlog,
            "priority": TaskPriority.low,
            "deadline": None,
            "tag_indices": [4],
            "checklist": [],
        },
        {
            "title": "Build personal blog with Next.js",
            "description": "Create a markdown-powered blog with dark mode, RSS feed, and syntax highlighting.",
            "status": TaskStatus.in_progress,
            "priority": TaskPriority.medium,
            "deadline": now + timedelta(days=30),
            "tag_indices": [7, 2],
            "checklist": [
                {"id": "1", "text": "Set up Next.js project", "completed": True},
                {"id": "2", "text": "MDX integration", "completed": True},
                {"id": "3", "text": "Dark mode toggle", "completed": False},
                {"id": "4", "text": "Deploy to Vercel", "completed": False},
            ],
        },
        {
            "title": "Prepare for system design interview",
            "description": "Practice designing distributed systems: URL shortener, chat app, news feed.",
            "status": TaskStatus.new,
            "priority": TaskPriority.high,
            "deadline": now + timedelta(days=10),
            "tag_indices": [6, 2],
            "checklist": [
                {"id": "1", "text": "URL shortener design", "completed": False},
                {"id": "2", "text": "Chat application design", "completed": False},
                {"id": "3", "text": "News feed system", "completed": False},
            ],
        },
        {
            "title": "Organize home office setup",
            "description": "Cable management, new monitor arm, better lighting for video calls.",
            "status": TaskStatus.done,
            "priority": TaskPriority.low,
            "deadline": now - timedelta(days=7),
            "tag_indices": [5, 1],
            "checklist": [
                {"id": "1", "text": "Order monitor arm", "completed": True},
                {"id": "2", "text": "Cable management", "completed": True},
                {"id": "3", "text": "Desk lamp", "completed": True},
            ],
        },
        {
            "title": "Write blog post about FastAPI testing patterns",
            "description": "Share learnings from building test suites for async FastAPI apps.",
            "status": TaskStatus.new,
            "priority": TaskPriority.medium,
            "deadline": now + timedelta(days=21),
            "tag_indices": [7, 2],
            "checklist": [],
        },
        {
            "title": "Annual gym membership renewal",
            "description": "Current membership expires in 2 weeks. Check if corporate discount applies.",
            "status": TaskStatus.cancelled,
            "priority": TaskPriority.low,
            "deadline": now - timedelta(days=1),
            "tag_indices": [3, 4],
            "checklist": [],
        },
    ]

    for td in tasks_data:
        task = Task(
            user_id=user_id,
            created_by_id=user_id,
            assignee_id=user_id,
            title=td["title"],
            description=td["description"],
            status=td["status"],
            priority=td["priority"],
            deadline=td["deadline"],
            checklist=td["checklist"],
            source=TaskSource.web,
            visibility=Visibility.private,
            completed_at=(now - timedelta(days=2)) if td["status"] == TaskStatus.done else None,
        )
        session.add(task)
        await session.flush()

        # Link tags
        for idx in td["tag_indices"]:
            session.add(TaskTag(task_id=task.id, tag_id=tags[idx].id))

    print(f"  Created {len(tasks_data)} tasks with tags")


async def create_jobs(session, user_id: int) -> list[Job]:
    """Create 8 jobs across various statuses with history."""
    now = datetime.now(timezone.utc)
    jobs_data = [
        {
            "title": "Senior Backend Engineer",
            "company": "Stripe",
            "location": "San Francisco, CA (Remote)",
            "url": "https://stripe.com/jobs/example",
            "source": "linkedin",
            "description": "Build and scale payment processing systems. Python, Go, distributed systems.",
            "salary_min": 180000, "salary_max": 250000,
            "status": ApplicationStatus.technical_interview,
            "applied_date": date.today() - timedelta(days=14),
            "recruiter_name": "Sarah Chen",
            "next_action": "Prepare system design presentation",
            "next_action_date": date.today() + timedelta(days=3),
        },
        {
            "title": "Staff Software Engineer",
            "company": "Datadog",
            "location": "New York, NY (Hybrid)",
            "url": "https://datadog.com/careers/example",
            "source": "adzuna",
            "description": "Lead observability platform development. Experience with time-series databases required.",
            "salary_min": 200000, "salary_max": 280000,
            "status": ApplicationStatus.applied,
            "applied_date": date.today() - timedelta(days=7),
            "next_action": "Follow up on application status",
            "next_action_date": date.today() + timedelta(days=7),
        },
        {
            "title": "Full Stack Developer",
            "company": "Vercel",
            "location": "Remote",
            "url": "https://vercel.com/careers/example",
            "source": "manual",
            "description": "Work on Next.js cloud platform. TypeScript, React, Node.js.",
            "salary_min": 150000, "salary_max": 200000,
            "status": ApplicationStatus.screening,
            "applied_date": date.today() - timedelta(days=10),
            "recruiter_name": "Mike Johnson",
            "recruiter_contact": "mike@vercel.com",
        },
        {
            "title": "Platform Engineer",
            "company": "Cloudflare",
            "location": "Austin, TX (Remote)",
            "url": "https://cloudflare.com/careers/example",
            "source": "serpapi",
            "description": "Build and maintain edge computing infrastructure. Go, Rust, Kubernetes.",
            "salary_min": 170000, "salary_max": 230000,
            "status": ApplicationStatus.saved,
        },
        {
            "title": "Senior Python Developer",
            "company": "Notion",
            "location": "San Francisco, CA",
            "url": "https://notion.so/careers/example",
            "source": "linkedin",
            "description": "Backend services for the collaboration platform. Python, PostgreSQL, Redis.",
            "salary_min": 160000, "salary_max": 220000,
            "status": ApplicationStatus.rejected,
            "applied_date": date.today() - timedelta(days=30),
            "rejection_reason": "Looking for more distributed systems experience",
        },
        {
            "title": "Engineering Manager",
            "company": "Linear",
            "location": "Remote (US)",
            "url": "https://linear.app/careers/example",
            "source": "manual",
            "description": "Lead a team of 6-8 engineers building project management tools.",
            "salary_min": 190000, "salary_max": 260000,
            "status": ApplicationStatus.found,
        },
        {
            "title": "Backend Engineer — AI Platform",
            "company": "Anthropic",
            "location": "San Francisco, CA",
            "url": "https://anthropic.com/careers/example",
            "source": "jsearch",
            "description": "Build infrastructure for large language model serving. Python, distributed systems.",
            "salary_min": 200000, "salary_max": 300000,
            "status": ApplicationStatus.offer,
            "applied_date": date.today() - timedelta(days=45),
            "recruiter_name": "Lisa Park",
            "next_action": "Negotiate compensation package",
            "next_action_date": date.today() + timedelta(days=5),
        },
        {
            "title": "DevOps Engineer",
            "company": "GitLab",
            "location": "Remote (Global)",
            "url": "https://gitlab.com/jobs/example",
            "source": "adzuna",
            "description": "Maintain CI/CD infrastructure at scale. Terraform, Kubernetes, AWS.",
            "salary_min": 140000, "salary_max": 190000,
            "status": ApplicationStatus.withdrawn,
            "applied_date": date.today() - timedelta(days=20),
        },
    ]

    jobs = []
    for jd in jobs_data:
        job = Job(
            user_id=user_id,
            title=jd["title"],
            company=jd["company"],
            location=jd.get("location"),
            url=jd.get("url"),
            source=jd.get("source", "manual"),
            description=jd.get("description"),
            salary_min=jd.get("salary_min"),
            salary_max=jd.get("salary_max"),
            salary_currency="USD",
            status=jd.get("status"),
            applied_date=jd.get("applied_date"),
            recruiter_name=jd.get("recruiter_name"),
            recruiter_contact=jd.get("recruiter_contact"),
            next_action=jd.get("next_action"),
            next_action_date=jd.get("next_action_date"),
            rejection_reason=jd.get("rejection_reason"),
            found_at=now - timedelta(days=60),
        )
        session.add(job)
        await session.flush()

        # Create status history
        if jd.get("status"):
            history = StatusHistory(
                job_id=job.id,
                old_status=None,
                new_status=jd["status"].value,
                comment="Initial status from demo seed",
            )
            session.add(history)

        jobs.append(job)

    print(f"  Created {len(jobs)} jobs with status history")
    return jobs


async def create_events(session, user_id: int) -> None:
    """Create 6 calendar events."""
    now = datetime.now(timezone.utc)
    events_data = [
        {
            "title": "System Design Interview — Stripe",
            "description": "Round 2: Design a payment processing system. 60 min with senior staff engineer.",
            "start_time": now + timedelta(days=3, hours=2),
            "end_time": now + timedelta(days=3, hours=3),
            "location": "Zoom (link in email)",
        },
        {
            "title": "Weekly Team Standup",
            "description": "Status updates, blockers, sprint planning.",
            "start_time": now + timedelta(days=1, hours=1),
            "end_time": now + timedelta(days=1, hours=1, minutes=30),
            "location": "Google Meet",
        },
        {
            "title": "1:1 with Engineering Manager",
            "description": "Career growth discussion, Q2 goals review.",
            "start_time": now + timedelta(days=2, hours=3),
            "end_time": now + timedelta(days=2, hours=3, minutes=45),
        },
        {
            "title": "Python Meetup: FastAPI Best Practices",
            "description": "Local meetup featuring talks on async patterns and testing strategies.",
            "start_time": now + timedelta(days=7, hours=4),
            "end_time": now + timedelta(days=7, hours=6),
            "location": "TechHub Coworking Space",
        },
        {
            "title": "Dentist Appointment",
            "description": "Annual checkup at Dr. Smith's office.",
            "start_time": now - timedelta(days=5, hours=-3),
            "end_time": now - timedelta(days=5, hours=-4),
            "location": "123 Health St",
        },
        {
            "title": "Project Demo — Analytics Dashboard",
            "description": "Present Q1 analytics dashboard to stakeholders. Prepare slides and live demo.",
            "start_time": now + timedelta(days=5, hours=2),
            "end_time": now + timedelta(days=5, hours=3),
            "location": "Conference Room A / Zoom",
        },
    ]

    for ed in events_data:
        event = CalendarEvent(
            user_id=user_id,
            title=ed["title"],
            description=ed.get("description"),
            start_time=ed["start_time"],
            end_time=ed["end_time"],
            location=ed.get("location"),
            all_day=False,
            source="local",
            visibility=Visibility.private,
        )
        session.add(event)
        await session.flush()

        # Add a note to first 3 events
        if events_data.index(ed) < 3:
            note = EventNote(
                event_id=event.id,
                user_id=user_id,
                content=f"Preparation notes for: {ed['title']}",
            )
            session.add(note)

    print(f"  Created {len(events_data)} events with notes")


async def create_kb_docs(session, user_id: int) -> None:
    """Create 3 AI Knowledge Base documents."""
    kb_data = [
        {
            "slug": "elevator-pitch",
            "title": "Elevator Pitch",
            "content": "I'm a full-stack engineer with 5+ years building scalable backend systems and modern web applications. At TechFlow, I led the redesign of our analytics pipeline, reducing latency by 60% while handling 10M+ daily events. I'm passionate about developer experience and love building tools that make engineering teams more productive. I'm now looking for a senior or staff role where I can drive technical strategy and mentor the next generation of engineers.",
            "used_by": ["resume", "cover_letter"],
        },
        {
            "slug": "star-stories",
            "title": "STAR Interview Stories",
            "content": "## Performance Optimization\n**Situation:** Analytics pipeline was bottlenecked, 15-second query times.\n**Task:** Reduce query latency to under 2 seconds.\n**Action:** Redesigned data model, added materialized views, implemented query caching with Redis.\n**Result:** Achieved 200ms average query time — 75x improvement. Zero downtime migration.\n\n## Team Leadership\n**Situation:** Team of 3 juniors with no testing culture.\n**Task:** Establish testing practices and improve code quality.\n**Action:** Introduced TDD workshops, set up CI/CD with mandatory test coverage, paired programming sessions.\n**Result:** Test coverage went from 12% to 78%. Bug rate dropped 40% in 3 months.",
            "used_by": ["resume", "gap_analysis"],
        },
        {
            "slug": "target-companies",
            "title": "Target Companies & Preferences",
            "content": "## Priority Companies\n- Stripe (payments infra, strong eng culture)\n- Datadog (observability, distributed systems)\n- Vercel (Next.js ecosystem, developer tools)\n- Anthropic (AI/ML infrastructure)\n\n## Must-haves\n- Remote or hybrid flexibility\n- Strong engineering culture\n- IC track available (not forced into management)\n- Competitive comp ($180k+ base)\n\n## Nice-to-haves\n- Open source contributions encouraged\n- Conference/learning budget\n- Small-medium team size (< 50 eng)",
            "used_by": ["cover_letter"],
        },
    ]

    for kd in kb_data:
        kb = AiKnowledgeBase(
            user_id=user_id,
            slug=kd["slug"],
            title=kd["title"],
            content=kd["content"],
            is_default=True,
            used_by=kd["used_by"],
        )
        session.add(kb)

    print(f"  Created {len(kb_data)} KB documents")


async def create_notes(session, user_id: int) -> None:
    """Create 4 local notes (no Google Drive)."""
    notes_data = [
        {
            "title": "System Design Interview Prep",
            "content": "# System Design Interview Prep\n\n## Key Topics\n- Load balancing strategies\n- Database sharding vs replication\n- Message queues (Kafka, RabbitMQ)\n- Caching layers (Redis, CDN)\n\n## Common Questions\n1. Design a URL shortener\n2. Design a chat application\n3. Design a news feed\n4. Design a rate limiter\n\n## Resources\n- System Design Primer (GitHub)\n- Designing Data-Intensive Applications (book)\n- ByteByteGo YouTube channel",
            "folder_path": "Career",
        },
        {
            "title": "Weekly Reflection — Week 11",
            "content": "# Weekly Reflection — Week 11\n\n## Wins\n- Shipped the analytics pipeline optimization (75x speedup!)\n- Got positive feedback from the Stripe recruiter\n- Completed 3 modules of the TypeScript course\n\n## Challenges\n- Token refresh bug took longer than expected\n- Need to improve time management between job search and current work\n\n## Next Week Focus\n- Prepare for Stripe system design interview\n- Finish TypeScript course Module 7\n- Submit Datadog application follow-up",
            "folder_path": "Personal",
        },
        {
            "title": "FastAPI Testing Patterns",
            "content": "# FastAPI Testing Patterns\n\n## Setup\n```python\nimport pytest\nfrom httpx import AsyncClient, ASGITransport\nfrom app.main import app\n\n@pytest.fixture\nasync def client():\n    async with AsyncClient(\n        transport=ASGITransport(app=app),\n        base_url=\"http://test\"\n    ) as c:\n        yield c\n```\n\n## Patterns\n1. **Mock external services** — always mock AI/API calls\n2. **Use factories** — create test data with factory functions\n3. **Test error paths** — 400, 401, 403, 404\n4. **Async fixtures** — use `pytest-asyncio`\n\n## Common Pitfalls\n- Forgetting to await async operations in tests\n- Not cleaning up database state between tests\n- Mocking too much vs too little",
            "folder_path": "Learning",
        },
        {
            "title": "Meeting Notes — Product Review",
            "content": "# Product Review — Q1 Analytics Dashboard\n\n**Date:** March 15, 2026\n**Attendees:** Alex, Sarah (PM), James (Design), Emily (Data)\n\n## Key Decisions\n- Dashboard will use real-time data (WebSocket updates)\n- Mobile view is P1 for Q2\n- Export to PDF feature moved to Q3\n\n## Action Items\n- [ ] Alex: Implement WebSocket data layer by March 22\n- [ ] James: Final mockups for mobile view by March 20\n- [ ] Emily: Data pipeline documentation by March 18\n\n## Open Questions\n- Should we use SSE or WebSocket?\n- Budget for external charting library?",
            "folder_path": "Work",
        },
    ]

    for nd in notes_data:
        note = Note(
            user_id=user_id,
            google_file_id=None,
            title=nd["title"],
            content=nd["content"],
            folder_path=nd.get("folder_path"),
            mime_type="text/markdown",
        )
        session.add(note)

    print(f"  Created {len(notes_data)} local notes")


async def create_pulse_data(session, user_id: int) -> None:
    """Create pulse sources, digests with items, and inbox items."""
    now = datetime.now(timezone.utc)

    # 3 pulse sources (simulated, no real Telegram IDs)
    sources_data = [
        {"telegram_id": 1001, "username": "python_news", "title": "Python News & Updates", "category": "learning", "subcategory": "python"},
        {"telegram_id": 1002, "username": "remote_jobs_tech", "title": "Remote Tech Jobs", "category": "jobs", "subcategory": "remote"},
        {"telegram_id": 1003, "username": "ai_research_daily", "title": "AI Research Daily", "category": "learning", "subcategory": "ai"},
    ]

    sources = []
    for sd in sources_data:
        source = PulseSource(
            user_id=user_id,
            telegram_id=sd["telegram_id"],
            username=sd.get("username"),
            title=sd["title"],
            category=sd["category"],
            subcategory=sd.get("subcategory"),
            is_active=True,
            poll_status="idle",
            last_polled_at=now - timedelta(hours=6),
            last_poll_message_count=15,
        )
        session.add(source)
        sources.append(source)
    await session.flush()

    # 3 digests with structured items
    digest_news = PulseDigest(
        user_id=user_id,
        category="news",
        content=None,
        digest_type="structured",
        message_count=32,
        items_count=4,
        generated_at=now - timedelta(hours=3),
        period_start=now - timedelta(days=1),
        period_end=now,
    )
    session.add(digest_news)
    await session.flush()

    digest_learning = PulseDigest(
        user_id=user_id,
        category="learning",
        content=None,
        digest_type="structured",
        message_count=24,
        items_count=5,
        generated_at=now - timedelta(hours=12),
        period_start=now - timedelta(days=1),
        period_end=now,
    )
    session.add(digest_learning)
    await session.flush()

    digest_jobs = PulseDigest(
        user_id=user_id,
        category="jobs",
        content=None,
        digest_type="structured",
        message_count=18,
        items_count=3,
        generated_at=now - timedelta(hours=6),
        period_start=now - timedelta(days=1),
        period_end=now,
    )
    session.add(digest_jobs)
    await session.flush()

    # Digest items for news digest
    news_items = [
        {
            "title": "EU AI Act Enforcement Begins — What It Means for Developers",
            "summary": "The European Union's AI Act enters active enforcement. High-risk AI systems now require conformity assessments, transparency disclosures, and human oversight documentation. Fines up to €35M or 7% of global revenue.",
            "classification": "regulation",
            "source_names": ["Tech Policy Watch"],
        },
        {
            "title": "OpenAI Launches GPT-5 with Native Tool Use",
            "summary": "GPT-5 features built-in code execution, web browsing, and file analysis without plugins. Context window expanded to 1M tokens. Available via API at $15/1M input tokens.",
            "classification": "ai_release",
            "source_names": ["AI Research Daily"],
        },
        {
            "title": "GitHub Copilot Workspace Goes GA",
            "summary": "GitHub Copilot Workspace is now generally available. Developers can describe tasks in natural language and get full implementation plans with code changes across multiple files.",
            "classification": "developer_tools",
            "source_names": ["Tech Policy Watch"],
        },
        {
            "title": "Rust Foundation Announces Rust 2027 Edition Roadmap",
            "summary": "Major changes planned: async traits stabilization, improved compile times via cranelift backend, and new borrow checker with polonius. Migration tools included.",
            "classification": "technology",
            "source_names": ["Python News & Updates"],
        },
    ]

    for i, item in enumerate(news_items):
        di = PulseDigestItem(
            digest_id=digest_news.id,
            user_id=user_id,
            title=item["title"],
            summary=item["summary"],
            classification=item["classification"],
            source_names=item["source_names"],
            status="new" if i >= 1 else "actioned",
            actioned_at=(now - timedelta(hours=1)) if i < 1 else None,
            action_type="skip" if i == 0 else None,
        )
        session.add(di)

    # Digest items for learning digest
    learning_items = [
        {
            "title": "Python 3.13 Performance Improvements",
            "summary": "CPython 3.13 introduces a new JIT compiler that improves performance by 15-30% for compute-heavy workloads. The free-threaded mode (no GIL) is now stable for production use.",
            "classification": "technology",
            "source_names": ["Python News & Updates"],
        },
        {
            "title": "FastAPI 0.115 Released with Dependency Overrides",
            "summary": "New version adds improved dependency override system, better WebSocket support, and automatic OpenAPI 3.1 schema validation.",
            "classification": "framework",
            "source_names": ["Python News & Updates"],
        },
        {
            "title": "Introduction to RAG with LangChain",
            "summary": "Tutorial on building Retrieval-Augmented Generation systems using LangChain and ChromaDB. Covers embedding strategies, chunking, and hybrid search.",
            "classification": "tutorial",
            "source_names": ["AI Research Daily"],
        },
        {
            "title": "PostgreSQL 17 Query Planner Enhancements",
            "summary": "Significant improvements to parallel query execution and partition pruning. Benchmarks show 2-5x speedup for analytical queries on partitioned tables.",
            "classification": "technology",
            "source_names": ["Python News & Updates"],
        },
        {
            "title": "Transformer Architecture Deep Dive",
            "summary": "Comprehensive guide to understanding attention mechanisms, positional encoding, and the evolution from vanilla transformers to modern architectures like Mamba.",
            "classification": "research",
            "source_names": ["AI Research Daily"],
        },
    ]

    for i, item in enumerate(learning_items):
        di = PulseDigestItem(
            digest_id=digest_learning.id,
            user_id=user_id,
            title=item["title"],
            summary=item["summary"],
            classification=item["classification"],
            source_names=item["source_names"],
            status="new" if i >= 2 else "actioned",
            actioned_at=(now - timedelta(hours=6)) if i < 2 else None,
            action_type="to_note" if i == 0 else ("skip" if i == 1 else None),
        )
        session.add(di)

    # Digest items for jobs digest
    jobs_items = [
        {
            "title": "Senior Python Engineer at Spotify (Remote EU/US)",
            "summary": "Spotify is hiring senior Python engineers for the recommendation team. Requires 5+ years Python, ML experience a plus. €90-130k for EU, $170-220k for US.",
            "classification": "job_listing",
            "source_names": ["Remote Tech Jobs"],
        },
        {
            "title": "Staff Engineer at Figma — Developer Platform",
            "summary": "Figma expanding developer platform team. TypeScript/Rust. Strong focus on API design and developer experience. $200-280k + equity.",
            "classification": "job_listing",
            "source_names": ["Remote Tech Jobs"],
        },
        {
            "title": "Backend Lead at Scale AI — Data Infrastructure",
            "summary": "Scale AI looking for a backend lead to build data labeling infrastructure. Python, Go, distributed systems. $190-260k.",
            "classification": "job_listing",
            "source_names": ["Remote Tech Jobs"],
        },
    ]

    for i, item in enumerate(jobs_items):
        di = PulseDigestItem(
            digest_id=digest_jobs.id,
            user_id=user_id,
            title=item["title"],
            summary=item["summary"],
            classification=item["classification"],
            source_names=item["source_names"],
            status="new",
        )
        session.add(di)

    print("  Created 3 pulse sources, 3 digests with 12 items")


async def create_vitals_data(session, user_id: int) -> None:
    """Create vitals data: Garmin connection, 30 days metrics/sleep, 15 activities, 1 briefing."""
    now = datetime.now(timezone.utc)
    today = date.today()
    random.seed(42)  # Deterministic seed for reproducible data

    # GarminConnection (simulated)
    conn = GarminConnection(
        user_id=user_id,
        email_encrypted="demo_encrypted",
        password_encrypted="demo_encrypted",
        garth_tokens_encrypted="demo_token",
        last_sync_at=now,
        sync_status="ok",
        sync_interval_minutes=240,
        connected_at=now - timedelta(days=30),
    )
    session.add(conn)

    # 30 days of VitalsDailyMetric
    for day_offset in range(30):
        d = today - timedelta(days=day_offset)
        steps = random.randint(6000, 12000)
        resting_hr = random.randint(58, 72)
        avg_hr = resting_hr + random.randint(5, 15)
        max_hr = avg_hr + random.randint(20, 60)
        avg_stress = random.randint(20, 45)
        max_stress = avg_stress + random.randint(15, 35)
        body_battery_high = random.randint(70, 95)
        body_battery_low = random.randint(15, 45)
        calories_active = random.randint(200, 600)
        calories_total = calories_active + random.randint(1400, 1800)
        distance_m = steps * random.uniform(0.7, 0.85)
        floors = random.randint(3, 20)
        intensity = random.randint(10, 45)
        vo2_max = round(random.uniform(42.0, 48.0), 1)

        metric = VitalsDailyMetric(
            user_id=user_id,
            date=d,
            steps=steps,
            distance_m=round(distance_m),
            calories_active=calories_active,
            calories_total=calories_total,
            floors_climbed=floors,
            intensity_minutes=intensity,
            resting_hr=resting_hr,
            avg_hr=avg_hr,
            max_hr=max_hr,
            min_hr=resting_hr - random.randint(2, 8),
            avg_stress=avg_stress,
            max_stress=max_stress,
            body_battery_high=body_battery_high,
            body_battery_low=body_battery_low,
            vo2_max=vo2_max,
        )
        session.add(metric)

    # 30 days of VitalsSleep
    for day_offset in range(30):
        d = today - timedelta(days=day_offset)
        total_hours = random.uniform(6.0, 8.5)
        total_seconds = int(total_hours * 3600)
        deep_pct = random.uniform(0.12, 0.22)
        rem_pct = random.uniform(0.18, 0.28)
        awake_pct = random.uniform(0.03, 0.08)
        light_pct = 1.0 - deep_pct - rem_pct - awake_pct

        sleep = VitalsSleep(
            user_id=user_id,
            date=d,
            duration_seconds=total_seconds,
            deep_seconds=int(total_seconds * deep_pct),
            light_seconds=int(total_seconds * light_pct),
            rem_seconds=int(total_seconds * rem_pct),
            awake_seconds=int(total_seconds * awake_pct),
            sleep_score=random.randint(60, 90),
            start_time=datetime(
                d.year, d.month, d.day,
                random.randint(22, 23), random.randint(0, 59),
                tzinfo=timezone.utc,
            ) - timedelta(days=1),
            end_time=datetime(
                d.year, d.month, d.day,
                random.randint(6, 8), random.randint(0, 59),
                tzinfo=timezone.utc,
            ),
        )
        session.add(sleep)

    # 15 VitalsActivity records spread over 30 days
    activity_templates = [
        {
            "type": "running", "name": "Morning Run",
            "distance_range": (3000, 10000), "duration_range": (1200, 3600),
            "hr_range": (140, 170),
        },
        {
            "type": "cycling", "name": "Evening Ride",
            "distance_range": (10000, 30000), "duration_range": (2400, 5400),
            "hr_range": (130, 160),
        },
        {
            "type": "walking", "name": "Lunch Walk",
            "distance_range": (2000, 5000), "duration_range": (1200, 2400),
            "hr_range": (90, 120),
        },
        {
            "type": "strength_training", "name": "Gym Session",
            "distance_range": (0, 0), "duration_range": (2400, 4200),
            "hr_range": (110, 145),
        },
    ]

    for i in range(15):
        template = activity_templates[i % len(activity_templates)]
        day_offset = i * 2  # Every 2 days
        d = today - timedelta(days=day_offset)

        activity = VitalsActivity(
            user_id=user_id,
            garmin_activity_id=100000 + i,
            activity_type=template["type"],
            name=template["name"],
            start_time=datetime(
                d.year, d.month, d.day,
                random.randint(7, 18), random.randint(0, 59),
                tzinfo=timezone.utc,
            ),
            duration_seconds=random.randint(*template["duration_range"]),
            distance_m=(
                random.randint(*template["distance_range"])
                if template["distance_range"][1] > 0
                else None
            ),
            avg_hr=random.randint(*template["hr_range"]),
            max_hr=random.randint(template["hr_range"][1], template["hr_range"][1] + 15),
            calories=random.randint(150, 600),
        )
        session.add(activity)

    # 1 VitalsBriefing for today
    briefing = VitalsBriefing(
        user_id=user_id,
        date=today,
        content=(
            "## Health Status\n"
            "Good overall condition. Sleep score of 78/100 with 7.2 hours of rest"
            " — solid recovery. Body Battery recharged to 82, indicating good"
            " energy reserves. Resting heart rate at 64 bpm is within your normal"
            " range. Stress levels moderate at 28 avg.\n\n"
            "## Day Forecast\n"
            "Moderate workload ahead: 3 active tasks due today, 1 team meeting"
            " at 2 PM. No interviews scheduled this week. Your energy levels"
            " support focused deep work in the morning.\n\n"
            "## Recommendations\n"
            "- **Best focus window: 9 AM – 12 PM** — Body Battery is highest,"
            " tackle your most demanding task first\n"
            "- Take a 15-min walk after lunch to manage afternoon stress\n"
            "- Light evening activity recommended — your 7-day activity trend"
            " is slightly below average\n\n"
            "## Notable Patterns\n"
            "- Sleep quality improved 12% this week compared to last week\n"
            "- Resting HR trending down (64 → 62 bpm over 14 days)"
            " — good fitness adaptation\n"
            "- Task completion rate correlates with sleep scores above 75"
        ),
        generated_at=now,
    )
    session.add(briefing)

    print(
        "  Created vitals data: 30 days metrics, 30 days sleep,"
        " 15 activities, 1 briefing"
    )


async def seed() -> None:
    """Main seed function — creates demo user and all associated data."""
    async with async_session_factory() as session:
        await cleanup_demo_user(session)

        user = await create_demo_user(session)
        await create_profile(session, user.id)
        tags = await create_tags(session, user.id)
        await create_tasks(session, user.id, tags)
        await create_jobs(session, user.id)
        await create_events(session, user.id)
        await create_kb_docs(session, user.id)
        await create_notes(session, user.id)
        await create_pulse_data(session, user.id)
        await create_vitals_data(session, user.id)

        await session.commit()
        print(f"\nDemo seed complete! User: {DEMO_EMAIL}")


if __name__ == "__main__":
    asyncio.run(seed())
