import json
from pathlib import Path
from urllib.parse import parse_qs, urlparse

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
    {
        "id": "10000000-0000-0000-0000-000000000001", "reference_number": "SALE-LSK-1",
        "title": "Kabulonga sale house", "description": "House in Kabulonga", "price": 900000,
        "currency_code": "ZMW", "purpose": "For Sale", "property_type": "House", "area": "Kabulonga",
        "full_address": "Kabulonga, Lusaka", "province_id": "province-lusaka", "city_id": "city-lusaka",
        "area_slug": "kabulonga", "bedrooms": 4, "bathrooms": 3, "garages": 2, "square_metres": 280,
        "status": "Active", "featured": True, "branch_id": None, "created_at": "2026-09-14T00:00:00Z",
    },
    {
        "id": "10000000-0000-0000-0000-000000000002", "reference_number": "SALE-LVN-1",
        "title": "Livingstone sale house", "description": "House in Livingstone", "price": 1500000,
        "currency_code": "ZMW", "purpose": "For Sale", "property_type": "House", "area": "Livingstone",
        "full_address": "Livingstone, Southern", "province_id": "province-southern", "city_id": "city-livingstone",
        "area_slug": "livingstone", "bedrooms": 3, "bathrooms": 2, "garages": 1, "square_metres": 220,
        "status": "Active", "featured": False, "branch_id": None, "created_at": "2026-09-13T00:00:00Z",
    },
    {
        "id": "10000000-0000-0000-0000-000000000003", "reference_number": "RENT-LSK-1",
        "title": "Lusaka rental apartment", "description": "Apartment in Lusaka", "price": 12000,
        "currency_code": "ZMW", "purpose": "For Rent", "property_type": "Apartment", "area": "Lusaka",
        "full_address": "Lusaka", "province_id": "province-lusaka", "city_id": "city-lusaka",
        "area_slug": "lusaka", "bedrooms": 2, "bathrooms": 1, "garages": 1, "square_metres": 90,
        "status": "Active", "featured": False, "branch_id": None, "created_at": "2026-09-12T00:00:00Z",
    },
    {
        "id": "10000000-0000-0000-0000-000000000004", "reference_number": "RENT-LSK-2",
        "title": "Lusaka rental house", "description": "House in Lusaka", "price": 25000,
        "currency_code": "ZMW", "purpose": "For Rent", "property_type": "House", "area": "Lusaka",
        "full_address": "Lusaka", "province_id": "province-lusaka", "city_id": "city-lusaka",
        "area_slug": "lusaka", "bedrooms": 3, "bathrooms": 2, "garages": 1, "square_metres": 180,
        "status": "Under Offer", "featured": False, "branch_id": None, "created_at": "2026-09-11T00:00:00Z",
    },
    {
        "id": "10000000-0000-0000-0000-000000000005", "reference_number": "RENT-LVN-1",
        "title": "Livingstone rental apartment", "description": "Apartment in Livingstone", "price": 10000,
        "currency_code": "ZMW", "purpose": "For Rent", "property_type": "Apartment", "area": "Livingstone",
        "full_address": "Livingstone", "province_id": "province-southern", "city_id": "city-livingstone",
        "area_slug": "livingstone", "bedrooms": 3, "bathrooms": 2, "garages": 1, "square_metres": 100,
        "status": "Active", "featured": False, "branch_id": None, "created_at": "2026-09-10T00:00:00Z",
    },
]


def fixture(route):
    parsed = urlparse(route.request.url)
    table = parsed.path.rstrip("/").split("/")[-1]
    if table == "properties":
        rows = PROPERTIES
    elif table == "provinces":
        rows = PROVINCES
    elif table == "cities":
        rows = CITIES
    elif table == "cms_homepage_content":
        rows = [{
            "id": "homepage", "hero_title": "Find Verified Properties Across Zambia",
            "hero_subtitle": "Buy and rent with Hilltop", "hero_button_text": "Explore Rentals",
            "hero_button_link": "property replica/rent/listings.html?location=Lusaka",
            "about_title": "Trusted Property Guidance", "about_content": "Hilltop Properties Zambia",
            "contact_phone": "+260 979 972019", "contact_email": "test@example.com",
            "contact_address": "Lusaka", "updated_at": "2026-09-14T00:00:00Z",
        }]
    else:
        rows = []
    route.fulfill(
        status=200,
        content_type="application/json",
        body=json.dumps(rows),
        headers={"content-range": f"0-{max(0, len(rows) - 1)}/{len(rows)}"},
    )


def install_api(page):
    page.route("**/rest/v1/**", fixture)


