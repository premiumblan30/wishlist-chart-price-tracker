# Scraper Setup Instructions

This scraper automatically fetches prices from marketplace URLs and updates the price history in your Supabase database.

## Prerequisites

- Python 3.8 or higher
- Supabase account
- ScraperAPI account (free tier available)
- GitHub account (for GitHub Actions)

## Setup

### 1. Install Python Dependencies

```bash
cd scraper
pip install requests supabase
```

### 2. Get ScraperAPI Free Key

1. Go to [scraperapi.com](https://www.scraperapi.com/)
2. Sign up for a free account
3. Get your API key from the dashboard
4. The free tier provides 1,000 requests per month

### 3. Add GitHub Secrets

Go to your GitHub repository settings → Secrets and variables → Actions → New repository secret

Add the following secrets:

- `SUPABASE_URL`: Your Supabase project URL (from Supabase dashboard → Settings → API)
- `SUPABASE_SERVICE_KEY`: Your Supabase service role key (from Supabase dashboard → Settings → API)
- `SCRAPERAPI_KEY`: Your ScraperAPI key

### 4. Deploy Edge Function (Optional)

The manual-scrape Edge Function allows triggering scrapes from the UI:

```bash
supabase functions deploy manual-scrape
```

This requires the Supabase CLI. Install it first:
```bash
npm install -g supabase
```

## Manual Testing

You can test the scraper locally by setting environment variables:

```bash
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_KEY="your-service-key"
export SCRAPERAPI_KEY="your-scraperapi-key"
python main.py
```

## Manual Trigger from UI

1. Navigate to an item detail page
2. Click the "Refresh Price" button (refresh icon)
3. The scraper will be triggered via the Edge Function
4. Wait for the polling to complete (up to 2 minutes)
5. The price history will automatically update when scraping is done

## Manual Price Input

If scraping fails or you want to add a price manually:

1. Navigate to an item detail page
2. Click "Add Price Manually"
3. Enter the price in IDR
4. Click "Add Price"
5. The price will be added to the price history with source: 'manual'

## How It Works

### Tokopedia Parser

The scraper uses multiple regex patterns to extract prices from Tokopedia:
- JSON-LD structured data
- data-price attributes
- Visible price elements
- API response data

### Generic Parser

For other marketplaces, it uses a generic price extraction:
- Indonesian currency format (Rp ...)
- Generic price attributes
- Price in HTML elements

### ScraperAPI Integration

ScraperAPI is used to avoid bot detection:
- Rotates proxies automatically
- Handles CAPTCHAs
- Renders JavaScript if needed
- Provides anti-bot protection

## GitHub Actions

The `.github/workflows/scrape.yml` file automatically runs the scraper on a schedule (default: every 6 hours).

To manually trigger the workflow:
1. Go to GitHub → Actions → scrape
2. Click "Run workflow"
3. Select branch and click "Run workflow"

## Troubleshooting

### Scraper Returns No Price

- Check if the URL is accessible
- Verify the marketplace is supported
- Try manual price input as a workaround

### ScraperAPI Quota Exceeded

- The free tier provides 1,000 requests/month
- Upgrade to a paid plan if needed
- Or reduce the scraping frequency in GitHub Actions

### Price Extraction Fails

- The website structure may have changed
- Check the browser console for the actual price element
- Update the regex patterns in `main.py`

## Database Schema

The scraper uses these tables:

- `items`: Stores item details (id, name, url, marketplace, target_price, etc.)
- `price_history`: Stores price records (id, item_id, price, scraped_at, source, status)
- `scrape_jobs`: Tracks scraping jobs (id, item_id, status, scheduled_at, error_msg)

## Security Notes

- Always use the service role key for the scraper (it has full database access)
- Never expose the service role key in client-side code
- The ScraperAPI key should be kept secret
- Use environment variables for all sensitive data
