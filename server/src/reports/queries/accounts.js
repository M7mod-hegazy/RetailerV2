const { getDb } = require("../../config/database");
const { addDateFilter } = require("../helpers");
const { getProfitLoss } = require("../../services/reportService");

function arAging(startDate, endDate, opts = {}) {
  const db = getDb();
  const { customer_id } = opts;
  const params = [];
  return db.prepare(`
    SELECT c.name AS customer_name,
      c.phone,
      c.id AS customer_id,
      COUNT(DISTINCT i.id) AS invoice_count,
      COALESCE(c.opening_balance, 0) + COALESCE(SUM(CASE WHEN i.status != 'paid' THEN i.total ELSE 0 END), 0) AS total_due,
      COALESCE(SUM(CASE WHEN i.status != 'paid' AND julianday('now') - julianday(i.created_at) <= 30 THEN i.total ELSE 0 END), 0) AS aging_0_30,
      COALESCE(SUM(CASE WHEN i.status != 'paid' AND julianday('now') - julianday(i.created_at) BETWEEN 31 AND 60 THEN i.total ELSE 0 END), 0) AS aging_31_60,
      COALESCE(SUM(CASE WHEN i.status != 'paid' AND julianday('now') - julianday(i.created_at) BETWEEN 61 AND 90 THEN i.total ELSE 0 END), 0) AS aging_61_90,
      COALESCE(SUM(CASE WHEN i.status != 'paid' AND julianday('now') - julianday(i.created_at) > 90 THEN i.total ELSE 0 END), 0) AS aging_90_plus,
      MAX(DATE(i.created_at)) AS last_invoice_date
    FROM customers c
    LEFT JOIN invoices i ON i.customer_id = c.id
    WHERE 1=1 ${customer_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    ORDER BY total_due DESC
  `).all(...(customer_id ? [customer_id] : []));
}

function apAging(startDate, endDate, opts = {}) {
  const db = getDb();
  const { supplier_id } = opts;
  const params = [];
  return db.prepare(`
    SELECT s.name AS supplier_name,
      s.phone,
      s.id AS supplier_id,
      COUNT(DISTINCT p.id) AS purchase_count,
      COALESCE(s.opening_balance, 0) + COALESCE(SUM(CASE WHEN p.status != 'paid' THEN p.total ELSE 0 END), 0) AS total_due,
      COALESCE(SUM(CASE WHEN (p.status IS NULL OR p.status != 'paid') AND julianday('now') - julianday(p.created_at) <= 30 THEN p.total ELSE 0 END), 0) AS aging_0_30,
      COALESCE(SUM(CASE WHEN (p.status IS NULL OR p.status != 'paid') AND julianday('now') - julianday(p.created_at) BETWEEN 31 AND 60 THEN p.total ELSE 0 END), 0) AS aging_31_60,
      COALESCE(SUM(CASE WHEN (p.status IS NULL OR p.status != 'paid') AND julianday('now') - julianday(p.created_at) BETWEEN 61 AND 90 THEN p.total ELSE 0 END), 0) AS aging_61_90,
      COALESCE(SUM(CASE WHEN (p.status IS NULL OR p.status != 'paid') AND julianday('now') - julianday(p.created_at) > 90 THEN p.total ELSE 0 END), 0) AS aging_90_plus,
      MAX(DATE(p.created_at)) AS last_purchase_date
    FROM suppliers s
    LEFT JOIN purchases p ON p.supplier_id = s.id
    WHERE 1=1 ${supplier_id ? " AND s.id = ?" : ""}
    GROUP BY s.id
    ORDER BY total_due DESC
  `).all(...(supplier_id ? [supplier_id] : []));
}

function profitLoss(startDate, endDate, opts = {}) {
  const result = getProfitLoss(startDate, endDate);
  if (!result || Array.isArray(result)) return result || [];
  return [{
    label: "الإيرادات",
    amount: result.revenue,
    pct: 100,
    section: "revenue",
  }, {
    label: "الخصومات",
    amount: result.discounts,
    pct: result.revenue > 0 ? Math.round((result.discounts / result.revenue) * 100) : 0,
    section: "revenue",
  }, {
    label: "تكلفة البضاعة المباعة",
    amount: result.cost_of_goods_sold,
    pct: result.revenue > 0 ? Math.round((result.cost_of_goods_sold / result.revenue) * 100) : 0,
    section: "cogs",
  }, {
    label: "إجمالي الربح",
    amount: result.gross_profit,
    pct: result.revenue > 0 ? Math.round((result.gross_profit / result.revenue) * 100) : 0,
    section: "gross_profit",
  }, {
    label: "المصروفات",
    amount: result.expenses,
    pct: result.revenue > 0 ? Math.round((result.expenses / result.revenue) * 100) : 0,
    section: "expenses",
  }, {
    label: "صافي الربح",
    amount: result.net_profit,
    pct: result.revenue > 0 ? Math.round((result.net_profit / result.revenue) * 100) : 0,
    section: "net_profit",
  }];
}

