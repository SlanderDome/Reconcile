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

  function formatDate(d) {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return String(d);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }

  function formatDateCompact(d) {
    if (!d) return '—';
    const date = new Date(d);
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

  /* ---------- AWB Normalization ---------- */
  function normalizeAWB(awb) {
    if (!awb) return '';
    return String(awb).trim().toUpperCase().replace(/[-\s]/g, '');
  }

  /* ---------- Status colors ---------- */
  const STATUS_COLORS = {
    'MATCHED':    { bg: 'rgba(0,108,78,0.1)',  text: '#006c4e', label: 'Matched' },
    'SHORT-PAID': { bg: 'rgba(163,103,0,0.1)', text: '#a36700', label: 'Short-paid' },
    'MISSING':    { bg: 'rgba(161,57,42,0.1)', text: '#a1392a', label: 'Missing' },
    'PENDING':    { bg: 'rgba(138,113,109,0.1)', text: '#8a716d', label: 'Pending' },
    'RESOLVED':   { bg: 'rgba(0,108,78,0.15)', text: '#006c4e', label: 'Resolved' }
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
    const headers = ['AWB', 'Order Date', 'City', 'Expected Amount'];
    const rows = [
      ['AWB-10001', '2024-10-15', 'San Francisco', '450.00'],
      ['AWB-10002', '2024-10-15', 'Austin', '1200.00'],
      ['AWB-10003', '2024-10-14', 'Seattle', '89.00'],
      ['AWB-10004', '2024-10-14', 'Chicago', '3240.00'],
      ['AWB-10005', '2024-10-13', 'Miami', '512.40'],
      ['AWB-10006', '2024-10-13', 'New York', '780.00'],
      ['AWB-10007', '2024-10-12', 'Denver', '1650.00'],
      ['AWB-10008', '2024-10-12', 'Portland', '320.00'],
      ['AWB-10009', '2024-10-11', 'Boston', '2100.00'],
      ['AWB-10010', '2024-10-11', 'Dallas', '945.00'],
    ];
    return arrayToCSV(headers, rows);
  }

  function generateSampleRemittanceCSV() {
    const headers = ['AWB', 'Remitted Amount', 'Settlement Date'];
    const rows = [
      ['AWB-10001', '450.00', '2024-10-18'],    // Matched
      ['AWB-10002', '1150.00', '2024-10-18'],   // Short-paid (gap $50, 4.2%)
      ['AWB-10003', '0', '2024-10-17'],          // Pending (remitted 0)
      ['AWB-10004', '3240.00', '2024-10-17'],   // Matched
      ['AWB-10005', '490.00', '2024-10-16'],    // Short-paid (gap $22.40, 4.4%)
      // AWB-10006 missing entirely               // Missing
      ['AWB-10007', '1650.00', '2024-10-15'],   // Matched
      ['AWB-10008', '280.00', '2024-10-15'],    // Short-paid (gap $40, 12.5%)
      // AWB-10009 missing entirely               // Missing
      ['AWB-10010', '945.00', '2024-10-14'],    // Matched
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
