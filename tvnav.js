/* D-pad / remote-control navigation for TV browsers (LG webOS and similar) —
   also just works as keyboard navigation on desktop. Loaded as a plain
   (non-module) script on every page alongside the page's own module script.

   - Auto-focusable: gives custom card/row elements (which have no native
     focus) a tabindex so the D-pad can reach them, including ones added
     later by the page's own async rendering (MutationObserver).
   - Arrow keys: spatial navigation — finds the nearest focusable element in
     the pressed direction using bounding-box geometry, so it works across
     every page's layout with no per-page wiring.
   - Enter/OK: activates the focused element (native buttons/links already
     do this; custom divs need a manual click dispatch).
   - Back (webOS remote keyCode 461, or Escape for desktop testing): closes
     an open <dialog>, else navigates back in history.
*/
(function () {
  'use strict';

  var AUTO_TABINDEX_SELECTORS = ['.card', '.cast-card', '.episode-row'];
  var FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  var KEY_DIRECTIONS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

  function isWebOS() {
    return /Web0S|WebOS/i.test(navigator.userAgent) || localStorage.getItem('force_tv_mode') === '1';
  }

  function markFocusable(root) {
    AUTO_TABINDEX_SELECTORS.forEach(function (sel) {
      var els = [];
      if (root.matches && root.matches(sel)) els.push(root);
      if (root.querySelectorAll) {
        Array.prototype.push.apply(els, root.querySelectorAll(sel));
      }
      els.forEach(function (el) {
        if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      });
    });
  }

  function isVisible(el) {
    if (!el || el.hidden) return false;
    var rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    var style = window.getComputedStyle(el);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }

  function getFocusableElements() {
    return Array.prototype.slice.call(document.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
  }

  function overlapAmount(aStart, aEnd, bStart, bEnd) {
    return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  }

  // Overlap-first spatial nav (same convention as most TV/remote-control UIs):
  // among elements strictly in the pressed direction, prefer ones that share
  // a "column" (up/down) or "row" (left/right) with the current element —
  // e.g. moving down a row of cards lands on the card below, not whatever's
  // merely nearest in a straight line — falling back to plain distance only
  // when nothing overlaps.
  function findNext(current, direction) {
    var currentRect = current.getBoundingClientRect();
    var best = null;
    var bestScore = Infinity;

    getFocusableElements().forEach(function (el) {
      if (el === current) return;
      var rect = el.getBoundingClientRect();
      var primary, aligned, overlap;

      if (direction === 'left') {
        aligned = rect.right <= currentRect.left + 1;
        primary = currentRect.left - rect.right;
        overlap = overlapAmount(currentRect.top, currentRect.bottom, rect.top, rect.bottom);
      } else if (direction === 'right') {
        aligned = rect.left >= currentRect.right - 1;
        primary = rect.left - currentRect.right;
        overlap = overlapAmount(currentRect.top, currentRect.bottom, rect.top, rect.bottom);
      } else if (direction === 'up') {
        aligned = rect.bottom <= currentRect.top + 1;
        primary = currentRect.top - rect.bottom;
        overlap = overlapAmount(currentRect.left, currentRect.right, rect.left, rect.right);
      } else {
        aligned = rect.top >= currentRect.bottom - 1;
        primary = rect.top - currentRect.bottom;
        overlap = overlapAmount(currentRect.left, currentRect.right, rect.left, rect.right);
      }

      if (!aligned) return;
      var score = overlap > 0 ? primary - overlap * 0.5 : primary + 1e6;
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    });

    return best;
  }

  function currentFocus() {
    var el = document.activeElement;
    if (!el || el === document.body || el === document.documentElement) return null;
    return el;
  }

  // Land the D-pad on real content first, not header chrome like the search
  // icon — matches how TV home screens usually behave on launch. Content
  // (cards, hero) renders after an async fetch, so this re-runs as it
  // appears (see the MutationObserver below) until either real content is
  // found, the user moves focus themselves, or something else legitimately
  // already had focus (e.g. search.html's <input autofocus>) — in every
  // case it then backs off for good.
  var autoFocusSettled = false;
  var lastAutoFocused = null;

  function focusInitial() {
    if (autoFocusSettled) return;

    var active = currentFocus();
    if (active && active !== lastAutoFocused) {
      autoFocusSettled = true; // something else already claimed focus — leave it
      return;
    }

    // An explicit [autofocus] element (e.g. search.html's query box) always
    // wins outright — don't race it against the browser's own timing for
    // applying that attribute.
    var preferred = document.querySelector('[autofocus]') || document.querySelector('.hero-play-btn, .card, .cast-card');
    var target = preferred && isVisible(preferred) ? preferred : getFocusableElements()[0];
    if (target && target !== active) {
      target.focus();
      lastAutoFocused = target;
    }
    if (preferred) autoFocusSettled = true;
  }

  function handleBack() {
    var openDialog = document.querySelector('dialog[open]');
    if (openDialog) {
      openDialog.close();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (window.webOS && typeof window.webOS.platformBack === 'function') {
      window.webOS.platformBack();
    }
  }

  document.addEventListener('keydown', function (e) {
    var active = document.activeElement;
    var inTextField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');

    var direction = KEY_DIRECTIONS[e.key];
    if (direction) {
      if (inTextField && (direction === 'left' || direction === 'right')) return; // preserve text-cursor movement
      autoFocusSettled = true;
      var current = active && active !== document.body ? active : getFocusableElements()[0];
      if (!current) return;
      var next = findNext(current, direction);
      if (next) {
        e.preventDefault();
        next.focus();
        if (next.scrollIntoView) next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      }
      return;
    }

    if (e.key === 'Enter' && !inTextField) {
      var el = currentFocus();
      if (el && el.tagName !== 'A' && el.tagName !== 'BUTTON') {
        e.preventDefault();
        el.click();
      }
      return;
    }

    if (e.keyCode === 461 || e.key === 'Escape') {
      if (inTextField) return;
      e.preventDefault();
      handleBack();
    }
  });

  document.addEventListener('mousedown', function () {
    autoFocusSettled = true;
  });

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType === 1) markFocusable(node);
      });
    });
    focusInitial();
  });

  function init() {
    document.documentElement.classList.toggle('tv-mode', isWebOS());
    markFocusable(document);
    observer.observe(document.body, { childList: true, subtree: true });
    focusInitial();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
