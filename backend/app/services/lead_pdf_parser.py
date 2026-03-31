"""
PDF → Lead extraction service.

Flow: PDF bytes → page images (PyMuPDF) → GPT-4o Vision → structured lead data.
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
from typing import Any

import fitz  # PyMuPDF
import openai

logger = logging.getLogger(__name__)

# High-res rendering: 200 DPI gives good OCR quality without huge file sizes
_DPI = 200
_ZOOM = _DPI / 72  # fitz default is 72 DPI

# Retry settings for transient API errors (rate limits, server errors)
_MAX_RETRIES = 3
_RETRY_BASE_DELAY = 2.0  # seconds; actual delay = base * 2^attempt

EXTRACTION_PROMPT = """\
You are an expert at extracting business contact information from Russian-language \
newspaper and magazine pages (directories, classified ads, display ads).

Analyze the image carefully and extract ALL business advertisements, contact blocks, \
and service listings you can find.

For each business, return a JSON object with these fields:
- business_name (string, required) — the company or business name
- contact_person (string | null) — owner or contact person name
- email (string | null)
- phone (string | null) — preserve original formatting
- website (string | null) — look for URLs in the ad text, even if not labeled \
(e.g. "www.example.com", "example.com"); domains often appear near phone numbers or emails
- service_description (string, required) — what the business does, offers, or sells. \
This is critically important. Extract the COMPLETE list of services, products, and \
specializations mentioned in the advertisement text, in Russian. Include ALL specific \
details: service types, sub-specializations, categories, areas of expertise. \
Do NOT summarize or shorten — preserve every detail from the ad. \
If the ad says "Юридические услуги. Иммиграция: визы H1B, L1, грин-карты. Разводы, \
custody. Банкротство Chapter 7 и 13." → write ALL of that. \
If it only lists a business name with a category (e.g. under a "Рестораны" heading) \
→ write the category as the description.
- industry_suggestion (string | null) — suggested industry category in English \
(e.g. "Legal Services", "Dental", "Real Estate", "Auto Repair", "Beauty Salon")

Quality rules:
- Extract EVERY business/advertisement on the page, even small ones.
- Phone numbers: keep the original format (e.g. "(718) 555-1234").
- business_name is required — skip entries where you cannot determine the business name.
- SKIP entries that have ONLY a person's name with no business name, no phone, no email, \
no website, and no description. A person's name alone is not a useful lead.
- SKIP table of contents pages, indices, and directory listings that only show business \
names with page numbers (e.g. "Laghman Express ...43"). These are navigation pages, \
not advertisements. Return [] for such pages.
- SKIP entries that have NO real contact information — at minimum one of phone, email, \
or website must be present. A business name with only a description is not actionable.
- service_description is extremely important for outreach context — it will be used to match \
businesses with specific pain points. Extract every detail you can find in the ad text. \
Only set to null if the ad truly contains nothing beyond the business name and contact info.
- If a field is not present, set it to null.
- Return valid JSON only — an array of objects. No markdown, no explanation.

Return format: [{"business_name": "...", ...}, ...]
If no businesses found on this page, return: []
"""


def pdf_to_images(pdf_bytes: bytes) -> list[bytes]:
    """Convert each PDF page to a PNG image (bytes)."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images: list[bytes] = []
    mat = fitz.Matrix(_ZOOM, _ZOOM)

    for page in doc:
        pix = page.get_pixmap(matrix=mat)
        images.append(pix.tobytes("png"))

    doc.close()
    return images


