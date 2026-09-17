# Compact Quick Filters carousel

Application files changed: listings.html, listings.css, listings-ui.js. Verification: tools/review-quick-carousel.py, verification/quick-carousel-results.json and quick-carousel-*.png.

The existing location buttons remain in quickFilterOptions and retain their original click listeners. A bounded start index hides buttons outside a maximum three-item window. Native previous/next buttons move exactly one location and hide at the endpoints; keyboard focus transfers to the remaining arrow when needed. Navigation never calls applyFilters, clears selection, reconstructs buttons, or writes URL state.

A ResizeObserver chooses up to three items using measured chip widths, reserving both arrow widths to avoid count changes during navigation. Three fit at 1024/1280/1440/1600px; two fit at 901px. Tablet retains the header's below-title placement and uses the same width-based count. At 600px and below all existing chips are available in a touch-scrollable row without arrows. Chips are 32px high with 13px text, 12px horizontal padding and 6px gaps. Arrows are 30px. A native 200ms, 10px horizontal animation respects reduced motion and cancels prior animations on rapid navigation.

Validation passed in headless Chrome at 1600, 1440, 1280, 1024, 901, 768, 601, 430 and 390px. Verified the exact three-item forward/back sequence, endpoint visibility, keyboard navigation/focus, unchanged results and location input during arrow navigation, selected-state retention outside the visible window, chip filtering, mobile scrolling, sorting, reduced motion and no page overflow. No JavaScript or console errors; test server favicon request is stubbed. node --check listings-ui.js passed. Desktop, narrow laptop and mobile screenshots visually reviewed.

Sidebar, card rendering, property grid, sorting/filter predicates, data, navigation and Supabase code were not modified. The preview's existing lack of URL/filter restoration remains unchanged.
