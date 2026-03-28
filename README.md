# Reconcile.ly

**Reconcile.ly** is a localized, client-side reconciliation engine designed for e-commerce vendors to automatically match their order exports against courier remittance files. It helps identify missing payouts, pending payments, and short-paid delivery discrepancies without sending sensitive financial data to an external server.

🌐 **Live Demo:** [https://reconcilely.netlify.app](https://reconcilely.netlify.app)

---

## 🚀 Key Features

*   **🔒 Local-First Processing:** All file parsing and data reconciliation happen entirely within your browser using SheetJS. No sensitive financial data is ever uploaded to a remote server.
*   **🧠 Smart Auto-Detection:** Automatically detects vital columns (AWB, Order Amount, Remittance Amount, Date) regardless of variations in header names across different courier formats.
*   **🌍 Multi-Currency Support:** Scans and auto-detects currencies ($, ₹, €, £) and codes (USD, INR, EUR, GBP) dynamically. Capable of cross-currency harmonization via an adjustable exchange rate multiplier.
*   **📊 Insightful Dashboard:** Provides a real-time dashboard reflecting `MATCHED`, `SHORT-PAID`, `MISSING`, and `PENDING` states with beautiful, interactive visualizations.
*   **🧾 Discrepancy Export:** Generates an easy-to-read CSV report containing only the anomalies, making it actionable for revenue recovery.

## 🛠️ Technology Stack

*   **HTML5 / CSS3:** Using modern, responsive layouts and custom design tokens.
*   **Vanilla JavaScript (ES6+):** Pure, dependency-free application logic for blistering fast performance.
*   **SheetJS (xlsx.js):** Efficiently reads, parses, and converts `.csv` and `.xlsx` files entirely on the client-side.

## 📖 How It Works

1.  **Upload:** Provide two files 
    *   **Order Export:** The data from your storefront containing Expected Amount and Tracking Number/AWB.
    *   **Courier Remittance:** The payout report from your shipping partner containing Remitted Amount and Tracking Number/AWB.
2.  **Conversion:** If the currencies between your systems differ, input a conversion multiplier when prompted.
3.  **Reconciliation Engine:** The `reconcile.js` matching engine compares the values utilizing a 2% precision tolerance to filter out generic rounding noise.
4.  **Visualize:** View the breakdown of financial gaps on the Dashboard.
5.  **Export:** Download a summarized "clean" list containing just the orders you need to dispute.

## 📂 Project Structure

```text
├── index.html                  # File Upload & Configuration Entrypoint
├── dashboard.html              # Analytics & Overview Dashboard
├── export.html                 # Final Summary & Download Page
├── css/
│   └── styles.css              # Custom unified design system
└── js/
    ├── app.js                  # Global formatting, currencies, & utilities
    ├── upload.js               # SheetJS file parsing, validation, & UI states
    ├── reconcile.js            # Core matching and anomaly-detection engine
    ├── dashboard-charts.js     # Logic for populating dashboard stats
    └── anomalies.js            # Detailed transaction ledger viewer
```


