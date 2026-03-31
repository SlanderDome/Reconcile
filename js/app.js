/* ============================================================
   Reconcile.ly — app.js
   Global utilities, localStorage helpers, formatting
   ============================================================ */

const App = (() => {
  const STORAGE_KEY = 'reconcile_last_session';

  /* ---------- localStorage ---------- */
  function saveSession(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('localStorage write failed', e);
    }
  }

  function loadSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('localStorage read failed', e);
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /* ---------- Formatting ---------- */
  const CURRENCY_SYMBOLS = {
    USD: '$',
    INR: '₹',
    EUR: '€',
    GBP: '£',
  };

  const CURRENCY_LABELS = {
    USD: 'US Dollar',
    INR: 'Indian Rupee',
    EUR: 'Euro',
    GBP: 'British Pound',
  };

  /**
   * Returns the display currency from the last saved session, or 'USD' as default.
   */
  function getDisplayCurrency() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data && data.summary && data.summary.displayCurrency) {
          return data.summary.displayCurrency;
        }
      }
    } catch (_) {}
    return 'USD';
  }

  function formatCurrency(n) {
    const cur = getDisplayCurrency();
    const sym = CURRENCY_SYMBOLS[cur] || '$';
    if (n == null || isNaN(n)) return sym + '0.00';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';

    if (cur === 'INR') {
      // Indian numbering: Crores (1,00,00,000) and Lakhs (1,00,000)
      if (abs >= 1_00_00_000) return sign + sym + (abs / 1_00_00_000).toFixed(2) + 'Cr';
      if (abs >= 1_00_000) return sign + sym + (abs / 1_00_000).toFixed(2) + 'L';
      return sign + sym + abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    // Western formatting (USD, EUR, GBP)
    if (abs >= 1_000_000) return sign + sym + (abs / 1_000_000).toFixed(1) + 'M';
    if (abs >= 100_000) return sign + sym + (abs / 1_000).toFixed(1) + 'K';
    return sign + sym + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatCurrencyFull(n) {
    const cur = getDisplayCurrency();
    const sym = CURRENCY_SYMBOLS[cur] || '$';
    if (n == null || isNaN(n)) return sym + '0.00';
    const sign = n < 0 ? '-' : '';
    const locale = cur === 'INR' ? 'en-IN' : 'en-US';
    return sign + sym + Math.abs(n).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function parseDate(dateStr) {
    if (!dateStr) return 'Unknown';
    const str = String(dateStr).trim();
    
    // Handle YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [y, m, d] = str.split('-');
      return new Date(y, m - 1, d);
    }
    // Handle DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      const [d, m, y] = str.split('/');
      return new Date(y, m - 1, d);
    }
    // Handle MM/DD/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      return new Date(str);
    }
    return new Date(str);
  }

  function formatDate(d) {
    if (!d) return '—';
    const date = parseDate(d);
    if (isNaN(date.getTime())) return String(d);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function formatDateCompact(d) {
    if (!d) return '—';
    const date = parseDate(d);
    if (isNaN(date.getTime())) return String(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }

  function formatPercent(n) {
    if (n == null || isNaN(n)) return '0%';
    return (n * 100).toFixed(1) + '%';
  }

  /* ---------- Count-up Animation ---------- */
  function animateValue(el, start, end, duration, formatter) {
    const range = end - start;
    const startTime = performance.now();
    const fmt = formatter || ((v) => Math.round(v).toLocaleString());

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const current = start + range * eased;
      el.textContent = fmt(current);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- Session ID ---------- */
  function generateSessionId() {
    const num = Math.floor(1000 + Math.random() * 9000);
    return 'REC_' + num;
  }

  /* ---------- Transaction ID Normalization ---------- */
  function normalizeAWB(id) {
    if (!id) return '';
    return String(id).trim().toUpperCase().replace(/[-\s]/g, '');
  }

  /* ---------- Status colors ---------- */
  const STATUS_COLORS = {
    'MATCHED':         { bg: 'rgba(0,108,78,0.1)',   text: '#006c4e', label: 'Matched' },
    'TIMING GAP':      { bg: 'rgba(161,57,42,0.1)',  text: '#a1392a', label: 'Timing Gap' },
    'DUPLICATE':       { bg: 'rgba(163,103,0,0.1)',  text: '#a36700', label: 'Duplicate' },
    'ROUNDING':        { bg: 'rgba(138,113,109,0.1)',text: '#8a716d', label: 'Rounding' },
    'ORPHANED REFUND': { bg: 'rgba(128,0,128,0.1)',  text: '#800080', label: 'Orphaned Refund' },
    'RESOLVED':        { bg: 'rgba(0,108,78,0.15)',  text: '#006c4e', label: 'Resolved' }
  };

  /* ---------- CSV Generation ---------- */
  function arrayToCSV(headers, rows) {
    const escape = (v) => {
      const s = String(v == null ? '' : v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    };
    const lines = [headers.map(escape).join(',')];
    rows.forEach(r => lines.push(r.map(escape).join(',')));
    return lines.join('\n');
  }

  function downloadCSV(filename, csvContent) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ---------- Sample Data Generation ---------- */
  function generateSampleOrderCSV() {
    const headers = ['TransactionID', 'Date', 'Amount', 'Customer'];
    const rows = [
      ['MAT-001', '2024-10-01', '100.00', 'Perfect1'],
      ['MAT-002', '2024-10-02', '200.00', 'Perfect2'],
      ['MAT-003', '2024-10-03', '300.00', 'Perfect3'],
      ['MAT-004', '2024-10-04', '400.00', 'Perfect4'],
      ['MAT-005', '2024-10-05', '500.00', 'Perfect5'],
      ['TXN-001', '2024-10-31', '5000.00', 'TimingGapUser'],
      ['RND-001', '2024-10-15', '100.001', 'RounderUser1'],
      ['RND-002', '2024-10-15', '100.001', 'RounderUser2'],
      ['RND-003', '2024-10-15', '100.001', 'RounderUser3'],
      ['TXN-005', '2024-10-20', '2500.00', 'DuplicateUser'],
      ['REF-001', '2024-10-25', '-1500.00', 'OrphanRefundUser'],
    ];
    return arrayToCSV(headers, rows);
  }

  function generateSampleRemittanceCSV() {
    const headers = ['TransactionID', 'SettlementDate', 'Amount'];
    const rows = [
      ['MAT-001', '2024-10-03', '100.00'],
      ['MAT-002', '2024-10-04', '200.00'],
      ['MAT-003', '2024-10-05', '300.00'],
      ['MAT-004', '2024-10-06', '400.00'],
      ['MAT-005', '2024-10-07', '500.00'],
      // TXN-001 is deliberately missing from bank file (Timing Gap)
      ['RND-001', '2024-10-17', '100.00'],
      ['RND-002', '2024-10-17', '100.00'],
      ['RND-003', '2024-10-17', '100.00'],
      ['TXN-005', '2024-10-22', '2500.00'],
      ['TXN-005', '2024-10-22', '2500.00'], // The duplicate
      // REF-001 is missing from bank file (Orphaned Refund)
    ];
    return arrayToCSV(headers, rows);
  }

  return {
    STORAGE_KEY,
    CURRENCY_SYMBOLS,
    CURRENCY_LABELS,
    saveSession,
    loadSession,
    clearSession,
    getDisplayCurrency,
    formatCurrency,
    formatCurrencyFull,
    formatDate,
    formatDateCompact,
    formatPercent,
    animateValue,
    generateSessionId,
    normalizeAWB,
    STATUS_COLORS,
    arrayToCSV,
    downloadCSV,
    generateSampleOrderCSV,
    generateSampleRemittanceCSV,
  };
})();
