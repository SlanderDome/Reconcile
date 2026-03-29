/* ============================================================
   Reconcile.ly — claims.js
   Claims generator: modal, email templates, bulk ZIP export
   ============================================================ */

const Claims = (() => {

  /* ---------- Constants ---------- */
  const SELLER_NAME_KEY = 'reconcile_seller_name';
  const CLAIMS_KEY     = 'claims_generated';

  const COURIER_OPTIONS = [
    'Shiprocket', 'Delhivery', 'Ekart', 'Borzo',
    'BlueDart', 'FedEx', 'Xpressbees', 'Shadowfax', 'Other'
  ];

  const COURIER_EMAILS = {
    'Shiprocket':  'support@shiprocket.in',
    'Delhivery':   'support@delhivery.com',
    'Ekart':       'ekart.support@flipkart.com',
    'Borzo':       'support@borzo.com',
    'BlueDart':    'customerservice@bluedart.com',
    'FedEx':       'customer.relations@fedex.com',
    'Xpressbees':  'support@xpressbees.com',
    'Shadowfax':   'support@shadowfax.in',
  };

  /* ---------- localStorage Helpers ---------- */
  function getSavedSellerName() {
    try { return localStorage.getItem(SELLER_NAME_KEY) || ''; } catch (_) { return ''; }
  }
  function saveSellerName(name) {
    try { localStorage.setItem(SELLER_NAME_KEY, name); } catch (_) {}
  }

  function getClaimsGenerated() {
    try {
      const raw = localStorage.getItem(CLAIMS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) { return []; }
  }
  function addClaimGenerated(awb) {
    const arr = getClaimsGenerated();
    if (!arr.includes(awb)) {
      arr.push(awb);
      try { localStorage.setItem(CLAIMS_KEY, JSON.stringify(arr)); } catch (_) {}
    }
  }
  function isClaimGenerated(awb) {
    return getClaimsGenerated().includes(awb);
  }

  /* ---------- Courier Matching ---------- */
  function matchCourier(courierRaw) {
    if (!courierRaw || courierRaw === 'Auto-detected') return COURIER_OPTIONS[0];
    const lower = courierRaw.toLowerCase();
    for (const c of COURIER_OPTIONS) {
      if (c === 'Other') continue;
      if (lower.includes(c.toLowerCase())) return c;
    }
    return COURIER_OPTIONS[0];
  }

  function getCourierEmail(courierName) {
    return COURIER_EMAILS[courierName] || '';
  }

  /* ---------- Email Template ---------- */
  function buildSubject(row, gapAmount) {
    return `COD Remittance Discrepancy — AWB ${row.awb} — Claim for ${App.formatCurrencyFull(gapAmount)}`;
  }

  function buildBody(row, courierName, sellerName) {
    const gap = row.gap;
    const gapPct = ((row.gapPercent || 0) * 100).toFixed(1);
    return `Dear ${courierName} Support Team,

I am writing to formally dispute a remittance discrepancy for the following shipment:

AWB Number: ${row.awb}
Order Date: ${App.formatDate(row.orderDate)}
Delivery City: ${row.city}
Expected COD Amount: ${App.formatCurrencyFull(row.orderValue)}
Amount Remitted: ${App.formatCurrencyFull(row.remittedAmount)}
Discrepancy: ${App.formatCurrencyFull(gap)} (${gapPct}%)

This amount was not included in my remittance settlement dated ${App.formatDate(row.settlementDate)}. As per our service agreement, I request the outstanding amount of ${App.formatCurrencyFull(gap)} be remitted to my account within 7 working days.

Please confirm receipt of this claim and provide a resolution timeline.

Attached: Reconciliation report for reference.

Regards,
${sellerName || '[Your Name]'}`;
  }

  /* ---------- Modal ---------- */
  function openClaimModal(row) {
    // Track claim
    addClaimGenerated(row.awb);

    // Refresh table badges if Table is available
    if (typeof Table !== 'undefined' && Table.applyFilters) {
      Table.applyFilters();
    }

    const matched = matchCourier(row.courier);
    const sellerName = getSavedSellerName();
    const subject = buildSubject(row, row.gap);
    const body = buildBody(row, matched, sellerName);
    const email = getCourierEmail(matched);

    // Remove existing modal if any
    const existing = document.getElementById('claim-modal-backdrop');
    if (existing) existing.remove();

    const backdrop = document.createElement('div');
    backdrop.id = 'claim-modal-backdrop';
    backdrop.className = 'claim-modal-backdrop';

    backdrop.innerHTML = `
      <div class="claim-modal" onclick="event.stopPropagation()">
        <!-- Header -->
        <div class="claim-modal-header">
          <div style="display:flex; align-items:center; gap:0.75rem;">
            <span class="material-symbols-outlined" style="color:#a1392a; font-size:1.5rem;">mail</span>
            <div>
              <h3 style="font-family:var(--font-headline); font-size:1.25rem; font-weight:800; letter-spacing:-0.02em;">Claim Ready to Send</h3>
              <p style="font-family:var(--font-label); font-size:0.6rem; color:var(--on-surface-variant); text-transform:uppercase; letter-spacing:0.12em;">AWB ${row.awb}</p>
            </div>
          </div>
          <button id="claim-modal-close" style="padding:0.5rem; border-radius:50%; transition:background 0.2s;" onmouseenter="this.style.background='var(--surface-container-low)'" onmouseleave="this.style.background='transparent'">
            <span class="material-symbols-outlined" style="color:var(--on-surface-variant);">close</span>
          </button>
        </div>

        <!-- Body -->
        <div class="claim-modal-body">
          <!-- Courier dropdown -->
          <div class="claim-field">
            <label class="claim-field-label">Courier</label>
            <select id="claim-courier-select" class="claim-input">
              ${COURIER_OPTIONS.map(c => `<option value="${c}" ${c === matched ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>

          <!-- Other courier name (hidden by default) -->
          <div id="claim-other-courier-wrap" class="claim-field" style="display:none;">
            <label class="claim-field-label">Courier Name (manual)</label>
            <input id="claim-other-courier" type="text" class="claim-input" placeholder="Enter courier name" />
          </div>

          <!-- Courier email -->
          <div class="claim-field">
            <label class="claim-field-label">Courier Email</label>
            <input id="claim-email" type="email" class="claim-input" value="${email}" placeholder="support@courier.com" />
          </div>

          <!-- Subject -->
          <div class="claim-field">
            <label class="claim-field-label">Subject Line</label>
            <input id="claim-subject" type="text" class="claim-input" value="${subject.replace(/"/g, '&quot;')}" />
          </div>

          <!-- Email Body -->
          <div class="claim-field">
            <label class="claim-field-label">Email Body</label>
            <textarea id="claim-body" class="claim-input claim-textarea">${body}</textarea>
          </div>

          <!-- Seller Name -->
          <div class="claim-field">
            <label class="claim-field-label">Your Name (saved for next time)</label>
            <input id="claim-seller-name" type="text" class="claim-input" value="${sellerName.replace(/"/g, '&quot;')}" placeholder="Enter your name" />
          </div>
        </div>

        <!-- Footer -->
        <div class="claim-modal-footer">
          <button id="claim-copy-btn" class="btn-coral">
            <span class="material-symbols-outlined" style="font-size:16px;">content_copy</span>
            Copy to Clipboard
          </button>
          <button id="claim-gmail-btn" class="btn-coral btn-coral-outline">
            <span class="material-symbols-outlined" style="font-size:16px;">open_in_new</span>
            Open in Gmail
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    // Animate in
    requestAnimationFrame(() => {
      backdrop.classList.add('visible');
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    /* --- Event Wiring --- */
    const closeModal = () => {
      backdrop.classList.remove('visible');
      setTimeout(() => {
        backdrop.remove();
        document.body.style.overflow = '';
      }, 300);
    };

    backdrop.addEventListener('click', closeModal);
    document.getElementById('claim-modal-close').addEventListener('click', closeModal);

    // Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);

    // Courier dropdown change
    const courierSelect = document.getElementById('claim-courier-select');
    const otherWrap = document.getElementById('claim-other-courier-wrap');
    const emailInput = document.getElementById('claim-email');
    const bodyTextarea = document.getElementById('claim-body');

    courierSelect.addEventListener('change', () => {
      const val = courierSelect.value;
      if (val === 'Other') {
        otherWrap.style.display = '';
        emailInput.value = '';
        emailInput.placeholder = 'Enter courier support email';
      } else {
        otherWrap.style.display = 'none';
        emailInput.value = getCourierEmail(val);
      }
      // Rebuild body with new courier name
      const courierName = val === 'Other' ? (document.getElementById('claim-other-courier').value || 'Courier') : val;
      const seller = document.getElementById('claim-seller-name').value;
      bodyTextarea.value = buildBody(row, courierName, seller);
    });

    // Other courier name change → update body
    const otherInput = document.getElementById('claim-other-courier');
    otherInput.addEventListener('input', () => {
      const seller = document.getElementById('claim-seller-name').value;
      bodyTextarea.value = buildBody(row, otherInput.value || 'Courier', seller);
    });

    // Seller name change → save + update body
    const sellerInput = document.getElementById('claim-seller-name');
    sellerInput.addEventListener('input', () => {
      saveSellerName(sellerInput.value);
      const courierVal = courierSelect.value;
      const courierName = courierVal === 'Other' ? (otherInput.value || 'Courier') : courierVal;
      bodyTextarea.value = buildBody(row, courierName, sellerInput.value);
    });

    // Copy to clipboard
    document.getElementById('claim-copy-btn').addEventListener('click', () => {
      const text = bodyTextarea.value;
      navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('claim-copy-btn');
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">check</span> Copied!';
        setTimeout(() => {
          btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">content_copy</span> Copy to Clipboard';
        }, 2000);
      }).catch(() => {
        // Fallback
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      });
    });

    // Open in Gmail
    document.getElementById('claim-gmail-btn').addEventListener('click', () => {
      const to = emailInput.value;
      const subj = document.getElementById('claim-subject').value;
      const mailBody = bodyTextarea.value;
      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(mailBody)}`;
      window.open(mailto, '_blank');
    });
  }

  /* ---------- Recovery Potential ---------- */
  function getRecoveryTotal(results) {
    if (!results) return 0;
    return results
      .filter(r => r.status === 'SHORT-PAID' || r.status === 'MISSING')
      .reduce((sum, r) => sum + (r.gap || 0), 0);
  }

  function getDiscrepancies(results) {
    if (!results) return [];
    return results.filter(r => r.status === 'SHORT-PAID' || r.status === 'MISSING');
  }

  /* ---------- Bulk Claims ZIP ---------- */
  function generateAllClaims(results) {
    const discrepancies = getDiscrepancies(results);
    if (discrepancies.length === 0) {
      alert('No discrepancies found to generate claims for.');
      return;
    }

    const sellerName = getSavedSellerName() || '[Your Name]';

    // Check if JSZip is available
    if (typeof JSZip === 'undefined') {
      alert('JSZip library not loaded. Please check your internet connection.');
      return;
    }

    const zip = new JSZip();
    const claimsFolder = zip.folder('claims');

    discrepancies.forEach(row => {
      const courier = matchCourier(row.courier);
      const courierEmail = getCourierEmail(courier);
      const subject = buildSubject(row, row.gap);
      const body = buildBody(row, courier, sellerName);

      const fileContent = `TO: ${courierEmail}
SUBJECT: ${subject}

${body}`;

      const safeAWB = row.awb.replace(/[^a-zA-Z0-9_-]/g, '_');
      claimsFolder.file(`claim_${safeAWB}.txt`, fileContent);

      // Track
      addClaimGenerated(row.awb);
    });

    zip.generateAsync({ type: 'blob' }).then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reconcile_claims_${new Date().toISOString().slice(0, 10)}.zip`;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Refresh table badges
      if (typeof Table !== 'undefined' && Table.applyFilters) {
        Table.applyFilters();
      }
    });
  }

  /* ---------- Public API ---------- */
  return {
    openClaimModal,
    isClaimGenerated,
    getRecoveryTotal,
    getDiscrepancies,
    generateAllClaims,
    COURIER_OPTIONS,
    COURIER_EMAILS,
  };
})();
