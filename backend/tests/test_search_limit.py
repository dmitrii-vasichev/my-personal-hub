"""Tests for search limit parameter across schemas and providers."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.search import AutoSearchRequest, SearchRequest


class TestSearchRequestSchema:
    def test_default_limit(self):
        req = SearchRequest(query="python developer")
        assert req.limit == 10

    def test_custom_limit(self):
        req = SearchRequest(query="python developer", limit=25)
        assert req.limit == 25

    def test_limit_min_boundary(self):
        req = SearchRequest(query="python developer", limit=1)
        assert req.limit == 1

    def test_limit_max_boundary(self):
        req = SearchRequest(query="python developer", limit=100)
        assert req.limit == 100

    def test_limit_below_min_raises(self):
        with pytest.raises(ValidationError):
            SearchRequest(query="python developer", limit=0)

    def test_limit_above_max_raises(self):
        with pytest.raises(ValidationError):
            SearchRequest(query="python developer", limit=101)


class TestAutoSearchRequestSchema:
    def test_default_limit(self):
        req = AutoSearchRequest()
        assert req.limit == 30

    def test_custom_limit(self):
        req = AutoSearchRequest(limit=50)
        assert req.limit == 50

    def test_limit_below_min_raises(self):
        with pytest.raises(ValidationError):
            AutoSearchRequest(limit=0)

    def test_limit_above_max_raises(self):
        with pytest.raises(ValidationError):
            AutoSearchRequest(limit=101)
