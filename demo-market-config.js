
(function () {
  'use strict';

  var market = {
    country: '',
    headquarters: ''
  };


  function getSupabase() {
    return window.hilltopSupabase || null;
  }


  function clean(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ');
  }


  function status(message, type) {
    var element =
      document.getElementById(
        'demoMarketStatus'
      );

    if (!element) return;

    element.textContent =
      message || '';

    element.classList.remove(
      'success',
      'error'
    );

    if (type) {
      element.classList.add(type);
    }
  }


  async function loadMarket() {
    var supabase =
      getSupabase();

    if (!supabase) {
      throw new Error(
        'Supabase client is unavailable.'
      );
    }

    var response = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq(
        'setting_key',
        'demo_market'
      )
      .maybeSingle();

    if (response.error) {
      throw response.error;
    }

    var value =
      response.data &&
      response.data.setting_value
        ? response.data.setting_value
        : {};

    market.country =
      clean(value.country);

    market.headquarters =
      clean(value.headquarters);
  }


  async function saveMarket() {
    var supabase =
      getSupabase();

    if (!supabase) {
      throw new Error(
        'Supabase client is unavailable.'
      );
    }

    var existing = await supabase
      .from('app_settings')
      .select('id')
      .eq(
        'setting_key',
        'demo_market'
      )
      .maybeSingle();

    if (existing.error) {
      throw existing.error;
    }

    var payload = {
      country:
        clean(market.country),

      headquarters:
        clean(market.headquarters)
    };

    var response;

    if (existing.data) {
      response = await supabase
        .from('app_settings')
        .update({
          setting_value: payload
        })
        .eq(
          'setting_key',
          'demo_market'
        );
    } else {
      response = await supabase
        .from('app_settings')
        .insert({
          setting_key:
            'demo_market',

          setting_category:
            'website',

          setting_value:
            payload
        });
    }

    if (response.error) {
      throw response.error;
    }
  }


  function injectCard() {
    if (
      document.getElementById(
        'dashboardDemoMarket'
      )
    ) {
      return;
    }

    var anchor =
      document.getElementById(
        'dashboardDemoLocations'
      ) ||
      document.querySelector(
        '.theme-settings-card'
      );

    if (!anchor) {
      console.warn(
        '[Demo market] Dashboard anchor not found.'
      );

      return;
    }

    anchor.insertAdjacentHTML(
      'afterend',
      `
      <section
        class="brand-settings-card demo-market-card"
        id="dashboardDemoMarket">

        <div class="brand-settings-copy">

          <p class="brand-settings-eyebrow">
            Demo market
          </p>

          <h2>
            Country &amp; headquarters
          </h2>

          <p>
            Choose the country represented by this
            demo and the city where the company is
            headquartered.
          </p>

        </div>

        <form
          class="brand-settings-form"
          id="demoMarketForm">

          <div class="demo-market-grid">

            <label for="demoMarketCountry">

              <span>
                Country
              </span>

              <input
                id="demoMarketCountry"
                type="text"
                list="demoCountryOptions"
                maxlength="100"
                placeholder="e.g. Zambia"
                required>

              <datalist id="demoCountryOptions">
                <option value="Zambia"></option>
                <option value="Zimbabwe"></option>
                <option value="South Africa"></option>
                <option value="Botswana"></option>
                <option value="Namibia"></option>
                <option value="Malawi"></option>
                <option value="Mozambique"></option>
                <option value="Tanzania"></option>
                <option value="Kenya"></option>
                <option value="Uganda"></option>
                <option value="Rwanda"></option>
                <option value="Ghana"></option>
                <option value="Nigeria"></option>
                <option value="United Kingdom"></option>
                <option value="Canada"></option>
                <option value="United States"></option>
              </datalist>

            </label>


            <label for="demoMarketHeadquarters">

              <span>
                Headquarters city
              </span>

              <input
                id="demoMarketHeadquarters"
                type="text"
                maxlength="120"
                placeholder="e.g. Lusaka"
                required>

            </label>

          </div>


          <div class="theme-settings-actions">

            <button
              class="action-btn primary"
              id="demoMarketSave"
              type="submit">
              Save market
            </button>

          </div>


          <p
            class="brand-settings-status"
            id="demoMarketStatus"
            role="status"
            aria-live="polite">
          </p>

        </form>

      </section>
      `
    );
  }


  function populateForm() {
    var country =
      document.getElementById(
        'demoMarketCountry'
      );

    var headquarters =
      document.getElementById(
        'demoMarketHeadquarters'
      );

    if (country) {
      country.value =
        market.country || '';
    }

    if (headquarters) {
      headquarters.value =
        market.headquarters || '';
    }
  }


  function bind() {
    var form =
      document.getElementById(
        'demoMarketForm'
      );

    var country =
      document.getElementById(
        'demoMarketCountry'
      );

    var headquarters =
      document.getElementById(
        'demoMarketHeadquarters'
      );

    if (
      !form ||
      !country ||
      !headquarters
    ) {
      return;
    }


    form.addEventListener(
      'submit',
      async function (event) {
        event.preventDefault();

        var countryValue =
          clean(country.value);

        var headquartersValue =
          clean(headquarters.value);

        if (
          !countryValue ||
          !headquartersValue
        ) {
          status(
            'Country and headquarters are required.',
            'error'
          );

          return;
        }

        market.country =
          countryValue;

        market.headquarters =
          headquartersValue;

        try {
          await saveMarket();

          status(
            countryValue +
            ' · ' +
            headquartersValue +
            ' headquarters saved.',
            'success'
          );

        } catch (error) {
          console.error(error);

          status(
            error.message ||
            'Unable to save market.',
            'error'
          );
        }
      }
    );
  }


  async function init() {
    injectCard();

    try {
      await loadMarket();

      populateForm();
      bind();

    } catch (error) {
      console.error(
        '[Demo market]',
        error
      );

      status(
        error.message ||
        'Unable to load market.',
        'error'
      );
    }
  }


  if (
    document.readyState ===
    'loading'
  ) {
    document.addEventListener(
      'DOMContentLoaded',
      init
    );
  } else {
    init();
  }

})();
