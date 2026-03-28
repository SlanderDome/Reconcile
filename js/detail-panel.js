/* ============================================================
   Reconcile.ly — detail-panel.js
   Slide-in comparison panel for individual AWB records
   ============================================================ */

const DetailPanel = (() => {
  let currentIdx = null;

  function open(idx) {
    const row = Table.getDataByIndex(idx);
    if (!row) return;
    currentIdx = idx;

    const panel = document.getElementById('detail-panel');
    const backdrop = document.getElementById('detail-backdrop');
    if (!panel || !backdrop) return;

    // Populate left column — Order Record
    setText('detail-awb', row.awb);
    setText('detail-order-value', App.formatCurrencyFull(row.orderValue));
    setText('detail-order-date', App.formatDate(row.orderDate));
    setText('detail-order-city', row.city);
    setText('detail-courier', row.courier || 'Auto-detected');

    // Populate right column — Settlement Data
    setText('detail-ref-id', row.awb.replace('AWB', 'ST') + '-S');
    setText('detail-remitted', App.formatCurrencyFull(row.remittedAmount));

    // Delta card
    const deltaCard = document.getElementById('detail-delta-card');
    const deltaAmount = document.getElementById('detail-delta-amount');
    const deltaDesc = document.getElementById('detail-delta-desc');

    if (deltaCard && deltaAmount && deltaDesc) {
      const gap = row.gap;
      const gapPct = row.gapPercent;
      deltaAmount.textContent = '-' + App.formatCurrencyFull(gap);

      if (Math.abs(gapPct) >= 0.02 && gap > 0) {
        deltaDesc.textContent = `The payout is ${(gapPct * 100).toFixed(1)}% lower than the original order value. Discrepancy exceeds the allowable 2% threshold.`;
        deltaCard.style.display = '';
      } else if (row.status === 'MISSING') {
        deltaDesc.textContent = 'No matching remittance record found for this AWB. Full order value is unaccounted for.';
        deltaCard.style.display = '';
      } else {
        deltaCard.style.display = 'none';
      }
    }

    // Fee breakdown (estimated)
    const gap = row.gap;
    if (gap > 0) {
      const baseFee = Math.round(gap * 0.52 * 100) / 100;
      const fuelSurcharge = Math.round(gap * 0.15 * 100) / 100;
      const unexplained = Math.round((gap - baseFee - fuelSurcharge) * 100) / 100;
      setText('detail-base-fee', App.formatCurrencyFull(baseFee));
      setText('detail-fuel-surcharge', App.formatCurrencyFull(fuelSurcharge));
      setText('detail-unexplained-gap', App.formatCurrencyFull(unexplained));
    } else {
      setText('detail-base-fee', '$0.00');
      setText('detail-fuel-surcharge', '$0.00');
      setText('detail-unexplained-gap', '$0.00');
    }

    // Status
    const statusEl = document.getElementById('detail-status');
    if (statusEl) {
      const sc = row.resolved ? App.STATUS_COLORS['RESOLVED'] : App.STATUS_COLORS[row.status];
      if (sc) {
        statusEl.textContent = sc.label;
        statusEl.style.background = sc.bg;
        statusEl.style.color = sc.text;
      }
    }

    // Audit metadata
    setText('detail-audit-hash', '0x' + Math.random().toString(16).slice(2, 6) + '...' + Math.random().toString(16).slice(2, 6));
    setText('detail-sync-time', new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC');

    // Resolve button state
    const resolveBtn = document.getElementById('btn-mark-resolved');
    if (resolveBtn) {
      if (row.resolved) {
        resolveBtn.textContent = '✓ Resolved';
        resolveBtn.disabled = true;
        resolveBtn.style.opacity = '0.5';
      } else {
        resolveBtn.innerHTML = 'Mark as resolved';
        resolveBtn.disabled = false;
        resolveBtn.style.opacity = '1';
      }
    }

    // Show panel with animation
    backdrop.style.display = 'block';
    panel.style.display = 'flex';
    requestAnimationFrame(() => {
      backdrop.classList.add('visible');
      panel.classList.add('visible');
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';
  }

  function close() {
    const panel = document.getElementById('detail-panel');
    const backdrop = document.getElementById('detail-backdrop');
    if (!panel || !backdrop) return;

    backdrop.classList.remove('visible');
    panel.classList.remove('visible');

    setTimeout(() => {
      backdrop.style.display = 'none';
      panel.style.display = 'none';
      document.body.style.overflow = '';
    }, 300);

    currentIdx = null;
  }

  function markResolved() {
    if (currentIdx == null) return;
    Table.markResolved(currentIdx);

    const resolveBtn = document.getElementById('btn-mark-resolved');
    if (resolveBtn) {
      resolveBtn.textContent = '✓ Resolved';
      resolveBtn.disabled = true;
      resolveBtn.style.opacity = '0.5';
    }
  }

  function copyAWB() {
    if (currentIdx == null) return;
    const row = Table.getDataByIndex(currentIdx);
    if (!row) return;

    navigator.clipboard.writeText(row.awb).then(() => {
      const btn = document.getElementById('btn-copy-awb');
      if (btn) {
        const original = btn.innerHTML;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">check</span> Copied!';
        setTimeout(() => { btn.innerHTML = original; }, 1500);
      }
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = row.awb;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val || '—';
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  return { open, close, markResolved, copyAWB };
})();
