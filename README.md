# Reconcile.ly

**Reconcile.ly** is a localized, client-side reconciliation engine designed for payments companies and e-commerce platforms to automatically match their internal transaction records against bank settlement files. It helps identify timing gaps, duplicates, rounding errors, and orphaned refunds instantly without sending sensitive financial data to an external server.

🌐 **Live Demo:** [https://reconcilely.netlify.app](https://reconcilely.netlify.app)

---

## 🚀 Key Features

*   **🔒 Local-First Processing:** All file parsing and data reconciliation happen entirely within your browser using SheetJS. No sensitive financial data is ever uploaded to a remote server.
*   **🧠 Smart Auto-Detection:** Automatically detects vital columns (Transaction ID, Transaction Amount, Settled Amount, Date) regardless of variations in header names from different payment processors (Stripe, Razorpay, PayPal, etc.).
*   **🌍 Multi-Currency Support:** Scans and auto-detects currencies ($, ₹, €, £) and codes (USD, INR, EUR, GBP) dynamically. Evaluates datasets uniformly via an adjustable exchange rate multiplier.
*   **📊 Insightful Dashboard:** Provides a real-time dashboard categorizing transactions into 4 precise discrepancy states:
    - **Timing Gap:** Exists in internal records, missing from the bank settlement.
    - **Duplicate:** Transaction ID appears multiple times in the settlement file.
    - **Rounding Difference:** Minor discrepancy (configurable threshold) between the platform value and the bank payout.
    - **Orphaned Refund:** Reversal/refund exists in internal records with no matching original payment.
*   **🧾 Bank Inquiry Generator:** Automatically drafts a tailored inquiry email pre-filled with discrepancy context, gap percentages, and bank-specific contact templates, saving hours of manual dispute work.
*   **💼 Discrepancy Export:** Generates an easy-to-read CSV report containing only the unreconciled anomalies.

## 🛠️ Technology Stack

*   **HTML5 / CSS3:** Modern, responsive "Suede Ledger" design system with deep terracotta and rich earthy tones.
*   **Vanilla JavaScript (ES6+):** Pure, dependency-free application logic for blisteringly fast performance and zero configuration.
*   **SheetJS (xlsx.js):** Efficiently reads, parses, and converts `.csv` and `.xlsx` files entirely on the client-side.

## 📖 How It Works

1.  **Upload:** Provide two files on the hero page via drag-and-drop or click-to-upload:
    *   **Platform Transactions:** The truth-source records from your storefront or internal ledger containing Expected Amount and Transaction ID.
    *   **Bank Settlement:** The payout report from your banking partner containing the actual Settled Amount and Reference ID.
2.  **Conversion:** If the currencies between your systems differ, input a conversion multiplier when prompted by the alert dialogue.
3.  **Engine Crunching:** The `reconcile.js` engine immediately scans for duplicates, isolates orphaned refunds, maps timing gaps, and filters pure rounding discrepancies all in memory.
4.  **Analyze Context:** Dive into the Dashboard to view visually rich KPI cards and interact with the slide-in **Detail Comparison Panel**.
5.  **Act & Export:** Use the **Bank Inquiry Generator** to instantly draft dispute emails to your payment processor or export the consolidated gap report for offline viewing.

## 📂 Project Structure

```text
├── index.html                  # File Upload & Configuration Entrypoint
├── dashboard.html              # Analytics & Overview Dashboard
├── export.html                 # Final Summary & Download Page
├── css/
│   ├── dashboard.css           # Styling for UI logic heavy layouts
│   ├── index.css               # Core styling, animations, global variables
│   └── reset.css               # Browser normalization
└── js/
    ├── app.js                  # Global formatting, session memory, CSV generation
    ├── upload.js               # SheetJS file parsing, validation, & UI states
    ├── reconcile.js            # Core matching and 4-type gap-detection engine
    ├── dashboard.js            # Metric injection & generic dashboard state
    ├── table.js                # Ledger table population and pagination
    ├── detail-panel.js         # Slide-in transaction card logic
    ├── anomalies.js            # Deep-dive discrepancy review view
    ├── claims.js               # Bank Inquiry email templating & modal system
    └── export-page.js          # Export summary and download execution
```
