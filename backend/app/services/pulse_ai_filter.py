"""AI-based relevance analysis for Pulse messages."""
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.ai import LLMAdapter

logger = logging.getLogger(__name__)

JOBS_SYSTEM_PROMPT = """You are a job relevance analyzer. Given a message from a Telegram channel and user criteria, rate the relevance of this job posting.

Return ONLY a JSON object: {"relevance": 0.0-1.0, "classification": null}
- 1.0 = perfect match to criteria
- 0.0 = completely irrelevant
Consider: job title, required stack/skills, grade level, salary range, location."""

LEARNING_SYSTEM_PROMPT = """You are a content classifier. Classify this Telegram message into one of these categories and rate its learning value.

Return ONLY a JSON object: {"relevance": 0.0-1.0, "classification": "article|lifehack|insight|tool|other"}
- article: long-form content, blog post, tutorial
- lifehack: practical tip, shortcut, productivity hack
- insight: industry observation, trend, opinion
- tool: software tool, library, framework recommendation
- other: doesn't fit above categories"""


async def analyze_relevance(
    message_text: str,
    source_category: str,
    criteria: dict | None,
    llm_client: "LLMAdapter",
) -> tuple[float, str | None]:
    """Analyze message relevance using AI.

    Returns (relevance_score, classification).
    - News: always (1.0, None)
    - Jobs: (0.0-1.0, None)
    - Learning: (0.0-1.0, classification_label)
    """
    if source_category == "news" or source_category not in ("jobs", "learning"):
        return 1.0, None

    try:
        if source_category == "jobs":
            system_prompt = JOBS_SYSTEM_PROMPT
            user_prompt = f"Message:\n{message_text[:2000]}\n\nCriteria:\n{json.dumps(criteria or {})}"
        else:  # learning
            system_prompt = LEARNING_SYSTEM_PROMPT
            user_prompt = f"Message:\n{message_text[:2000]}"

        response = await llm_client.generate(system_prompt, user_prompt)

        # Parse JSON from response
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        data = json.loads(clean)
        relevance = max(0.0, min(1.0, float(data.get("relevance", 0.5))))
        classification = data.get("classification")

        return relevance, classification

    except Exception as e:
        logger.warning("AI relevance analysis failed: %s", e)
        return 0.5, None