def wait_home(page):
    page.wait_for_function(
        "document.querySelectorAll('#homePropertySections .property-card').length === 5 && "
        "document.querySelectorAll('#discoveryLocation option').length > 1",
        timeout=30000,
    )


def wait_listings(page):
    page.wait_for_function(
        "document.querySelector('.listing-results') && "
        "document.querySelector('.listing-results').getAttribute('aria-busy') === 'false'",
        timeout=30000,
    )


def url_state(page):
    parsed = urlparse(page.url)
    return parsed.path, parse_qs(parsed.query)


checks = []


def check(name, condition):
    assert condition, name
    checks.append(name)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome", headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    install_api(page)

    # Homepage links and draft-only behavior.
    page.goto(BASE + "/", wait_until="domcontentloaded")
    wait_home(page)
    check("homepage Sale section uses canonical URL", page.locator('a[href="/property-for-sale"]').count() >= 2)
    check("homepage Rent section uses canonical URL", page.locator('a[href="/property-for-rent"]').count() >= 2)
    check(
        "legacy CMS Rent link is canonicalized",
        page.evaluate("canonicalCollectionHref('property replica/rent/listings.html?location=Lusaka')")
        == "/property-for-rent?location=Lusaka",
    )
    check("no runtime homepage link enters a replica", page.locator('a[href*="property replica"],a[href*="property%20replica"]').count() == 0)

    sale_action = page.locator('section[aria-labelledby="property-section-sale-title"] .property-section__view-all')
    check("homepage Sale action is unique", sale_action.count() == 1)
    with page.expect_navigation(wait_until="domcontentloaded"):
        sale_action.click()
    wait_listings(page)
    check("homepage Sale action reaches canonical route", url_state(page)[0] == "/property-for-sale")
    page.go_back(wait_until="domcontentloaded")
    wait_home(page)

    rent_action = page.locator('section[aria-labelledby="property-section-rent-title"] .property-section__view-all')
    check("homepage Rent action is unique", rent_action.count() == 1)
    with page.expect_navigation(wait_until="domcontentloaded"):
        rent_action.click()
    wait_listings(page)
    check("homepage Rent action reaches canonical route", url_state(page)[0] == "/property-for-rent")
    page.go_back(wait_until="domcontentloaded")
    wait_home(page)

    home_url = page.url
    baseline_inventory = page.locator("#homePropertySections").inner_html()
    baseline_count = page.locator("#homePropertySections .property-card").count()
    page.locator('[data-discovery-purpose="For Rent"]').click()
    check("purpose is draft-only", page.url == home_url and page.locator("#homePropertySections").inner_html() == baseline_inventory)
    page.locator('[data-discovery-purpose="For Sale"]').click()
    page.locator("#discoveryLocation").select_option('["lusaka","lusaka","kabulonga",""]')
    check("location is draft-only", page.url == home_url and page.locator("#homePropertySections").inner_html() == baseline_inventory)
    page.locator("#discoveryType").select_option("House")
    check("property type is draft-only", page.url == home_url and page.locator("#homePropertySections").inner_html() == baseline_inventory)
    page.locator("#discoveryPrice").select_option("ZMW:900000")
    check("price and currency are draft-only", page.url == home_url and page.locator("#homePropertySections").inner_html() == baseline_inventory)
    check("homepage cards remain unchanged until Search", page.locator("#homePropertySections .property-card").count() == baseline_count)
    page.screenshot(path=str(OUT / "homepage-draft-search.png"), full_page=False)

    with page.expect_navigation(wait_until="domcontentloaded"):
        page.locator("#discoverySearchBtn").click()
    wait_listings(page)
    sale_path, sale_query = url_state(page)
    expected_sale_query = {
        "province": ["lusaka"], "city": ["lusaka"], "area": ["kabulonga"],
        "type": ["house"], "currency": ["ZMW"], "maxPrice": ["900000"],
    }
    check("Sale search opens canonical route", sale_path == "/property-for-sale")
    check("Sale search preserves canonical filters", sale_query == expected_sale_query)
    check("Sale search hydrates controls", page.locator("#listingProvinceFilter").input_value() == "lusaka" and page.locator("#listingTypeFilter").input_value() == "House" and page.locator("#listingCurrencyFilter").input_value() == "ZMW" and page.locator("#listingMaxPriceFilter").input_value() == "900000")
    check("Sale search applies only after navigation", page.locator("#listingsGrid .property-card").count() == 1 and "Kabulonga sale house" in page.locator("#listingsGrid").inner_text())
    check("Sale cards retain property-details URLs", page.locator('#listingsGrid .property-card[href^="property-details.html?id="]').count() == 1)
    page.screenshot(path=str(OUT / "sale-search-results.png"), full_page=False)

    # Purpose switch, compatible filters, and history.
    with page.expect_navigation(wait_until="domcontentloaded"):
        page.locator('[data-listing-purpose="For Rent"]').click()
    wait_listings(page)
    rent_switch_path, rent_switch_query = url_state(page)
    check("purpose switch opens canonical Rent", rent_switch_path == "/property-for-rent")
    check("purpose switch preserves compatible filters", rent_switch_query == expected_sale_query)
    check("switched Rent route applies fixed purpose", page.locator('[data-listing-purpose="For Rent"]').get_attribute("aria-pressed") == "true")
    page.screenshot(path=str(OUT / "rent-purpose-switch.png"), full_page=False)

    page.go_back(wait_until="domcontentloaded")
    wait_listings(page)
    check("Back restores canonical Sale state", url_state(page) == (sale_path, sale_query) and page.locator('[data-listing-purpose="For Sale"]').get_attribute("aria-pressed") == "true")
    page.go_forward(wait_until="domcontentloaded")
    wait_listings(page)
    check("Forward restores canonical Rent state", url_state(page) == (rent_switch_path, rent_switch_query) and page.locator('[data-listing-purpose="For Rent"]').get_attribute("aria-pressed") == "true")

    with page.expect_navigation(wait_until="domcontentloaded"):
        page.locator('[data-listing-purpose="all"]').click()
    wait_listings(page)
    generic_path, generic_query = url_state(page)
    check("All properties returns to generic listings", generic_path == "/listings" and generic_query == expected_sale_query)
    check("generic listings clears the fixed purpose", page.locator('[data-listing-purpose="all"]').get_attribute("aria-pressed") == "true")

    # Legacy generic query compatibility.
    page.goto(BASE + "/listings?purpose=rent&location=Lusaka&type=apartment&currency=ZMW&maxPrice=15000", wait_until="domcontentloaded")
    wait_listings(page)
    check("legacy listings query still works", url_state(page)[0] == "/listings" and page.locator("#listingsGrid .property-card").count() == 1 and "Lusaka rental apartment" in page.locator("#listingsGrid").inner_text())
    check("legacy purpose hydrates Rent", page.locator('[data-listing-purpose="For Rent"]').get_attribute("aria-pressed") == "true")

    # Dedicated Rent homepage search with price/currency preservation.
    page.goto(BASE + "/", wait_until="domcontentloaded")
    wait_home(page)
    page.locator('[data-discovery-purpose="For Rent"]').click()
    page.locator("#discoveryLocation").select_option('["lusaka","lusaka","lusaka",""]')
    page.locator("#discoveryType").select_option("Apartment")
    page.locator("#discoveryPrice").select_option("ZMW:12000")
    rent_home_inventory = page.locator("#homePropertySections").inner_html()
    check("Rent draft does not mutate homepage", page.locator("#homePropertySections .property-card").count() == 5 and rent_home_inventory)
    with page.expect_navigation(wait_until="domcontentloaded"):
        page.locator("#discoverySearchBtn").click()
    wait_listings(page)
    rent_path, rent_query = url_state(page)
    check("Rent search opens canonical route", rent_path == "/property-for-rent")
    check("Rent search preserves filters and price currency", rent_query == {
        "province": ["lusaka"], "city": ["lusaka"], "area": ["lusaka"],
        "type": ["apartment"], "currency": ["ZMW"], "maxPrice": ["12000"],
    })
    check("Rent search applies submitted filters", page.locator("#listingsGrid .property-card").count() == 1 and "Lusaka rental apartment" in page.locator("#listingsGrid").inner_text())

    # Unfiltered generic catalogue and unchanged detail destination behavior.
    page.goto(BASE + "/listings", wait_until="domcontentloaded")
    wait_listings(page)
    check("unfiltered generic listings shows Sale and Rent", set(page.locator("#listingsGrid .purpose-badge").all_text_contents()) == {"For Sale", "For Rent"})
    check("no runtime listings link enters a replica", page.locator('a[href*="property replica"],a[href*="property%20replica"]').count() == 0)
    card_count = page.locator("#listingsGrid .property-card").count()
    check("generic listings has property cards", card_count == 5)
    with page.expect_navigation(wait_until="domcontentloaded"):
        page.locator("#listingsGrid .property-card").first.click()
    details_path, details_query = url_state(page)
    check("property cards still open existing details route", details_path == "/property-details" and "id" in details_query)

    check("no JavaScript page errors", not errors)
    browser.close()

report = {"checks_passed": len(checks), "checks": checks, "page_errors": errors}
(OUT / "test-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(json.dumps(report, indent=2))
