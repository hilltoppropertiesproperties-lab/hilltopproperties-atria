import json
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5000"
OUT = Path(__file__).resolve().parent

PROVINCES = [
    {"id": "province-lusaka", "name": "Lusaka", "slug": "lusaka", "map_key": "lusaka", "sort_order": 1},
    {"id": "province-southern", "name": "Southern", "slug": "southern", "map_key": "southern", "sort_order": 2},
]
CITIES = [
    {"id": "city-lusaka", "province_id": "province-lusaka", "name": "Lusaka", "slug": "lusaka"},
    {"id": "city-livingstone", "province_id": "province-southern", "name": "Livingstone", "slug": "livingstone"},
]
PROPERTIES = [
    {"id": "10000000-0000-0000-0000-000000000001", "reference_number": "SALE-LSK-1", "title": "Kabulonga sale house", "description": "House with pool in Kabulonga", "price": 900000, "currency_code": "ZMW", "purpose": "For Sale", "property_type": "House", "area": "Kabulonga", "full_address": "Kabulonga, Lusaka", "province_id": "province-lusaka", "city_id": "city-lusaka", "area_slug": "kabulonga", "bedrooms": 4, "bathrooms": 3, "garages": 2, "square_metres": 280, "status": "Active", "featured": True, "branch_id": None, "created_at": "2026-09-14T00:00:00Z", "amenities": ["Pool", "Garden", "Parking"]},
    {"id": "10000000-0000-0000-0000-000000000002", "reference_number": "SALE-LVN-1", "title": "Livingstone sale house", "description": "House in Livingstone", "price": 1500000, "currency_code": "ZMW", "purpose": "For Sale", "property_type": "House", "area": "Livingstone", "full_address": "Livingstone, Southern", "province_id": "province-southern", "city_id": "city-livingstone", "area_slug": "livingstone", "bedrooms": 3, "bathrooms": 2, "garages": 1, "square_metres": 220, "status": "Active", "featured": False, "branch_id": None, "created_at": "2026-09-13T00:00:00Z", "amenities": ["Garden"]},
    {"id": "10000000-0000-0000-0000-000000000006", "reference_number": "SALE-LAND-1", "title": "Lusaka residential land", "description": "Land in Lusaka", "price": 450000, "currency_code": "ZMW", "purpose": "For Sale", "property_type": "Land", "area": "Lusaka", "full_address": "Lusaka", "province_id": "province-lusaka", "city_id": "city-lusaka", "area_slug": "lusaka", "bedrooms": 0, "bathrooms": 0, "garages": 0, "square_metres": 1200, "status": "Active", "featured": False, "branch_id": None, "created_at": "2026-09-12T12:00:00Z", "amenities": []},
    {"id": "10000000-0000-0000-0000-000000000003", "reference_number": "RENT-LSK-1", "title": "Lusaka rental apartment", "description": "Apartment in Lusaka", "price": 12000, "currency_code": "ZMW", "purpose": "For Rent", "property_type": "Apartment", "area": "Lusaka", "full_address": "Lusaka", "province_id": "province-lusaka", "city_id": "city-lusaka", "area_slug": "lusaka", "bedrooms": 2, "bathrooms": 1, "garages": 1, "square_metres": 90, "status": "Active", "featured": False, "branch_id": None, "created_at": "2026-09-12T00:00:00Z", "amenities": ["Parking"]},
    {"id": "10000000-0000-0000-0000-000000000004", "reference_number": "RENT-LSK-2", "title": "Lusaka rental house", "description": "House in Lusaka", "price": 25000, "currency_code": "ZMW", "purpose": "For Rent", "property_type": "House", "area": "Lusaka", "full_address": "Lusaka", "province_id": "province-lusaka", "city_id": "city-lusaka", "area_slug": "lusaka", "bedrooms": 3, "bathrooms": 2, "garages": 1, "square_metres": 180, "status": "Under Offer", "featured": False, "branch_id": None, "created_at": "2026-09-11T00:00:00Z", "amenities": ["Garden", "Parking"]},
    {"id": "10000000-0000-0000-0000-000000000005", "reference_number": "RENT-LVN-1", "title": "Livingstone rental apartment", "description": "Apartment in Livingstone", "price": 10000, "currency_code": "ZMW", "purpose": "For Rent", "property_type": "Apartment", "area": "Livingstone", "full_address": "Livingstone", "province_id": "province-southern", "city_id": "city-livingstone", "area_slug": "livingstone", "bedrooms": 3, "bathrooms": 2, "garages": 1, "square_metres": 100, "status": "Active", "featured": False, "branch_id": None, "created_at": "2026-09-10T00:00:00Z", "amenities": ["Borehole"]},
]
IMAGES = [
    {"property_id": PROPERTIES[0]["id"], "image_url": BASE + "/assets/images/hero-poster.png", "display_order": 0, "is_cover": True},
    {"property_id": PROPERTIES[0]["id"], "image_url": BASE + "/assets/images/partners/smart-fittings-designs-zm.jpg", "display_order": 1, "is_cover": False},
]

