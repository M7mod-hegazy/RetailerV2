const express = require("express");
const { getDb } = require("../config/database");
const { getSalesSummary, getCashierPerformance } = require("../services/salesAnalytics");
const { getInventoryValuation, getLowStock } = require("../services/stockAnalytics");
const { getPaymentsReport, getProfitLoss } = require("../services/financeAnalytics");
const { exportRowsToExcel, exportRowsToPdf } = require("../services/exportService");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.use(authRequired);

function listRows(slug, startDate, endDate) {
  const db = getDb();
  const params = [];
  const addDateFilter = (column = "created_at") => {
    let clause = "";
    if (startDate) {
      clause += ` AND DATE(${column}) >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      clause += ` AND DATE(${column}) <= ?`;
      params.push(endDate);
    }
    return clause;
  };

  switch (slug) {
    case "daily-sales":
      return getSalesSummary(startDate, endDate);
    case "detailed-sales":
      return db.prepare(
        `SELECT i.invoice_no, DATE(i.created_at) AS date, COALESCE(c.name, 'عميل نقدي') AS customer_name, i.payment_type, i.status, i.total
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE 1=1 ${addDateFilter("i.created_at")}
         ORDER BY i.created_at DESC`,
      ).all(...params);
    case "sales-by-item":
      return db.prepare(
        `SELECT items.name AS item_name, SUM(il.quantity) AS quantity_sold, SUM(il.line_total) AS revenue
         FROM invoice_lines il
         JOIN invoices i ON i.id = il.invoice_id
         JOIN items ON items.id = il.item_id
         WHERE 1=1 ${addDateFilter("i.created_at")}
         GROUP BY items.id
         ORDER BY revenue DESC`,
      ).all(...params);
    case "sales-by-category":
      return db.prepare(
        `SELECT COALESCE(c.name, 'غير مصنف') AS category_name, SUM(il.quantity) AS quantity_sold, SUM(il.line_total) AS revenue
         FROM invoice_lines il
         JOIN invoices i ON i.id = il.invoice_id
         JOIN items it ON it.id = il.item_id
         LEFT JOIN item_categories c ON c.id = it.category_id
         WHERE 1=1 ${addDateFilter("i.created_at")}
         GROUP BY c.id
         ORDER BY revenue DESC`,
      ).all(...params);
    case "sales-by-cashier":
      return getCashierPerformance(startDate, endDate);
    case "sales-by-payment":
      return db.prepare(
        `SELECT payment_type, COUNT(*) AS invoice_count, SUM(total) AS total_sales
         FROM invoices
         WHERE 1=1 ${addDateFilter()}
         GROUP BY payment_type
         ORDER BY total_sales DESC`,
      ).all(...params);
    case "sales-heatmap":
      return db.prepare(
        `SELECT strftime('%w', created_at) AS weekday, strftime('%H:00', created_at) AS hour_slot, COUNT(*) AS invoice_count, SUM(total) AS total_sales
         FROM invoices
         WHERE 1=1 ${addDateFilter()}
         GROUP BY weekday, hour_slot
         ORDER BY weekday, hour_slot`,
      ).all(...params);
    case "exceptions":
      return db.prepare(
        `SELECT invoice_no, DATE(created_at) AS date, discount, status, total
         FROM invoices
         WHERE (discount > 0 OR status != 'paid') ${addDateFilter()}
         ORDER BY created_at DESC`,
      ).all(...params);
    case "period-comparison": {
      const current = getSalesSummary(startDate, endDate);
      return current;
    }
    case "slow-moving":
      return db.prepare(
        `SELECT it.name, COALESCE(SUM(sl.quantity), 0) AS stock_quantity
         FROM items it
         LEFT JOIN stock_levels sl ON sl.item_id = it.id
         WHERE it.id NOT IN (
           SELECT DISTINCT il.item_id
           FROM invoice_lines il
           JOIN invoices i ON i.id = il.invoice_id
           WHERE 1=1 ${addDateFilter("i.created_at")}
         )
         GROUP BY it.id
         ORDER BY stock_quantity DESC`,
      ).all(...params);
    case "stock-levels":
      return db.prepare(
        `SELECT it.name, COALESCE(SUM(sl.quantity), 0) AS quantity, it.min_stock_qty, u.name AS unit_name
         FROM items it
         LEFT JOIN stock_levels sl ON sl.item_id = it.id
         LEFT JOIN units u ON u.id = it.unit_id
         GROUP BY it.id
         ORDER BY it.name ASC`,
      ).all();
    case "stock-movements":
      return db.prepare(
        `SELECT movement_type, reference_type, reference_id, quantity, DATE(created_at) AS date
         FROM stock_movements
         WHERE 1=1 ${addDateFilter()}
         ORDER BY created_at DESC`,
      ).all(...params);
    case "stock-valuation":
      return getInventoryValuation();
    case "count-sheet":
      return db.prepare(
        `SELECT it.code, it.name, COALESCE(SUM(sl.quantity), 0) AS system_quantity
         FROM items it
         LEFT JOIN stock_levels sl ON sl.item_id = it.id
         GROUP BY it.id
         ORDER BY it.name ASC`,
      ).all();
    case "reorder":
      return getLowStock();
    case "expiry":
      return [];
    case "daily-financial":
      return db.prepare(
        `SELECT DATE(created_at) AS date, SUM(total) AS sales_total
         FROM invoices
         WHERE 1=1 ${addDateFilter()}
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
      ).all(...params);
    case "ar-aging":
    case "customer-aging":
      return db.prepare(
        `SELECT c.name AS customer_name, COALESCE(c.opening_balance, 0) + COALESCE(SUM(CASE WHEN i.status != 'paid' THEN i.total ELSE 0 END), 0) AS outstanding_balance
         FROM customers c
         LEFT JOIN invoices i ON i.customer_id = c.id
         GROUP BY c.id
         ORDER BY outstanding_balance DESC`,
      ).all();
    case "ap-aging":
      return db.prepare(
        `SELECT s.name AS supplier_name, COALESCE(s.opening_balance, 0) + COALESCE(SUM(p.total), 0) AS outstanding_balance
         FROM suppliers s
         LEFT JOIN purchases p ON p.supplier_id = s.id
         GROUP BY s.id
         ORDER BY outstanding_balance DESC`,
      ).all();
    case "profit-loss":
      return [getProfitLoss(startDate, endDate)];
    case "cash-flow":
      return db.prepare(
        `SELECT DATE(created_at) AS date, 'revenue' AS type, SUM(amount) AS total
         FROM revenues
         WHERE 1=1 ${addDateFilter()}
         GROUP BY DATE(created_at)
         UNION ALL
         SELECT DATE(created_at) AS date, 'expense' AS type, SUM(amount) AS total
         FROM expenses
         WHERE 1=1 ${addDateFilter()}
         GROUP BY DATE(created_at)
         ORDER BY date DESC`,
      ).all(...params);
    case "treasury":
      return [
        ...db.prepare("SELECT name, code, balance, 'treasury' AS source FROM treasuries ORDER BY name ASC").all(),
        ...db.prepare("SELECT name, code, balance, 'bank' AS source FROM banks ORDER BY name ASC").all(),
      ];
    case "vat":
      return db.prepare(
        `SELECT items.tax_rate, SUM(il.line_total) AS taxable_sales
         FROM invoice_lines il
         JOIN items ON items.id = il.item_id
         JOIN invoices i ON i.id = il.invoice_id
         WHERE 1=1 ${addDateFilter("i.created_at")}
         GROUP BY items.tax_rate
         ORDER BY items.tax_rate DESC`,
      ).all(...params);
    case "customer-statement":
      return db.prepare(
        `SELECT COALESCE(c.name, 'عميل نقدي') AS customer_name, i.invoice_no, DATE(i.created_at) AS date, i.status, i.total
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE 1=1 ${addDateFilter("i.created_at")}
         ORDER BY i.created_at DESC`,
      ).all(...params);
    case "top-customers":
      return db.prepare(
        `SELECT COALESCE(c.name, 'عميل نقدي') AS customer_name, COUNT(i.id) AS invoice_count, SUM(i.total) AS total_spent
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE 1=1 ${addDateFilter("i.created_at")}
         GROUP BY c.id
         ORDER BY total_spent DESC`,
      ).all(...params);
    case "shift-history":
      return db.prepare(
        `SELECT s.id, DATE(s.opened_at) AS opened_date, s.status, s.opening_cash, s.closing_cash,
                COALESCE(SUM(i.total), 0) AS sales_total
         FROM shifts s
         LEFT JOIN invoices i ON i.shift_id = s.id
         GROUP BY s.id
         ORDER BY s.id DESC`,
      ).all();
    case "audit-log":
      return db.prepare("SELECT id, user_id, action, resource, payload_json, created_at FROM audit_logs ORDER BY id DESC LIMIT 200").all();
    default:
      return [];
  }
}

