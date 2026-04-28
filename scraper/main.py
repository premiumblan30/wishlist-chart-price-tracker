import os
import re
import requests
import json
from supabase import create_client, Client
from datetime import datetime
from bs4 import BeautifulSoup

# Initialize Supabase client
supabase_url = os.getenv('SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_KEY')
scraperapi_key = os.getenv('SCRAPERAPI_KEY')

if not supabase_url or not supabase_key:
    raise ValueError('SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables are required')

supabase: Client = create_client(supabase_url, supabase_key)


def scrape_tokopedia_with_variant(url: str, variant_key: str) -> float | None:
    """
    Uses ScraperAPI js_scenario to click variant buttons then extract price.
    """
    variants = [v.strip() for v in variant_key.split('|')]
    print(f'Target variant names: {variants}')
    
    # Build click instructions for each variant
    instructions = []
    for variant in variants:
        instructions.append({"wait_for_selector": f"button:has-text('{variant}')", "timeout": 8000})
        instructions.append({"click": f"button:has-text('{variant}')"})
        instructions.append({"wait": 2000})
    
    # Wait for price to update after clicking
    instructions.append({"wait_for_selector": "[data-testid='lblPDPDetailProductPrice']", "timeout": 8000})
    scenario = json.dumps({"instructions": instructions})
    
    try:
        api_url = "http://api.scraperapi.com/"
        params = {
            "api_key": scraperapi_key,
            "url": url,
            "render_js": "true",
            "js_scenario": scenario,
        }
        resp = requests.get(api_url, params=params, timeout=60)
        
        if resp.status_code != 200:
            print(f"ScraperAPI js_scenario failed: {resp.status_code}")
            return None
        
        html = resp.text
        
        # Extract price from rendered HTML
        # Try data-testid selector pattern in HTML
        price_match = re.search(
            r'lblPDPDetailProductPrice[^>]*>Rp\s*([\d.,]+)',
            html
        )
        if not price_match:
            # Fallback: find price in JSON-LD or meta
            price_match = re.search(r'"price"\s*:\s*"?([\d]+)"?', html)
        
        if price_match:
            price_str = price_match.group(1).replace('.', '').replace(',', '')
            price = float(price_str)
            print(f'Variant price via ScraperAPI js_scenario: Rp {price:,.0f}')
            return price
        
        print('Price element not found in rendered HTML')
        return None
    except Exception as e:
        print(f'ScraperAPI js_scenario error: {e}')
        return None


def parse_tokopedia(html: str) -> float | None:
    """Extract harga dari halaman Tokopedia"""
    soup = BeautifulSoup(html, "html.parser")

    # Coba harga diskon dulu, fallback ke harga normal
    selectors = [
        {"data-testid": "lblPDPDetailProductPrice"},   # harga diskon
        {"data-testid": "lblPDPDetailProductPriceOriginal"},  # harga normal
    ]

    for attrs in selectors:
        el = soup.find(attrs=attrs)
        if el:
            raw = re.sub(r"[^\d]", "", el.get_text())
            if raw:
                price = float(raw)
                if price > 0:
                    return price

    return None  # sold out atau struktur berubah


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


def parse_blibli(html: str) -> float | None:
    soup = BeautifulSoup(html, 'html.parser')
    # Debug: print all JSON-LD scripts
    for i, script in enumerate(soup.find_all('script', type='application/ld+json')):
        try:
            data = json.loads(script.string or '{}')
            print(f'JSON-LD [{i}]: type={data.get("@type")}, keys={list(data.keys())[:5]}')
            if data.get('@type') == 'Product':
                print(f'Product offers: {data.get("offers")}')
        except Exception as e:
            print(f'JSON-LD parse error: {e}')
    # Debug: print all Rp prices found on page
    all_prices = []
    for match in re.finditer(r'Rp\s*([\d.]+)', html):
        try:
            p = float(match.group(1).replace('.', ''))
            if 1_000_000 <= p <= 50_000_000:
                all_prices.append(p)
        except Exception:
            pass
    print(f'All prices found on Blibli page (1jt-50jt range): {sorted(set(all_prices))}')
    # Debug: check og meta tags
    for meta in soup.find_all('meta'):
        name = meta.get('property', '') or meta.get('name', '')
        if 'price' in name.lower():
            print(f'Meta price tag: {name} = {meta.get("content")}')
    return None  # Temporarily return None to just see debug output