function customerStatement(startDate, endDate, opts = {}) {
  const db = getDb();
  const customerId = opts.customer_id;
  if (!customerId) return [];
  const customer = db.prepare("SELECT name, COALESCE(opening_balance, 0) AS opening_balance FROM customers WHERE id = ?").get(customerId);
  if (!customer) return [];
  const params = [];
  const txns = db.prepare(`
    SELECT i.invoice_no AS ref_no, DATE(i.created_at) AS date,
      'فاتورة' AS type, i.total AS amount, i.status
    FROM invoices i
    WHERE i.customer_id = ? ${addDateFilter("i.created_at", startDate, endDate, params)}
    UNION ALL
    SELECT p.reference_number AS ref_no, DATE(p.created_at) AS date,
      'دفعة' AS type, -p.amount AS amount, 'paid' AS status
    FROM payments p
    WHERE p.party_type = 'customer' AND p.party_id = ?
      ${addDateFilter("p.created_at", startDate, endDate, [])}
    ORDER BY date ASC
  `).all(customerId, ...params, customerId);
  let running = customer.opening_balance;
  const rows = txns.map(t => {
    running += Number(t.amount);
    return { ...t, running_balance: running };
  });
  return {
    customer_name: customer.name,
    opening_balance: customer.opening_balance,
    closing_balance: running,
    transactions: rows,
  };
}

function topCustomers(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT COALESCE(c.name, 'نقدي') AS customer_name,
      c.phone,
      c.id AS customer_id,
      COUNT(i.id) AS invoice_count,
      SUM(i.total) AS total_spent,
      ROUND(AVG(i.total), 2) AS avg_order_value,
      MAX(DATE(i.created_at)) AS last_purchase_date,
      c.loyalty_points, c.loyalty_tier
    FROM invoices i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.status != 'cancelled' ${addDateFilter("i.created_at", startDate, endDate, params)}
      ${customer_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    ORDER BY total_spent DESC
  `).all(...params, ...(customer_id ? [customer_id] : []));
}

function collectionEfficiency(startDate, endDate, opts = {}) {
  const db = getDb();
  const params = [];
  const { customer_id } = opts;
  return db.prepare(`
    SELECT c.name AS customer_name,
      c.id AS customer_id,
      COUNT(DISTINCT i.id) AS total_invoices,
      SUM(i.total) AS total_billed,
      SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) AS collected,
      SUM(CASE WHEN i.status != 'paid' THEN i.total ELSE 0 END) AS outstanding,
      CASE WHEN SUM(i.total) > 0
        THEN ROUND((SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END) / SUM(i.total)) * 100, 1)
        ELSE 0 END AS collection_rate,
      ROUND(AVG(CASE WHEN i.status = 'paid' THEN julianday(i.updated_at) - julianday(i.created_at) ELSE NULL END), 1) AS days_to_collect
    FROM customers c
    LEFT JOIN invoices i ON i.customer_id = c.id
      AND DATE(i.created_at) >= ? AND DATE(i.created_at) <= ?
    WHERE 1=1 ${customer_id ? " AND c.id = ?" : ""}
    GROUP BY c.id
    HAVING total_billed > 0
    ORDER BY collection_rate ASC
  `).all(startDate || "", endDate || "", ...(customer_id ? [customer_id] : []));
}

function supplierStatement(startDate, endDate, opts = {}) {
  const db = getDb();
  const supplierId = opts.supplier_id;
  if (!supplierId) return [];
  const supplier = db.prepare("SELECT name, COALESCE(opening_balance, 0) AS opening_balance FROM suppliers WHERE id = ?").get(supplierId);
  if (!supplier) return [];
  const params = [];
  const txns = db.prepare(`
    SELECT p.purchase_no AS ref_no, DATE(p.created_at) AS date,
      'مشتريات' AS type, p.total AS amount, p.status
    FROM purchases p
    WHERE p.supplier_id = ? ${addDateFilter("p.created_at", startDate, endDate, params)}
    ORDER BY date ASC
  `).all(supplierId, ...params);
  let running = supplier.opening_balance;
  const rows = txns.map(t => {
    running += Number(t.amount);
    return { ...t, running_balance: running };
  });
  return {
    supplier_name: supplier.name,
    opening_balance: supplier.opening_balance,
    closing_balance: running,
    transactions: rows,
  };
}

module.exports = {
  arAging,
  apAging,
  profitLoss,
  customerStatement,
  topCustomers,
  collectionEfficiency,
  supplierStatement,
};
