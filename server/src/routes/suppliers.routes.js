const express = require("express");
const { getDb } = require("../config/database");

const router = express.Router();

router.get("/", (_req, res) => {
  const rows = getDb().prepare("SELECT * FROM suppliers ORDER BY id DESC").all();
  res.json({ success: true, data: rows });
});

router.post("/", (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare(
      `INSERT INTO suppliers
       (name, phone, code, opening_balance, payment_terms, bank_details, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      payload.name,
      payload.phone || null,
      payload.code || null,
      Number(payload.opening_balance || 0),
      payload.payment_terms || null,
      payload.bank_details || null,
      payload.is_active === false ? 0 : 1,
    );
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM suppliers WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare(
      `UPDATE suppliers
       SET name = ?, phone = ?, code = ?, opening_balance = ?, payment_terms = ?, bank_details = ?, is_active = ?
       WHERE id = ?`,
    )
    .run(
      payload.name,
      payload.phone || null,
      payload.code || null,
      Number(payload.opening_balance || 0),
      payload.payment_terms || null,
      payload.bank_details || null,
      payload.is_active === false ? 0 : 1,
      req.params.id,
    );
  res.json({ success: true, data: getDb().prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", (req, res) => {
  try {
    getDb().prepare("DELETE FROM suppliers WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف المورد لأنه مرتبط بفواتير مشتريات" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

router.get("/:id", (req, res) => {
  const supplier = getDb().prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id);
  if (!supplier) return res.status(404).json({ success: false, message: "المورد غير موجود" });
  res.json({ success: true, data: supplier });
});

router.post("/:id/adjust", (req, res) => {
  const { amount, reason, direction } = req.body || {};
  const delta = direction === 'subtract' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));
  try {
    getDb().transaction(() => {
      getDb().prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(delta, req.params.id);
      getDb().prepare("INSERT INTO supplier_notes (supplier_id, note, created_by) VALUES (?, ?, ?)")
        .run(req.params.id, `تسوية رصيد بقيمة ${delta > 0 ? '+' : ''}${delta}: ${reason || 'بدون سبب'}`, req.user?.id || null);
    })();
    res.json({ success: true, data: getDb().prepare("SELECT * FROM suppliers WHERE id = ?").get(req.params.id) });
  } catch (e) {
    res.status(500).json({ success: false, message: "خطأ أثناء التسوية" });
  }
});

router.get("/:id/notes", (req, res) => {
  const notes = getDb().prepare("SELECT n.*, u.name as user_name FROM supplier_notes n LEFT JOIN users u ON u.id = n.created_by WHERE supplier_id = ? ORDER BY n.created_at DESC").all(req.params.id);
  res.json({ success: true, data: notes });
});

router.post("/:id/notes", (req, res) => {
  const { note } = req.body || {};
  if (!note) return res.status(400).json({ success: false, message: "الملاحظة مطلوبة" });
  const result = getDb().prepare("INSERT INTO supplier_notes (supplier_id, note, created_by) VALUES (?, ?, ?)")
    .run(req.params.id, note, req.user?.id || null);
  const newNote = getDb().prepare("SELECT n.*, u.name as user_name FROM supplier_notes n LEFT JOIN users u ON u.id = n.created_by WHERE n.id = ?").get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: newNote });
});

module.exports = router;
