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


def get_tokopedia_variant_price(product_url: str, variant_key: str) -> float | None:
    """
    Fetches price for a specific variant combination using Tokopedia's
    internal pdpGetLayout GraphQL API.
    variant_key format: "KING|630T Egyptian" (pipe-separated variant names)
    """
    headers = {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json',
        'X-Source': 'tokopedia-lite',
    }
    # Extract shop domain and product slug from URL
    parts = product_url.rstrip('/').split('/')
    if len(parts) < 2:
        return None
    shop_domain = parts[-2]
    product_slug = parts[-1].split('?')[0]

    payload = {
        "operationName": "PDPGetLayout",
        "variables": {
            "shopDomain": shop_domain,
            "productKey": product_slug,
            "layoutID": "",
            "apiVersion": 1,
            "tokonow": {"shopID": "0", "whID": "0", "serviceType": ""}
        },
        "query": """
        query PDPGetLayout($shopDomain: String, $productKey: String) {
          pdpGetLayout(shopDomain: $shopDomain, productKey: $productKey) {
            basicInfo {
              id alias
            }
            data {
              ... on PDPDataProductVariant {
                errorCode
                products {
                  price { value }
                  isBuyable
                  combination
                  optionIds
                }
                variants {
                  identifier
                  option { id value }
                }
              }
            }
          }
        }
        """
    }

    try:
        resp = requests.post(
            'https://gql.tokopedia.com/',
            json=payload,
            headers=headers,
            timeout=15
        )
        data = resp.json()
        layout = data.get('data', {}).get('pdpGetLayout', {}).get('data', [])
        # Find variant section
        variant_data = next((d for d in layout if d.get('products')), None)
        if not variant_data:
            return None

        variants = variant_data.get('variants', [])
        target_names = [v.strip() for v in variant_key.split('|')]

        # Build option_id lookup: name -> id
        name_to_id = {}
        for variant in variants:
            for opt in variant.get('option', []):
                name_to_id[opt['value'].strip()] = str(opt['id'])

        target_ids = set(name_to_id.get(n) for n in target_names if name_to_id.get(n))

        # Find product where all target option IDs are in its combination
        for product in variant_data.get('products', []):
            combo = set(str(x) for x in product.get('optionIds', []))
            if target_ids and target_ids.issubset(combo) and product.get('isBuyable'):
                return float(product['price']['value'])
    except Exception as e:
        print(f'Variant API error: {e}')
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
        print(f'Using variant API for variant: {variant_key}')
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
