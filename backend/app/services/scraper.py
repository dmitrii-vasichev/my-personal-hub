"""
Server-side URL fetcher for extracting job metadata from postings.
Includes SSRF protection to block requests to private/local IP ranges.
"""
import ipaddress
import re
import socket
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup


@dataclass
class JobMetadata:
    """Structured metadata extracted from a job posting page."""
    title: str = ""
    company: str = ""
    location: str = ""
    description: str = ""
    salary_min: int | None = None
    salary_max: int | None = None
    salary_currency: str = "USD"
    salary_period: str = "yearly"

# Private/reserved IP ranges to block (SSRF protection)
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),  # link-local
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _validate_url(url: str) -> None:
    """Raise ValueError if the URL scheme or resolved IP is not allowed."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http and https URLs are allowed")
    if not parsed.hostname:
        raise ValueError("Invalid URL: missing hostname")

    # Resolve hostname to IP and check against blocked ranges
    try:
        ip_str = socket.gethostbyname(parsed.hostname)
    except socket.gaierror as exc:
        raise ValueError(f"Cannot resolve hostname: {parsed.hostname}") from exc

    ip = ipaddress.ip_address(ip_str)
    for network in _BLOCKED_NETWORKS:
        if ip in network:
            raise ValueError("Requests to private/local addresses are not allowed")


def _is_linkedin(url: str) -> bool:
    """Check if the URL belongs to LinkedIn."""
    hostname = urlparse(url).hostname or ""
    return hostname.endswith("linkedin.com")


def _first_text(soup: BeautifulSoup, selectors: list[str], min_len: int = 1) -> str:
    """Return text from the first matching selector that meets min length."""
    for selector in selectors:
        el = soup.select_one(selector)
        if el:
            text = el.get_text(separator="\n", strip=True)
            if len(text) >= min_len:
                return text
    return ""


_SALARY_RE = re.compile(
    r"\$\s*([\d,]+(?:\.\d+)?)\s*[Kk]?"
    r"(?:\s*[-–—/]\s*\$?\s*([\d,]+(?:\.\d+)?)\s*[Kk]?)?"
    r"(?:\s*/?\s*(hr|hour|yr|year|annually|monthly|mo|week|wk))?"
    , re.IGNORECASE,
)

_PERIOD_MAP = {
    "hr": "hourly", "hour": "hourly",
    "yr": "yearly", "year": "yearly", "annually": "yearly",
    "mo": "monthly", "monthly": "monthly",
    "week": "weekly", "wk": "weekly",
}


def _parse_salary_text(text: str, meta: JobMetadata) -> None:
    """Best-effort extraction of salary range from text."""
    m = _SALARY_RE.search(text)
    if not m:
        return

    def _to_int(s: str) -> int:
        s = s.replace(",", "")
        val = float(s)
        # Detect shorthand like "120K" — the K is captured by [Kk]? but
        # sits right after the number in the original text
        if val < 1000 and "k" in text[m.start():m.end()].lower():
            val *= 1000
        return int(val)

    try:
        meta.salary_min = _to_int(m.group(1))
        if m.group(2):
            meta.salary_max = _to_int(m.group(2))
        period_raw = (m.group(3) or "").lower()
        meta.salary_period = _PERIOD_MAP.get(period_raw, "yearly")
    except (ValueError, AttributeError):
        pass


def _extract_linkedin_metadata(soup: BeautifulSoup) -> JobMetadata:
    """Extract structured job metadata from LinkedIn HTML."""
    meta = JobMetadata()

    meta.title = _first_text(soup, [
        ".top-card-layout__title",
        ".topcard__title",
        "h1[class*='title']",
        "h1",
    ])

    meta.company = _first_text(soup, [
        ".topcard__org-name-link",
        ".top-card-layout__second-subline a[data-tracking-control-name*='company']",
        ".top-card-layout__card-btn-container a",
        "a[class*='company-name']",
        "[class*='topcard'] a[class*='org-name']",
    ])

    meta.location = _first_text(soup, [
        ".topcard__flavor--bullet",
        ".top-card-layout__bullet",
        "span[class*='location']",
    ])

    meta.description = _first_text(soup, [
        ".show-more-less-html__markup",
        ".description__text",
        "#job-details",
        "[class*='jobs-description-content']",
        "[class*='jobs-description']",
    ], min_len=50)

    # Salary (best-effort)
    salary_text = _first_text(soup, [
        ".salary-main-rail__current-range",
        ".compensation__salary",
        ".job-details-jobs-unified-top-card__job-insight--highlight span",
        ".topcard__flavor--salary",
        "[class*='salary']",
        "[class*='compensation']",
    ])
    if salary_text:
        _parse_salary_text(salary_text, meta)

    # If no salary from dedicated selectors, try description text
    if meta.salary_min is None and meta.description:
        _parse_salary_text(meta.description[:500], meta)

    # Fallback: try og:title which often has "Title at Company"
    if not meta.title or not meta.company:
        og = soup.find("meta", property="og:title")
        if og and og.get("content"):
            _parse_og_title(og["content"], meta)

    return meta


def _parse_og_title(og_title: str, meta: JobMetadata) -> None:
    """Parse 'Job Title at Company | LinkedIn' from og:title meta tag."""
    # Remove trailing " | LinkedIn" or similar
    cleaned = re.sub(r"\s*\|.*$", "", og_title).strip()
    # Split on " at " or " - " to get title and company
    for sep in [" at ", " — ", " - "]:
        if sep in cleaned:
            parts = cleaned.split(sep, 1)
            if not meta.title:
                meta.title = parts[0].strip()
            if not meta.company and len(parts) > 1:
                meta.company = parts[1].strip()
            return


def _clean_soup(soup: BeautifulSoup) -> None:
    """Remove noise elements from parsed HTML in place."""
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "iframe"]):
        tag.decompose()


def _extract_generic_metadata(soup: BeautifulSoup) -> JobMetadata:
    """Extract job metadata using generic heuristics and meta tags."""
    meta = JobMetadata()

    # Title: og:title or first h1
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        meta.title = og["content"].strip()
    if not meta.title:
        h1 = soup.find("h1")
        if h1:
            meta.title = h1.get_text(strip=True)

    # Description: known content containers
    for selector in [
        "article",
        "main",
        "[class*='job-description']",
        "[class*='description']",
        "[id*='description']",
        "[class*='content']",
    ]:
        element = soup.select_one(selector)
        if element:
            text = element.get_text(separator="\n", strip=True)
            if len(text) > 200:
                meta.description = text
                break

    # Fallback to body
    if not meta.description:
        body = soup.find("body")
        if body:
            meta.description = body.get_text(separator="\n", strip=True)
        else:
            meta.description = soup.get_text(separator="\n", strip=True)

    return meta


def _extract_metadata(html: str, url: str = "") -> JobMetadata:
    """Extract structured job metadata from HTML."""
    soup = BeautifulSoup(html, "lxml")
    _clean_soup(soup)

    if url and _is_linkedin(url):
        meta = _extract_linkedin_metadata(soup)
        # If LinkedIn-specific extraction got a description, return it
        if meta.description:
            return meta
        # Otherwise fill description from generic logic
        generic = _extract_generic_metadata(soup)
        meta.description = generic.description
        return meta

    return _extract_generic_metadata(soup)


async def fetch_job_metadata(url: str) -> JobMetadata:
    """
    Fetch a URL and extract structured job metadata.
    Raises ValueError for blocked/invalid URLs.
    Raises httpx.HTTPError for network/HTTP errors.
    """
    _validate_url(url)

    async with httpx.AsyncClient(
        timeout=10.0,
        follow_redirects=True,
        max_redirects=3,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (compatible; PersonalHub/1.0; +https://github.com)"
            )
        },
    ) as client:
        response = await client.get(url)
        response.raise_for_status()

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type and "text/plain" not in content_type:
        raise ValueError(f"Unsupported content type: {content_type}")

    return _extract_metadata(response.text, url=url)
