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

    // Matched Orders card
    const matchedCount = document.getElementById('metric-matched-count');
    const matchedNote = document.getElementById('metric-matched-note');
    if (matchedCount) {
      App.animateValue(matchedCount, 0, s.countMatched, 600, (v) => Math.round(v).toLocaleString());
    }
    if (matchedNote) {
      const pct = s.totalOrders > 0 ? ((s.countMatched / s.totalOrders) * 100).toFixed(1) : 0;
      matchedNote.textContent = pct + '% match rate';
    }

    // Missing/Pending card
    const missingCount = document.getElementById('metric-missing-count');
    const missingNote = document.getElementById('metric-missing-note');
    if (missingCount) {
      const total = s.countMissing + s.countPending;
      App.animateValue(missingCount, 0, total, 600, (v) => Math.round(v).toLocaleString());
    }
    if (missingNote) {
      missingNote.textContent = 'Requires immediate action';
    }

    // Short-paid Gap card
    const shortpaidCount = document.getElementById('metric-shortpaid-count');
    const shortpaidNote = document.getElementById('metric-shortpaid-note');
    if (shortpaidCount) {
      App.animateValue(shortpaidCount, 0, s.totalShortPaidGap, 600, (v) => App.formatCurrency(v));
    }
    if (shortpaidNote) {
      shortpaidNote.textContent = 'Spread across ' + s.countShortPaid + ' orders';
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
