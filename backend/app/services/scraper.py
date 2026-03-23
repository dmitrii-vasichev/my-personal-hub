"""
Server-side URL fetcher for extracting job descriptions.
Includes SSRF protection to block requests to private/local IP ranges.
"""
import ipaddress
import socket
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

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


def _extract_text(html: str) -> str:
    """Extract readable text from HTML, stripping scripts, styles, and boilerplate."""
    soup = BeautifulSoup(html, "lxml")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "header", "footer", "aside", "iframe"]):
        tag.decompose()

    # Prefer known content containers
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
                return text

    # Fall back to full body text
    body = soup.find("body")
    if body:
        return body.get_text(separator="\n", strip=True)

    return soup.get_text(separator="\n", strip=True)


async def fetch_job_description(url: str) -> str:
    """
    Fetch a URL and extract the job description text.
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

    return _extract_text(response.text)
