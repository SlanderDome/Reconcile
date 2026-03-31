/* ============================================================
   Reconcile.ly — dashboard.js
   Metrics, sub-view switching, count-up animation
   ============================================================ */

const Dashboard = (() => {
  let session = null;

  function init() {
    session = App.loadSession();

    if (!session || !session.results) {
      // No data — show empty state or redirect
      const emptyMsg = document.getElementById('empty-dashboard');
      if (emptyMsg) emptyMsg.style.display = 'flex';
      return;
    }

    // Hide empty state
    const emptyMsg = document.getElementById('empty-dashboard');
    if (emptyMsg) emptyMsg.style.display = 'none';

    populateMetrics();
    setupSubViewSwitching();
    Table.init(session.results);
    Anomalies.init(session.results, session.summary);

    // Show overview by default
    switchView('overview');
  }

  function populateMetrics() {
    const s = session.summary;

    // Card 1 — Matched Transactions
    const matchedCount = document.getElementById('metric-matched-count');
    const matchedNote = document.getElementById('metric-matched-note');
    if (matchedCount) {
      App.animateValue(matchedCount, 0, s.countMatched, 600, (v) => Math.round(v).toLocaleString());
    }
    if (matchedNote) {
      const pct = s.totalOrders > 0 ? ((s.countMatched / s.totalOrders) * 100).toFixed(1) : 0;
      matchedNote.textContent = pct + '% match rate';
    }

    // Card 2 — Timing Gaps
    const missingCount = document.getElementById('metric-missing-count');
    const missingNote = document.getElementById('metric-missing-note');
    if (missingCount) {
      App.animateValue(missingCount, 0, s.countTimingGap || 0, 600, (v) => Math.round(v).toLocaleString());
    }
    if (missingNote) {
      missingNote.textContent = App.formatCurrency(s.totalTimingGap || 0) + ' unmatched';
    }

    // Card 3 — Rounding Differences
    const shortpaidCount = document.getElementById('metric-shortpaid-count');
    const shortpaidNote = document.getElementById('metric-shortpaid-note');
    if (shortpaidCount) {
      App.animateValue(shortpaidCount, 0, s.totalRoundingGap || 0, 600, (v) => App.formatCurrency(v));
    }
    if (shortpaidNote) {
      shortpaidNote.textContent = 'Across ' + (s.countRounding || 0) + ' transactions';
    }

    // Card 4 — Duplicates & Orphaned Refunds
    const duporphanCount = document.getElementById('metric-duporphan-count');
    const duporphanNote = document.getElementById('metric-duporphan-note');
    if (duporphanCount) {
      const total = (s.countDuplicate || 0) + (s.countOrphanedRefund || 0);
      App.animateValue(duporphanCount, 0, total, 600, (v) => Math.round(v).toLocaleString());
    }
    if (duporphanNote) {
      duporphanNote.textContent = (s.countDuplicate || 0) + ' duplicates, ' + (s.countOrphanedRefund || 0) + ' orphans';
    }

    // Total Unreconciled Value banner (static card)
    const unreconciledEl = document.getElementById('metric-unreconciled-value');
    const unreconciledNote = document.getElementById('metric-unreconciled-note');
    if (unreconciledEl) {
      const totalUnreconciled = (s.totalRoundingGap || 0) +
                                 (s.totalDuplicateGap || 0) + (s.totalOrphanedRefund || 0);
      App.animateValue(unreconciledEl, 0, totalUnreconciled, 800, (v) => App.formatCurrency(v));
      if (unreconciledNote) {
        const totalCount = (s.countRounding || 0) +
                           (s.countDuplicate || 0) + (s.countOrphanedRefund || 0);
        unreconciledNote.textContent = 'Across ' + totalCount + ' discrepancies (excluding timing gaps)';
      }
    }

    // Recovery / Unreconciled Amount Banner
    const recoveryBanner = document.getElementById('recovery-banner');
    const recoveryValue = document.getElementById('recovery-value');
    if (recoveryBanner && recoveryValue && typeof Claims !== 'undefined') {
      const totalRecovery = Claims.getRecoveryTotal(session.results);
      if (totalRecovery > 0) {
        recoveryBanner.style.display = '';
        App.animateValue(recoveryValue, 0, totalRecovery, 900, (v) => App.formatCurrencyFull(v));

        const discrepancies = Claims.getDiscrepancies(session.results);
        const sub = recoveryBanner.querySelector('.recovery-banner-sub');
        if (sub) sub.textContent = `across ${discrepancies.length} discrepancies — ready to investigate today`;
      } else {
        recoveryBanner.style.display = 'none';
      }
    }
  }

  function setupSubViewSwitching() {
    const navItems = document.querySelectorAll('[data-view]');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const view = item.dataset.view;
        switchView(view);
      });
    });
  }

  function switchView(viewName) {
    // Update nav active state
    const navItems = document.querySelectorAll('[data-view]');
    navItems.forEach(item => {
      if (item.dataset.view === viewName) {
        item.classList.add('nav-active');
        item.classList.remove('nav-inactive');
      } else {
        item.classList.remove('nav-active');
        item.classList.add('nav-inactive');
      }
    });

    // Show/hide content sections
    const views = document.querySelectorAll('[data-content]');
    views.forEach(view => {
      view.style.display = view.dataset.content === viewName ? '' : 'none';
    });

    // Update page title
    const titleEl = document.getElementById('page-title');
    const titles = {
      'overview': 'Dashboard Overview',
      'transactions': 'Transactions',
      'anomalies': 'Integrity Gaps',
      'settings': 'System Configuration',
    };
    if (titleEl) titleEl.textContent = titles[viewName] || viewName;
  }

  return { init, switchView };
})();

document.addEventListener('DOMContentLoaded', Dashboard.init);
