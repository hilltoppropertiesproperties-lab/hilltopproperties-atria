# Listings filter redesign

Only the listings filter presentation and its control adapters were changed.

## Files

- `listings.html`: heading, counts, segmented buttons, labels, homepage SVG icons, field wrappers, Search Properties action, and advanced-filter wrapper.
- `listings-filter.css` (new): extracted homepage component rules and sidebar/mobile adapters. `listings.css` is unchanged.
- `listings-ui.js`: segmented buttons use the original purpose select; selected prices and filtered counts are displayed; the same form moves into the existing mobile modal.
- `tools/review-sidebar.py` (new): browser regression checks.
- `verification/sidebar-review.json`, `sidebar-desktop.png`, `sidebar-mobile.png`: test output and visually inspected screenshots. `filter-before/` holds original listings files for scope comparison.

## Homepage reuse

Inspected `C:/Users/Asus/orca/workspaces/hilltop update/timingila/index.html` and `website.css`. Reused `discovery-header`, `discovery-badge`, `discovery-transactions`, `discovery-field-group`, `field-label`, `discovery-control`, `field-row`, `field-icon`, `field-chevron`, `search-btn`, and `discovery-status` markup/styles, including the exact SVG icons and chevron.

The reference is a separate workspace, so its component rules are included locally rather than loading its entire stylesheet or adding an external workspace dependency. No homepage files were edited. Reused Concise font, #d9dece field borders, 2px radii, 48px controls, #e6f3fb/#0b527f active/action colors, #bdddf1 button border, hover and focus treatments. New adapters provide a 20px sidebar heading, icon alignment, input/popup compatibility, and responsive form placement.

## Behavior

Sale/rent buttons write to `listingPurposeFilter` and dispatch its change event; Search still runs the existing filter predicate. Location datalist, type taxonomy, numeric minimum/maximum bounds, advanced fields, features, sorting and Quick Filters retain their existing logic. Field IDs and native values remain intact; moving the same form preserves selections across viewport changes. Minimum price remains available and appears in the price summary when set. Counts use the filtered array length passed to the existing result renderer, with singular/plural wording.

The existing 230–240px sidebar column was retained to preserve card widths. Desktop keeps sticky positioning with an 18px offset; the header is in normal flow. Sticky is disabled at viewport heights of 650px or less so the form stays reachable. At 900px width and below the entire form moves into the existing modal. More Filters expands the existing advanced fields within that form. One Search Properties action has the matching count directly underneath.

## Verification

`node --check listings-ui.js` succeeded. `python tools/review-sidebar.py` succeeded in Chrome at 1440, 1024, 901, 900, 768, 390 and 360px. Checked sale/rent, location, type, keyboard selection, both price bounds, advanced bedrooms/features, search, zero/singular/plural counts, reset, responsive selected values, mobile modal, sorting, Quick Filters and sticky behavior. Primary desktop field heights were 48px. No horizontal overflow or JavaScript runtime errors occurred. Desktop and mobile screenshots were visually reviewed. Results markup and original `listings.css` are identical to the pre-edit copies.

The existing page is a bundled-data preview. It has no URL filter serialization, Back/Forward/reload restoration, or active Supabase integration. No routing, queries or database code was changed; these absent production capabilities cannot be claimed as verified. This is not a full production acceptance PASS.
