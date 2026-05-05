const express = require("express");
const fs = require("fs");
const { getDb } = require("../config/database");
const { getSalesSummary, getCashierPerformance } = require("../services/salesAnalytics");
const { getInventoryValuation, getLowStock } = require("../services/stockAnalytics");
const { getPaymentsReport, getProfitLoss } = require("../services/financeAnalytics");
const { exportRowsToExcel, exportRowsToPdf, exportRowsToExcelV2, exportRowsToPdfV2, exportRowsToDocx, exportRowsToPdfV3 } = require("../services/exportService");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

router.use(authRequired);

function listRows(slug, startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const q = String(opts.q || "").trim();
  const status = String(opts.status || "").trim();
  const paymentType = String(opts.payment_type || "").trim();
  const movementType = String(opts.movement_type || "").trim();
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
      // Optional filters: status, payment_type, q (invoice_no/customer)
      // Note: we keep params array order stable.
      return db.prepare(
        `SELECT i.invoice_no, DATE(i.created_at) AS date, COALESCE(c.name, 'عميل نقدي') AS customer_name, i.payment_type, i.status, i.total
         FROM invoices i
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE 1=1
           ${addDateFilter("i.created_at")}
           ${status ? " AND i.status = ?" : ""}
           ${paymentType ? " AND i.payment_type = ?" : ""}
           ${q ? " AND (i.invoice_no LIKE ? OR COALESCE(c.name,'') LIKE ?)" : ""}
         ORDER BY i.created_at DESC`,
      ).all(
        ...params,
        ...(status ? [status] : []),
        ...(paymentType ? [paymentType] : []),
        ...(q ? [`%${q}%`, `%${q}%`] : []),
      );
    case "sales-by-item":
      return db.prepare(
        `SELECT COALESCE(items.code, 'ITEM-' || items.id) AS item_code,
                items.name AS item_name,
                SUM(il.quantity) AS quantity_sold,
                SUM(il.line_total) AS revenue
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
        `SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
                it.name AS item_name,
                COALESCE(SUM(sl.quantity), 0) AS stock_quantity
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
        `SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
                it.name AS item_name,
                COALESCE(SUM(sl.quantity), 0) AS quantity,
                it.min_stock_qty,
                u.name AS unit_name
         FROM items it
         LEFT JOIN stock_levels sl ON sl.item_id = it.id
         LEFT JOIN units u ON u.id = it.unit_id
         GROUP BY it.id
         ORDER BY it.name ASC`,
      ).all();
    case "stock-movements":
      return db.prepare(
        `SELECT COALESCE(i.code, 'ITEM-' || i.id) AS item_code,
                i.name AS item_name,
                sm.movement_type,
                sm.reference_type,
                sm.reference_id,
                sm.quantity,
                DATE(sm.created_at) AS date
         FROM stock_movements sm
         LEFT JOIN items i ON i.id = sm.item_id
         WHERE sm.deleted_at IS NULL
           ${addDateFilter("sm.created_at")}
           ${movementType ? " AND sm.movement_type = ?" : ""}
           ${q ? " AND (COALESCE(i.name,'') LIKE ? OR COALESCE(i.code,'') LIKE ?)" : ""}
         ORDER BY sm.created_at DESC`,
      ).all(
        ...params,
        ...(movementType ? [movementType] : []),
        ...(q ? [`%${q}%`, `%${q}%`] : []),
      );
    case "stock-valuation":
      return getInventoryValuation();
    case "count-sheet":
      return db.prepare(
        `SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
                it.name AS item_name,
                COALESCE(SUM(sl.quantity), 0) AS system_quantity
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
      return db.prepare(
        `SELECT id, user_id, action, resource, payload_json, created_at 
         FROM audit_logs 
         WHERE 1=1 ${addDateFilter("created_at")}
         ORDER BY id DESC 
         LIMIT 500`,
      ).all(...params);

    // ─────────────────────────────────────────────────────────────
    // NEW SALES REPORTS
    // ─────────────────────────────────────────────────────────────
    case "gross-net-sales":
      return db.prepare(
        `SELECT DATE(i.created_at) AS date,
                SUM(i.total) AS gross_sales,
                SUM(i.discount) AS total_discount,
                SUM(i.total - i.discount) AS net_sales,
                COUNT(*) AS invoice_count
         FROM invoices i
         WHERE i.status != 'cancelled' ${addDateFilter("i.created_at")}
         GROUP BY DATE(i.created_at)
         ORDER BY date DESC`,
      ).all(...params);

    case "sales-returns":
      return db.prepare(
        `SELECT r.id, r.invoice_no, DATE(r.created_at) AS date, 
                COALESCE(c.name, 'عميل نقدي') AS customer_name,
                r.total AS return_total, r.reason
         FROM sales_returns r
         LEFT JOIN invoices i ON i.invoice_no = r.invoice_no
         LEFT JOIN customers c ON c.id = i.customer_id
         WHERE 1=1 ${addDateFilter("r.created_at")}
         ORDER BY r.created_at DESC`,
      ).all(...params);

    case "discount-analysis":
      return db.prepare(
        `SELECT i.payment_type,
                COUNT(*) AS invoice_count,
                SUM(i.discount) AS total_discount,
                AVG(i.discount) AS avg_discount,
                SUM(i.total) AS total_sales
         FROM invoices i
         WHERE i.discount > 0 AND i.status != 'cancelled' ${addDateFilter("i.created_at")}
         GROUP BY i.payment_type
         ORDER BY total_discount DESC`,
      ).all(...params);

    case "margin-by-item":
      return db.prepare(
        `SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
                it.name AS item_name,
                SUM(il.quantity) AS quantity_sold,
                SUM(il.line_total) AS revenue,
                SUM(il.quantity * it.cost_price) AS cost,
                SUM(il.line_total) - SUM(il.quantity * it.cost_price) AS profit_margin,
                CASE WHEN SUM(il.line_total) > 0 
                     THEN ROUND(((SUM(il.line_total) - SUM(il.quantity * it.cost_price)) / SUM(il.line_total)) * 100, 1)
                     ELSE 0 END AS margin_percent
         FROM invoice_lines il
         JOIN invoices i ON i.id = il.invoice_id
         JOIN items it ON it.id = il.item_id
         WHERE i.status != 'cancelled' ${addDateFilter("i.created_at")}
         GROUP BY it.id
         ORDER BY profit_margin DESC`,
      ).all(...params);

    case "margin-by-category":
      return db.prepare(
        `SELECT COALESCE(c.name, 'غير مصنف') AS category_name,
                SUM(il.quantity) AS quantity_sold,
                SUM(il.line_total) AS revenue,
                SUM(il.quantity * it.cost_price) AS cost,
                SUM(il.line_total) - SUM(il.quantity * it.cost_price) AS profit_margin,
                CASE WHEN SUM(il.line_total) > 0 
                     THEN ROUND(((SUM(il.line_total) - SUM(il.quantity * it.cost_price)) / SUM(il.line_total)) * 100, 1)
                     ELSE 0 END AS margin_percent
         FROM invoice_lines il
         JOIN invoices i ON i.id = il.invoice_id
         JOIN items it ON it.id = il.item_id
         LEFT JOIN item_categories c ON c.id = it.category_id
         WHERE i.status != 'cancelled' ${addDateFilter("i.created_at")}
         GROUP BY c.id
         ORDER BY profit_margin DESC`,
      ).all(...params);

    // ─────────────────────────────────────────────────────────────
    // PURCHASES REPORTS
    // ─────────────────────────────────────────────────────────────
    case "purchase-summary":
      return db.prepare(
        `SELECT DATE(p.created_at) AS date,
                COUNT(*) AS purchase_count,
                SUM(p.total) AS total_purchases
         FROM purchases p
         WHERE p.status != 'cancelled' ${addDateFilter("p.created_at")}
         GROUP BY DATE(p.created_at)
         ORDER BY date DESC`,
      ).all(...params);

    case "detailed-purchases":
      return db.prepare(
        `SELECT p.id, p.purchase_no, DATE(p.created_at) AS date,
                s.name AS supplier_name, p.total, p.status, p.payment_type
         FROM purchases p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE 1=1 ${addDateFilter("p.created_at")}
         ORDER BY p.created_at DESC`,
      ).all(...params);

    case "purchases-by-supplier":
      return db.prepare(
        `SELECT s.name AS supplier_name,
                COUNT(p.id) AS purchase_count,
                SUM(p.total) AS total_purchases
         FROM purchases p
         JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.status != 'cancelled' ${addDateFilter("p.created_at")}
         GROUP BY s.id
         ORDER BY total_purchases DESC`,
      ).all(...params);

    case "purchases-by-item":
      return db.prepare(
        `SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
                it.name AS item_name,
                SUM(pl.quantity) AS quantity_purchased,
                SUM(pl.line_total) AS total_cost
         FROM purchase_lines pl
         JOIN purchases p ON p.id = pl.purchase_id
         JOIN items it ON it.id = pl.item_id
         WHERE p.status != 'cancelled' ${addDateFilter("p.created_at")}
         GROUP BY it.id
         ORDER BY total_cost DESC`,
      ).all(...params);

    case "purchase-returns":
      return db.prepare(
        `SELECT pr.id, pr.purchase_no, DATE(pr.created_at) AS date,
                s.name AS supplier_name, pr.total AS return_total, pr.reason
         FROM purchase_returns pr
         LEFT JOIN purchases p ON p.purchase_no = pr.purchase_no
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE 1=1 ${addDateFilter("pr.created_at")}
         ORDER BY pr.created_at DESC`,
      ).all(...params);

    case "supplier-pricing":
      return db.prepare(
        `SELECT s.name AS supplier_name,
                it.name AS item_name,
                pl.unit_price,
                DATE(p.created_at) AS purchase_date
         FROM purchase_lines pl
         JOIN purchases p ON p.id = pl.purchase_id
         JOIN suppliers s ON s.id = p.supplier_id
         JOIN items it ON it.id = pl.item_id
         WHERE p.status != 'cancelled' ${addDateFilter("p.created_at")}
         ORDER BY it.name, p.created_at DESC`,
      ).all(...params);

    // ─────────────────────────────────────────────────────────────
    // INVENTORY REPORTS (NEW)
    // ─────────────────────────────────────────────────────────────
    case "inventory-aging":
      return db.prepare(
        `SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
                it.name AS item_name,
                COALESCE(sl.quantity, 0) AS quantity,
                it.cost_price,
                COALESCE(sl.quantity, 0) * it.cost_price AS total_value,
                CASE 
                  WHEN COALESCE(sl.quantity, 0) = 0 THEN 'نفذ'
                  WHEN COALESCE(sl.quantity, 0) <= it.min_stock_qty THEN 'منخفض'
                  ELSE 'متاح'
                END AS stock_status
         FROM items it
         LEFT JOIN stock_levels sl ON sl.item_id = it.id
         ORDER BY sl.quantity ASC`,
      ).all();

    case "dead-stock":
      return db.prepare(
        `SELECT COALESCE(it.code, 'ITEM-' || it.id) AS item_code,
                it.name AS item_name,
                COALESCE(sl.quantity, 0) AS quantity,
                it.cost_price,
                COALESCE(sl.quantity, 0) * it.cost_price AS total_value
         FROM items it
         LEFT JOIN stock_levels sl ON sl.item_id = it.id
         WHERE it.id NOT IN (
           SELECT DISTINCT il.item_id
           FROM invoice_lines il
           JOIN invoices i ON i.id = il.invoice_id
           WHERE 1=1 ${addDateFilter("i.created_at")}
         )
         AND COALESCE(sl.quantity, 0) > 0
         ORDER BY sl.quantity DESC`,
      ).all(...params);

    // ─────────────────────────────────────────────────────────────
    // TREASURY REPORTS (NEW)
    // ─────────────────────────────────────────────────────────────
    case "cash-consistency":
      return db.prepare(
        `SELECT DATE(opened_at) AS date,
                id AS shift_id,
                opening_cash,
                closing_cash,
                (closing_cash - opening_cash) AS variance,
                status
         FROM shifts
         WHERE 1=1 ${addDateFilter("opened_at")}
         ORDER BY opened_at DESC`,
      ).all(...params);

    case "payment-method-flow":
      return db.prepare(
        `SELECT i.payment_type,
                DATE(i.created_at) AS date,
                COUNT(*) AS transaction_count,
                SUM(i.total) AS total_amount
         FROM invoices i
         WHERE i.status = 'paid' ${addDateFilter("i.created_at")}
         GROUP BY i.payment_type, DATE(i.created_at)
         ORDER BY date DESC, total_amount DESC`,
      ).all(...params);

    case "bank-cash-split":
      return [
        ...db.prepare("SELECT 'treasury' AS type, name, balance FROM treasuries").all(),
        ...db.prepare("SELECT 'bank' AS type, name, balance FROM banks").all(),
      ];

    case "reconciliation-exceptions":
      return db.prepare(
        `SELECT DATE(opened_at) AS date,
                id AS shift_id,
                opening_cash,
                closing_cash,
                (closing_cash - opening_cash) AS variance,
                status
         FROM shifts
         WHERE ABS(closing_cash - opening_cash) > 0.01
           ${addDateFilter("opened_at")}
         ORDER BY opened_at DESC`,
      ).all(...params);

    // ─────────────────────────────────────────────────────────────
    // TAX REPORTS (NEW)
    // ─────────────────────────────────────────────────────────────
    case "output-vat":
      return db.prepare(
        `SELECT it.tax_rate,
                SUM(il.line_total) AS taxable_amount,
                SUM(il.line_total * it.tax_rate / 100) AS vat_amount
         FROM invoice_lines il
         JOIN invoices i ON i.id = il.invoice_id
         JOIN items it ON it.id = il.item_id
         WHERE i.status != 'cancelled' ${addDateFilter("i.created_at")}
         GROUP BY it.tax_rate
         ORDER BY it.tax_rate DESC`,
      ).all(...params);

    case "input-vat":
      return db.prepare(
        `SELECT it.tax_rate,
                SUM(pl.line_total) AS taxable_amount,
                SUM(pl.line_total * it.tax_rate / 100) AS vat_amount
         FROM purchase_lines pl
         JOIN purchases p ON p.id = pl.purchase_id
         JOIN items it ON it.id = pl.item_id
         WHERE p.status != 'cancelled' ${addDateFilter("p.created_at")}
         GROUP BY it.tax_rate
         ORDER BY it.tax_rate DESC`,
      ).all(...params);

    case "vat-filing-summary":
      return db.prepare(
        `SELECT 
                (SELECT COALESCE(SUM(il.line_total * it.tax_rate / 100), 0)
                 FROM invoice_lines il
                 JOIN invoices i ON i.id = il.invoice_id
                 JOIN items it ON it.id = il.item_id
                 WHERE i.status != 'cancelled' AND DATE(i.created_at) BETWEEN ? AND ?) AS output_vat,
                (SELECT COALESCE(SUM(pl.line_total * it.tax_rate / 100), 0)
                 FROM purchase_lines pl
                 JOIN purchases p ON p.id = pl.purchase_id
                 JOIN items it ON it.id = pl.item_id
                 WHERE p.status != 'cancelled' AND DATE(p.created_at) BETWEEN ? AND ?) AS input_vat`,
      ).get(startDate || params[0], endDate || params[1], startDate || params[0], endDate || params[1]);

    case "returns-tax-effect":
      return db.prepare(
        `SELECT DATE(r.created_at) AS date,
                r.total AS return_amount,
                SUM(il.line_total * it.tax_rate / 100) AS vat_reversed
         FROM sales_returns r
         LEFT JOIN invoices i ON i.invoice_no = r.invoice_no
         LEFT JOIN invoice_lines il ON il.invoice_id = i.id
         LEFT JOIN items it ON it.id = il.item_id
         WHERE 1=1 ${addDateFilter("r.created_at")}
         GROUP BY r.id
         ORDER BY r.created_at DESC`,
      ).all(...params);

    // ─────────────────────────────────────────────────────────────
    // ACCOUNTS REPORTS (NEW)
    // ─────────────────────────────────────────────────────────────
    case "collection-efficiency":
      return db.prepare(
        `SELECT c.name AS customer_name,
                COUNT(DISTINCT i.id) AS total_invoices,
                SUM(i.total) AS total_billed,
                SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) AS collected,
                SUM(CASE WHEN i.status != 'paid' THEN i.total ELSE 0 END) AS outstanding,
                CASE WHEN SUM(i.total) > 0 
                     THEN ROUND((SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) / SUM(i.total)) * 100, 1)
                     ELSE 0 END AS collection_rate
         FROM customers c
         LEFT JOIN invoices i ON i.customer_id = c.id AND DATE(i.created_at) BETWEEN ? AND ?
         GROUP BY c.id
         HAVING total_billed > 0
         ORDER BY collection_rate ASC`,
      ).all(startDate || params[0], endDate || params[1]);

    case "supplier-statement":
      return db.prepare(
        `SELECT p.purchase_no, DATE(p.created_at) AS date,
                s.name AS supplier_name, p.total, p.status, p.payment_type
         FROM purchases p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         WHERE 1=1 ${addDateFilter("p.created_at")}
         ORDER BY p.created_at DESC`,
      ).all(...params);

    // ─────────────────────────────────────────────────────────────
    // AUDIT REPORTS (NEW)
    // ─────────────────────────────────────────────────────────────
    case "user-activity":
      return db.prepare(
        `SELECT user_id, action, resource, COUNT(*) AS action_count,
                DATE(created_at) AS date
         FROM audit_logs
         WHERE 1=1 ${addDateFilter("created_at")}
         GROUP BY user_id, action, resource, DATE(created_at)
         ORDER BY date DESC`,
      ).all(...params);

    default:
      return [];
  }
}

function labelForKey(key) {
  const labels = {
    item_code: "كود الصنف",
    code: "كود الصنف",
    sku: "كود SKU",
    barcode: "الباركود",
    item_name: "اسم الصنف",
    name: "الاسم",
    invoice_no: "رقم الفاتورة",
    customer_name: "العميل",
    supplier_name: "المورد",
    date: "التاريخ",
    total: "الإجمالي",
    total_sales: "إجمالي المبيعات",
    invoice_count: "عدد الفواتير",
    quantity: "الكمية",
    quantity_sold: "الكمية المباعة",
    stock_quantity: "رصيد المخزون",
    system_quantity: "رصيد النظام",
    category_name: "التصنيف",
    payment_type: "طريقة الدفع",
    status: "الحالة",
    balance: "الرصيد",
    source: "المصدر",
    tax_rate: "نسبة الضريبة",
    taxable_sales: "المبيعات الخاضعة",
    outstanding_balance: "الرصيد المستحق",
    hour_slot: "الساعة",
    weekday: "يوم الأسبوع",
    action: "الإجراء",
    resource: "الكيان",
    created_at: "تاريخ الإنشاء",
    line_total: "إجمالي السطر",
    movement_type: "نوع الحركة",
    reference_type: "نوع المرجع",
    reference_id: "رقم المرجع",
    revenue: "الإيراد",
    min_stock_qty: "حد أدنى للمخزون",
    min_stock: "حد أدنى",
    unit_name: "الوحدة",
    total_quantity: "إجمالي الكمية",
    cost_price: "سعر التكلفة",
    total_value: "القيمة الإجمالية",
    total_spent: "إجمالي الإنفاق",
    payload_json: "تفاصيل",
    user_id: "المستخدم",
    // Sales labels
    gross_sales: "المبيعات الإجمالية",
    net_sales: "المبيعات الصافية",
    total_discount: "إجمالي الخصم",
    avg_discount: "متوسط الخصم",
    return_total: "إجمالي المرتجع",
    reason: "السبب",
    profit_margin: "هامش الربح",
    margin_percent: "نسبة الربح %",
    cost: "التكلفة",
    // Purchase labels
    purchase_count: "عدد المشتريات",
    total_purchases: "إجمالي المشتريات",
    purchase_no: "رقم الشراء",
    quantity_purchased: "الكمية المشتراة",
    total_cost: "إجمالي التكلفة",
    unit_price: "سعر الوحدة",
    purchase_date: "تاريخ الشراء",
    stock_status: "حالة المخزون",
    // Treasury labels
    shift_id: "رقم الوردية",
    opening_cash: "النقد الافتتاحي",
    closing_cash: "النقد الختامي",
    variance: "الفرق",
    transaction_count: "عدد المعاملات",
    total_amount: "إجمالي المبلغ",
    type: "النوع",
    // Tax labels
    taxable_amount: "المبلغ الخاضع",
    vat_amount: "قيمة الضريبة",
    output_vat: "ضريبة المخرجات",
    input_vat: "ضريبة المدخلات",
    return_amount: "قيمة المرتجع",
    vat_reversed: "الضريبة المستردة",
    total_invoices: "إجمالي الفواتير",
    total_billed: "إجمالي الفوترة",
    collected: "المحصل",
    outstanding: "المستحق",
    collection_rate: "نسبة التحصيل %",
    action_count: "عدد العمليات",
  };
  return labels[key] || key;
}

function buildColumnsFromRows(rows) {
  const sample = rows?.[0] || null;
  if (!sample) return [];
  const keys = Object.keys(sample);
  const first = [];
  const used = new Set();
  for (const k of ["item_code", "code", "sku", "barcode"]) {
    if (keys.includes(k)) { first.push(k); used.add(k); }
  }
  for (const k of ["item_name", "name"]) {
    if (keys.includes(k) && !used.has(k)) { first.push(k); used.add(k); }
  }
  const ordered = [...first, ...keys.filter((k) => !used.has(k))];
  return ordered.map((k) => ({ key: k, label: labelForKey(k) }));
}

// ─────────────────────────────────────────────────────────────
// REPORT REGISTRY - Server-side report definitions
// ─────────────────────────────────────────────────────────────

const REPORT_REGISTRY = {
  categories: [
    { id: "sales", label: "مبيعات" },
    { id: "purchases", label: "مشتريات" },
    { id: "inventory", label: "مخزون" },
    { id: "accounts", label: "حسابات" },
    { id: "treasury", label: "خزينة" },
    { id: "tax", label: "ضرائب" },
    { id: "audit", label: "تدقيق" },
  ],
  reports: [
    // Sales
    { id: "R01", cat: "sales", title: "الملخص اليومي للمبيعات", desc: "إيرادات وخصومات وعدد فواتير حسب اليوم.", slug: "daily-sales", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R02", cat: "sales", title: "المبيعات التفصيلية", desc: "كل الفواتير مع بيانات العميل وطريقة الدفع.", slug: "detailed-sales", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: ["status", "payment_type", "q"] },
    { id: "R03", cat: "sales", title: "مبيعات حسب الصنف", desc: "الأصناف الأكثر بيعاً حسب الكمية والإيراد.", slug: "sales-by-item", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R04", cat: "sales", title: "مبيعات حسب الفئة", desc: "توزيع المبيعات على التصنيفات.", slug: "sales-by-category", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R05", cat: "sales", title: "مبيعات حسب الكاشير", desc: "أداء المستخدمين حسب المبيعات وعدد الفواتير.", slug: "sales-by-cashier", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R06", cat: "sales", title: "مبيعات حسب طريقة الدفع", desc: "تجميع الفواتير حسب طريقة السداد.", slug: "sales-by-payment", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R07", cat: "sales", title: "خريطة حرارة المبيعات", desc: "توزيع الذروة حسب اليوم والساعة.", slug: "sales-heatmap", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
    { id: "R09", cat: "sales", title: "مقارنة فترتين", desc: "مقارنة مختصرة لملخص المبيعات.", slug: "period-comparison", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
    { id: "R29", cat: "sales", title: "المبيعات الإجمالية والصافية", desc: "إجمالي المبيعات بعد الخصومات والمرتجعات.", slug: "gross-net-sales", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R30", cat: "sales", title: "تقرير المرتجعات", desc: "تفاصيل مرتجعات المبيعات وتأثيرها.", slug: "sales-returns", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R31", cat: "sales", title: "تحليل الخصومات", desc: "إجمالي الخصومات وأنواعها وتأثيرها.", slug: "discount-analysis", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R32", cat: "sales", title: "هامش الربح حسب الصنف", desc: "تحليل هوامش الربح لكل صنف.", slug: "margin-by-item", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R33", cat: "sales", title: "هامش الربح حسب الفئة", desc: "تحليل هوامش الربح لكل تصنيف.", slug: "margin-by-category", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R27", cat: "sales", title: "تاريخ الورديات", desc: "إجماليات الورديات وفروق الصندوق.", slug: "shift-history", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },

    // Purchases
    { id: "R34", cat: "purchases", title: "ملخص المشتريات", desc: "إجمالي المشتريات حسب التاريخ والمورد.", slug: "purchase-summary", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R35", cat: "purchases", title: "المشتريات التفصيلية", desc: "تفاصيل أوامر الشراء والاستلام.", slug: "detailed-purchases", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R36", cat: "purchases", title: "مشتريات حسب المورد", desc: "تجميع المشتريات حسب المورد.", slug: "purchases-by-supplier", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R37", cat: "purchases", title: "مشتريات حسب الصنف", desc: "الأصناف الأكثر شراءً.", slug: "purchases-by-item", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R38", cat: "purchases", title: "مرتجعات المشتريات", desc: "تفاصيل مرتجعات المشتريات.", slug: "purchase-returns", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R39", cat: "purchases", title: "تحليل أسعار التوريد", desc: "مقارنة أسعار الموردين وتغيراتها.", slug: "supplier-pricing", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },

    // Inventory
    { id: "R10", cat: "inventory", title: "الأصناف الراكدة", desc: "أصناف لم تسجل مبيعات خلال الفترة.", slug: "slow-moving", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R11", cat: "inventory", title: "مستوى المخزون الحالي", desc: "الأرصدة الحالية وحدود إعادة الطلب.", slug: "stock-levels", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R12", cat: "inventory", title: "حركة المخزون التفصيلية", desc: "تفاصيل حركات المخزون.", slug: "stock-movements", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: ["movement_type", "q"] },
    { id: "R13", cat: "inventory", title: "تقييم المخزون", desc: "قيمة المخزون الحالية حسب التكلفة.", slug: "stock-valuation", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R14", cat: "inventory", title: "ورقة جرد المخزون", desc: "رصيد النظام الحالي لكل صنف.", slug: "count-sheet", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
    { id: "R15", cat: "inventory", title: "تقرير إعادة الطلب", desc: "الأصناف منخفضة المخزون.", slug: "reorder", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
    { id: "R16", cat: "inventory", title: "تقرير انتهاء الصلاحية", desc: "يتطلب تفعيل تتبع الصلاحية (قيد الإعداد).", slug: "expiry", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
    { id: "R40", cat: "inventory", title: "تقادم المخزون", desc: "تحليل أعمار المخزون.", slug: "inventory-aging", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R41", cat: "inventory", title: "المخزون الراكد", desc: "أصناف بدون حركة لفترة طويلة.", slug: "dead-stock", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },

    // Accounts
    { id: "R17", cat: "accounts", title: "الملخص المالي اليومي", desc: "إجماليات مبيعات حسب التاريخ.", slug: "daily-financial", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R18", cat: "accounts", title: "ذمم العملاء", desc: "الأرصدة المستحقة على العملاء.", slug: "ar-aging", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R19", cat: "accounts", title: "ذمم الموردين", desc: "الأرصدة المستحقة للموردين.", slug: "ap-aging", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R20", cat: "accounts", title: "الأرباح والخسائر", desc: "إيرادات وتكاليف ومصروفات وصافي الربح.", slug: "profit-loss", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R24", cat: "accounts", title: "كشف حساب العميل", desc: "حركة فواتير العملاء خلال الفترة.", slug: "customer-statement", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R25", cat: "accounts", title: "أفضل العملاء", desc: "العملاء الأعلى إنفاقاً.", slug: "top-customers", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R26", cat: "accounts", title: "تحليل تقادم الذمم", desc: "تقادم الأرصدة المدينة.", slug: "customer-aging", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R42", cat: "accounts", title: "كفاءة التحصيل", desc: "تحليل سرعة تحصيل المستحقات.", slug: "collection-efficiency", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R43", cat: "accounts", title: "كشف حساب المورد", desc: "حركة فواتير الموردين خلال الفترة.", slug: "supplier-statement", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },

    // Treasury
    { id: "R21", cat: "treasury", title: "التدفق النقدي", desc: "واردات وصادرات نقدية حسب التاريخ.", slug: "cash-flow", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R22", cat: "treasury", title: "الخزائن والحسابات البنكية", desc: "أرصدة الخزائن والبنوك.", slug: "treasury", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R44", cat: "treasury", title: "تناسق الصندوق", desc: "مطابقة أرصدة الصندوق الافتتاحية والختامية.", slug: "cash-consistency", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
    { id: "R45", cat: "treasury", title: "تدفق وسائل الدفع", desc: "تحليل التدفقات حسب طريقة الدفع.", slug: "payment-method-flow", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R46", cat: "treasury", title: "مقارنة البنك والصندوق", desc: "توزيع الأرصدة بين البنوك والصناديق.", slug: "bank-cash-split", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
    { id: "R47", cat: "treasury", title: "استثناءات التسوية", desc: "فروق التسوية والمشاكل المحاسبية.", slug: "reconciliation-exceptions", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },

    // Tax
    { id: "R23", cat: "tax", title: "ضريبة القيمة المضافة", desc: "المبيعات الخاضعة حسب نسبة الضريبة.", slug: "vat", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R48", cat: "tax", title: "ضريبة المخرجات", desc: "ضريبة المبيعات المستحقة.", slug: "output-vat", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R49", cat: "tax", title: "ضريبة المدخلات", desc: "ضريبة المشتريات القابلة للاسترداد.", slug: "input-vat", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R50", cat: "tax", title: "ملخص الإقرار الضريبي", desc: "ملخص شامل للفترة الضريبية.", slug: "vat-filing-summary", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R51", cat: "tax", title: "تأثير المرتجعات الضريبي", desc: "تأثير المرتجعات على الضريبة.", slug: "returns-tax-effect", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },

    // Audit
    { id: "R08", cat: "audit", title: "تقرير الاستثناءات", desc: "الفواتير ذات الخصومات أو الحالات غير المعتادة.", slug: "exceptions", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
    { id: "R28", cat: "audit", title: "سجل التدقيق", desc: "سجل الأنشطة مع فلترة متقدمة.", slug: "audit-log", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
    { id: "R52", cat: "audit", title: "عمليات المستخدمين", desc: "تتبع أنشطة المستخدمين التفصيلية.", slug: "user-activity", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
  ],
};

// GET /api/reports/registry - Return all report definitions
router.get("/registry", (_req, res) => {
  res.json({ success: true, data: REPORT_REGISTRY });
});

// GET /api/reports/registry/:slug - Return single report definition
router.get("/registry/:slug", (req, res) => {
  const { slug } = req.params;
  const report = REPORT_REGISTRY.reports.find((r) => r.slug === slug);
  if (!report) {
    return res.status(404).json({ success: false, message: "Report not found" });
  }
  res.json({ success: true, data: report });
});

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
    const { start_date, end_date, q, status, payment_type, movement_type } = req.query;
    const rows = listRows(req.params.slug, start_date, end_date, { q, status, payment_type, movement_type });
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

// Export any report by slug (Arabic-friendly Excel, PDF, Word).
// Generates the file, reads it into a buffer, sends directly, then cleans up.
router.get("/export-slug/:slug", async (req, res, next) => {
  try {
    const { start_date, end_date, format, q, status, payment_type, movement_type } = req.query;
    const slug = String(req.params.slug || "");
    console.log(`[EXPORT] slug=${slug} format=${format || "excel"} dates=${start_date}→${end_date}`);

    const rows = listRows(slug, start_date, end_date, { q, status, payment_type, movement_type }) || [];
    console.log(`[EXPORT] rows=${rows.length}`);

    if (!rows.length) {
      console.warn(`[EXPORT] No data for slug=${slug}`);
    }

    const columns = buildColumnsFromRows(rows) || [];
    // Get Arabic title from registry
    const reportDef = REPORT_REGISTRY.reports.find(r => r.slug === slug);
    const reportTitle = reportDef?.title || slug;
    const filters = start_date && end_date ? { from: start_date, to: end_date } : null;

    let filePath;
    let contentType;
    let extension;

    if (format === "word" || format === "docx") {
      filePath = await exportRowsToDocx({ rows, title: reportTitle, columns, rtl: true });
      contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      extension = "docx";
    } else if (format === "pdf") {
      filePath = await exportRowsToPdfV3({ rows, title: reportTitle, columns, filters });
      contentType = "application/pdf";
      extension = "pdf";
    } else {
      // Default to Excel
      filePath = await exportRowsToExcelV2({ rows, worksheetName: reportTitle, columns, rtl: true });
      contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      extension = "xlsx";
    }

    // Read the generated file into memory and send it directly.
    // This avoids streaming race conditions and guarantees the full buffer goes out.
    const buffer = fs.readFileSync(filePath);
    console.log(`[EXPORT] file=${filePath} size=${buffer.length} type=${extension}`);

    const filename = `${slug}-${Date.now()}.${extension}`;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "no-store");
    // Explicit CORS headers for download
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.send(buffer);

    // Delete temp file after sending response
    res.on("finish", () => {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    });
    res.on("error", () => {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    });
  } catch (error) {
    console.error(`[EXPORT] ERROR slug=${req.params.slug} format=${req.query.format}:`, error);
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
