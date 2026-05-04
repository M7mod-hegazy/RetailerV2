const express = require("express");
const { getDb } = require("../config/database");

const router = express.Router();

/** Get or auto-create today's session */
router.get("/today", (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    let session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(today);

    if (!session) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const prev = db.prepare("SELECT closing_balance FROM daily_sessions WHERE date = ? AND status = 'closed'").get(yesterday);
      const openingBalance = prev?.closing_balance ?? 0;

      db.prepare(
        "INSERT INTO daily_sessions (date, opening_balance, status) VALUES (?, ?, 'open')"
      ).run(today, openingBalance);

      session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(today);
    }

    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Check if yesterday's session is unclosed */
router.get("/yesterday/alert", (req, res) => {
  try {
    const db = getDb();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const sess = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(yesterday);
    const unclosed = sess && sess.status === "open";
    res.json({ success: true, data: { unclosed, session: sess || null } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Get today's full financial equation */
router.get("/today/summary", (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);

    const session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(today);
    if (!session) return res.json({ success: true, data: null });

    // POS sales cash
    const posSales = db.prepare(`
      SELECT COALESCE(SUM(i.total), 0) AS total, COUNT(*) AS count
      FROM invoices i
      WHERE date(i.created_at) = ? AND i.payment_type = 'cash' AND i.status != 'cancelled'
    `).get(today);

    // POS bank/card sales
    const posBankSales = db.prepare(`
      SELECT COALESCE(SUM(i.total), 0) AS total
      FROM invoices i
      WHERE date(i.created_at) = ? AND i.payment_type = 'bank_transfer' AND i.status != 'cancelled'
    `).get(today);

    // All POS sales
    const posAllSales = db.prepare(`
      SELECT COALESCE(SUM(i.total), 0) AS total, COUNT(*) AS count
      FROM invoices i
      WHERE date(i.created_at) = ? AND i.status != 'cancelled'
    `).get(today);

    // Purchases (cash out) — purchases table has no payment_method, use total
    const purchases = db.prepare(`
      SELECT COALESCE(SUM(total), 0) AS total
      FROM purchases
      WHERE date(created_at) = ?
    `).get(today);

    // Expenses (cash out)
    const expenses = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
      FROM expenses
      WHERE date(created_at) = ? AND payment_method = 'cash'
    `).get(today);

    // Revenues (cash in)
    const revenues = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
      FROM revenues
      WHERE date(created_at) = ?
    `).get(today);

    // Customer payments (cash in) via payments table
    const cpRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
      FROM payments
      WHERE date(created_at) = ? AND party_type = 'customer' AND method = 'cash'
    `).get(today);
    const customerPayments = cpRow.total || 0;
    const customerPaymentsCount = cpRow.count || 0;

    // Withdrawals
    const withdrawals = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM daily_withdrawals
      WHERE session_id = ?
    `).get(session.id);

    const expectedCash =
      session.opening_balance
      + (posSales.total || 0)
      - (purchases.total || 0)
      - (expenses.total || 0)
      + (revenues.total || 0)
      + customerPayments
      - (withdrawals.total || 0);

    // Yesterday comparison
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const yPosSales = db.prepare(`SELECT COALESCE(SUM(total), 0) AS total FROM invoices WHERE date(created_at) = ? AND status != 'cancelled'`).get(yesterday);
    const yExpenses = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE date(created_at) = ? AND payment_method = 'cash'`).get(yesterday);

    res.json({
      success: true,
      data: {
        session,
        opening_balance: session.opening_balance,
        pos_cash_sales: posSales.total || 0,
        pos_cash_sales_count: posSales.count || 0,
        pos_bank_sales: posBankSales.total || 0,
        pos_all_sales: posAllSales.total || 0,
        pos_all_sales_count: posAllSales.count || 0,
        purchases_cash: purchases.total || 0,
        expenses_cash: expenses.total || 0,
        expenses_count: expenses.count || 0,
        revenues_cash: revenues.total || 0,
        revenues_count: revenues.count || 0,
        customer_payments: customerPayments,
        customer_payments_count: customerPaymentsCount,
        withdrawals: withdrawals.total || 0,
        expected_cash: expectedCash,
        actual_cash: session.actual_cash,
        discrepancy: session.actual_cash != null ? session.actual_cash - expectedCash : null,
        yesterday: {
          pos_all_sales: yPosSales.total || 0,
          expenses_cash: yExpenses.total || 0,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Get transactions by type (supports date param for historical) */
router.get("/today/transactions", (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const { type = "pos", page = 1, limit = 100, search = "", date: queryDate } = req.query;
    const targetDate = queryDate || today;
    const offset = (Number(page) - 1) * Number(limit);
    const like = `%${search}%`;

    let rows = [];

    if (type === "pos") {
      rows = db.prepare(`
        SELECT i.id, i.invoice_no AS doc_no, i.total AS amount, i.payment_type,
               i.created_at, c.name AS party, i.status, 'pos_invoice' AS doc_type
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        WHERE date(i.created_at) = ? AND i.status != 'cancelled'
          AND (? = '' OR i.invoice_no LIKE ? OR c.name LIKE ? OR CAST(i.total AS TEXT) LIKE ?)
        ORDER BY i.created_at DESC LIMIT ? OFFSET ?
      `).all(targetDate, search, like, like, like, Number(limit), offset);

    } else if (type === "expenses") {
      rows = db.prepare(`
        SELECT e.id, e.doc_no, e.amount, 'expense' AS doc_type,
               e.created_at, ec.name AS party, e.description, e.notes
        FROM expenses e
        LEFT JOIN expense_categories ec ON ec.id = e.category_id
        WHERE date(e.created_at) = ?
          AND (? = '' OR e.doc_no LIKE ? OR ec.name LIKE ? OR CAST(e.amount AS TEXT) LIKE ?)
        ORDER BY e.id DESC LIMIT ? OFFSET ?
      `).all(targetDate, search, like, like, like, Number(limit), offset);

    } else if (type === "revenues") {
      rows = db.prepare(`
        SELECT r.id, r.doc_no, r.amount, 'revenue' AS doc_type,
               r.created_at, rc.name AS party, r.notes AS description
        FROM revenues r
        LEFT JOIN revenue_categories rc ON rc.id = r.category_id
        WHERE date(r.created_at) = ?
          AND (? = '' OR r.doc_no LIKE ? OR rc.name LIKE ? OR CAST(r.amount AS TEXT) LIKE ?)
        ORDER BY r.id DESC LIMIT ? OFFSET ?
      `).all(targetDate, search, like, like, like, Number(limit), offset);

    } else if (type === "purchases") {
      rows = db.prepare(`
        SELECT p.id, p.doc_no, p.total AS amount, 'purchase' AS doc_type,
               p.created_at, s.name AS party, NULL AS description
        FROM purchases p
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        WHERE date(p.created_at) = ?
          AND (? = '' OR p.doc_no LIKE ? OR s.name LIKE ? OR CAST(p.total AS TEXT) LIKE ?)
        ORDER BY p.id DESC LIMIT ? OFFSET ?
      `).all(targetDate, search, like, like, like, Number(limit), offset);

    } else if (type === "customer_payments") {
      rows = db.prepare(`
        SELECT py.id, NULL AS doc_no, py.amount, 'customer_payment' AS doc_type,
               py.created_at, c.name AS party, NULL AS description
        FROM payments py
        LEFT JOIN customers c ON c.id = py.party_id
        WHERE date(py.created_at) = ? AND py.party_type = 'customer'
          AND (? = '' OR c.name LIKE ? OR CAST(py.amount AS TEXT) LIKE ?)
        ORDER BY py.id DESC LIMIT ? OFFSET ?
      `).all(targetDate, search, like, like, Number(limit), offset);

    } else if (type === "withdrawals") {
      const session = db.prepare("SELECT id FROM daily_sessions WHERE date = ?").get(targetDate);
      if (session) {
        rows = db.prepare(`
          SELECT dw.id, NULL AS doc_no, dw.amount, 'withdrawal' AS doc_type,
                 dw.created_at, NULL AS party, dw.note AS description
          FROM daily_withdrawals dw
          WHERE dw.session_id = ?
            AND (? = '' OR CAST(dw.amount AS TEXT) LIKE ? OR dw.note LIKE ?)
          ORDER BY dw.id DESC
        `).all(session.id, search, like, like);
      }

    } else if (type === "all") {
      rows = db.prepare(`
        SELECT id, invoice_no AS doc_no, total AS amount, 'pos_invoice' AS doc_type, created_at,
               (SELECT name FROM customers WHERE id = customer_id) AS party, NULL AS description
        FROM invoices WHERE date(created_at) = ? AND status != 'cancelled'
          AND (? = '' OR CAST(total AS TEXT) LIKE ? OR invoice_no LIKE ?)
        UNION ALL
        SELECT id, doc_no, amount, 'expense', created_at,
               (SELECT name FROM expense_categories WHERE id = category_id), description
        FROM expenses WHERE date(created_at) = ?
          AND (? = '' OR CAST(amount AS TEXT) LIKE ? OR doc_no LIKE ?)
        UNION ALL
        SELECT id, doc_no, amount, 'revenue', created_at,
               (SELECT name FROM revenue_categories WHERE id = category_id), notes
        FROM revenues WHERE date(created_at) = ?
          AND (? = '' OR CAST(amount AS TEXT) LIKE ? OR doc_no LIKE ?)
        UNION ALL
        SELECT id, doc_no, total, 'purchase', created_at,
               (SELECT name FROM suppliers WHERE id = supplier_id), NULL
        FROM purchases WHERE date(created_at) = ?
          AND (? = '' OR CAST(total AS TEXT) LIKE ? OR doc_no LIKE ?)
        UNION ALL
        SELECT id, NULL, amount, 'customer_payment', created_at,
               (SELECT name FROM customers WHERE id = party_id), NULL
        FROM payments WHERE date(created_at) = ? AND party_type = 'customer'
          AND (? = '' OR CAST(amount AS TEXT) LIKE ?)
        ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(
        targetDate, search, like, like,
        targetDate, search, like, like,
        targetDate, search, like, like,
        targetDate, search, like, like,
        targetDate, search, like,
        Number(limit), offset
      );
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Add a withdrawal */
router.post("/today/withdrawals", (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const { amount, note } = req.body || {};
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "المبلغ مطلوب" });
    }

    let session = db.prepare("SELECT id FROM daily_sessions WHERE date = ?").get(today);
    if (!session) return res.status(400).json({ success: false, message: "لا توجد جلسة مفتوحة اليوم" });

    db.prepare(
      "INSERT INTO daily_withdrawals (session_id, amount, note, created_by) VALUES (?, ?, ?, ?)"
    ).run(session.id, Number(amount), note || null, req.user?.id || 1);

    db.prepare(
      "UPDATE daily_sessions SET total_withdrawals = total_withdrawals + ? WHERE id = ?"
    ).run(Number(amount), session.id);

    res.status(201).json({ success: true, data: { message: "تم تسجيل المسحوبات" } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Close today's session */
router.post("/today/close", (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const { actual_cash, notes } = req.body || {};

    const session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(today);
    if (!session) return res.status(400).json({ success: false, message: "لا توجد جلسة اليوم" });
    if (session.status === "closed") return res.status(400).json({ success: false, message: "الجلسة مغلقة بالفعل" });
    if (actual_cash == null) return res.status(400).json({ success: false, message: "أدخل الرصيد الفعلي" });

    const posSales = db.prepare(`SELECT COALESCE(SUM(total),0) AS t FROM invoices WHERE date(created_at)=? AND payment_type='cash' AND status!='cancelled'`).get(today).t;
    const purchases = db.prepare(`SELECT COALESCE(SUM(total),0) AS t FROM purchases WHERE date(created_at)=?`).get(today).t;
    const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) AS t FROM expenses WHERE date(created_at)=? AND payment_method='cash'`).get(today).t;
    const revenues = db.prepare(`SELECT COALESCE(SUM(amount),0) AS t FROM revenues WHERE date(created_at)=?`).get(today).t;
    const cpCash = db.prepare(`SELECT COALESCE(SUM(amount),0) AS t FROM payments WHERE date(created_at)=? AND party_type='customer' AND method='cash'`).get(today).t;
    const withdrawals = db.prepare(`SELECT COALESCE(SUM(amount),0) AS t FROM daily_withdrawals WHERE session_id=?`).get(session.id).t;

    const expectedCash = session.opening_balance + posSales - purchases - expenses + revenues + cpCash - withdrawals;
    const actualCash = Number(actual_cash);
    const discrepancy = actualCash - expectedCash;
    const closingBalance = actualCash;

    db.prepare(`
      UPDATE daily_sessions
      SET actual_cash = ?, closing_balance = ?, discrepancy = ?,
          status = 'closed', notes = ?, closed_at = datetime('now'), closed_by = ?
      WHERE id = ?
    `).run(actualCash, closingBalance, discrepancy, notes || null, req.user?.id || 1, session.id);

    res.json({ success: true, data: db.prepare("SELECT * FROM daily_sessions WHERE id = ?").get(session.id) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Force-close yesterday's session */
router.post("/yesterday/force-close", (req, res) => {
  try {
    const db = getDb();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(yesterday);
    if (!session) return res.status(404).json({ success: false, message: "لا توجد جلسة بالأمس" });
    if (session.status === "closed") return res.json({ success: true, data: session });

    db.prepare(`
      UPDATE daily_sessions SET status = 'closed', closing_balance = opening_balance,
      actual_cash = 0, discrepancy = 0, closed_at = datetime('now'), closed_by = ?
      WHERE id = ?
    `).run(req.user?.id || 1, session.id);

    res.json({ success: true, data: db.prepare("SELECT * FROM daily_sessions WHERE id = ?").get(session.id) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** List past sessions */
router.get("/", (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM daily_sessions ORDER BY date DESC LIMIT 60").all();
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Summary for a specific past date */
router.get("/:date/summary", (req, res) => {
  try {
    const db = getDb();
    const { date } = req.params;
    const session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(date);
    if (!session) return res.status(404).json({ success: false, message: "لا توجد جلسة لهذا اليوم" });

    const posSales = db.prepare(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM invoices WHERE date(created_at)=? AND status!='cancelled'`).get(date);
    const expenses = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE date(created_at)=? AND payment_method='cash'`).get(date);
    const revenues = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM revenues WHERE date(created_at)=?`).get(date);
    const purchases = db.prepare(`SELECT COALESCE(SUM(total),0) AS total FROM purchases WHERE date(created_at)=?`).get(date);
    const cpCash = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM payments WHERE date(created_at)=? AND party_type='customer' AND method='cash'`).get(date);
    const withdrawals = db.prepare(`SELECT COALESCE(SUM(amount),0) AS total FROM daily_withdrawals WHERE session_id=?`).get(session.id);

    res.json({
      success: true,
      data: {
        session,
        opening_balance: session.opening_balance,
        pos_all_sales: posSales.total,
        pos_all_sales_count: posSales.count,
        pos_cash_sales: posSales.total,
        expenses_cash: expenses.total,
        revenues_cash: revenues.total,
        purchases_cash: purchases.total,
        customer_payments: cpCash.total,
        withdrawals: withdrawals.total,
        expected_cash: session.closing_balance ?? 0,
        actual_cash: session.actual_cash,
        discrepancy: session.discrepancy,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Single session by date */
router.get("/:date", (req, res) => {
  try {
    const db = getDb();
    const session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(req.params.date);
    if (!session) return res.status(404).json({ success: false, message: "لا توجد جلسة لهذا اليوم" });
    res.json({ success: true, data: session });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