router.get("/sales-summary", (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const data = getSalesSummary(start_date, end_date);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/inventory-valuation", (req, res, next) => {
  try {
    const data = getInventoryValuation();
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/cashier-performance", (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const data = getCashierPerformance(start_date, end_date);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

router.get("/low-stock", (req, res, next) => {
  try { res.json({ success: true, data: getLowStock() }); } catch (e) { next(e); }
});

router.get("/payments-report", (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    res.json({ success: true, data: getPaymentsReport(start_date, end_date) });
  } catch (e) { next(e); }
});

router.get("/profit-loss", (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    res.json({ success: true, data: getProfitLoss(start_date, end_date) });
  } catch (e) { next(e); }
});

router.get("/run/:slug", (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const rows = listRows(req.params.slug, start_date, end_date);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/export/:kind", async (req, res, next) => {
  try {
    const kind = req.params.kind;
    const rows =
      kind === "inventory"
        ? getInventoryValuation()
        : kind === "payments"
          ? getPaymentsReport(req.query.start_date, req.query.end_date)
          : getSalesSummary(req.query.start_date, req.query.end_date);

    if ((req.query.format || "excel") === "pdf") {
      const filePath = await exportRowsToPdf(rows, kind);
      return res.json({ success: true, data: { path: filePath } });
    }

    const filePath = await exportRowsToExcel(rows, kind);
    res.json({ success: true, data: { path: filePath } });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
