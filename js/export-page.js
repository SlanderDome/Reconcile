/* ============================================================
   Reconcile.ly — export-page.js
   Export page: summary stats, CSV download, session management
   ============================================================ */

const ExportPage = (() => {
  function init() {
    const session = App.loadSession();

    if (!session || !session.summary) {
      // No data
      const headline = document.getElementById('export-headline');
      if (headline) headline.innerHTML = 'No Data<br><span style="color:#a1392a; font-style:italic;">Available</span>';
      return;
    }

    const s = session.summary;

    // Populate summary stats
    const matchedEl = document.getElementById('export-matched');
    const missingEl = document.getElementById('export-missing');
    const shortpaidEl = document.getElementById('export-shortpaid');

    if (matchedEl) App.animateValue(matchedEl, 0, s.totalMatched, 600, (v) => App.formatCurrency(v));
    if (missingEl) App.animateValue(missingEl, 0, s.totalMissing, 600, (v) => App.formatCurrency(v));
    if (shortpaidEl) App.animateValue(shortpaidEl, 0, s.totalShortPaidGap, 600, (v) => App.formatCurrency(v));

    // Session ID
    const sessionEl = document.getElementById('export-session-id');
    if (sessionEl) sessionEl.textContent = s.sessionId || App.generateSessionId();

    // Timestamp
    const timestampEl = document.getElementById('export-timestamp');
    if (timestampEl) {
      const d = new Date(s.timestamp || Date.now());
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      timestampEl.textContent = `${y}.${m}.${day} // ${h}:${min} UTC`;
    }

    // Download button
    const downloadBtn = document.getElementById('btn-download-report');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        const discrepancies = session.results.filter(r => r.status === 'SHORT-PAID' || r.status === 'MISSING');
        const headers = ['AWB', 'Order Date', 'City', 'Expected', 'Remitted', 'Gap', 'Status'];
        const rows = discrepancies.map(r => [
          r.awb,
          r.orderDate || '',
          r.city,
          r.orderValue.toFixed(2),
          r.remittedAmount.toFixed(2),
          r.gap.toFixed(2),
          r.status
        ]);
        const csv = App.arrayToCSV(headers, rows);
        App.downloadCSV('discrepancy_report_' + (s.sessionId || 'export') + '.csv', csv);
      });
    }

    // New reconciliation button
    const newBtn = document.getElementById('btn-new-reconciliation');
    if (newBtn) {
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        App.clearSession();
        window.location.href = 'index.html';
      });
    }
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', ExportPage.init);
