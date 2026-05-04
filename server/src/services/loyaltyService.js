const { getDb } = require("../config/database");

function earnPointsForInvoice(customerId, invoiceId, points, userId = null) {
  const db = getDb();
  const customer = db.prepare("SELECT loyalty_points FROM customers WHERE id = ?").get(customerId);
  const nextBalance = Number(customer?.loyalty_points || 0) + Number(points || 0);

  db.prepare("UPDATE customers SET loyalty_points = ? WHERE id = ?").run(nextBalance, customerId);
  db.prepare(
    "INSERT INTO loyalty_transactions (customer_id, invoice_id, points, source, transaction_type, balance_after, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(customerId, invoiceId || null, Number(points || 0), "invoice", "earn", nextBalance, userId);

  return nextBalance;
}

function calculateEarnedPoints(invoiceTotal) {
  return Math.floor(Number(invoiceTotal || 0) / 100);
}

module.exports = { earnPointsForInvoice, calculateEarnedPoints };
