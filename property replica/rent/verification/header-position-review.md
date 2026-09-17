# Quick Filters and sort positioning

Changed application files: listings.html, listings.css, listings-ui.js.

Quick Filters now use flex-end alignment within the existing results-header tools area. Their chip styling, visible-count logic, animation, selection and click handlers are unchanged. Removing desktop sorting from that area eliminates its wrapped row and lets cards begin at approximately 216px at all tested desktop widths.

The original sort label/select is moved, never duplicated: after List Privately and before Account above 1100px; in a separate row below Account at 901–1100px; back into the existing results toolbar at 900px and below. Header styling is compact and borderless with a visible Sort: prefix and the native dynamic selected option. Option values and the existing change listener are unchanged. Header width/gaps accommodate the added control without overlap; Account and List Privately handlers remain intact.

Validation: node --check listings-ui.js; tools/review-quick-carousel.py; tools/review-header-position.py. Checked 390, 430, 768, 900, 901, 950, 1024, 1100, 1101, 1200, 1201, 1280, 1440 and 1600px for control placement, no duplicates, selected-sort/order preservation across resizing, header overlap and page overflow. Existing carousel sequence, filtering, selected state, keyboard navigation, sorting and reduced-motion checks passed. No console or JavaScript errors. Account and List Privately preview actions still respond. Desktop and narrow-desktop screenshots visually reviewed.

Sidebar, card markup, image carousel, property grid, filter predicates, sort implementation and data queries were not changed. Existing URL behavior is unchanged.
