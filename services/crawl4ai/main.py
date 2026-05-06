"""
DnD Beyond character extractor using crawl4ai + Playwright.

Problem: The DDB character-service API returns 403 for private characters
even when the requester is the campaign DM. But the website renders those
same characters fine for authenticated DMs. This service renders the page
as the DM (using their CobaltSession cookie) and intercepts the XHR that
the DDB SPA makes to character-service.dndbeyond.com — giving us clean JSON
without HTML parsing.

Usage:
  POST /character/extract
    { "character_id": "12345678", "cobalt_session": "<cookie value>" }

  GET /health
"""

import asyncio
import json
import re
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from playwright.async_api import async_playwright, Route, Request

app = FastAPI(title="DDB Character Extractor", version="1.0.0")


class ExtractRequest(BaseModel):
    character_id: str
    cobalt_session: str


class ExtractResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    message: Optional[str] = None


CHARACTER_URL = "https://www.dndbeyond.com/characters/{character_id}"
CAMPAIGN_URL = "https://www.dndbeyond.com/campaigns/{campaign_id}"
CHARACTER_API_RE = re.compile(
    r"https://character-service\.dndbeyond\.com/character/v\d+/character/\d+"
)
CAMPAIGN_CHARS_API_RE = re.compile(
    r"https://(?:www\.dndbeyond\.com|character-service\.dndbeyond\.com)/(?:api/)?(?:campaign|character)[^\s\"']*"
)
CHARACTER_ID_RE = re.compile(r"/characters/(\d+)")


async def extract_character(character_id: str, cobalt_session: str) -> dict:
    """
    Launch a headless Chromium browser with the DM's CobaltSession cookie,
    navigate to the DDB character page, and intercept the character-service
    XHR the page makes. Returns the raw character JSON.
    """
    intercepted: dict = {}

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
            ],
        )

        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            extra_http_headers={
                "Accept-Language": "en-US,en;q=0.9",
            },
        )

        # Inject the DM's session cookie
        await context.add_cookies(
            [
                {
                    "name": "CobaltSession",
                    "value": cobalt_session,
                    "domain": ".dndbeyond.com",
                    "path": "/",
                    "httpOnly": True,
                    "secure": True,
                    "sameSite": "None",
                }
            ]
        )

        page = await context.new_page()
        captured_event = asyncio.Event()

        async def handle_response(response):
            if CHARACTER_API_RE.match(response.url) and not intercepted:
                try:
                    body = await response.json()
                    intercepted.update(body)
                    captured_event.set()
                except Exception:
                    pass

        page.on("response", handle_response)

        url = CHARACTER_URL.format(character_id=character_id)
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)

        # Wait up to 15s for the character API response to be intercepted
        try:
            await asyncio.wait_for(captured_event.wait(), timeout=15.0)
        except asyncio.TimeoutError:
            pass

        await browser.close()

    if not intercepted:
        raise HTTPException(
            status_code=404,
            detail=(
                "Could not intercept character data. "
                "The character may be truly private (not in your campaign), "
                "or the CobaltSession may be expired."
            ),
        )

    return intercepted


class CampaignExtractRequest(BaseModel):
    campaign_id: str
    cobalt_session: str


class CampaignExtractResponse(BaseModel):
    success: bool
    character_ids: list[str] = []
    message: Optional[str] = None


async def extract_campaign_characters(campaign_id: str, cobalt_session: str) -> list[str]:
    """
    Navigate to the DDB campaign page as the DM and collect character IDs by:
    1. Intercepting character-service XHR responses
    2. Scraping /characters/{id} links from the rendered HTML
    """
    intercepted_ids: set[str] = set()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            extra_http_headers={"Accept-Language": "en-US,en;q=0.9"},
        )
        await context.add_cookies([{
            "name": "CobaltSession",
            "value": cobalt_session,
            "domain": ".dndbeyond.com",
            "path": "/",
            "httpOnly": True,
            "secure": True,
            "sameSite": "None",
        }])

        page = await context.new_page()

        async def handle_response(response):
            url = response.url
            if "character" in url and "dndbeyond.com" in url:
                try:
                    body = await response.text()
                    for m in CHARACTER_ID_RE.finditer(body):
                        intercepted_ids.add(m.group(1))
                    # Also check URL itself
                    for m in re.finditer(r"/character/v\d+/character/(\d+)", url):
                        intercepted_ids.add(m.group(1))
                except Exception:
                    pass

        page.on("response", handle_response)

        url = CAMPAIGN_URL.format(campaign_id=campaign_id)
        await page.goto(url, wait_until="networkidle", timeout=30000)

        # Also scrape rendered HTML for character links
        html = await page.content()
        for m in CHARACTER_ID_RE.finditer(html):
            intercepted_ids.add(m.group(1))

        await browser.close()

    return list(intercepted_ids)


@app.post("/campaign/extract", response_model=CampaignExtractResponse)
async def extract_campaign_endpoint(req: CampaignExtractRequest):
    try:
        ids = await extract_campaign_characters(req.campaign_id, req.cobalt_session)
        if not ids:
            return CampaignExtractResponse(
                success=False,
                message="No character IDs found. Session may be expired or campaign may be private.",
            )
        return CampaignExtractResponse(success=True, character_ids=ids)
    except Exception as e:
        return CampaignExtractResponse(success=False, message=str(e))


@app.post("/character/extract", response_model=ExtractResponse)
async def extract_character_endpoint(req: ExtractRequest):
    try:
        data = await extract_character(req.character_id, req.cobalt_session)
        return ExtractResponse(success=True, data=data)
    except HTTPException as e:
        return ExtractResponse(success=False, message=e.detail)
    except Exception as e:
        return ExtractResponse(success=False, message=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}