def fixture(route):
    parsed = urlparse(route.request.url)
    table = parsed.path.rstrip("/").split("/")[-1]
    query = parse_qs(parsed.query)
    if table == "properties":
        rows = PROPERTIES
        purpose = unquote(query.get("purpose", [""])[0])
        if purpose.startswith("eq."):
            rows = [row for row in rows if row["purpose"] == purpose[3:]]
    elif table == "property_images":
        rows = IMAGES
    elif table == "provinces":
        rows = PROVINCES
    elif table == "cities":
        rows = CITIES
    else:
        rows = []
    route.fulfill(status=200, content_type="application/json", body=json.dumps(rows), headers={"content-range": f"0-{max(0, len(rows)-1)}/{len(rows)}"})

def wait_listings(page):
    page.wait_for_function("""() => {
      const results = document.querySelector('.listing-results');
      const grid = document.querySelector('#listingsGrid');
      return results?.getAttribute('aria-busy') === 'false' || grid?.getAttribute('aria-busy') === 'false';
    }""", timeout=30000)

checks = []
def check(name, condition):
    assert condition, name
    checks.append(name)

with sync_playwright() as pw:
    browser = pw.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1100})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.route("**/rest/v1/**", fixture)

    response = page.goto(BASE + "/property%20replica/sales/listings.html", wait_until="domcontentloaded")
    wait_listings(page)
    check("reference page HTTP 200", response.status == 200)
    page.screenshot(path=str(OUT / "reference-sales-1440.png"), full_page=True)

    response = page.goto(BASE + "/property-for-sale", wait_until="domcontentloaded")
    wait_listings(page)
    check("Sale route HTTP 200", response.status == 200)
    check("Sale canonical URL retained", urlparse(page.url).path == "/property-for-sale")
    check("Sale heading", page.locator("#listingPageTitle").inner_text() == "Properties for Sale")
    check("Sale tab active", page.locator('.discovery-transactions [data-listing-purpose="For Sale"]').get_attribute("aria-pressed") == "true")
    check("Sale inventory only", set(page.locator("#listingsGrid .purpose-badge").all_text_contents()) == {"For Sale"})
    check("Sale result count", page.locator("#listingsGrid .property-card").count() == 3 and page.locator("#listingsCount").inner_text() == "1 - 3 of 3 properties")
    check("approved layout present", page.locator(".listings-sidebar").is_visible() and page.locator(".quick-filters").is_visible() and page.locator(".listings-lower-prices").is_visible())
    check("canonical detail URLs", page.locator('#listingsGrid a[href^="/property-details?id="]').count() >= 3)
    check("no replica links", page.locator('a[href*="property replica"],a[href*="property%20replica"]').count() == 0)
    page.screenshot(path=str(OUT / "canonical-sale-1440.png"), full_page=True)

    quick_house = page.locator('#listingQuickFilters [data-listing-type="House"]')
    quick_house.click()
    check("Quick Filters stay in Sale", urlparse(page.url).path == "/property-for-sale" and parse_qs(urlparse(page.url).query).get("type") == ["house"] and page.locator("#listingsGrid .property-card").count() == 2)
    page.go_back(); wait_listings(page)
    check("Back restores unfiltered Sale", page.locator("#listingsGrid .property-card").count() == 3)
    page.go_forward(); wait_listings(page)
    check("Forward restores Quick Filter", page.locator("#listingsGrid .property-card").count() == 2)
    page.goto(BASE + "/property-for-sale", wait_until="domcontentloaded"); wait_listings(page)

    page.locator("#listingTypeFilter").select_option("Land")
    page.locator(".search-button").click(); wait_listings(page)
    check("Property Type selector", page.locator("#listingsGrid .property-card").count() == 1 and parse_qs(urlparse(page.url).query).get("type") == ["land"])
    page.goto(BASE + "/property-for-sale", wait_until="domcontentloaded"); wait_listings(page)
    page.locator("#listingSortSelect").select_option("price-high"); wait_listings(page)
    check("Sort order", "1,500,000" in page.locator("#listingsGrid .property-price").first.inner_text() and parse_qs(urlparse(page.url).query).get("sort") == ["price-high"])
    page.goto(BASE + "/property-for-sale", wait_until="domcontentloaded"); wait_listings(page)

    page.locator("#listingLocationInput").fill("Kabulonga")
    page.locator(".search-button").click(); wait_listings(page)
    check("Location filter", page.locator("#listingsGrid .property-card").count() == 1 and parse_qs(urlparse(page.url).query).get("location") == ["Kabulonga"])
    page.goto(BASE + "/property-for-sale", wait_until="domcontentloaded"); wait_listings(page)
    page.locator("#priceSummary").click()
    page.locator("#listingCurrencyFilter").select_option("ZMW")
    page.locator("#listingMaxPriceFilter").fill("500000")
    page.locator("#priceDone").click()
    page.locator(".search-button").click(); wait_listings(page)
    check("Currency and maximum price", page.locator("#listingsGrid .property-card").count() == 1 and "450,000" in page.locator(".property-price").inner_text())

    page.goto(BASE + "/property-for-sale", wait_until="domcontentloaded"); wait_listings(page)
    page.locator("#moreFiltersButton").click()
    page.locator("#listingBedroomsFilter").select_option("4")
    page.locator('input[name="feature"][value="Pool"]').check()
    page.locator("#applyFilters").click(); wait_listings(page)
    check("More Filters", page.locator("#listingsGrid .property-card").count() == 1 and parse_qs(urlparse(page.url).query).get("feature") == ["Pool"])
    page.locator("#listingSortSelect").select_option("price-high"); wait_listings(page)
    check("Sort uses URL state", parse_qs(urlparse(page.url).query).get("sort") == ["price-high"])

    page.goto(BASE + "/property-for-sale?location=Lusaka&type=house", wait_until="domcontentloaded"); wait_listings(page)
    rent_switch = page.locator('.discovery-transactions [data-listing-purpose="For Rent"]')
    rent_switch.click(); page.wait_for_url("**/property-for-rent?**"); wait_listings(page)
    rent_query = parse_qs(urlparse(page.url).query)
    check("Sale to Rent canonical switch", urlparse(page.url).path == "/property-for-rent")
    check("switch preserves compatible filters", rent_query.get("location") == ["Lusaka"] and rent_query.get("type") == ["house"] and "purpose" not in rent_query)
    check("Rent heading and tab", page.locator("#listingPageTitle").inner_text() == "Properties for Rent" and page.locator('.discovery-transactions [data-listing-purpose="For Rent"]').get_attribute("aria-pressed") == "true")
    check("Rent inventory only", set(page.locator("#listingsGrid .purpose-badge").all_text_contents()) == {"For Rent"})

    page.goto(BASE + "/property-for-rent", wait_until="domcontentloaded"); wait_listings(page)
    check("Rent route HTTP/render", page.locator("#listingsGrid .property-card").count() == 3 and page.locator("#listingsCount").inner_text() == "1 - 3 of 3 properties")
    page.screenshot(path=str(OUT / "canonical-rent-1440.png"), full_page=True)
    sale_switch = page.locator('.discovery-transactions [data-listing-purpose="For Sale"]')
    sale_switch.click(); page.wait_for_url("**/property-for-sale"); wait_listings(page)
    check("Rent to Sale canonical switch", urlparse(page.url).path == "/property-for-sale" and "purpose" not in parse_qs(urlparse(page.url).query))

    legacy = []
    for path, expected in [("/listings", 6), ("/listings?purpose=sale", 3), ("/listings?purpose=rent", 3)]:
        response = page.goto(BASE + path, wait_until="domcontentloaded"); wait_listings(page)
        legacy.append(response.status == 200 and page.locator("#listingsGrid .property-card").count() == expected)
    check("legacy routes", all(legacy))

    responsive = []
    for width in [1440, 1024, 768, 430, 390]:
        page.set_viewport_size({"width": width, "height": 900})
        page.goto(BASE + "/property-for-sale", wait_until="domcontentloaded"); wait_listings(page)
        metrics = page.evaluate("""() => ({width: innerWidth, scrollWidth: document.documentElement.scrollWidth, cards: getComputedStyle(document.querySelector('.property-grid')).gridTemplateColumns, sortVisible: !!document.querySelector('#listingSortSelect')?.offsetParent, quickVisible: !!document.querySelector('.quick-filters')?.offsetParent})""")
        check(f"responsive {width} no overflow", metrics["width"] == metrics["scrollWidth"])
        check(f"responsive {width} controls", metrics["sortVisible"] and metrics["quickVisible"])
        button = page.locator("#mobileFiltersButton" if width <= 900 else "#moreFiltersButton")
        button.click()
        check(f"responsive {width} filters usable", page.locator("#listingFiltersDialog").is_visible())
        page.keyboard.press("Escape")
        responsive.append(metrics)
        if width in (768, 390):
            page.screenshot(path=str(OUT / f"canonical-sale-{width}.png"), full_page=True)

    page.set_viewport_size({"width": 1440, "height": 700})
    page.goto(BASE + "/property-for-sale", wait_until="domcontentloaded"); wait_listings(page)
    page.evaluate("window.scrollTo(0, 300)")
    sticky_y = page.locator(".filter-sidebar").bounding_box()["y"]
    check("desktop sidebar sticky", abs(sticky_y - 18) < 3)
    check("no JavaScript errors", not errors)

    report = {"checks_passed": len(checks), "checks": checks, "responsive": responsive, "page_errors": errors}
    (OUT / "test-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report))
    browser.close()
