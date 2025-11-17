"""
Debug script to save D&D Beyond character HTML for inspection
"""

import sys
import io
import asyncio
import os

# Fix Windows encoding issues
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Suppress rich console output from crawl4ai
os.environ['CRAWL4AI_SILENT'] = '1'
os.environ['TERM'] = 'dumb'

from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

async def save_html(url: str, output_file: str):
    """Fetch and save HTML from D&D Beyond character page"""

    # Suppress Crawl4AI logging
    import logging
    logging.getLogger('crawl4ai').setLevel(logging.ERROR)

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

    # Temporarily redirect stdout to suppress progress output
    original_stdout = sys.stdout
    sys.stdout = sys.stderr

    try:
        async with AsyncWebCrawler(config=browser_config) as crawler:
            result = await crawler.arun(url=url, config=crawl_config)
    finally:
        sys.stdout = original_stdout

        if not result.success:
            print(f"Failed to crawl: {result.error_message}")
            sys.exit(1)

        # Save HTML to file
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(result.html)

        print(f"✅ HTML saved to: {output_file}")
        print(f"📏 Size: {len(result.html)} characters")

        # Save some XPath inspection hints
        from lxml import html as lxml_html
        tree = lxml_html.fromstring(result.html)

        # List all elements with "spell" in class name
        print("\n🔍 Elements with 'spell' in class:")
        spell_elements = tree.xpath("//*[contains(@class, 'spell')]")
        for elem in spell_elements[:10]:  # First 10
            classes = elem.get('class', '')
            print(f"  - <{elem.tag}> class=\"{classes[:80]}...\"")

        print(f"\nTotal spell-related elements: {len(spell_elements)}")

        # List all elements with "feat" in class name
        print("\n🔍 Elements with 'feat' in class:")
        feat_elements = tree.xpath("//*[contains(@class, 'feat')]")
        for elem in feat_elements[:10]:  # First 10
            classes = elem.get('class', '')
            print(f"  - <{elem.tag}> class=\"{classes[:80]}...\"")

        print(f"\nTotal feat-related elements: {len(feat_elements)}")

        # List all elements with "feature" in class name
        print("\n🔍 Elements with 'feature' in class:")
        feature_elements = tree.xpath("//*[contains(@class, 'feature')]")
        for elem in feature_elements[:10]:  # First 10
            classes = elem.get('class', '')
            print(f"  - <{elem.tag}> class=\"{classes[:80]}...\"")

        print(f"\nTotal feature-related elements: {len(feature_elements)}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python debug-dndbeyond-html-full.py <url> [output_file]")
        sys.exit(1)

    url = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "dndbeyond-debug.html"

    asyncio.run(save_html(url, output_file))

if __name__ == "__main__":
    main()
