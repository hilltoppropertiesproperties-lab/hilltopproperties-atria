# Hilltop listings redesign

Implemented in `C:/Users/Asus/Desktop/property replica`. The supplied `orca/workspaces/hilltop update/timingila` homepage was inspected as a read-only design reference. No files in that workspace were changed.

## Files
- `listings.html`: Hilltop branding/title, mobile filter actions below quick filters, shorter sort labels.
- `listings.css`: two-column catalogue, editorial cards, 4:3 images, homepage navy/army colours, matching verified label, restrained transaction badge, accessible carousel controls, responsive spacing.
- `listings-ui.js`: replaced collage/contact-row markup with image/title detail links, carousel controls, counters, and relevant positive facts. Added delegated carousel/touch events; existing sample filters, sorts, counts, and UI-only favourites remain.
- `tools/review-listings.py`: updated browser regression checks for the new cards and responsive layout.
- Generated QA files: `verification/listings-review.json`, `listings-desktop.png`, `listings-mobile.png`, `listings-mobile-filters.png`, `hilltop-listings-desktop.png`, `hilltop-listings-mobile.png`, and this report.

## Carousel and data
Image rows come from the existing `propertyPreviewData.images`, matched by `property_id`, cover-first then `display_order`, with blank URLs and exact duplicates excluded. This is the same row shape used by the separate Supabase loader. No image rows or property data were changed. The visible image alone has a `src`; other URLs stay in the gallery data attribute until selected. Later cards lazy-load their first image.

Each gallery owns its index and URL array. Previous/next wraps and changes only that gallery's image, alt text and counter. Event delegation is installed once on the persistent results grid, and new cards initialise at index zero after a rerender. Buttons are separate from links. Swipe requires 50px horizontal travel and a 1.5:1 horizontal/vertical ratio; passive touch listeners leave scrolling available and a short click suppression prevents swipe navigation.

## Responsive behaviour
Above 900px: sticky left sidebar with 18px top spacing and two cards per row. The existing header is in normal document flow, so it does not overlap sticky filters. At 900px and below: existing modal filtering, no sidebar. At 600px and below: one card per row and 44px carousel targets. Mobile page gutters are 16px.

## Verification and limits
Browser checks cover widths 1600, 1440, 1280, 1024, 900, 820, 768, 600, 430, 390 and 360; expected columns; no horizontal overflow; sticky filters; modal/Escape/focus; sorting; quick filters; type, price and sale/rent filtering; empty recovery; saved state; counter updates and wrap; Enter/Space; rerender safety; single-image control hiding; missing land facts; normal title detail navigation; and native touch swipe plus vertical scrolling. Screenshots were inspected. No JavaScript page errors were observed. See `listings-review.json` for run results.

The pre-existing listings page is explicitly a bundled-data preview and does not load `website.js`. There is no active Supabase, pagination, or URL/Back/Forward filter implementation on this page to verify or preserve. Those implementations in the separate public site scripts, all queries, authentication, homepage, and property-details implementation were left unchanged. Detail links use the existing `property-details.html?id=...` structure; live property resolution remains unverified. This is not a full production acceptance PASS.