def scrape_blibli_api(url: str) -> float | None:
    import re
    # Extract SKU from URL — pattern: /is--{SKU}
    match = re.search(r'/is--([A-Z0-9\-]+)', url)
    if not match:
        print(f'Could not extract Blibli SKU from URL: {url}')
        return None
    sku = match.group(1)
    api_url = f'https://www.blibli.com/backend/product-detail/products/{sku}/_summary'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.blibli.com/',
        'Origin': 'https://www.blibli.com',
    }
    try:
        resp = requests.get(api_url, headers=headers, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        # Navigate to price in response
        price = None
        # Try common paths in Blibli API response
        try:
            price = data['data']['defaultPrice']['offerPrice']
        except (KeyError, TypeError):
            pass
        if not price:
            try:
                price = data['data']['price']['offerPrice']
            except (KeyError, TypeError):
                pass
        if not price:
            try:
                price = data['data']['minPrice']
            except (KeyError, TypeError):
                pass
        if price:
            p = float(str(price).replace('.', '').replace(',', ''))
            if 100_000 <= p <= 999_000_000:
                print(f'Blibli API price found: Rp {p:,.0f}')
                return p
        # Debug: print keys if price not found
        print(f'Blibli API response keys: {list(data.get("data", {}).keys())[:10]}')
        return None
    except Exception as e:
        print(f'Blibli API error: {e}')
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


def send_email(to: str, subject: str, body: str):
    smtp_user = os.getenv('EMAIL_USER', '')
    smtp_pass = os.getenv('EMAIL_PASS', '')
    if not smtp_user or not smtp_pass:
        print('Email credentials not configured, skipping notification')
        return
    import smtplib
    from email.mime.text import MIMEText
    try:
        msg = MIMEText(body, 'plain', 'utf-8')
        msg['Subject'] = subject
        msg['From'] = f'Wishlist Chart <{smtp_user}>'
        msg['To'] = to
        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)
        print(f'Email sent to {to}: {subject}')
    except Exception as e:
        print(f'Failed to send email: {e}')


def check_and_notify(item: dict, new_price: float, previous_price: float | None):
    try:
        alert_resp = supabase.table('alert_settings')\
            .select('*')\
            .eq('user_id', item['user_id'])\
            .maybe_single()\
            .execute()
        # maybe_single returns None in .data when no row exists
        if not alert_resp or not alert_resp.data:
            return  # No alert settings configured yet
        settings = alert_resp.data
        if not settings.get('email_enabled', True):
            return
        # Get user email via admin API
        user_resp = supabase.auth.admin.get_user_by_id(item['user_id'])
        user_email = user_resp.user.email if user_resp.user else None
        if not user_email:
            return
        # Check: hit target price
        if settings.get('alert_on_target') and item.get('target_price'):
            if new_price <= float(item['target_price']):
                send_email(
                    user_email,
                    f"🎯 Target tercapai: {item['name']}",
                    f"{item['name']} sekarang Rp {new_price:,.0f} — sudah di bawah target Rp {item['target_price']:,.0f}!\n\nCek sekarang: {item['url']}"
                )
                return
        # Check: price drop threshold
        if settings.get('alert_on_drop') and previous_price and previous_price > 0:
            drop_pct = ((previous_price - new_price) / previous_price) * 100
            threshold = settings.get('drop_threshold', 5)
            if drop_pct >= threshold:
                send_email(
                    user_email,
                    f"📉 Harga turun {drop_pct:.1f}%: {item['name']}",
                    f"{item['name']} turun {drop_pct:.1f}%\nDari Rp {previous_price:,.0f} → Rp {new_price:,.0f}\n\nCek sekarang: {item['url']}"
                )
    except Exception as e:
        print(f'Notification check error: {e}')


