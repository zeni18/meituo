/* Merchant white theme bootstrap. Load synchronously before the Nuxt entry. */
(() => {
  'use strict';
  const config = window.__MERCHANT_UI__;
  if (!config || config.white !== true) return;
  const normalize = path => String(path == null ? location.pathname : path).split(/[?#]/)[0].replace(/^\/t\/\d+(?=\/|$)/, '') || '/';
  const excluded = /(?:^|\/)(?:short[-_]drama|aigc_short_drama|aigc_canvas)(?:\/|$)/;
  const isMerchantWhite = path => config.white === true && !excluded.test(normalize(path));
  const root = document.documentElement;
  let owned = false;
  let previousColorScheme = '';
  function apply(path) {
    const on = isMerchantWhite(path);
    if (!on) {
      root.removeAttribute('data-merchant-white');
      if (owned) root.style.colorScheme = previousColorScheme;
      owned = false;
      return false;
    }
    if (!owned) previousColorScheme = root.style.colorScheme;
    owned = true;
    root.dataset.merchantWhite = 'true';
    root.dataset.pcDesign = 'imagine';
    root.dataset.pcWorkspace = 'imagine';
    root.dataset.pcTheme = 'light';
    root.dataset.pcMode = 'light';
    delete root.dataset.pcSkin;
    root.classList.remove('theme-dark', 'theme-coral', 'dark');
    root.classList.add('theme-light');
    root.style.colorScheme = 'light';
    return true;
  }
  if (Number.isSafeInteger(config.tenantId) && config.tenantId > 0) root.dataset.merchantTenant = String(config.tenantId);
  window.isMerchantWhite = isMerchantWhite;
  window.MerchantWhiteTheme = Object.freeze({ version: 'mw20261023d', apply, isMerchantWhite });
  apply();
})();
