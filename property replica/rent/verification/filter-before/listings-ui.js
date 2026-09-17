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
    byId('listingsCount').textContent = properties.length ? '1 - ' + properties.length + ' of ' + properties.length + ' sample ' + (properties.length === 1 ? 'property' : 'properties') : '0 sample properties';
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
    selectControls.forEach(function (control) {
      control.trigger.querySelector('.filter-value').textContent = control.select.selectedOptions[0].textContent;
      control.panel.querySelectorAll('[role="radio"]').forEach(function (option) {
        var selected = option.dataset.value === control.select.value;
        option.setAttribute('aria-checked',String(selected));
        option.tabIndex = selected ? 0 : -1;
      });
    });
  }
  [['listingPurposeFilter','purposeSlot','Sale or rent'],['listingTypeFilter','typeSlot','Property type']].forEach(function (config) {
    var select = byId(config[0]);
    select.closest('.field').classList.add('native-filter');
    var trigger = document.createElement('button');
    trigger.type = 'button'; trigger.id = config[0] + 'Trigger';
    trigger.className = 'button filter-trigger';
    trigger.innerHTML = '<span class="filter-value"></span><span class="caret" aria-hidden="true"></span>';
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
    [['purposeField','purposeSlot'],['typeField','typeSlot'],['priceField','priceSlot']].forEach(function (pair) { byId(mobile.matches ? 'mobilePrimaryFilters' : pair[1]).appendChild(byId(pair[0])); });
    price.open = mobile.matches;
    if (mobile.matches) pricePanel.removeAttribute('role');
    else pricePanel.setAttribute('role','dialog');
    byId('priceSummary').setAttribute('aria-expanded',String(price.open));
    syncSelectControls();
  }
  function openFilters(event) { opener = event.currentTarget; if (!mobile.matches) { openFlyout(dialog,opener); return; } price.open = true; dialog.showModal(); opener.setAttribute('aria-expanded','true'); document.body.style.overflow = 'hidden'; }
  byId('moreFiltersButton').addEventListener('click',openFilters);
  byId('mobileFiltersButton').addEventListener('click',openFilters);
  byId('closeFilters').addEventListener('click',function () { if (activeFlyout) closeFlyout(true); else dialog.close(); });
  dialog.addEventListener('close',function () { document.body.style.overflow = ''; if (dialog.open) return; byId('moreFiltersButton').setAttribute('aria-expanded','false'); byId('mobileFiltersButton').setAttribute('aria-expanded','false'); if (mobile.matches) byId('mobileFiltersButton').focus(); });
  function runSearch() { closeFlyout(true); if (dialog.open) dialog.close(); price.open = mobile.matches; applyFilters(); }
  byId('applyFilters').addEventListener('click',runSearch);
  byId('listingSearchForm').addEventListener('submit',function (event) { event.preventDefault(); runSearch(); });
  byId('resetFilters').addEventListener('click',function () { byId('listingSearchForm').reset(); byId('listingPurposeFilter').value = 'For Sale'; syncSelectControls(); byId('quickFilterOptions').querySelectorAll('button').forEach(function (item) { item.setAttribute('aria-pressed','false'); }); applyFilters(); });
  byId('listingSortSelect').addEventListener('change',applyFilters);
  byId('priceDone').addEventListener('click',function () { closeFlyout(true); });
  byId('mobileLocationInput').addEventListener('input',function (event) { byId('listingLocationInput').value = event.target.value; });
  byId('listingLocationInput').addEventListener('input',function (event) { byId('mobileLocationInput').value = event.target.value; });
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
