# Quick filters results header

Application files changed: listings.html and listings.css. Verification added in tools/review-quick-filters.py and verification/quick-filters-*.

The existing title and result count now share a left-hand header group. The existing quick-filter navigation and sort select are in the right-hand tools group, with their original IDs and data-driven buttons. Removed the separate grid row and explicit row reservations. Desktop uses grid plus wrapping flex controls and a 20px gap above the cards. At 900px and below, sorting stays beside the title/count and quick filters occupy the following header row. At 600px and below, only the chip container scrolls horizontally.

Chrome verification passed at 1600, 1440, 1280, 1024, 768, 430 and 390px: no page overflow, overlapping chips, or off-screen sorting. All controls fit inline at 1440 and 1600px. At 1280px the sort wraps; at 1024px chips and sort share two lines. Cards moved upward by 76.5px at wide desktop, 61.3px at smaller desktop, 37.7px at tablet, and 44.2px at mobile. Screenshots reviewed at desktop, laptop and mobile. Filter selection/count and sorting exercised; the final mobile chip scrolls into view and filters successfully. No JavaScript runtime or console errors (the local server's missing favicon was stubbed for the verification run).

No JavaScript, sidebar, card markup/styles, grid columns, navigation, data or Supabase code changed. This standalone bundled preview has no URL/filter synchronization or reload restoration implementation; that pre-existing limitation is unchanged.
