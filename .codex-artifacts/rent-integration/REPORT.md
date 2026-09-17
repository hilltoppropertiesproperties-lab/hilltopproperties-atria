# Rent live integration

Changed application files: `property replica/rent/listings.html` and `property replica/rent/listings-ui.js`.
Added regression suite: `tools/test-rent-integration.py`. Evidence, baseline captures, screenshots, and reports are in `.codex-artifacts/rent-integration/`; the Sales regression report was refreshed in `.codex-artifacts/sales-integration/`.

`listings-data.js` is unchanged. Rent calls `HilltopListingsData.loadPublicListings('For Rent')`.

The shared loader executes:

```javascript
client.from('properties').select(fields)
  .eq('purpose', 'For Rent')
  .in('status', ['Active', 'Under Offer'])
  .order('created_at', {ascending: false})
  .order('id', {ascending: true})
  .range(offset, offset + 499)
  .abortSignal(signal);
```

`fields`: id, reference_number, title, description, price, currency_code, purpose, property_type, area, full_address, province_id, city_id, area_slug, bedrooms, bathrooms, garages, square_metres, status, featured, branch_id, created_at, amenities.

Live anonymous read: **5 rentals**, all **Active**, all **ZMW**. Types: **House, Apartment**. Locations (and live quick filters): **MACHA AVE, New Kasama, Kingsland City, LIVINGSTONE, Olympia**. All five amenities arrays are empty. Under Offer and exclusions are exercised with controlled responses because the live inventory has only Active rentals.

A read-only `select('*')` inspection of these public records found no billing/lease/rental period column. Local SQL definitions also yielded no confirmed period field. No field or database column was invented. The existing Rent currency formatter is retained: absent/unknown billing period displays `/ month`. This is a display fallback, not verified monthly billing. The averages note discloses that limitation. Exact returned field names are recorded in `live-data-summary.json`.

Images use the shared loader: query `property_images` for returned Rent IDs only, in batches of 100 IDs and pages of 500; select property_id, image_url, display_order, is_cover. Cover first, then display order, with deterministic property_id/image_url tie breakers. Invalid/unrelated image rows are excluded; duplicate URLs are removed by the gallery. Missing/broken images use the existing placeholder. Request failures show an error with retry and never sample inventory.

Location, type, price, bedrooms, bathrooms, minimum size, keywords, reference and amenity filters operate on real inventory. Reset, Clear Filters, transaction controls and URL/browser-state attempts retain Rent. The existing mobile Clear Filters placement is preserved. Quick-filter chips populate after the live load and refresh the existing carousel measurements. Counts use live inventory and matches.

The price popover reuses Sales' currency selector and validation, with existing field styles. Price limits require ZMW or USD; no cross-currency numerical comparison or FX conversion occurs. Price sorting groups currencies before sorting within each group. Averages exclude missing prices, separate currencies and remain based on the full Rent inventory. Current displayed averages: overall **ZMW K8,480 / month**, Houses **ZMW K4,850 / month**, Apartments **ZMW K23,000 / month**; Land and Commercial are unavailable. All monthly suffixes use the documented fallback.

Gallery and title links point to `/property-details?id=<real-id>`. Preview inventory is no longer loaded by Rent; historical preview files remain. Sale controls remain on Rent and explain that navigation is deferred. No final routes were introduced.

Both Rent stylesheets are unchanged. Before/after measurements compare header, marketplace, sidebar, results header, grid, cards and galleries at 1440px and 390px. Responsive checks also cover 1024, 900, 600 and 360px. Live desktop/mobile screenshots were visually reviewed.

Validation commands:

```text
python tools/test-rent-integration.py
python tools/test-sales-integration.py
```

See `test-report.json` for individual Rent checks and `../sales-integration/test-report.json` for Sales checks. Sales passed **104 checks** and returned **5 Sale properties**. Rent passed **111 checks**, including browser-state purpose isolation and unchanged stylesheets, and returned **5 Rent properties**.

Unresolved: billing period cannot be confirmed from current data; amenity filters have no live matches. Homepage, Admin, creation, database, RLS, migrations, property-details logic, Sales implementation and Firebase routing were not changed. Route creation and navigation wiring remain deferred for review.
