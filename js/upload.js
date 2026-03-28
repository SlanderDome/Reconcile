/* ============================================================
   Reconcile.ly — upload.js
   Drag-drop file upload, SheetJS parsing, column detection
   ============================================================ */

const Upload = (() => {
  let orderData = null;
  let remitData = null;
  let orderCols = null;
  let remitCols = null;

  function init() {
    const zone1 = document.getElementById('dropzone-order');
    const zone2 = document.getElementById('dropzone-remit');
    const fileInput1 = document.getElementById('file-input-order');
    const fileInput2 = document.getElementById('file-input-remit');
    const runBtn = document.getElementById('btn-run-reconciliation');
    const statusText = document.getElementById('status-text');

    if (!zone1 || !zone2) return;

    // Sample file downloads
    const sampleOrder = document.getElementById('sample-order');
    const sampleRemit = document.getElementById('sample-remit');
    if (sampleOrder) {
      sampleOrder.addEventListener('click', (e) => {
        e.preventDefault();
        App.downloadCSV('sample_order_export.csv', App.generateSampleOrderCSV());
      });
    }
    if (sampleRemit) {
      sampleRemit.addEventListener('click', (e) => {
        e.preventDefault();
        App.downloadCSV('sample_remittance.csv', App.generateSampleRemittanceCSV());
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
      resetZoneUI('order');
      updateRunButton();
    });
    document.getElementById('clear-remit')?.addEventListener('click', () => {
      remitData = null;
      remitCols = null;
      resetZoneUI('remit');
      updateRunButton();
    });

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
            alert('Could not detect AWB/Tracking column in the order file. Please ensure a column named AWB, Tracking Number, or similar exists.');
            return;
          }
          if (!orderCols.amount) {
            alert('Could not detect Amount column in the order file. Please ensure a column named Expected Amount, Order Value, Amount, or similar exists.');
            return;
          }
          orderData = json;
          showUploadedState('order', file.name, json.length);
        } else {
          remitCols = Reconciler.detectRemittanceColumns(headers);
          if (!remitCols.awb) {
            alert('Could not detect AWB/Tracking column in the remittance file. Please ensure a column named AWB, Tracking Number, or similar exists.');
            return;
          }
          if (!remitCols.amount) {
            alert('Could not detect Amount column in the remittance file. Please ensure a column named Remitted Amount, Amount, Payout, or similar exists.');
            return;
          }
          remitData = json;
          showUploadedState('remit', file.name, json.length);
        }

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
    if (rcEl) rcEl.textContent = rowCount.toLocaleString() + ' rows identified';
  }

  function resetZoneUI(type) {
    const emptyState = document.getElementById(`empty-state-${type}`);
    const uploadedState = document.getElementById(`uploaded-state-${type}`);

    if (emptyState) emptyState.style.display = '';
    if (uploadedState) uploadedState.style.display = 'none';
  }

  function updateRunButton() {
    const runBtn = document.getElementById('btn-run-reconciliation');
    const statusText = document.getElementById('status-text');

    if (!runBtn) return;

    const ready = orderData && remitData;
    runBtn.disabled = !ready;
    runBtn.style.opacity = ready ? '1' : '0.4';
    runBtn.style.pointerEvents = ready ? 'auto' : 'none';

    if (statusText) {
      if (ready) {
        const total = orderData.length + remitData.length;
        statusText.textContent = `Both sources matched. Ready to analyze ${total.toLocaleString()} data points.`;
      } else if (orderData) {
        statusText.textContent = 'Order export loaded. Upload the remittance file to continue.';
      } else if (remitData) {
        statusText.textContent = 'Remittance file loaded. Upload the order export to continue.';
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

    // Small delay for UI feedback
    setTimeout(() => {
      try {
        const result = Reconciler.reconcile(orderData, remitData, orderCols, remitCols);
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
