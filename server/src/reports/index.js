const sales = require("./queries/sales");
const purchases = require("./queries/purchases");
const inventory = require("./queries/inventory");
const accounts = require("./queries/accounts");
const treasury = require("./queries/treasury");
const tax = require("./queries/tax");
const audit = require("./queries/audit");

const dispatcher = {
  // Sales
  "daily-sales": sales.dailySales,
  "detailed-sales": sales.detailedSales,
  "sales-by-item": sales.salesByItem,
  "sales-by-category": sales.salesByCategory,
  "sales-by-cashier": sales.salesByCashier,
  "sales-by-payment": sales.salesByPayment,
  "sales-heatmap": sales.salesHeatmap,
  "period-comparison": sales.periodComparison,
  "gross-net-sales": sales.grossNetSales,
  "sales-returns": sales.salesReturns,
  "discount-analysis": sales.discountAnalysis,
  "margin-by-item": sales.marginByItem,
  "margin-by-category": sales.marginByCategory,
  "margin-health": sales.marginHealth,
  "shift-history": sales.shiftHistory,

  // Purchases
  "purchase-summary": purchases.purchaseSummary,
  "detailed-purchases": purchases.detailedPurchases,
  "purchases-by-supplier": purchases.purchasesBySupplier,
  "purchases-by-item": purchases.purchasesByItem,
  "purchase-returns": purchases.purchaseReturns,
  "supplier-pricing": purchases.supplierPricing,

  // Inventory
  "slow-moving": inventory.slowMoving,
  "stock-levels": inventory.stockLevels,
  "stock-movements": inventory.stockMovements,
  "stock-valuation": inventory.stockValuation,
  "count-sheet": inventory.countSheet,
  "reorder": inventory.reorderReport,
  "expiry": inventory.expiryReport,
  "inventory-aging": inventory.inventoryAging,
  "dead-stock": inventory.deadStock,

  // Accounts
  "ar-aging": accounts.arAging,
  "ap-aging": accounts.apAging,
  "profit-loss": accounts.profitLoss,
  "customer-statement": accounts.customerStatement,
  "top-customers": accounts.topCustomers,
  "collection-efficiency": accounts.collectionEfficiency,
  "supplier-statement": accounts.supplierStatement,

  // Treasury
  "cash-flow": treasury.cashFlow,
  "treasury": treasury.treasury,
  "cash-consistency": treasury.cashConsistency,
  "payment-method-flow": treasury.paymentMethodFlow,
  "bank-cash-split": treasury.bankCashSplit,
  "reconciliation-exceptions": treasury.reconciliationExceptions,

  // Tax
  "vat": tax.vat,
  "output-vat": tax.outputVat,
  "input-vat": tax.inputVat,
  "vat-filing-summary": tax.vatFilingSummary,
  "returns-tax-effect": tax.returnsTaxEffect,

  // Audit
  "exceptions": audit.exceptionsReport,
  "audit-log": audit.auditLog,
  "user-activity": audit.userActivity,
};

function listRows(slug, startDate, endDate, opts = {}) {
  const fn = dispatcher[slug];
  if (!fn) return [];
  return fn(startDate, endDate, opts);
}

module.exports = { listRows, dispatcher };
