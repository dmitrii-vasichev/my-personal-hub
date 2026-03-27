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

EXTRACTION_PROMPT = """\
You are an expert at extracting business contact information from Russian-language \
newspaper and magazine pages.

Analyze the image and extract ALL business advertisements and contact blocks you can find.

For each business, return a JSON object with these fields:
- business_name (string, required) — the company or business name
- contact_person (string | null) — owner or contact person name
- email (string | null)
- phone (string | null) — preserve original formatting
- website (string | null)
- service_description (string | null) — brief description of what the business does/offers
- industry_suggestion (string | null) — suggested industry category in English \
(e.g. "Legal Services", "Dental", "Real Estate", "Auto Repair", "Beauty Salon")

Rules:
- Extract EVERY business/advertisement on the page, even small ones.
- If a field is not present, set it to null.
- Phone numbers: keep the original format (e.g. "(718) 555-1234").
- business_name is required — skip entries where you cannot determine the business name.
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
) -> list[dict[str, Any]]:
    """Send a single page image to GPT-4o Vision and parse extracted leads."""
    b64 = base64.b64encode(image_png).decode()

    response = await client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": EXTRACTION_PROMPT},
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

    return data


_MAX_CONCURRENT_PAGES = 10


async def parse_pdf(
    pdf_bytes: bytes,
    openai_api_key: str,
    filename: str = "upload.pdf",
) -> dict[str, Any]:
    """
    Full pipeline: PDF → images → Vision API → extracted leads.

    Pages are processed concurrently (up to _MAX_CONCURRENT_PAGES at a time)
    to keep total wall-clock time reasonable for large PDFs.

    Returns:
        {
            "total_pages": int,
            "leads": [{"business_name": ..., "page": int, ...}, ...],
            "errors": [{"page": int, "error": str}, ...],
        }
    """
    images = pdf_to_images(pdf_bytes)
    client = openai.AsyncOpenAI(api_key=openai_api_key)

    sem = asyncio.Semaphore(_MAX_CONCURRENT_PAGES)

    async def _process_page(
        i: int, img: bytes
    ) -> tuple[int, list[dict[str, Any]], str | None]:
        page_num = i + 1
        async with sem:
            try:
                page_leads = await extract_leads_from_image(client, img)
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
