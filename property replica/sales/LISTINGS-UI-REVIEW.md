# Property.co.zw listing/results page — UI preview

Open listings.html or http://127.0.0.1:8085/listings.html.

## Sidebar filter update

Desktop Sale/Rent, Type, Price and More filters now open in a shared area to the right of the sidebar, aligned with its top. The panels use the page's typography, blue selection states, light borders and subtle shadows. Only one panel opens at a time; outside clicks and Escape dismiss it. Sale/Rent and Type support arrow-key selection. Mobile retains the filter dialog and native selects, with values preserved across viewport changes.

Verification: `python tools/review-filter-flyouts.py` checks panel placement, selection, search, dismissal, keyboard controls and desktop/mobile transitions. Screenshots and results are in `verification/*-desktop.png`, `verification/filter-flyouts-mobile.png` and `verification/filter-flyouts-review.json`.

Only the requested listing/results page was built. Following the latest instructions, the visual reference and displayed branding are Property.co.zw. This is a standalone UI using approved bundled sample content, with no backend connection.

## Files changed

- listings.html: single-page structure, Property.co.zw-style header, search rail, context, toolbar, quick filters, sidebar and dialogs.
- listings.css: self-contained reference-based design using IBM Plex Sans, blue controls, a 1100px container, subtle borders, photo collages and responsive layouts. It does not load Hilltop CSS.
- listings-ui.js: sample card presentation and UI interactions, including dialogs, thumbnails, save-button state and mobile navigation.
- listings-preview-data.js: approved existing sample records, generated without contacting Supabase.
- listings-preview.html: redirects the earlier preview URL to the finished page.
- tools/build-listings-preview.cjs: regenerates sample content from the bundled source records.
- tools/review-listings.py: browser verification and screenshots.
- verification/listings-*: desktop/mobile screenshots, filter screenshot and verification results.

## Desktop and mobile

Desktop follows the reference's proportions: 75px header, compact horizontal search rail with a dominant location field, breadcrumb and modest heading, result count and sort, quick filters, and 788px/288px results/sidebar columns at full width. Sidebar actions start level with result controls. Cards use a large photo and three side thumbnails when available, then a blue price, title, location, property type and contact/specification row.

Mobile follows the reference's dedicated layout: compact logo/navigation header, Change filters / Requests bar, context, count/sort, horizontally scrolling quick filters, map action and full-width property cards. The same filter controls move into a mobile drawer.

## Preserved, replaced and omitted

The earlier Hilltop visual treatment was replaced on this page at the user's request. Other website pages, shared website JavaScript/CSS, Supabase configuration, database schema and backend routines are unchanged. The previous Hilltop page markup is retained in verification/hilltop-listings-before-reference.html.

No other pages, account system, real search engine, map service, agency advertising, newsletters or promotional banners were built. Header navigation and map controls demonstrate appearance and explain that they are not connected. Requests never send data. Saving a property changes its button's visual state only.

## Content, assumptions and existing issues

The user approved the project's bundled sample properties. The page shows three For Sale samples, and counts are derived from those samples. Its title is Properties for Sale rather than claiming these mixed sample records are residential land in Zimbabwe. Existing sample photographs and the bundled land image are illustrative; no property photographs or agency assets were copied from the reference.

The reference was inspected directly at desktop and mobile widths: https://www.property.co.zw/residential-land-stands-for-sale. Its body font was verified as IBM Plex Sans.

The original Supabase hostname failed to resolve, and the old loading screen prevented reviewing its UI. This preview is independent of that connection. No property-results map or pagination implementation was found in the original copy. Those remain observations for later integration.

## Verification

Chrome checks passed at 1440, 1280, 1024, 768, 430, 390 and 360px, with no horizontal page overflow or JavaScript runtime errors. Confirmed zero Supabase requests. Verified filter opening/closing, Escape and focus restoration, mobile navigation, request preview, desktop price popover, save-button state and photo thumbnails. Desktop/mobile screenshots were visually reviewed against the reference.

Latest results: verification/listings-review.json.

Run locally: python -m http.server 8085 --bind 127.0.0.1
Rebuild sample data: node tools/build-listings-preview.cjs
Run browser checks: python tools/review-listings.py (requires Python Playwright and Chrome).
