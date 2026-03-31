/* ============================================================
   Reconcile.ly — upload.js
   Drag-drop file upload, SheetJS parsing, column detection,
   currency auto-detection, cross-currency gating
   ============================================================ */

const Upload = (() => {
  let orderData = null;
  let remitData = null;
  let orderCols = null;
  let remitCols = null;
  let orderCurrency = null;   // detected: 'USD' | 'INR' | 'EUR' | 'GBP' | null
  let remitCurrency = null;   // detected: 'USD' | 'INR' | 'EUR' | 'GBP' | null
  let currencyMismatch = false;

  function init() {
    const zone1 = document.getElementById('dropzone-order');
    const zone2 = document.getElementById('dropzone-remit');
    const fileInput1 = document.getElementById('file-input-order');
    const fileInput2 = document.getElementById('file-input-remit');
    const runBtn = document.getElementById('btn-run-reconciliation');

    if (!zone1 || !zone2) return;

    // Sample file downloads
    const sampleOrder = document.getElementById('sample-order');
    const sampleRemit = document.getElementById('sample-remit');
    if (sampleOrder) {
      sampleOrder.addEventListener('click', (e) => {
        e.preventDefault();
        App.downloadCSV('sample_platform_transactions.csv', App.generateSampleOrderCSV());
      });
    }
    if (sampleRemit) {
      sampleRemit.addEventListener('click', (e) => {
        e.preventDefault();
        App.downloadCSV('sample_bank_settlement.csv', App.generateSampleRemittanceCSV());
      });
    }

    // Setup both zones
    setupDropZone(zone1, fileInput1, 'order');
    setupDropZone(zone2, fileInput2, 'remit');

    // Run button
    if (runBtn) {
      runBtn.addEventListener('click', runReconciliation);
    }

    // Clear buttons
    document.getElementById('clear-order')?.addEventListener('click', () => {
      orderData = null;
      orderCols = null;
      orderCurrency = null;
      resetZoneUI('order');
      updateCurrencyUI();
      updateRunButton();
    });
    document.getElementById('clear-remit')?.addEventListener('click', () => {
      remitData = null;
      remitCols = null;
      remitCurrency = null;
      resetZoneUI('remit');
      updateCurrencyUI();
      updateRunButton();
    });

    // Listen for changes on conversion rate input to re-check run button
    const rateInput = document.getElementById('input-conversion-rate');
    if (rateInput) {
      rateInput.addEventListener('input', updateRunButton);
    }

    // Listen for display currency change
    const currSelect = document.getElementById('select-display-currency');
    if (currSelect) {
      currSelect.addEventListener('change', updateRunButton);
    }

    updateRunButton();
  }

  function setupDropZone(zone, fileInput, type) {
    // Click to upload
    const dropArea = zone.querySelector('.drop-area');
    if (dropArea) {
      dropArea.addEventListener('click', () => fileInput.click());
    } else {
      zone.addEventListener('click', (e) => {
        if (e.target.closest('.uploaded-state')) return;
        fileInput.click();
      });
    }

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handleFile(e.target.files[0], type);
    });

    // Drag events
    zone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
    });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0], type);
    });
  }

  function handleFile(file, type) {
    const validTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
    ];
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext) && !validTypes.includes(file.type)) {
      alert('Please upload a CSV or XLSX file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (json.length === 0) {
          alert('The file appears to be empty.');
          return;
        }

        const headers = Object.keys(json[0]);

        if (type === 'order') {
          orderCols = Reconciler.detectOrderColumns(headers);
          if (!orderCols.awb) {
            alert('Could not detect Transaction ID column in the platform file. Please ensure a column named TransactionID, ID, AWB, or similar exists.');
            return;
          }
          if (!orderCols.amount) {
            alert('Could not detect Amount column in the platform file. Please ensure a column named Amount, Expected Amount, or similar exists.');
            return;
          }
          orderData = json;
          // Auto-detect currency from the amount column values
          orderCurrency = Reconciler.detectCurrency(json, orderCols.amount, headers);
          showUploadedState('order', file.name, json.length);
        } else {
          remitCols = Reconciler.detectRemittanceColumns(headers);
          if (!remitCols.awb) {
            alert('Could not detect Transaction ID column in the bank file. Please ensure a column named TransactionID, ID, AWB, or similar exists.');
            return;
          }
          if (!remitCols.amount) {
            alert('Could not detect Amount column in the bank file. Please ensure a column named Amount, Settlement Amount, or similar exists.');
            return;
          }
          remitData = json;
          // Auto-detect currency from the amount column values
          remitCurrency = Reconciler.detectCurrency(json, remitCols.amount, headers);
          showUploadedState('remit', file.name, json.length);
        }

        updateCurrencyUI();
        updateRunButton();
      } catch (err) {
        console.error('File parse error:', err);
        alert('Error parsing file: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function showUploadedState(type, filename, rowCount) {
    const emptyState = document.getElementById(`empty-state-${type}`);
    const uploadedState = document.getElementById(`uploaded-state-${type}`);
    const fnEl = document.getElementById(`filename-${type}`);
    const rcEl = document.getElementById(`rowcount-${type}`);

    if (emptyState) emptyState.style.display = 'none';
    if (uploadedState) uploadedState.style.display = 'flex';
    if (fnEl) fnEl.textContent = filename;
    if (rcEl) {
      const currLabel = (type === 'order' ? orderCurrency : remitCurrency);
      const suffix = currLabel ? ` · ${currLabel} detected` : '';
      rcEl.textContent = rowCount.toLocaleString() + ' rows identified' + suffix;
    }
  }

  function resetZoneUI(type) {
    const emptyState = document.getElementById(`empty-state-${type}`);
    const uploadedState = document.getElementById(`uploaded-state-${type}`);

    if (emptyState) emptyState.style.display = '';
    if (uploadedState) uploadedState.style.display = 'none';
  }

  /* ---------- Currency UI Logic ---------- */
  function updateCurrencyUI() {
    const mismatchBanner = document.getElementById('currency-mismatch-banner');
    const undetectedBanner = document.getElementById('currency-undetected-banner');
    const settingsPanel = document.getElementById('currency-settings');
    const currSelect = document.getElementById('select-display-currency');
    const rateInput = document.getElementById('input-conversion-rate');

    // Hide everything by default
    if (mismatchBanner) mismatchBanner.style.display = 'none';
    if (undetectedBanner) undetectedBanner.style.display = 'none';
    if (settingsPanel) settingsPanel.style.display = 'none';
    currencyMismatch = false;

    const hasAny = orderData || remitData;
    const hasBoth = orderData && remitData;

    if (!hasAny) return;

    // Show the settings panel whenever at least one file is uploaded
    if (settingsPanel) settingsPanel.style.display = 'block';

    if (hasBoth) {
      if (orderCurrency && remitCurrency) {
        if (orderCurrency !== remitCurrency) {
          // MISMATCH
          currencyMismatch = true;
          if (mismatchBanner) {
            mismatchBanner.style.display = 'block';
            const olabel = document.getElementById('currency-order-label');
            const rlabel = document.getElementById('currency-remit-label');
            if (olabel) olabel.textContent = orderCurrency;
            if (rlabel) rlabel.textContent = remitCurrency;
          }
          // Auto-select the remittance currency as the display currency
          // (since remittance is what the courier actually paid, that's the "real" currency)
          if (currSelect) currSelect.value = remitCurrency;
        } else {
          // MATCH — both detected and same
          if (currSelect) currSelect.value = orderCurrency;
        }
      } else if (!orderCurrency && !remitCurrency) {
        // Neither detected
        if (undetectedBanner) undetectedBanner.style.display = 'block';
      } else {
        // One detected, one not — show soft notice
        if (undetectedBanner) undetectedBanner.style.display = 'block';
        // Pre-select the one we know about
        const known = orderCurrency || remitCurrency;
        if (currSelect && known) currSelect.value = known;
      }
    } else {
      // Only one file uploaded — pre-select if detected
      const known = orderCurrency || remitCurrency;
      if (currSelect && known) currSelect.value = known;
    }
  }

  function updateRunButton() {
    const runBtn = document.getElementById('btn-run-reconciliation');
    const statusText = document.getElementById('status-text');
    const rateInput = document.getElementById('input-conversion-rate');

    if (!runBtn) return;

    const hasBoth = orderData && remitData;
    const rate = rateInput ? parseFloat(rateInput.value) : 1;
    const rateIsDefault = !rate || rate === 1;

    // Block if currencies mismatch but user hasn't set a non-1.0 rate
    const blockedByMismatch = currencyMismatch && rateIsDefault;

    const ready = hasBoth && !blockedByMismatch;
    runBtn.disabled = !ready;
    runBtn.style.opacity = ready ? '1' : '0.4';
    runBtn.style.pointerEvents = ready ? 'auto' : 'none';

    if (statusText) {
      if (blockedByMismatch) {
        statusText.textContent = 'Enter a conversion rate to reconcile across different currencies.';
      } else if (hasBoth) {
        const total = orderData.length + remitData.length;
        statusText.textContent = `Both sources matched. Ready to analyze ${total.toLocaleString()} data points.`;
      } else if (orderData) {
        statusText.textContent = 'Platform transactions loaded. Upload the bank settlement to continue.';
      } else if (remitData) {
        statusText.textContent = 'Bank settlement loaded. Upload the platform transactions to continue.';
      } else {
        statusText.textContent = 'Upload both files to begin reconciliation.';
      }
    }
  }

  function runReconciliation() {
    if (!orderData || !remitData) return;

    const runBtn = document.getElementById('btn-run-reconciliation');
    if (runBtn) {
      runBtn.textContent = 'Processing...';
      runBtn.disabled = true;
    }

    // Read user settings
    const rateInput = document.getElementById('input-conversion-rate');
    const currSelect = document.getElementById('select-display-currency');
    const orderMultiplier = rateInput ? parseFloat(rateInput.value) || 1 : 1;
    const displayCurrency = currSelect ? currSelect.value : 'USD';

    // Small delay for UI feedback
    setTimeout(() => {
      try {
        const result = Reconciler.reconcile(orderData, remitData, orderCols, remitCols, {
          orderMultiplier,
          displayCurrency,
        });
        App.saveSession(result);
        window.location.href = 'dashboard.html';
      } catch (err) {
        console.error('Reconciliation error:', err);
        alert('Reconciliation failed: ' + err.message);
        if (runBtn) {
          runBtn.textContent = 'Run Reconciliation';
          runBtn.disabled = false;
        }
      }
    }, 100);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', Upload.init);
