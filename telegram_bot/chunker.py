TG_LIMIT = 4000  # conservative under the 4096 hard limit


def chunk_reply(text: str, limit: int = TG_LIMIT) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    remaining = text
    in_fence = False
    while len(remaining) > limit:
        window = remaining[:limit]
        split_at = window.rfind("\n\n")
        if split_at < limit // 2:
            split_at = window.rfind("\n")
        if split_at < limit // 2:
            split_at = limit
        chunk = remaining[:split_at]
        # preserve balanced code fences across chunk boundaries
        fences_in_chunk = chunk.count("```")
        if fences_in_chunk % 2 == 1:
            in_fence = not in_fence
            chunk = chunk + "\n```"
        if in_fence and not chunk.startswith("```"):
            chunk = "```\n" + chunk
        chunks.append(chunk)
        remaining = remaining[split_at:].lstrip("\n")
    if remaining:
        if in_fence:
            remaining = "```\n" + remaining
        chunks.append(remaining)
    return chunks
