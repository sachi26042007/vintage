/**
 * MAGNETIC TABS — sliding indicator for category tabs
 * Pure JS, no framework. Runs after DOM is ready.
 */
(function () {
  'use strict';

  function updateIndicator(activeTab) {
    const wrapper = document.querySelector('.cat-tabs-wrapper');
    const indicator = document.getElementById('cat-indicator');
    if (!wrapper || !indicator || !activeTab) return;

    const wRect = wrapper.getBoundingClientRect();
    const tRect = activeTab.getBoundingClientRect();
    const pad = 0;

    indicator.style.left  = (tRect.left - wRect.left - pad) + 'px';
    indicator.style.width = (tRect.width + pad * 2)         + 'px';
  }

  function initTabs() {
    const tabs = document.querySelectorAll('.cat-tab');
    const activeTab = document.querySelector('.cat-tab.active');

    // Position indicator immediately (no transition) on load
    const indicator = document.getElementById('cat-indicator');
    if (indicator) indicator.style.transition = 'none';
    updateIndicator(activeTab);
    // Re-enable transition after a frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (indicator) indicator.style.transition = '';
      });
    });

    tabs.forEach(tab => {
      tab.addEventListener('mouseenter', () => updateIndicator(tab));
      tab.addEventListener('mouseleave', () => {
        const current = document.querySelector('.cat-tab.active');
        updateIndicator(current);
      });
      tab.addEventListener('click', () => {
        tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        updateIndicator(tab);
      });
    });

    // Recalculate on resize
    window.addEventListener('resize', () => {
      const current = document.querySelector('.cat-tab.active');
      updateIndicator(current);
    });
  }

  // Wait for app to fully render preset buttons, then init
  document.addEventListener('DOMContentLoaded', () => {
    // Small delay to let app.js render presets first
    setTimeout(initTabs, 60);
  });
})();
