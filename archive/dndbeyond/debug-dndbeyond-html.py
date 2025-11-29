"""
Debug script to fetch and save raw HTML from D&D Beyond character pages
"""

import sys
import asyncio
import os

# Suppress rich console output
os.environ['CRAWL4AI_SILENT'] = '1'
os.environ['TERM'] = 'dumb'

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

async def fetch_html(url: str, output_file: str):
    """Fetch HTML from D&D Beyond character page"""

    # Configure browser
    browser_config = BrowserConfig(
        headless=True,
        verbose=False,
        extra_args=["--disable-gpu", "--disable-dev-shm-usage", "--no-sandbox"],
    )

    # Configure crawler
    crawl_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        wait_for="body",
        js_code=[
            # Wait for character data to load
            "await new Promise(r => setTimeout(r, 5000));",
        ],
        wait_for_images=False,
        screenshot=False,
    )

    # Redirect stdout to suppress progress
    original_stdout = sys.stdout
    sys.stdout = sys.stderr

    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(url=url, config=crawl_config)
    finally:
        sys.stdout = original_stdout

    if not result.success:
        print(f"Failed to crawl: {result.error_message}", file=sys.stderr)
        return False

    # Save HTML to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(result.html)

    print(f"HTML saved to: {output_file}")
    print(f"HTML length: {len(result.html)} characters")

    # Print first 2000 characters as a preview
    print("\n=== HTML Preview (first 2000 chars) ===")
    print(result.html[:2000])

    return True

def main():
    if len(sys.argv) < 2:
        print("Usage: python debug-dndbeyond-html.py <url> [output_file]")
        sys.exit(1)

    url = sys.argv[1]
    character_id = url.split('/')[-1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else f"test-results/character-{character_id}.html"

    print(f"Fetching: {url}")
    print(f"Output: {output_file}\n")

    asyncio.run(fetch_html(url, output_file))

if __name__ == "__main__":
    main()
