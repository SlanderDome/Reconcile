/* ============================================================
   Reconcile.ly — table.js
   Sortable, filterable, searchable, paginated data table
   ============================================================ */

const Table = (() => {
  let allData = [];
  let filteredData = [];
  let currentPage = 1;
  let pageSize = 15;
  let sortColumn = null;
  let sortDirection = 'asc';
  let searchQuery = '';
  let statusFilter = 'all';

  function init(data) {
    allData = data;
    filteredData = [...data];

    // Search input
    const searchInput = document.getElementById('table-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        currentPage = 1;
        applyFilters();
      });
    }

    // Status filter tabs
    const filterBtns = document.querySelectorAll('[data-filter]');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        statusFilter = btn.dataset.filter;
        currentPage = 1;
        // Update active tab style
        filterBtns.forEach(b => {
          b.classList.toggle('filter-active', b.dataset.filter === statusFilter);
          b.classList.toggle('filter-inactive', b.dataset.filter !== statusFilter);
        });
        applyFilters();
      });
    });

    // Export CSV button
    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportFilteredCSV);
    }

    applyFilters();
  }

  function applyFilters() {
    filteredData = allData.filter(row => {
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'shortpaid' && row.status !== 'SHORT-PAID') return false;
        if (statusFilter === 'matched' && row.status !== 'MATCHED') return false;
        if (statusFilter === 'missing' && row.status !== 'MISSING') return false;
        if (statusFilter === 'pending' && row.status !== 'PENDING') return false;
      }

      // Search filter
      if (searchQuery) {
        const q = searchQuery;
        const haystack = [
          row.awb,
          row.city,
          row.status,
          App.formatCurrencyFull(row.orderValue),
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });

    // Apply sort
    if (sortColumn) {
      filteredData.sort((a, b) => {
        let va = a[sortColumn];
        let vb = b[sortColumn];
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();
        if (va < vb) return sortDirection === 'asc' ? -1 : 1;
        if (va > vb) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    renderTable();
    renderPagination();
  }

  function renderTable() {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;

    const start = (currentPage - 1) * pageSize;
    const pageData = filteredData.slice(start, start + pageSize);

    if (pageData.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center; padding:3rem; color:#8a716d; font-family:'JetBrains Mono',monospace; font-size:0.75rem;">
            No records match your current filters.
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = pageData.map((row, idx) => {
      const sc = row.resolved ? App.STATUS_COLORS['RESOLVED'] : (App.STATUS_COLORS[row.status] || App.STATUS_COLORS['PENDING']);
      const isClickable = row.status === 'SHORT-PAID' || row.status === 'MISSING' || row.status === 'PENDING';
      const resolvedClass = row.resolved ? 'opacity:0.55;' : '';
      const gapColor = row.gap > 0 ? '#a1392a' : (row.gap === 0 ? '#006c4e' : '#1b1c1a');
      const gapDisplay = row.gap > 0 ? '-' + App.formatCurrencyFull(row.gap) : App.formatCurrencyFull(0);

      return `
        <tr class="table-row" style="cursor:${isClickable ? 'pointer' : 'default'}; ${resolvedClass}"
            data-idx="${start + idx}" ${isClickable ? 'onclick="DetailPanel.open(' + (start + idx) + ')"' : ''}>
          <td class="td-awb">${row.awb}</td>
          <td class="td-date">${App.formatDate(row.orderDate)}</td>
          <td class="td-city">${row.city}</td>
          <td class="td-amount">${App.formatCurrencyFull(row.orderValue)}</td>
          <td class="td-amount">${App.formatCurrencyFull(row.remittedAmount)}</td>
          <td class="td-amount" style="color:${gapColor}">${row.status === 'MATCHED' ? '$0.00' : gapDisplay}</td>
          <td class="td-status">
            <span class="status-pill" style="background:${sc.bg};color:${sc.text}">
              ${sc.label}
            </span>
          </td>
        </tr>`;
    }).join('');
  }

  function renderPagination() {
    const container = document.getElementById('pagination');
    if (!container) return;

    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
    const showing = document.getElementById('pagination-info');
    if (showing) {
      const start = Math.min((currentPage - 1) * pageSize + 1, filteredData.length);
      const end = Math.min(currentPage * pageSize, filteredData.length);
      showing.textContent = `Showing ${start}-${end} of ${filteredData.length.toLocaleString()} entries`;
    }

    const paginationBtns = document.getElementById('pagination-buttons');
    if (!paginationBtns) return;

    let html = '';
    // Prev button
    html += `<button class="pg-btn" ${currentPage <= 1 ? 'disabled' : ''} onclick="Table.goToPage(${currentPage - 1})">
      <span class="material-symbols-outlined" style="font-size:16px">chevron_left</span>
    </button>`;

    // Page numbers
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);

    for (let i = startPage; i <= endPage; i++) {
      html += `<button class="pg-btn ${i === currentPage ? 'pg-active' : ''}" onclick="Table.goToPage(${i})">${i}</button>`;
    }

    // Next button
    html += `<button class="pg-btn" ${currentPage >= totalPages ? 'disabled' : ''} onclick="Table.goToPage(${currentPage + 1})">
      <span class="material-symbols-outlined" style="font-size:16px">chevron_right</span>
    </button>`;

    paginationBtns.innerHTML = html;
  }

  function goToPage(page) {
    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
    currentPage = Math.max(1, Math.min(page, totalPages));
    renderTable();
    renderPagination();
  }

  function sortBy(column) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
    applyFilters();
  }

  function getDataByIndex(idx) {
    return allData[idx] || null;
  }

  function markResolved(idx) {
    if (allData[idx]) {
      allData[idx].resolved = true;
      allData[idx].status = 'MATCHED';
      // Update localStorage
      const session = App.loadSession();
      if (session) {
        session.results = allData;
        App.saveSession(session);
      }
      applyFilters();
    }
  }

  function exportFilteredCSV() {
    const headers = ['AWB', 'Order Date', 'City', 'Expected', 'Remitted', 'Gap', 'Status'];
    const rows = filteredData.map(r => [
      r.awb, r.orderDate || '', r.city,
      r.orderValue.toFixed(2), r.remittedAmount.toFixed(2),
      r.gap.toFixed(2), r.status
    ]);
    const csv = App.arrayToCSV(headers, rows);
    App.downloadCSV('reconcile_filtered_export.csv', csv);
  }

  return { init, goToPage, sortBy, getDataByIndex, markResolved, applyFilters };
})();