def scrape_item(item_id: str, url: str, marketplace: str, variant_key: str | None = None) -> dict:
    """Scrape price for an item and update price history."""
    print(f'Scraping item {item_id} from {marketplace}: {url}')

    # Use variant scraping for Tokopedia if variant_key is provided
    if marketplace == 'tokopedia' and variant_key:
        print(f'Scraping variant: {variant_key} for {item_id}')
        price = scrape_tokopedia_with_variant(url, variant_key)
        if price:
            print(f'Variant price found: {price}')
        else:
            print(f'Variant scraping failed, falling back to HTML scraping')
            html = fetch_html(url)
            if html:
                price = extract_price_tokopedia(html)
            else:
                price = None
    elif marketplace == 'blibli':
        price = scrape_blibli_api(url)
        if price:
            # Insert to price_history
            supabase.table('price_history').insert({
                'item_id': item_id,
                'price': price,
                'source': 'cron',
                'status': 'success',
                'scraped_at': datetime.utcnow().isoformat()
            }).execute()
            return {'success': True, 'price': price}
        else:
            return {'success': False, 'error': 'Could not extract Blibli price via API'}
    else:
        html = fetch_html(url)
        if not html:
            print(f'Failed to fetch HTML for item {item_id}')
            return {'success': False, 'error': 'Failed to fetch HTML'}

        # Extract price based on marketplace
        if marketplace == 'tokopedia':
            price = extract_price_tokopedia(html)
        elif marketplace == 'blibli':
            price = parse_blibli(html)
        else:
            price = extract_price_generic(html)

    if price is None:
        return {
            'success': False,
            'error': 'Could not extract price',
        }

    # Validate price is positive
    if price is None or price <= 0:
        print(f'Invalid or null price for item {item_id}, skipping')
        return {'success': False, 'error': f'Invalid price: {price}'}

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
            # Get previous price
            prev_resp = supabase.table('price_history')\
                .select('price')\
                .eq('item_id', item['id'])\
                .eq('status', 'success')\
                .order('scraped_at', desc=True)\
                .limit(1)\
                .execute()
            previous_price = prev_resp.data[0]['price'] if prev_resp.data else None
            variant_key = item.get('variant_key')
            result = scrape_item(item['id'], item['url'], item['marketplace'], variant_key)
            if result['success']:
                print(f'✓ {item["name"]}: Rp {result["price"]:,.0f}')
                check_and_notify(item, result['price'], previous_price)
            else:
                print(f'✗ {item["name"]}: {result["error"]}')

        print('Scraping completed')

        # Process pending manual scrape jobs
        print('Checking for pending manual scrape jobs...')
        try:
            pending_resp = supabase.table('scrape_jobs')\
                .select('*, items(*)')\
                .eq('status', 'pending')\
                .execute()
            pending_jobs = pending_resp.data or []
            print(f'Found {len(pending_jobs)} pending jobs')
            for job in pending_jobs:
                item = job.get('items')
                if not item:
                    supabase.table('scrape_jobs').update({
                        'status': 'failed',
                        'error_message': 'Item not found',
                        'completed_at': datetime.utcnow().isoformat()
                    }).eq('id', job['id']).execute()
                    continue
                print(f'Processing job {job["id"]} for item: {item["name"]}')
                # Mark as running
                supabase.table('scrape_jobs').update({
                    'status': 'running'
                }).eq('id', job['id']).execute()
                variant_key = item.get('variant_key')
                result = scrape_item(item['id'], item['url'], item['marketplace'], variant_key)
                final_status = 'completed' if result['success'] else 'failed'
                supabase.table('scrape_jobs').update({
                    'status': final_status,
                    'completed_at': datetime.utcnow().isoformat(),
                    'error_message': result.get('error')
                }).eq('id', job['id']).execute()
                if result['success']:
                    print(f'Job {job["id"]} completed: Rp {result["price"]:,.0f}')
                else:
                    print(f'Job {job["id"]} failed: {result.get("error")}')
        except Exception as e:
            print(f'Error processing scrape jobs: {e}')

    except Exception as e:
        print(f'Error in main: {e}')


if __name__ == '__main__':
    main()
