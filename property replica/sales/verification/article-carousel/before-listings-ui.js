/* This file only presents sample content and demonstrates controls; no backend logic. */
(function () {
  'use strict';
  var byId = function (id) { return document.getElementById(id); };
  var escape = function (value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var icon = function (name) { return '<svg aria-hidden="true"><use href="#icon-' + name + '"/></svg>'; };
  var data = window.propertyPreviewData;
  var allProperties = data.properties.slice();
  var savedProperties = new Set();
  var grid = byId('listingsGrid');

  function renderProperties(properties) {
    grid.innerHTML = properties.map(function (property, index) {
    var images = data.images.filter(function (image) { return String(image.property_id) === String(property.id) && typeof image.image_url === 'string' && image.image_url.trim(); }).sort(function (a, b) {
      return Number(Boolean(b.is_cover)) - Number(Boolean(a.is_cover)) || Number(a.display_order || 0) - Number(b.display_order || 0);
    }).map(function (image) { return image.image_url.trim(); }).filter(function (url, index, urls) { return urls.indexOf(url) === index; });
    var title = escape(property.title || property.reference_number || 'Hilltop property');
    var url = 'property-details.html?id=' + encodeURIComponent(property.id);
    var main = images.length ? '<img src="' + escape(images[0]) + '" alt="' + title + ' — photo 1" decoding="async" ' + (index > 1 ? 'loading="lazy"' : 'fetchpriority="high"') + '>' : '<div class="gallery-placeholder">' + icon('home') + '<span>Photo unavailable</span></div>';
    var controls = images.length > 1 ? '<button type="button" class="gallery-arrow gallery-previous" data-direction="-1" aria-label="Previous image of ' + title + '">‹</button><button type="button" class="gallery-arrow gallery-next" data-direction="1" aria-label="Next image of ' + title + '">›</button><span class="gallery-counter">1 / ' + images.length + '</span>' : '';
    var specifications = [];
    var positive = function (value) { return Number.isFinite(Number(value)) && Number(value) > 0; };
    if (String(property.property_type).toLowerCase() !== 'land') {
      if (positive(property.bedrooms)) specifications.push('<span>' + Number(property.bedrooms) + ' beds</span>');
      if (positive(property.bathrooms)) specifications.push('<span>' + Number(property.bathrooms) + ' baths</span>');
    }
    if (positive(property.square_metres)) specifications.push('<span>' + icon('area') + Number(property.square_metres).toLocaleString() + ' m²</span>');
    return '<article class="property-card" aria-labelledby="property-title-' + index + '">' +
      '<div class="property-gallery" data-images="' + escape(JSON.stringify(images)) + '" data-index="0" data-title="' + title + '"><a href="' + url + '" class="gallery-main">' + main + '</a><span class="purpose-badge">' + escape(property.purpose) + '</span><button type="button" class="save-property" data-property-id="' + escape(property.id) + '" aria-label="Save ' + title + '" aria-pressed="' + String(savedProperties.has(String(property.id))) + '">' + icon('heart') + '</button><span class="property-card-verified">HILLTOP.Verified</span>' + controls + '</div>' +
      '<div class="property-info"><p class="property-price">' + window.HilltopCurrency.formatPropertyPrice(property.price,property.currency_code,property.purpose) + '</p><h2 class="property-title" id="property-title-' + index + '"><a href="' + url + '">' + title + '</a></h2><p class="property-location">' + [property.area, property.property_type].filter(Boolean).map(escape).join(' · ') + '</p>' + (specifications.length ? '<div class="property-specs">' + specifications.join('') + '</div>' : '') + '</div></article>';
    }).join('');
    if (!properties.length) grid.innerHTML = '<div class="listings-empty"><h2>No properties found</h2><p>Try clearing one or more filters.</p></div>';
    byId('filterPropertyCount').textContent = properties.length + (properties.length === 1 ? ' property' : ' properties');
    byId('filterMatchingCount').textContent = properties.length + (properties.length === 1 ? ' matching property' : ' matching properties');
    byId('listingsCount').textContent = properties.length ? '1 - ' + properties.length + ' of ' + properties.length + ' sample ' + (properties.length === 1 ? 'property' : 'properties') : '0 sample properties';
    // Mirror the existing result presentation in the lower-page design.
    byId('listingBottomCount').textContent = byId('listingsCount').textContent;
    byId('listingPagination').hidden = !properties.length;
    var lowerPurpose = byId('listingPurposeFilter').value === 'For Rent' ? 'for rent' : 'for sale';
    document.querySelectorAll('[data-lower-purpose]').forEach(function (label) { label.textContent = lowerPurpose; });
    document.querySelector('[data-lower-article-purpose]').textContent = lowerPurpose === 'for rent' ? 'for Rent' : 'for Sale';
  }

  // Delegation is installed once; every rendered gallery owns its image list and index.
  function stepGallery(gallery, direction) {
    var images = JSON.parse(gallery.dataset.images);
    if (images.length < 2) return;
    var index = (Number(gallery.dataset.index) + direction + images.length) % images.length;
    gallery.dataset.index = index;
    var image = gallery.querySelector('img');
    image.src = images[index];
    image.alt = gallery.dataset.title + ' — photo ' + (index + 1);
    gallery.querySelector('.gallery-counter').textContent = (index + 1) + ' / ' + images.length;
  }
  grid.addEventListener('click', function (event) {
    var arrow = event.target.closest('.gallery-arrow');
    if (!arrow) return;
    event.preventDefault(); event.stopPropagation();
    stepGallery(arrow.closest('.property-gallery'), Number(arrow.dataset.direction));
  });
  var gesture = null;
  var suppressClick = null;
  grid.addEventListener('touchstart', function (event) {
    suppressClick = null;
    var gallery = event.target.closest('.property-gallery');
    gesture = gallery && !event.target.closest('button') && event.touches.length === 1 ? {
      gallery: gallery, x: event.touches[0].clientX, y: event.touches[0].clientY
    } : null;
  }, {passive: true});
  grid.addEventListener('touchend', function (event) {
    if (!gesture) return;
    var dx = event.changedTouches[0].clientX - gesture.x;
    var dy = event.changedTouches[0].clientY - gesture.y;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      stepGallery(gesture.gallery, dx < 0 ? 1 : -1);
      suppressClick = {gallery: gesture.gallery, until: Date.now() + 700};
    }
    gesture = null;
  }, {passive: true});
  grid.addEventListener('touchcancel', function () { gesture = null; }, {passive: true});
  grid.addEventListener('click', function (event) {
    if (suppressClick && Date.now() < suppressClick.until && suppressClick.gallery.contains(event.target) && !event.target.closest('button')) {
      event.preventDefault(); event.stopPropagation();
    }
    suppressClick = null;
  }, true);

  function selectedMinimum(id) {
    var value = Number(byId(id).value);
    return byId(id).value === '' ? 0 : value;
  }

  function applyFilters() {
    var purpose = byId('listingPurposeFilter').value;
    var type = byId('listingTypeFilter').value;
    var location = byId('listingLocationInput').value.trim().toLowerCase();
    var keywords = byId('keywordsInput').value.trim().toLowerCase();
    var reference = byId('referenceInput').value.trim().toLowerCase();
    var minPrice = selectedMinimum('minPriceInput');
    var maxPrice = selectedMinimum('maxPriceInput') || Infinity;
    var minSize = selectedMinimum('minSizeInput');
    var minBedrooms = selectedMinimum('bedroomsFilter');
    var minBathrooms = selectedMinimum('bathroomsFilter');
    var features = Array.from(document.querySelectorAll('input[name="feature"]:checked')).map(function (input) { return input.value.toLowerCase(); });
    var properties = allProperties.filter(function (property) {
      var haystack = [property.title, property.description, property.area, property.full_address, property.property_type].join(' ').toLowerCase();
      var amenities = (property.amenities || []).map(function (item) { return String(item).toLowerCase(); });
      return property.purpose === purpose &&
        (type === 'all' || property.property_type === type) &&
        (!location || haystack.indexOf(location) !== -1) &&
        (!keywords || haystack.indexOf(keywords) !== -1) &&
        (!reference || String(property.reference_number || '').toLowerCase().indexOf(reference) !== -1) &&
        Number(property.price || 0) >= minPrice && Number(property.price || 0) <= maxPrice &&
        Number(property.square_metres || 0) >= minSize &&
        Number(property.bedrooms || 0) >= minBedrooms && Number(property.bathrooms || 0) >= minBathrooms &&
        features.every(function (feature) { return amenities.indexOf(feature) !== -1; });
    });
    var sort = byId('listingSortSelect').value;
    if (sort === 'price-high') properties.sort(function (a,b) { return Number(b.price) - Number(a.price); });
    if (sort === 'price-low') properties.sort(function (a,b) { return Number(a.price) - Number(b.price); });
    if (sort === 'newest') properties.sort(function (a,b) { return new Date(b.created_at) - new Date(a.created_at); });
    renderProperties(properties);
    byId('listingPageTitle').textContent = purpose === 'For Rent' ? 'Properties to Rent' : 'Properties for Sale';
    document.querySelector('.breadcrumb a').textContent = purpose === 'For Rent' ? 'Property to Rent' : 'Property for Sale';
    return properties;
  }

  renderProperties(allProperties.filter(function (row) { return row.purpose === 'For Sale'; }));
  var locations = Array.from(new Set(data.properties.map(function (row) { return row.area; })));
  locations.forEach(function (location) {
    var option = document.createElement('option'); option.value = location; byId('listingLocations').appendChild(option);
    var button = document.createElement('button'); button.type = 'button'; button.className = 'quick-filter'; button.textContent = location; button.setAttribute('aria-pressed','false');
    button.addEventListener('click', function () { byId('listingLocationInput').value = location; byId('mobileLocationInput').value = location; byId('quickFilterOptions').querySelectorAll('button').forEach(function (item) { item.setAttribute('aria-pressed',String(item === button)); }); applyFilters(); });
    byId('quickFilterOptions').appendChild(button);
  });
  // Navigate the existing buttons without changing their filter or selected state.
  (function setupQuickFilterCarousel() {
    var options = byId('quickFilterOptions');
    var chips = Array.from(options.children);
    var previous = byId('quickFilterPrevious');
    var next = byId('quickFilterNext');
    var nav = options.closest('.quick-filters');
    var mobileChips = window.matchMedia('(max-width:600px)');
    var reducedMotion = window.matchMedia('(prefers-reduced-motion:reduce)');
    var startIndex = 0;
    var visibleCount = 3;
    var chipWidths = [];

    function renderWindow(direction) {
      var focused = document.activeElement;
      var scrolling = mobileChips.matches;
      startIndex = Math.max(0, Math.min(startIndex, Math.max(0, chips.length - visibleCount)));
      chips.forEach(function (chip, index) {
        chip.hidden = !scrolling && (index < startIndex || index >= startIndex + visibleCount);
        chip.getAnimations().forEach(function (animation) { animation.cancel(); });
        if (direction && !scrolling && !chip.hidden && !reducedMotion.matches) {
          chip.animate([{ transform:'translateX(' + (direction * 10) + 'px)' }, { transform:'translateX(0)' }], { duration:200, easing:'ease-out' });
        }
      });
      previous.hidden = scrolling || startIndex === 0;
      next.hidden = scrolling || startIndex >= chips.length - visibleCount;
      // Keep keyboard focus usable when the arrow at an endpoint disappears.
      if (focused === previous && previous.hidden && !next.hidden) next.focus();
      if (focused === next && next.hidden && !previous.hidden) previous.focus();
    }

    function fitWindow() {
      var oldCount = visibleCount;
      // Reserve room for both arrows so advancing never changes the item count.
      var stackedLabel = getComputedStyle(nav).flexDirection === 'column';
      var available = nav.clientWidth - (stackedLabel ? 0 : nav.firstElementChild.getBoundingClientRect().width + 10) - 72 - 6;
      visibleCount = Math.min(3, chips.length);
      while (visibleCount > 1) {
        var widest = 0;
        for (var i = 0; i <= chips.length - visibleCount; i += 1) {
          var width = chipWidths.slice(i, i + visibleCount).reduce(function (sum, value) { return sum + value; }, 0) + (visibleCount - 1) * 6;
          widest = Math.max(widest, width);
        }
        if (widest <= available) break;
        visibleCount -= 1;
      }
      if (oldCount !== visibleCount) {
        var selected = chips.findIndex(function (chip) { return chip.getAttribute('aria-pressed') === 'true'; });
        if (selected >= 0) startIndex = Math.min(selected, Math.max(0, chips.length - visibleCount));
      }
      renderWindow(0);
    }

    function measureChips() {
      chips.forEach(function (chip) { chip.hidden = false; });
      chipWidths = chips.map(function (chip) { return chip.getBoundingClientRect().width; });
      fitWindow();
    }
    previous.addEventListener('click', function () { startIndex -= 1; renderWindow(-1); });
    next.addEventListener('click', function () { startIndex += 1; renderWindow(1); });
    mobileChips.addEventListener('change', fitWindow);
    new ResizeObserver(fitWindow).observe(nav);
    measureChips();
    document.fonts.ready.then(measureChips);
  }());
  var toastTimer;
  function toast(message) { var el = byId('previewToast'); el.textContent = message; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.hidden = true; }, 3500); }
  var dialog = byId('listingFiltersDialog');
  var mobile = window.matchMedia('(max-width:900px)');
  var price = byId('priceField');
  var opener;
  var activeFlyout;
  var selectControls = [];
  var pricePanel = price.querySelector('.price-popover');
  pricePanel.classList.add('filter-flyout');
  pricePanel.id = 'pricePanel';
  pricePanel.setAttribute('role','dialog');
  pricePanel.setAttribute('aria-label','Price range');
  byId('priceSummary').setAttribute('aria-controls','pricePanel');
  byId('priceSummary').setAttribute('aria-haspopup','dialog');
  dialog.classList.add('filter-flyout');

  function positionFlyout() {
    if (!activeFlyout || mobile.matches) return;
    var rail = document.querySelector('.filter-sidebar').getBoundingClientRect();
    var gap = parseFloat(getComputedStyle(document.querySelector('.marketplace-layout')).columnGap);
    var left = rail.right + gap;
    var top = Math.max(16, Math.min(rail.top, window.innerHeight - 160));
    activeFlyout.panel.style.left = left + 'px';
    activeFlyout.panel.style.top = top + 'px';
    activeFlyout.panel.style.width = Math.min(380, window.innerWidth - left - 20) + 'px';
    activeFlyout.panel.style.maxHeight = (window.innerHeight - top - 20) + 'px';
  }
  function closeFlyout(restoreFocus) {
    if (!activeFlyout) return;
    var previous = activeFlyout;
    activeFlyout = null;
    previous.trigger.setAttribute('aria-expanded','false');
    if (previous.panel === pricePanel) price.open = false;
    else previous.panel.close();
    if (restoreFocus) previous.trigger.focus();
  }
  function openFlyout(panel, trigger) {
    if (activeFlyout && activeFlyout.panel === panel) { closeFlyout(true); return; }
    closeFlyout(false);
    activeFlyout = {panel:panel, trigger:trigger};
    trigger.setAttribute('aria-expanded','true');
    positionFlyout();
    if (panel === pricePanel) price.open = true;
    else panel.show();
    (panel.querySelector('[aria-checked="true"]') || panel.querySelector('input,button')).focus();
  }
  function syncSelectControls() {
    document.querySelectorAll('[data-listing-purpose]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.listingPurpose === byId('listingPurposeFilter').value));
    });
    var maximum = byId('maxPriceInput').value;
    var minimum = byId('minPriceInput').value;
    byId('priceValue').textContent = maximum ? Number(maximum).toLocaleString() : 'No maximum';
    if (minimum) byId('priceValue').textContent += ' (min. ' + Number(minimum).toLocaleString() + ')';
    selectControls.forEach(function (control) {
      control.trigger.querySelector('.filter-value').textContent = control.select.selectedOptions[0].textContent;
      control.panel.querySelectorAll('[role="radio"]').forEach(function (option) {
        var selected = option.dataset.value === control.select.value;
        option.setAttribute('aria-checked',String(selected));
        option.tabIndex = selected ? 0 : -1;
      });
    });
  }
  [['listingTypeFilter','typeSlot','Property type']].forEach(function (config) {
    var select = byId(config[0]);
    select.closest('.field').classList.add('native-filter');
    var trigger = document.createElement('button');
    trigger.type = 'button'; trigger.id = config[0] + 'Trigger';
    trigger.className = 'button filter-trigger discovery-control';
    trigger.setAttribute('aria-labelledby','typeLabel ' + trigger.id + 'Value');
    trigger.innerHTML = byId('typeField').querySelector('.field-icon').outerHTML + '<span class="filter-value" id="' + trigger.id + 'Value"></span>' + byId('typeField').querySelector('.field-chevron').outerHTML;
    trigger.setAttribute('aria-haspopup','dialog'); trigger.setAttribute('aria-expanded','false');
    var panel = document.createElement('dialog');
    panel.id = config[0] + 'Panel'; panel.className = 'filter-flyout option-flyout';
    trigger.setAttribute('aria-controls',panel.id);
    panel.setAttribute('aria-labelledby',panel.id + 'Title');
    panel.innerHTML = '<div class="dialog-heading"><h2 id="' + panel.id + 'Title">' + config[2] + '</h2><button type="button" class="dialog-close" aria-label="Close ' + config[2].toLowerCase() + '">×</button></div><div class="filter-options" role="radiogroup" aria-label="' + config[2] + '"></div>';
    Array.from(select.options).forEach(function (option) {
      var choice = document.createElement('button');
      choice.type = 'button'; choice.className = 'filter-option'; choice.dataset.value = option.value;
      choice.setAttribute('role','radio');
      choice.textContent = option.value === 'all' ? 'All property types' : option.textContent;
      choice.addEventListener('click',function () { select.value = option.value; select.dispatchEvent(new Event('change',{bubbles:true})); closeFlyout(true); });
      panel.querySelector('.filter-options').appendChild(choice);
    });
    panel.addEventListener('keydown',function (event) {
      if (!event.target.matches('[role="radio"]')) return;
      var choices = Array.from(panel.querySelectorAll('[role="radio"]'));
      var index = choices.indexOf(event.target);
      if (['ArrowDown','ArrowRight','ArrowUp','ArrowLeft','Home','End'].indexOf(event.key) === -1) return;
      event.preventDefault();
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = choices.length - 1;
      else index = (index + (event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1) + choices.length) % choices.length;
      select.value = choices[index].dataset.value; syncSelectControls(); choices[index].focus();
    });
    panel.querySelector('.dialog-close').addEventListener('click',function () { closeFlyout(true); });
    trigger.addEventListener('click',function () { openFlyout(panel,trigger); });
    select.addEventListener('change',syncSelectControls);
    byId(config[1]).appendChild(trigger); document.body.appendChild(panel);
    selectControls.push({select:select,trigger:trigger,panel:panel});
  });
  byId('priceSummary').addEventListener('click',function (event) {
    if (mobile.matches) return;
    event.preventDefault(); openFlyout(pricePanel,byId('priceSummary'));
  });
  window.addEventListener('resize',positionFlyout);
  window.addEventListener('scroll',positionFlyout,{passive:true});
  document.addEventListener('pointerdown',function (event) {
    if (activeFlyout && !activeFlyout.panel.contains(event.target) && !activeFlyout.trigger.contains(event.target)) closeFlyout(false);
  });
  document.addEventListener('focusin',function (event) {
    if (activeFlyout && !activeFlyout.panel.contains(event.target) && !activeFlyout.trigger.contains(event.target)) closeFlyout(false);
  });
  function placeControls() {
    closeFlyout(false);
    if (dialog.open) dialog.close();
    [dialog,pricePanel].forEach(function (panel) { panel.removeAttribute('style'); });
    byId('filterFormHome').appendChild(byId('listingSearchForm'));
    if (mobile.matches) byId('listingSearchForm').insertBefore(byId('advancedFilters'), document.querySelector('.search-button'));
    else dialog.querySelector('.dialog-body').appendChild(byId('advancedFilters'));
    byId('advancedFilters').hidden = mobile.matches;
    byId('moreFiltersButton').setAttribute('aria-controls', mobile.matches ? 'advancedFilters' : 'listingFiltersDialog');
    if (mobile.matches) byId('moreFiltersButton').removeAttribute('aria-haspopup');
    else byId('moreFiltersButton').setAttribute('aria-haspopup','dialog');
    price.open = false;
    if (mobile.matches) pricePanel.removeAttribute('role');
    else pricePanel.setAttribute('role','dialog');
    byId('priceSummary').setAttribute('aria-expanded','false');
    syncSelectControls();
  }
  function openFilters(event) { opener = event.currentTarget; if (!mobile.matches) { openFlyout(dialog,opener); return; } byId('filterFormHome').scrollIntoView({block:'start'}); byId('listingLocationInput').focus({preventScroll:true}); }
  byId('moreFiltersButton').addEventListener('click',function (event) {
    if (!mobile.matches) { openFilters(event); return; }
    var advanced = byId('advancedFilters');
    advanced.hidden = !advanced.hidden;
    this.setAttribute('aria-expanded',String(!advanced.hidden));
    if (!advanced.hidden) advanced.querySelector('select').focus();
  });
  byId('mobileFiltersButton').addEventListener('click',openFilters);
  byId('closeFilters').addEventListener('click',function () { if (activeFlyout) closeFlyout(true); else dialog.close(); });
  dialog.addEventListener('close',function () { document.body.style.overflow = ''; if (dialog.open) return; byId('moreFiltersButton').setAttribute('aria-expanded','false'); byId('mobileFiltersButton').setAttribute('aria-expanded','false'); if (mobile.matches) byId('mobileFiltersButton').focus(); });
  function runSearch() { closeFlyout(true); if (dialog.open) dialog.close(); price.open = false; syncSelectControls(); applyFilters(); }
  byId('applyFilters').addEventListener('click',runSearch);
  byId('listingSearchForm').addEventListener('submit',function (event) { event.preventDefault(); runSearch(); });
  byId('resetFilters').addEventListener('click',function () { byId('listingSearchForm').reset(); byId('listingPurposeFilter').value = 'For Sale'; syncSelectControls(); byId('quickFilterOptions').querySelectorAll('button').forEach(function (item) { item.setAttribute('aria-pressed','false'); }); applyFilters(); });
  byId('listingSortSelect').addEventListener('change',applyFilters);
  // Move the original select; its value and existing change listener stay intact.
  var sortControl = byId('listingSortSelect').closest('.sort-control');
  var resultsTools = document.querySelector('.results-header-tools');
  var headerActions = document.querySelector('.header-actions');
  var accountControl = headerActions.querySelector('.account-link');
  var sortInResults = window.matchMedia('(max-width:900px)');
  function positionSortControl() {
    if (sortInResults.matches) resultsTools.appendChild(sortControl);
    else headerActions.insertBefore(sortControl, accountControl);
  }
  sortInResults.addEventListener('change', positionSortControl);
  positionSortControl();
  byId('priceDone').addEventListener('click',function () { closeFlyout(true); });
  byId('mobileLocationInput').addEventListener('input',function (event) { byId('listingLocationInput').value = event.target.value; });
  byId('listingLocationInput').addEventListener('input',function (event) { byId('mobileLocationInput').value = event.target.value; });
  document.querySelectorAll('[data-listing-purpose]').forEach(function (button) {
    button.addEventListener('click',function () {
      byId('listingPurposeFilter').value = button.dataset.listingPurpose;
      byId('listingPurposeFilter').dispatchEvent(new Event('change',{bubbles:true}));
    });
  });
  byId('listingPurposeFilter').addEventListener('change',syncSelectControls);
  ['minPriceInput','maxPriceInput'].forEach(function (id) { byId(id).addEventListener('input',syncSelectControls); });
  price.addEventListener('toggle',function () { byId('priceSummary').setAttribute('aria-expanded',String(price.open)); });
  mobile.addEventListener('change',placeControls); placeControls();
  var request = byId('requestDialog');
  var requestOpener;
  document.addEventListener('click',function (event) {
    var trigger = event.target.closest('.request-trigger');
    if (trigger) { requestOpener = trigger; request.showModal(); document.body.style.overflow = 'hidden'; }
    var demo = event.target.closest('[data-preview]');
    if (demo) toast(demo.dataset.preview + ' is not connected in this page preview.');
    var save = event.target.closest('.save-property');
    if (save) {
      event.preventDefault(); event.stopPropagation();
      var propertyId = save.dataset.propertyId;
      if (savedProperties.has(propertyId)) savedProperties.delete(propertyId); else savedProperties.add(propertyId);
      save.setAttribute('aria-pressed',String(savedProperties.has(propertyId)));
    }

  });
  request.querySelector('.dialog-close').addEventListener('click',function () { request.close(); });
  request.addEventListener('close',function () { document.body.style.overflow = ''; if (requestOpener) requestOpener.focus(); });
  byId('requestForm').addEventListener('submit',function (event) { event.preventDefault(); request.close(); toast('Preview only — no request has been sent.'); });
  [dialog,request].forEach(function (modal) { modal.addEventListener('click',function (event) { var rect=modal.getBoundingClientRect(); if (event.target===modal && (event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)) modal.close(); }); });
  var nav = byId('siteNav'), toggle = byId('navToggle');
  toggle.addEventListener('click',function () { var open=nav.classList.toggle('open'); toggle.setAttribute('aria-expanded',String(open)); toggle.setAttribute('aria-label',open ? 'Close navigation' : 'Open navigation'); });
  document.addEventListener('keydown',function (event) { if (event.key !== 'Escape') return; if (activeFlyout) { event.preventDefault(); closeFlyout(true); } if (nav.classList.contains('open')) { nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); toggle.focus(); } });
})();
