/* ============================================================
   Reconcile.ly — reconcile.js
   AWB matching engine with 2% tolerance classification
   ============================================================ */

const Reconciler = (() => {

  /* ---------- Column Auto-Detection ---------- */
  const AWB_ALIASES = [
    'awb', 'awb_number', 'awbnumber', 'tracking_id', 'trackingid',
    'tracking_number', 'trackingnumber', 'tracking number', 'awb number',
    'waybill', 'airwaybill', 'air_waybill', 'shipment_id', 'shipmentid',
    'order_id', 'orderid', 'order id', 'consignment', 'consignment_number'
  ];

  const ORDER_AMOUNT_ALIASES = [
    'expected_amount', 'expectedamount', 'expected amount', 'order_value',
    'ordervalue', 'order value', 'amount', 'total', 'order_amount',
    'orderamount', 'order amount', 'invoice_amount', 'invoiceamount',
    'invoice amount', 'sale_amount', 'saleamount', 'value', 'price',
    'total_amount', 'totalamount', 'cod_amount', 'codamount', 'collectible'
  ];

  const REMIT_AMOUNT_ALIASES = [
    'remitted_amount', 'remittedamount', 'remitted amount', 'remitted',
    'settlement_amount', 'settlementamount', 'settlement amount',
    'payout', 'payout_amount', 'payoutamount', 'paid_amount',
    'paidamount', 'paid amount', 'credit', 'credited', 'amount',
    'total', 'net_amount', 'netamount', 'net amount'
  ];

  const DATE_ALIASES = [
    'order_date', 'orderdate', 'order date', 'date', 'created_at',
    'createdat', 'created at', 'order_created', 'ordercreated',
    'shipment_date', 'shipmentdate', 'shipment date', 'dispatch_date',
    'dispatchdate', 'dispatch date', 'booking_date', 'bookingdate'
  ];

  const SETTLEMENT_DATE_ALIASES = [
    'settlement_date', 'settlementdate', 'settlement date', 'remittance_date',
    'remittancedate', 'remittance date', 'payout_date', 'payoutdate',
    'payout date', 'payment_date', 'paymentdate', 'payment date',
    'credit_date', 'creditdate', 'date', 'transaction_date'
  ];

  const CITY_ALIASES = [
    'city', 'customer_city', 'customercity', 'customer city',
    'destination', 'destination_city', 'destinationcity', 'delivery_city',
    'deliverycity', 'delivery city', 'location', 'ship_to_city', 'region'
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
      awb: findColumn(headers, AWB_ALIASES),
      amount: findColumn(headers, ORDER_AMOUNT_ALIASES),
      date: findColumn(headers, DATE_ALIASES),
      city: findColumn(headers, CITY_ALIASES),
    };
  }

  function detectRemittanceColumns(headers) {
    return {
      awb: findColumn(headers, AWB_ALIASES),
      amount: findColumn(headers, REMIT_AMOUNT_ALIASES),
      date: findColumn(headers, SETTLEMENT_DATE_ALIASES),
    };
  }

  /* ---------- Parse Amount ---------- */
  function parseAmount(val) {
    if (val == null || val === '') return 0;
    const s = String(val).replace(/[^0-9.\-]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /* ---------- Main Reconciliation ---------- */
  function reconcile(orderRows, remittanceRows, orderCols, remitCols) {
    // Build remittance lookup by normalized AWB
    const remitMap = new Map();
    for (const row of remittanceRows) {
      const rawAWB = row[remitCols.awb];
      if (!rawAWB) continue;
      const normAWB = App.normalizeAWB(rawAWB);
      remitMap.set(normAWB, {
        awbRaw: String(rawAWB).trim(),
        remittedAmount: parseAmount(row[remitCols.amount]),
        settlementDate: row[remitCols.date] || null,
      });
    }

    const results = [];
    let totalMatched = 0, totalMissing = 0, totalShortPaidGap = 0, totalPending = 0;
    let countMatched = 0, countMissing = 0, countShortPaid = 0, countPending = 0;

    for (const row of orderRows) {
      const rawAWB = row[orderCols.awb];
      if (!rawAWB) continue;

      const normAWB = App.normalizeAWB(rawAWB);
      const displayAWB = String(rawAWB).trim();
      const orderValue = parseAmount(row[orderCols.amount]);
      const orderDate = row[orderCols.date] || null;
      const city = row[orderCols.city] || '—';

      const remit = remitMap.get(normAWB);
      let status, remittedAmount, settlementDate, gap, gapPercent;

      if (!remit) {
        // Not found in remittance
        status = 'MISSING';
        remittedAmount = 0;
        settlementDate = null;
        gap = orderValue;
        gapPercent = orderValue > 0 ? 1 : 0;
        totalMissing += orderValue;
        countMissing++;
      } else if (remit.remittedAmount === 0 || remit.remittedAmount == null) {
        // Found but remitted amount is 0 or null
        status = 'PENDING';
        remittedAmount = 0;
        settlementDate = remit.settlementDate;
        gap = orderValue;
        gapPercent = orderValue > 0 ? 1 : 0;
        totalPending += orderValue;
        countPending++;
      } else {
        remittedAmount = remit.remittedAmount;
        settlementDate = remit.settlementDate;
        gap = orderValue - remittedAmount;
        gapPercent = orderValue > 0 ? gap / orderValue : 0;

        if (Math.abs(gapPercent) < 0.02) {
          // Within 2% tolerance — matched
          status = 'MATCHED';
          totalMatched += orderValue;
          countMatched++;
        } else {
          // Exceeds 2% tolerance — short-paid
          status = 'SHORT-PAID';
          totalShortPaidGap += gap;
          countShortPaid++;
        }
      }

      results.push({
        awb: displayAWB,
        awbNormalized: normAWB,
        orderValue,
        orderDate,
        city,
        remittedAmount,
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
      countMissing,
      countShortPaid,
      countPending,
      totalMatched,
      totalMissing,
      totalShortPaidGap,
      totalPending,
      sessionId: App.generateSessionId(),
      timestamp: new Date().toISOString(),
    };

    return { results, summary };
  }

  return {
    detectOrderColumns,
    detectRemittanceColumns,
    reconcile,
    parseAmount,
  };
})();
