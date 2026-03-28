/* ============================================================
   Reconcile.ly — anomalies.js
   Anomaly card generation, risk scoring
   ============================================================ */

const Anomalies = (() => {
  function init(results, summary) {
    const container = document.getElementById('anomalies-container');
    if (!container) return;

    // Get all non-matched anomalies sorted by gap descending
    const anomalies = results
      .filter(r => r.status === 'SHORT-PAID' || r.status === 'MISSING')
      .sort((a, b) => b.gap - a.gap);

    if (anomalies.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:4rem;">
          <span class="material-symbols-outlined" style="font-size:48px; color:#006c4e; margin-bottom:1rem; display:block;">verified</span>
          <h3 style="font-family:'Syne',sans-serif; font-size:1.5rem; font-weight:800; margin-bottom:0.5rem;">All Clear</h3>
          <p style="color:#57423e; font-size:0.875rem;">No integrity gaps detected in this reconciliation batch.</p>
        </div>`;
      return;
    }

    // Risk score
    const riskScore = Math.min(99, Math.round((anomalies.length / summary.totalOrders) * 100));
    const riskLevel = riskScore > 70 ? 'High' : riskScore > 40 ? 'Medium' : 'Low';

    // Header
    let html = `
      <div style="margin-bottom:2rem;">
        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.5rem;">
          <div style="height:2px; width:2rem; background:#a1392a;"></div>
          <span style="font-family:'JetBrains Mono',monospace; font-size:0.7rem; letter-spacing:0.15em; color:#a1392a; text-transform:uppercase; font-weight:700;">Audit Alert</span>
        </div>
        <h2 style="font-family:'Syne',sans-serif; font-size:2.5rem; letter-spacing:-0.03em;">Integrity Gaps</h2>
        <p style="color:#57423e; max-width:40rem; line-height:1.6;">
          Automated reconciliation detected ${anomalies.length} discrepancies requiring manual resolution.
        </p>
      </div>`;

    // Bento grid
    html += `<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:1.5rem;">`;

    // Featured anomaly (largest gap) — spans 2 columns
    const featured = anomalies[0];
    const featuredStatusLabel = featured.status === 'MISSING' ? 'Unmatched Entry' : 'Short Payment';
    html += `
      <div style="grid-column:span 2; background:#fff; padding:2rem; border-radius:0.5rem; box-shadow:0 4px 20px rgba(87,66,62,0.04),0 10px 40px rgba(87,66,62,0.06); position:relative; overflow:hidden;">
        <div style="position:absolute; top:0; right:0; padding:1rem;">
          <span style="font-family:'Syne',sans-serif; font-size:5rem; font-weight:800; color:rgba(161,57,42,0.04); line-height:1;">01</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
          <div>
            <span style="background:rgba(186,26,26,0.1); color:#93000a; padding:2px 8px; border-radius:2px; font-family:'JetBrains Mono',monospace; font-size:0.6rem; font-weight:700; text-transform:uppercase; letter-spacing:0.08em;">Critical ${featuredStatusLabel}</span>
            <h3 style="font-family:'Syne',sans-serif; font-size:1.25rem; margin-top:0.5rem;">${featured.awb}</h3>
          </div>
          <div style="text-align:right;">
            <span style="font-family:'Syne',sans-serif; font-size:1.75rem; color:#a1392a; letter-spacing:-0.02em;">-${App.formatCurrencyFull(featured.gap)}</span>
            <p style="font-family:'JetBrains Mono',monospace; font-size:0.6rem; color:#8a716d; text-transform:uppercase;">Unreconciled Gap</p>
          </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:1.5rem; padding:1rem 0; border-top:1px solid rgba(222,192,187,0.1); border-bottom:1px solid rgba(222,192,187,0.1); margin:1rem 0;">
          <div>
            <p style="font-family:'JetBrains Mono',monospace; font-size:0.6rem; color:#8a716d; text-transform:uppercase; margin-bottom:0.25rem;">AWB</p>
            <p style="font-family:'JetBrains Mono',monospace; font-size:0.8rem; font-weight:700;">${featured.awb}</p>
          </div>
          <div>
            <p style="font-family:'JetBrains Mono',monospace; font-size:0.6rem; color:#8a716d; text-transform:uppercase; margin-bottom:0.25rem;">City</p>
            <p style="font-family:'JetBrains Mono',monospace; font-size:0.8rem; font-weight:700;">${featured.city}</p>
          </div>
          <div>
            <p style="font-family:'JetBrains Mono',monospace; font-size:0.6rem; color:#8a716d; text-transform:uppercase; margin-bottom:0.25rem;">Date</p>
            <p style="font-family:'JetBrains Mono',monospace; font-size:0.8rem; font-weight:700;">${App.formatDate(featured.orderDate)}</p>
          </div>
          <div>
            <p style="font-family:'JetBrains Mono',monospace; font-size:0.6rem; color:#8a716d; text-transform:uppercase; margin-bottom:0.25rem;">Status</p>
            <div style="display:flex; align-items:center; gap:0.375rem;">
              <span style="width:6px; height:6px; border-radius:50%; background:#ba1a1a;"></span>
              <p style="font-family:'JetBrains Mono',monospace; font-size:0.8rem; font-weight:700; color:#ba1a1a;">${featured.status}</p>
            </div>
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <p style="font-size:0.75rem; font-style:italic; color:#8a716d; max-width:24rem;">Expected ${App.formatCurrencyFull(featured.orderValue)}, received ${App.formatCurrencyFull(featured.remittedAmount)}. Gap of ${(featured.gapPercent * 100).toFixed(1)}% exceeds threshold.</p>
          <button class="btn-primary-sm" onclick="DetailPanel.open(${results.indexOf(featured)})">Resolve</button>
        </div>
      </div>`;

    // Risk Score Card
    html += `
      <div style="background:#f5f3ef; padding:2rem; border-radius:0.5rem; display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
            <span style="font-family:'Syne',sans-serif; font-size:1.1rem;">Risk Score</span>
            <span style="font-family:'JetBrains Mono',monospace; font-weight:700; font-size:1.15rem; color:${riskScore > 70 ? '#ba1a1a' : riskScore > 40 ? '#a36700' : '#006c4e'};">${riskLevel} (${riskScore})</span>
          </div>
          <div style="width:100%; background:#eae8e4; height:8px; border-radius:999px; overflow:hidden;">
            <div style="background:#a1392a; height:100%; width:${riskScore}%; border-radius:999px; transition:width 0.6s ease;"></div>
          </div>
        </div>
        <div style="margin-top:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <span class="material-symbols-outlined" style="color:#a1392a;">warning</span>
              <span style="font-family:'JetBrains Mono',monospace; font-size:0.8rem;">Short Payments</span>
            </div>
            <span style="font-family:'JetBrains Mono',monospace; font-size:0.7rem; font-weight:700; padding:2px 8px; background:rgba(163,103,0,0.1); color:#a36700; border-radius:2px;">${summary.countShortPaid} Events</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; padding:0.5rem 0; cursor:pointer;">
            <div style="display:flex; align-items:center; gap:0.75rem;">
              <span class="material-symbols-outlined" style="color:#a1392a;">search_off</span>
              <span style="font-family:'JetBrains Mono',monospace; font-size:0.8rem;">Missing Records</span>
            </div>
            <span style="font-family:'JetBrains Mono',monospace; font-size:0.7rem; font-weight:700; padding:2px 8px; background:rgba(163,103,0,0.1); color:#a36700; border-radius:2px;">${summary.countMissing} Events</span>
          </div>
        </div>
        <div style="padding-top:1rem; border-top:1px solid rgba(222,192,187,0.2); text-align:center; margin-top:1rem;">
          <button style="color:#a1392a; font-family:'JetBrains Mono',monospace; font-size:0.7rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; background:none; border:none; cursor:pointer;" onclick="exportAnomalies()">Download Audit Log</button>
        </div>
      </div>`;

    // Remaining anomaly cards (skip the first/featured one)
    if (anomalies.length > 1) {
      html += `<div style="grid-column:span 3; display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">`;
      for (let i = 1; i < anomalies.length; i++) {
        const a = anomalies[i];
        const icon = a.status === 'MISSING' ? 'search_off' : 'currency_exchange';
        const globalIdx = results.indexOf(a);
        html += `
          <div style="background:#fff; padding:1.5rem; border-radius:0.5rem; box-shadow:0 4px 20px rgba(87,66,62,0.04),0 10px 40px rgba(87,66,62,0.06); transition:background 0.2s;" onmouseenter="this.style.background='#f5f3ef'" onmouseleave="this.style.background='#fff'">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem;">
              <div style="display:flex; gap:1rem;">
                <div style="width:3rem; height:3rem; border-radius:0.375rem; background:#efeeea; display:flex; align-items:center; justify-content:center;">
                  <span class="material-symbols-outlined" style="color:#a1392a;">${icon}</span>
                </div>
                <div>
                  <h4 style="font-family:'Syne',sans-serif; font-size:1rem;">${a.awb}</h4>
                  <p style="font-family:'JetBrains Mono',monospace; font-size:0.6rem; color:#8a716d; letter-spacing:-0.02em;">${a.city} • ${a.status}</p>
                </div>
              </div>
              <span style="font-family:'JetBrains Mono',monospace; font-size:1.1rem; font-weight:700; color:#a1392a;">-${App.formatCurrencyFull(a.gap)}</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
              <div>
                <p style="font-family:'JetBrains Mono',monospace; font-size:0.6rem; color:#8a716d; text-transform:uppercase; margin-bottom:0.25rem;">Expected</p>
                <p style="font-size:0.75rem; color:#57423e;">${App.formatCurrencyFull(a.orderValue)} → ${App.formatCurrencyFull(a.remittedAmount)}</p>
              </div>
              <button style="color:#a1392a; border:1px solid rgba(161,57,42,0.2); padding:0.375rem 1rem; border-radius:2px; font-family:'JetBrains Mono',monospace; font-size:0.6rem; font-weight:700; text-transform:uppercase; background:none; cursor:pointer; transition:all 0.2s;" onmouseenter="this.style.background='#a1392a';this.style.color='#fff'" onmouseleave="this.style.background='none';this.style.color='#a1392a'" onclick="DetailPanel.open(${globalIdx})">Review</button>
            </div>
          </div>`;
      }
      html += `</div>`;
    }

    html += `</div>`; // close bento grid
    container.innerHTML = html;
  }

  return { init };
})();

// Global export anomalies function
function exportAnomalies() {
  const session = App.loadSession();
  if (!session) return;
  const anomalies = session.results.filter(r => r.status === 'SHORT-PAID' || r.status === 'MISSING');
  const headers = ['AWB', 'Order Date', 'City', 'Expected', 'Remitted', 'Gap', 'Status'];
  const rows = anomalies.map(r => [r.awb, r.orderDate || '', r.city, r.orderValue.toFixed(2), r.remittedAmount.toFixed(2), r.gap.toFixed(2), r.status]);
  App.downloadCSV('anomaly_audit_log.csv', App.arrayToCSV(headers, rows));
}
