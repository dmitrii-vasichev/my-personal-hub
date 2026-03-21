"""
Tests for pulse digest preview extraction — _extract_preview_items.
"""
from app.services.dashboard import _extract_preview_items


class TestExtractPreviewItemsBoldTitles:
    """Extract titles from markdown bold patterns."""

    def test_standard_bold_pattern(self):
        content = (
            "# News Digest\n\n"
            "- **Apple M4 Launch**: Apple unveiled new chip\n"
            "- **EU AI Act**: Regulation goes into effect\n"
            "- **Python 3.13**: New release with improvements\n"
        )
        items = _extract_preview_items(content)
        assert len(items) == 3
        assert items[0] == {"title": "Apple M4 Launch", "classification": None}
        assert items[1] == {"title": "EU AI Act", "classification": None}
        assert items[2] == {"title": "Python 3.13", "classification": None}

    def test_max_five_items(self):
        lines = [f"- **Item {i}**: Description {i}" for i in range(10)]
        content = "\n".join(lines)
        items = _extract_preview_items(content)
        assert len(items) == 5
        assert items[4]["title"] == "Item 4"

    def test_asterisk_bullets(self):
        content = "* **Title One**: desc\n* **Title Two**: desc"
        items = _extract_preview_items(content)
        assert len(items) == 2
        assert items[0]["title"] == "Title One"


class TestExtractPreviewItemsFallback:
    """Fallback parsing when no bold patterns found."""

    def test_plain_lines(self):
        content = "# Heading\n\nFirst line of content.\nSecond line here.\nThird."
        items = _extract_preview_items(content)
        assert len(items) == 3
        assert items[0]["title"] == "First line of content"
        assert items[1]["title"] == "Second line here"
        assert items[2]["title"] == "Third"

    def test_takes_first_sentence(self):
        content = "Important news today. More details follow."
        items = _extract_preview_items(content)
        assert items[0]["title"] == "Important news today"

    def test_skips_headings_and_empty(self):
        content = "# Title\n\n## Subtitle\n\nActual content."
        items = _extract_preview_items(content)
        assert len(items) == 1
        assert items[0]["title"] == "Actual content"


class TestExtractPreviewItemsEdgeCases:
    """Edge cases: empty, None, whitespace."""

    def test_none_content(self):
        assert _extract_preview_items(None) == []

    def test_empty_string(self):
        assert _extract_preview_items("") == []

    def test_only_headings(self):
        assert _extract_preview_items("# H1\n## H2\n### H3") == []

    def test_whitespace_only(self):
        assert _extract_preview_items("   \n\n  \n") == []
