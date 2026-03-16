"""Keyword-based message filter for Pulse sources."""


def keyword_filter(message_text: str | None, keywords: list[str] | None) -> bool:
    """Return True if message passes keyword filter.

    If no keywords are configured, all messages pass.
    Otherwise, at least one keyword must be found (case-insensitive).
    """
    if not keywords:
        return True
    if not message_text:
        return False
    text_lower = message_text.lower()
    return any(kw.lower() in text_lower for kw in keywords)
