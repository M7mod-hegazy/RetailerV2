const express = require("express");
const { getDb } = require("../config/database");
const { generateDocNumber } = require("../utils/docNumber");

const router = express.Router();

// Helper to recalc debt status
function recalcDebt(db, debtId) {
  const d = db.prepare("SELECT * FROM ajal_debts WHERE id = ?").get(debtId);
  if (!d) return;
  const remaining = d.original_amount - d.paid_amount;
  let status = "open";
  if (remaining <= 0) status = "paid";
  else if (d.paid_amount > 0) status = "partial";
  else if (d.due_date && new Date(d.due_date) < new Date()) status = "overdue";
  db.prepare("UPDATE ajal_debts SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, debtId);
}

// GET /api/ajal-debts/summary
router.get("/summary", (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const open = db.prepare(`SELECT COALESCE(SUM(original_amount - paid_amount),0) AS total, COUNT(*) AS count FROM ajal_debts WHERE status != 'paid'`).get();
    const overdue = db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(original_amount - paid_amount),0) AS amount FROM ajal_debts WHERE status = 'overdue' OR (due_date < ? AND status != 'paid')`).get(today);
    const dueToday = db.prepare(`SELECT COUNT(*) AS count FROM ajal_debts WHERE due_date = ? AND status != 'paid'`).get(today);
    const customers = db.prepare(`SELECT COUNT(DISTINCT customer_id) AS count FROM ajal_debts WHERE status != 'paid'`).get();
    res.json({ success: true, data: { total_owed: open.total, open_count: open.count, overdue_count: overdue.count, overdue_amount: overdue.amount, due_today: dueToday.count, debtors: customers.count } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-debts
router.get("/", (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const { status, customer_id, search = "", overdue } = req.query;
    const conds = ["1=1"];
    const params = [];

    if (status && status !== "all") { conds.push("d.status = ?"); params.push(status); }
    if (overdue === "1") { conds.push("(d.due_date < ? AND d.status != 'paid')"); params.push(today); }
    if (customer_id) { conds.push("d.customer_id = ?"); params.push(customer_id); }
    if (search) { conds.push("(c.name LIKE ? OR i.invoice_no LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }

    const rows = db.prepare(`
      SELECT d.*, c.name AS customer_name, c.phone AS customer_phone,
             i.invoice_no, (d.original_amount - d.paid_amount) AS remaining
      FROM ajal_debts d
      LEFT JOIN customers c ON c.id = d.customer_id
      LEFT JOIN invoices i ON i.id = d.invoice_id
      WHERE ${conds.join(" AND ")}
      ORDER BY d.created_at DESC
      LIMIT 200
    `).all(...params);

    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-debts/customer/:customerId
router.get("/customer/:customerId", (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT d.*, i.invoice_no, (d.original_amount - d.paid_amount) AS remaining
      FROM ajal_debts d LEFT JOIN invoices i ON i.id = d.invoice_id
      WHERE d.customer_id = ? ORDER BY d.created_at DESC
    `).all(req.params.customerId);
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/ajal-debts/:id
router.get("/:id", (req, res) => {
  try {
    const db = getDb();
    const debt = db.prepare(`
      SELECT d.*, c.name AS customer_name, c.phone, i.invoice_no, (d.original_amount - d.paid_amount) AS remaining
      FROM ajal_debts d
      LEFT JOIN customers c ON c.id = d.customer_id
      LEFT JOIN invoices i ON i.id = d.invoice_id
      WHERE d.id = ?
    `).get(req.params.id);
    if (!debt) return res.status(404).json({ success: false, message: "الدين غير موجود" });
    const payments = db.prepare(`
      SELECT ap.*, pm.name AS method_name FROM ajal_payments ap
      LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
      WHERE ap.debt_id = ? ORDER BY ap.created_at DESC
    `).all(req.params.id);
    const schedule = db.prepare("SELECT * FROM ajal_schedules WHERE debt_id = ? ORDER BY installment_no").all(req.params.id);
    res.json({ success: true, data: { ...debt, payments, schedule } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/ajal-debts/:id/pay
router.post("/:id/pay", (req, res) => {
  try {
    const db = getDb();
    const { amount, payment_method_id, notes, payment_date } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "المبلغ مطلوب" });

    const debt = db.prepare("SELECT * FROM ajal_debts WHERE id = ?").get(req.params.id);
    if (!debt) return res.status(404).json({ success: false, message: "الدين غير موجود" });
    if (debt.status === "paid") return res.status(400).json({ success: false, message: "تم سداد هذا الدين بالكامل" });

    const payAmount = Math.min(Number(amount), debt.original_amount - debt.paid_amount);

    db.transaction(() => {
      db.prepare(`INSERT INTO ajal_payments (debt_id, amount, payment_method_id, payment_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(debt.id, payAmount, payment_method_id || 1, payment_date || new Date().toISOString().slice(0, 10), notes || null, req.user?.id || 1);
      db.prepare("UPDATE ajal_debts SET paid_amount = paid_amount + ? WHERE id = ?").run(payAmount, debt.id);
      recalcDebt(db, debt.id);

      // Update customer balance
      db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(payAmount, debt.customer_id);

      // Update treasury only if payment method doesn't exclude from treasury
      const pm = db.prepare("SELECT excludes_from_treasury FROM payment_methods WHERE id = ?").get(payment_method_id || 1);
      if (!pm || !pm.excludes_from_treasury) {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = 1").run(payAmount);
      }
    })();

    res.json({ success: true, data: db.prepare("SELECT * FROM ajal_debts WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/ajal-debts/:id/schedule
router.post("/:id/schedule", (req, res) => {
  try {
    const db = getDb();
    const { installments, frequency = "monthly", start_date } = req.body || {};
    if (!installments || installments < 1) return res.status(400).json({ success: false, message: "عدد الأقساط مطلوب" });

    const debt = db.prepare("SELECT * FROM ajal_debts WHERE id = ?").get(req.params.id);
    if (!debt) return res.status(404).json({ success: false, message: "الدين غير موجود" });

    const remaining = debt.original_amount - debt.paid_amount;
    const perInstallment = Math.ceil((remaining / installments) * 100) / 100;
    const start = start_date ? new Date(start_date) : new Date();
    const freqDays = frequency === "weekly" ? 7 : frequency === "biweekly" ? 14 : 30;

    // Delete existing schedule
    db.prepare("DELETE FROM ajal_schedules WHERE debt_id = ?").run(debt.id);

    db.transaction(() => {
      for (let i = 1; i <= installments; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + freqDays * i);
        db.prepare("INSERT INTO ajal_schedules (debt_id, installment_no, due_date, amount, status) VALUES (?, ?, ?, ?, 'pending')")
          .run(debt.id, i, d.toISOString().slice(0, 10), i === installments ? remaining - perInstallment * (i - 1) : perInstallment);
      }
    })();

    const schedule = db.prepare("SELECT * FROM ajal_schedules WHERE debt_id = ? ORDER BY installment_no").all(debt.id);
    res.json({ success: true, data: schedule });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
