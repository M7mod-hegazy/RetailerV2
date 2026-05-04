const express = require("express");
const { getDb } = require("../config/database");

const router = express.Router();

router.get("/", (_req, res) => {
  const rows = getDb().prepare("SELECT * FROM banks ORDER BY name ASC").all();
  res.json({ success: true, data: rows });
});

router.post("/", (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare("INSERT INTO banks (name, code, balance) VALUES (?, ?, ?)")
    .run(payload.name, payload.code || null, Number(payload.balance || 0));
  res.status(201).json({ success: true, data: getDb().prepare("SELECT * FROM banks WHERE id = ?").get(info.lastInsertRowid) });
});

router.put("/:id", (req, res) => {
  const payload = req.body || {};
  getDb().prepare("UPDATE banks SET name = ?, code = ? WHERE id = ?").run(payload.name, payload.code || null, req.params.id);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM banks WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", (req, res) => {
  try {
    getDb().prepare("DELETE FROM banks WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن الحذف لأن هذا البنك مرتبط بعمليات أخرى" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

// GET /api/banks/:id/balance
router.get("/:id/balance", (req, res) => {
  try {
    const bank = getDb().prepare("SELECT id, name, balance FROM banks WHERE id = ?").get(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: "البنك غير موجود" });
    res.json({ success: true, data: bank });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/banks/:id/transactions
router.get("/:id/transactions", (req, res) => {
  try {
    const db = getDb();
    const { from, to, limit = 100 } = req.query;
    const conds = ["bank_id = ?"];
    const params = [req.params.id];
    if (from) { conds.push("date(created_at) >= date(?)"); params.push(from); }
    if (to) { conds.push("date(created_at) <= date(?)"); params.push(to); }
    const rows = db.prepare(`
      SELECT * FROM bank_transactions WHERE ${conds.join(" AND ")}
      ORDER BY created_at DESC LIMIT ?
    `).all(...params, Number(limit));
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/banks/:id/deposit
router.post("/:id/deposit", (req, res) => {
  try {
    const db = getDb();
    const { amount, reference, notes } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "المبلغ مطلوب" });
    db.transaction(() => {
      db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(Number(amount), req.params.id);
      db.prepare("INSERT INTO bank_transactions (bank_id, type, amount, reference, notes, created_by) VALUES (?, 'deposit', ?, ?, ?, ?)")
        .run(req.params.id, Number(amount), reference || null, notes || null, req.user?.id || 1);
    })();
    res.json({ success: true, data: db.prepare("SELECT * FROM banks WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/banks/:id/withdraw
router.post("/:id/withdraw", (req, res) => {
  try {
    const db = getDb();
    const { amount, reference, notes } = req.body || {};
    if (!amount || Number(amount) <= 0) return res.status(400).json({ success: false, message: "المبلغ مطلوب" });
    const bank = db.prepare("SELECT balance FROM banks WHERE id = ?").get(req.params.id);
    if (!bank) return res.status(404).json({ success: false, message: "البنك غير موجود" });
    db.transaction(() => {
      db.prepare("UPDATE banks SET balance = balance - ? WHERE id = ?").run(Number(amount), req.params.id);
      db.prepare("INSERT INTO bank_transactions (bank_id, type, amount, reference, notes, created_by) VALUES (?, 'withdrawal', ?, ?, ?, ?)")
        .run(req.params.id, Number(amount), reference || null, notes || null, req.user?.id || 1);
    })();
    res.json({ success: true, data: db.prepare("SELECT * FROM banks WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
