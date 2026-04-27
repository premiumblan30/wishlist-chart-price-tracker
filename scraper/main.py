import os
import re
import requests
from supabase import create_client, Client
from datetime import datetime

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
scraperapi_key = os.getenv('SCRAPERAPI_KEY')

if not supabase_url or not supabase_key:
    raise ValueError('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required')

supabase: Client = create_client(supabase_url, supabase_key)


def get_tokopedia_variant_price(url: str, variant_key: str) -> float | None:
    """
    Uses Tokopedia's pdp_get_product_info API to get variant prices.
    No browser needed — pure HTTP request.
    """
    try:
        # Extract product ID from URL (15-20 digit number in URL)
        match = re.search(r'-(\d{15,20})(?:\?|$)', url)
        if not match:
            print(f'Cannot extract product ID from URL: {url}')
            return None

        product_id = match.group(1)
        target_variants = [v.strip() for v in variant_key.split('|')]
        print(f'Target variant names: {target_variants}')

        headers = {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
            'Accept': 'application/json',
            'Referer': 'https://www.tokopedia.com/',
        }

        # Tokopedia public product info endpoint
        api_url = f'https://api.tokopedia.com/v2/product/{product_id}'
        resp = requests.get(api_url, headers=headers, timeout=15)

        if resp.status_code != 200:
            print(f'Tokopedia API returned status {resp.status_code}')
            # Try alternative: scrape price from mobile page
            mobile_url = url.replace('www.tokopedia.com', 'm.tokopedia.com')
            resp2 = requests.get(mobile_url, headers=headers, timeout=15)
            html = resp2.text

            # Find JSON data embedded in page
            json_match = re.search(r'"price_format":"Rp([\d.,]+)".*?"variant_name":"([^"]+)"', html)
            if json_match:
                price_str = json_match.group(1).replace('.', '').replace(',', '')
                print(f'Found variant price from mobile page: {price_str}')
                return float(price_str)
            return None

        data = resp.json()

        # Navigate variant data
        variants_data = data.get('data', {}).get('children', [])
        for child in variants_data:
            child_name = child.get('name', '')
            # Check if all target variants match this child
            if all(v.lower() in child_name.lower() for v in target_variants):
                price = child.get('price', {}).get('value', 0)
                if price:
                    print(f'Found variant match: {child_name} = Rp{price}')
                    return float(price)

        print(f'No matching variant found for: {target_variants}')
        return None

    except Exception as e:
        print(f'Tokopedia API error: {e}')
        return None


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

    # Use variant API for Tokopedia if variant_key is provided
    if marketplace == 'tokopedia' and variant_key:
        print(f'Scraping variant: {variant_key} for {item_id}')
        price = get_tokopedia_variant_price(url, variant_key)
        if price:
            print(f'Variant price found: {price}')
        else:
            print(f'Variant API failed, falling back to HTML scraping')
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
