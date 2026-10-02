
(function () {
  'use strict';

  var market = {
    country: '',
    headquarters: ''
  };

  var applying = false;


  function getSupabase() {
    return window.hilltopSupabase || null;
  }


  function clean(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ');
  }


  async function loadMarket() {
    var supabase =
      getSupabase();

    if (!supabase) {
      return;
    }

    try {
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

    } catch (error) {
      console.warn(
        '[Demo market]',
        error
      );
    }
  }


  function updateBranchLabel() {
    var select =
      document.getElementById(
        'fBranch'
      );

    if (!select) return;

    var label =
      document.querySelector(
        'label[for="fBranch"]'
      );

    if (label) {
      var required =
        label.querySelector('.req');

      label.childNodes.forEach(
        function (node) {
          if (
            node.nodeType === 3 &&
            clean(node.nodeValue)
          ) {
            node.nodeValue =
              'Headquarters ';

            return;
          }
        }
      );

      if (
        !required &&
        label.textContent
      ) {
        label.textContent =
          'Headquarters';
      }
    }
  }


  function applyMarketToBranch() {
    if (applying) return;

    var select =
      document.getElementById(
        'fBranch'
      );

    if (!select) return;

    if (
      !market.country ||
      !market.headquarters
    ) {
      return;
    }

    var options =
      Array.prototype.slice.call(
        select.options || []
      );

    if (!options.length) {
      return;
    }

    var emptyOption =
      options.find(
        function (option) {
          return !option.value;
        }
      );

    var realOptions =
      options.filter(
        function (option) {
          return Boolean(option.value);
        }
      );

    if (!realOptions.length) {
      if (emptyOption) {
        emptyOption.textContent =
          'No headquarters branch available';
      }

      return;
    }

    applying = true;

    try {
      updateBranchLabel();

      if (emptyOption) {
        emptyOption.textContent =
          'Select ' +
          market.headquarters +
          ' headquarters...';
      }

      var headquartersOption =
        realOptions[0];

      headquartersOption.textContent =
        market.headquarters +
        ' (Headquarters)';

      headquartersOption.hidden =
        false;

      headquartersOption.disabled =
        false;


      realOptions.slice(1)
        .forEach(
          function (option) {
            option.hidden = true;
          }
        );


      if (!select.value) {
        select.value =
          headquartersOption.value;

        select.dispatchEvent(
          new Event(
            'change',
            { bubbles: true }
          )
        );
      }


      select.setAttribute(
        'data-demo-country',
        market.country
      );

      select.setAttribute(
        'data-demo-headquarters',
        market.headquarters
      );

    } finally {
      applying = false;
    }
  }


  function observeBranchOptions() {
    var select =
      document.getElementById(
        'fBranch'
      );

    if (!select) return;

    var observer =
      new MutationObserver(
        function () {
          window.setTimeout(
            applyMarketToBranch,
            0
          );
        }
      );

    observer.observe(
      select,
      {
        childList: true,
        subtree: true
      }
    );
  }


  async function init() {
    await loadMarket();

    applyMarketToBranch();

    observeBranchOptions();

    window.setTimeout(
      applyMarketToBranch,
      300
    );

    window.setTimeout(
      applyMarketToBranch,
      1000
    );
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
