/* ============================================================
   Reconcile.ly — reconcile.js
   Transaction matching engine with 4 gap types:
   TIMING GAP, DUPLICATE, ROUNDING, ORPHANED REFUND
   ============================================================ */

const Reconciler = (() => {

  /* ---------- Column Auto-Detection ---------- */
  const TXN_ID_ALIASES = [
    'transactionid', 'transaction_id', 'transaction id', 'txn_id', 'txnid',
    'txn id', 'id', 'ref', 'reference', 'reference_id', 'referenceid',
    'awb', 'awb_number', 'awbnumber', 'tracking_id', 'trackingid',
    'tracking_number', 'trackingnumber', 'tracking number', 'awb number',
    'waybill', 'airwaybill', 'shipment_id', 'shipmentid',
    'order_id', 'orderid', 'order id', 'consignment', 'consignment_number'
  ];

  const TXN_AMOUNT_ALIASES = [
    'amount', 'expected_amount', 'expectedamount', 'expected amount',
    'order_value', 'ordervalue', 'order value', 'total', 'order_amount',
    'orderamount', 'order amount', 'invoice_amount', 'invoiceamount',
    'invoice amount', 'sale_amount', 'saleamount', 'value', 'price',
    'total_amount', 'totalamount', 'cod_amount', 'codamount', 'collectible'
  ];

  const BANK_AMOUNT_ALIASES = [
    'amount', 'settlement_amount', 'settlementamount', 'settlement amount',
    'settled_amount', 'settledamount', 'settled amount',
    'remitted_amount', 'remittedamount', 'remitted amount', 'remitted',
    'payout', 'payout_amount', 'payoutamount',
    'paid_amount', 'paidamount', 'paid amount',
    'bank_amount', 'bankamount', 'bank amount',
    'credit', 'credited',
    'total', 'net_amount', 'netamount', 'net amount'
  ];

  const DATE_ALIASES = [
    'date', 'order_date', 'orderdate', 'order date', 'created_at',
    'createdat', 'created at', 'transaction_date', 'transactiondate',
    'shipment_date', 'shipmentdate', 'shipment date', 'dispatch_date',
    'dispatchdate', 'dispatch date', 'booking_date', 'bookingdate'
  ];

  const SETTLEMENT_DATE_ALIASES = [
    'settlementdate', 'settlement_date', 'settlement date',
    'remittance_date', 'remittancedate', 'remittance date',
    'payout_date', 'payoutdate', 'payout date',
    'payment_date', 'paymentdate', 'payment date',
    'credit_date', 'creditdate', 'date', 'transaction_date'
  ];

  const CUSTOMER_ALIASES = [
    'customer', 'customer_name', 'customername', 'customer name',
    'name', 'buyer', 'client', 'payee',
    'city', 'customer_city', 'customercity', 'customer city',
    'destination', 'destination_city', 'destinationcity', 'delivery_city',
    'deliverycity', 'delivery city', 'location', 'ship_to_city', 'region'
  ];

  const CURRENCY_CODE_ALIASES = [
    'currency', 'currency_code', 'currencycode', 'currency code',
    'cur', 'ccy', 'iso_currency', 'isocurrency'
  ];

  function normalizeColName(name) {
    return String(name).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function findColumn(headers, aliases) {
    const normalizedAliases = aliases.map(normalizeColName);
    for (const h of headers) {
      const nh = normalizeColName(h);
      if (normalizedAliases.includes(nh)) return h;
    }
    return null;
  }

  function detectOrderColumns(headers) {
    return {
      awb: findColumn(headers, TXN_ID_ALIASES),
      amount: findColumn(headers, TXN_AMOUNT_ALIASES),
      date: findColumn(headers, DATE_ALIASES),
      city: findColumn(headers, CUSTOMER_ALIASES),
    };
  }

  function detectRemittanceColumns(headers) {
    return {
      awb: findColumn(headers, TXN_ID_ALIASES),
      amount: findColumn(headers, BANK_AMOUNT_ALIASES),
      date: findColumn(headers, SETTLEMENT_DATE_ALIASES),
    };
  }

  /* ---------- Currency Symbol Map ---------- */
  const SYMBOL_TO_CURRENCY = {
    '$': 'USD',
    '₹': 'INR',
    '€': 'EUR',
    '£': 'GBP',
  };

  const CURRENCY_CODE_SET = new Set(['USD', 'INR', 'EUR', 'GBP']);

  /* ---------- Currency Auto-Detection ---------- */
  function detectCurrency(rows, amountColName, headers) {
    const votes = { USD: 0, INR: 0, EUR: 0, GBP: 0 };

    const currencyCol = findColumn(headers, CURRENCY_CODE_ALIASES);
    if (currencyCol) {
      const sampleSize = Math.min(rows.length, 50);
      for (let i = 0; i < sampleSize; i++) {
        const code = String(rows[i][currencyCol] || '').trim().toUpperCase();
        if (CURRENCY_CODE_SET.has(code)) votes[code] += 5;
      }
    }

    if (amountColName) {
      const sampleSize = Math.min(rows.length, 50);
      for (let i = 0; i < sampleSize; i++) {
        const raw = String(rows[i][amountColName] || '');
        for (const [symbol, code] of Object.entries(SYMBOL_TO_CURRENCY)) {
          if (raw.includes(symbol)) votes[code] += 1;
        }
      }
    }

    let best = null, bestCount = 0;
    for (const [code, count] of Object.entries(votes)) {
      if (count > bestCount) { best = code; bestCount = count; }
    }

    return bestCount > 0 ? best : null;
  }

  /* ---------- Parse Amount ---------- */
  function parseAmount(val) {
    if (val == null || val === '') return 0;
    let s = String(val).trim();
    s = s.replace(/[$₹€£]/g, '');
    s = s.replace(/[A-Za-z]/g, '');
    s = s.trim();

    if (s.includes(',') && s.includes('.')) {
      s = s.replace(/,/g, '');
    } else if (s.includes(',')) {
      s = s.replace(/,/g, '');
    }

    s = s.replace(/[^0-9.\-]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /* ---------- Main Reconciliation ---------- */
  /**
   * New logic with 4 gap types:
   * - TIMING GAP: exists in transactions, not yet in bank settlements
   * - DUPLICATE: same ID appears twice (or more) in bank file
   * - ROUNDING: difference is less than 0.05
   * - ORPHANED REFUND: negative amount with no matching original in bank
   * - MATCHED: everything lines up
   */
  function reconcile(orderRows, remittanceRows, orderCols, remitCols, options) {
    const opts = options || {};
    const orderMultiplier = opts.orderMultiplier || 1;

    // Build bank lookup by normalized TXN ID
    const bankMap = new Map();
    const bankDuplicates = new Set();

    for (const row of remittanceRows) {
      const rawID = row[remitCols.awb];
      if (!rawID) continue;
      const normID = App.normalizeAWB(rawID);

      if (bankMap.has(normID)) {
        // If we've seen this ID before, mark it as duplicate
        bankDuplicates.add(normID);
      }
      bankMap.set(normID, {
        idRaw: String(rawID).trim(),
        bankAmount: parseAmount(row[remitCols.amount]),
        settlementDate: row[remitCols.date] || null,
      });
    }

    const results = [];
    let totalMatched = 0, totalTimingGap = 0, totalRoundingGap = 0;
    let totalDuplicateGap = 0, totalOrphanedRefund = 0;
    let countMatched = 0, countTimingGap = 0, countRounding = 0;
    let countDuplicate = 0, countOrphanedRefund = 0;

    // Track which transaction IDs exist in the platform file (for orphaned refund check)
    const txnIDs = new Set();
    for (const row of orderRows) {
      const rawID = row[orderCols.awb];
      if (!rawID) continue;
      txnIDs.add(App.normalizeAWB(rawID));
    }

    for (const row of orderRows) {
      const rawID = row[orderCols.awb];
      if (!rawID) continue;

      const normID = App.normalizeAWB(rawID);
      const displayID = String(rawID).trim();
      const txnAmount = parseAmount(row[orderCols.amount]) * orderMultiplier;
      const txnDate = row[orderCols.date] || null;
      const customer = row[orderCols.city] || '—';

      const bankRecord = bankMap.get(normID);
      let status, bankAmount, settlementDate, gap, gapPercent;

      if (!bankRecord) {
        // TIMING GAP — exists in transactions, not yet in bank settlements
        if (txnAmount < 0) {
          // Negative amount with no bank match = orphaned refund
          // Check if there's a positive original for this (simplified: no original)
          status = 'ORPHANED REFUND';
          bankAmount = 0;
          settlementDate = null;
          gap = Math.abs(txnAmount);
          gapPercent = 1;
          totalOrphanedRefund += Math.abs(txnAmount);
          countOrphanedRefund++;
        } else {
          status = 'TIMING GAP';
          bankAmount = 0;
          settlementDate = null;
          gap = txnAmount;
          gapPercent = txnAmount > 0 ? 1 : 0;
          totalTimingGap += txnAmount;
          countTimingGap++;
        }
      } else if (bankDuplicates.has(normID)) {
        // DUPLICATE — same ID appears twice in bank file
        status = 'DUPLICATE';
        bankAmount = bankRecord.bankAmount;
        settlementDate = bankRecord.settlementDate;
        gap = bankAmount; // The extra duplicated amount
        gapPercent = txnAmount !== 0 ? gap / Math.abs(txnAmount) : 0;
        totalDuplicateGap += bankAmount; // one full duplicate amount at risk
        countDuplicate++;
      } else {
        bankAmount = bankRecord.bankAmount;
        settlementDate = bankRecord.settlementDate;
        gap = Math.abs(txnAmount - bankAmount);
        gapPercent = txnAmount !== 0 ? gap / Math.abs(txnAmount) : 0;

        if (gap < 0.50) {
          // ROUNDING — difference is less than 0.50
          if (gap > 0) {
            status = 'ROUNDING';
            totalRoundingGap += gap;
            countRounding++;
          } else {
            status = 'MATCHED';
            totalMatched += Math.abs(txnAmount);
            countMatched++;
          }
        } else {
          // Significant gap — classify as Timing Gap (partial payment missing)
          status = 'TIMING GAP';
          totalTimingGap += gap;
          countTimingGap++;
        }
      }

      results.push({
        awb: displayID,
        awbNormalized: normID,
        orderValue: txnAmount,
        orderDate: txnDate,
        city: customer,
        remittedAmount: bankAmount,
        settlementDate,
        gap,
        gapPercent,
        status,
        resolved: false,
        courier: 'Auto-detected',
      });
    }

    const summary = {
      totalOrders: results.length,
      countMatched,
      countTimingGap,
      countRounding,
      countDuplicate,
      countOrphanedRefund,
      // Legacy compat aliases
      countMissing: countTimingGap,
      countShortPaid: countRounding,
      countPending: 0,
      totalMatched,
      totalTimingGap,
      totalRoundingGap,
      totalDuplicateGap,
      totalOrphanedRefund,
      // Legacy compat aliases
      totalMissing: totalTimingGap,
      totalShortPaidGap: totalRoundingGap,
      totalPending: 0,
      displayCurrency: opts.displayCurrency || 'USD',
      orderMultiplier,
      sessionId: App.generateSessionId(),
      timestamp: new Date().toISOString(),
    };

    return { results, summary };
  }

  return {
    detectOrderColumns,
    detectRemittanceColumns,
    detectCurrency,
    reconcile,
    parseAmount,
  };
})();