async def extract_leads_from_image(
    client: openai.AsyncOpenAI,
    image_png: bytes,
    model: str = "gpt-4o",
    existing_industries: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Send a single page image to GPT-4o Vision and parse extracted leads.

    Retries up to _MAX_RETRIES times with exponential backoff on transient
    errors (rate limits, server errors).
    """
    b64 = base64.b64encode(image_png).decode()

    prompt = EXTRACTION_PROMPT
    if existing_industries:
        industries_list = ", ".join(f'"{i}"' for i in existing_industries)
        prompt += f"\n\nIMPORTANT: When selecting an `industry_suggestion`, preferentially use one of these EXACT existing strings if it fits: [{industries_list}]. If none fit perfectly, you may suggest a new category."

    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES):
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{b64}",
                                    "detail": "high",
                                },
                            },
                        ],
                    }
                ],
                temperature=0.1,
                max_tokens=4096,
            )
            break  # success
        except (openai.RateLimitError, openai.APIStatusError) as e:
            last_exc = e
            if attempt < _MAX_RETRIES - 1:
                delay = _RETRY_BASE_DELAY * (2 ** attempt)
                logger.warning(
                    "Retryable error on attempt %d/%d: %s — waiting %.1fs",
                    attempt + 1, _MAX_RETRIES, e, delay,
                )
                await asyncio.sleep(delay)
            else:
                raise
    else:
        raise last_exc  # type: ignore[misc]

    raw = response.choices[0].message.content or "[]"

    # Strip markdown fences if the model wraps the JSON
    raw = raw.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1]  # drop first line
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Failed to parse Vision response as JSON: %s", raw[:200])
        return []

    if not isinstance(data, list):
        return []

    return [lead for lead in data if _has_contact_info(lead)]


def _has_contact_info(lead: dict[str, Any]) -> bool:
    """Return True if the lead has at least one real contact field."""
    has_phone = bool(lead.get("phone"))
    has_email = bool(lead.get("email"))
    has_website = bool(lead.get("website")) and lead["website"].strip().lower() not in (
        "example.com",
        "www.example.com",
        "http://example.com",
        "https://example.com",
    )
    return has_phone or has_email or has_website


_MAX_CONCURRENT_SMALL = 10  # PDFs under 40 pages
_MAX_CONCURRENT_LARGE = 5   # PDFs with 40+ pages (avoid rate limits)
_LARGE_PDF_THRESHOLD = 40


async def parse_pdf(
    pdf_bytes: bytes,
    openai_api_key: str,
    filename: str = "upload.pdf",
    existing_industries: list[str] | None = None,
) -> dict[str, Any]:
    """
    Full pipeline: PDF → images → Vision API → extracted leads.

    Pages are processed concurrently with adaptive concurrency:
    smaller PDFs use higher parallelism, large ones throttle to avoid
    OpenAI rate limits.

    Returns:
        {
            "total_pages": int,
            "leads": [{"business_name": ..., "page": int, ...}, ...],
            "errors": [{"page": int, "error": str}, ...],
        }
    """
    images = pdf_to_images(pdf_bytes)
    client = openai.AsyncOpenAI(api_key=openai_api_key)

    concurrency = (
        _MAX_CONCURRENT_LARGE if len(images) >= _LARGE_PDF_THRESHOLD
        else _MAX_CONCURRENT_SMALL
    )
    sem = asyncio.Semaphore(concurrency)

    async def _process_page(
        i: int, img: bytes
    ) -> tuple[int, list[dict[str, Any]], str | None]:
        page_num = i + 1
        async with sem:
            try:
                page_leads = await extract_leads_from_image(
                    client, img, existing_industries=existing_industries
                )
                for lead in page_leads:
                    lead["page"] = page_num
                    lead["source_detail"] = filename
                return page_num, page_leads, None
            except Exception as e:
                logger.error(
                    "Error processing page %d of %s: %s", page_num, filename, e
                )
                return page_num, [], str(e)

    results = await asyncio.gather(
        *(_process_page(i, img) for i, img in enumerate(images))
    )

    all_leads: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for _page_num, page_leads, error in results:
        all_leads.extend(page_leads)
        if error:
            errors.append({"page": _page_num, "error": error})

    return {
        "total_pages": len(images),
        "leads": all_leads,
        "errors": errors,
    }
