import os
import re
import requests
from supabase import create_client, Client
from datetime import datetime
import asyncio
from playwright.async_api import async_playwright

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
scraperapi_key = os.getenv('SCRAPERAPI_KEY')

if not supabase_url or not supabase_key:
    raise ValueError('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required')

supabase: Client = create_client(supabase_url, supabase_key)


async def scrape_tokopedia_with_variant(url: str, variant_key: str) -> float | None:
    """
    Fetches price for a specific variant combination using Playwright.
    variant_key format: "KING|630T Egyptian" (pipe-separated variant names)
    """
    variants = [v.strip() for v in variant_key.split('|')]
    print(f'Target variant names: {variants}')
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        
        try:
            await page.goto(url, wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(3000)

            # Click each variant button
            for variant_name in variants:
                try:
                    # Find button containing the variant name text
                    btn = page.get_by_role('button', name=variant_name, exact=True)
                    if await btn.count() == 0:
                        # Try partial match
                        btn = page.locator(f'button:has-text("{variant_name}")')
                    if await btn.count() > 0:
                        await btn.first.click()
                        await page.wait_for_timeout(1500)
                        print(f'Clicked variant: {variant_name}')
                    else:
                        print(f'Variant button not found: {variant_name}')
                except Exception as e:
                    print(f'Failed to click variant {variant_name}: {e}')

            # Extract price after variant selection
            try:
                # Tokopedia price selector
                price_el = await page.locator('[data-testid="lblPDPDetailProductPrice"]').first.inner_text()
                price = float(price_el.replace('Rp', '').replace('.', '').replace(',', '').strip())
                await browser.close()
                print(f'Variant price found: {price}')
                return price
            except Exception as e:
                print(f'Price extraction failed: {e}')
                await browser.close()
                return None
        except Exception as e:
            print(f'Playwright error: {e}')
            await browser.close()
            return None


def get_variant_price(url: str, variant_key: str) -> float | None:
    """Wrapper to run async Playwright function."""
    return asyncio.run(scrape_tokopedia_with_variant(url, variant_key))


def extract_price_tokopedia(html: str) -> float | None:
    """Extract price from Tokopedia HTML using multiple patterns."""
    patterns = [
        r'"price":\s*(\d+)',                          # JSON-LD
        r'data-price=["\'](\d+)["\']',                # data attribute
        r'class="[^"]*price[^"]*"[^>]*>Rp\s*([\d.]+)', # visible price
        r'"harga":\s*"?([\d.]+)"?',                   # API response
    ]
    for pattern in patterns:
        match = re.search(pattern, html)
        if match:
            price_str = match.group(1).replace('.', '').replace(',', '')
            try:
                price = float(price_str)
                if 1000 <= price <= 999_000_000:
                    return price
            except ValueError:
                continue
    return None


def extract_price_generic(html: str) -> float | None:
    """Generic price extraction for other marketplaces."""
    patterns = [
        r'Rp\s*([\d.,]+)',                           # Indonesian format
        r'price["\']?\s*[:=]\s*["\']?([\d.,]+)',   # generic price attribute
        r'class="[^"]*price[^"]*"[^>]*>([\d.,]+)',  # price in element
    ]
    for pattern in patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            price_str = match.group(1).replace('.', '').replace(',', '')
            try:
                price = float(price_str)
                if 1000 <= price <= 999_000_000:
                    return price
            except ValueError:
                continue
    return None


def fetch_html(url: str) -> str | None:
    """Fetch HTML using ScraperAPI to avoid bot detection."""
    if not scraperapi_key:
        # Fallback to direct requests if no API key
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f'Error fetching URL: {e}')
            return None

    # Use ScraperAPI
    payload = {
        'api_key': scraperapi_key,
        'url': url,
        'render_js': 'true',
    }

    try:
        response = requests.get('http://api.scraperapi.com', params=payload, timeout=30)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f'Error fetching via ScraperAPI: {e}')
        return None


def scrape_item(item_id: str, url: str, marketplace: str, variant_key: str | None = None) -> dict:
    """Scrape price for an item and update price history."""
    print(f'Scraping item {item_id} from {marketplace}: {url}')

    # Use variant scraping for Tokopedia if variant_key is provided
    if marketplace == 'tokopedia' and variant_key:
        print(f'Scraping variant: {variant_key} for {item_id}')
        price = get_variant_price(url, variant_key)
        if price:
            print(f'Variant price found: {price}')
        else:
            print(f'Variant scraping failed, falling back to HTML scraping')
            html = fetch_html(url)
            if html:
                price = extract_price_tokopedia(html)
            else:
                price = None
    else:
        html = fetch_html(url)
        if not html:
            return {
                'success': False,
                'error': 'Failed to fetch HTML',
            }

        # Extract price based on marketplace
        if marketplace == 'tokopedia':
            price = extract_price_tokopedia(html)
        else:
            price = extract_price_generic(html)

    if price is None:
        return {
            'success': False,
            'error': 'Could not extract price',
        }

    # Insert price history
    try:
        supabase.table('price_history').insert({
            'item_id': item_id,
            'price': price,
            'source': 'cron',
            'status': 'success',
            'source_url': url,
            'scraped_at': datetime.utcnow().isoformat()
        }).execute()

        return {
            'success': True,
            'price': price,
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
        }


def main():
    """Main function to scrape all active items."""
    try:
        # Fetch all active items
        response = supabase.table('items').select('*').eq('is_active', True).execute()
        items = response.data

        print(f'Found {len(items)} active items to scrape')

        for item in items:
            variant_key = item.get('variant_key')
            result = scrape_item(item['id'], item['url'], item['marketplace'], variant_key)
            if result['success']:
                print(f'✓ {item["name"]}: Rp {result["price"]:,.0f}')
            else:
                print(f'✗ {item["name"]}: {result["error"]}')

        print('Scraping completed')

    except Exception as e:
        print(f'Error in main: {e}')


if __name__ == '__main__':
    main()
