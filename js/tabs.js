/**
 * MAGNETIC TABS — sliding indicator for category tabs
 * v2: orientation-aware recalculation
 */
(function () {
  'use strict';

  function updateIndicator(activeTab) {
    const wrapper = document.querySelector('.cat-tabs-wrapper');
    const indicator = document.getElementById('cat-indicator');
    if (!wrapper || !indicator || !activeTab) return;

    const wRect = wrapper.getBoundingClientRect();
    const tRect = activeTab.getBoundingClientRect();

    indicator.style.left = (tRect.left - wRect.left) + 'px';
    indicator.style.width = tRect.width + 'px';
  }

  /* Expose so app.js can call after _renderPresets (which rebuilds DOM) */
  window._updateTabIndicator = updateIndicator;

  function initTabs() {
    const tabs = document.querySelectorAll('.cat-tab');
    const activeTab = document.querySelector('.cat-tab.active');
    const indicator = document.getElementById('cat-indicator');

    /* Position immediately without animation on first load */
    if (indicator) indicator.style.transition = 'none';
    updateIndicator(activeTab);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (indicator) indicator.style.transition = '';
    }));

    tabs.forEach(tab => {
      /* Hover preview (desktop) */
      tab.addEventListener('mouseenter', () => updateIndicator(tab));
      tab.addEventListener('mouseleave', () => {
        updateIndicator(document.querySelector('.cat-tab.active'));
      });

      /* Click / tap */
      tab.addEventListener('click', () => {
        tabs.forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        updateIndicator(tab);
      });
    });

    /* Recalculate on resize & orientation change */
    const recalc = () => {
      const current = document.querySelector('.cat-tab.active');
      updateIndicator(current);
    };

    window.addEventListener('resize', recalc);

    if (screen.orientation) {
      screen.orientation.addEventListener('change', () => setTimeout(recalc, 250));
    } else {
      window.addEventListener('orientationchange', () => setTimeout(recalc, 300));
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    /* Small delay to let app.js render presets first */
    setTimeout(initTabs, 60);
  });
})();
