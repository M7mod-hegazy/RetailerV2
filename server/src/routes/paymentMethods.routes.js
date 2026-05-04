const express = require("express");
const router = express.Router();
const { getDb } = require("../config/database");

router.get("/", (_req, res) => {
  try {
    const rows = getDb().prepare("SELECT * FROM payment_methods ORDER BY id ASC").all();
    res.json({ success: true, data: rows });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post("/", (req, res) => {
  try {
    const db = getDb();
    const { name, category = "digital_wallet", icon = "💳", description = "", excludes_from_treasury = 1 } = req.body || {};
    if (!name) return res.status(400).json({ success: false, message: "الاسم مطلوب" });
    const result = db.prepare(
      "INSERT INTO payment_methods (name, category, icon, description, is_system, excludes_from_treasury, type) VALUES (?, ?, ?, ?, 0, ?, ?)"
    ).run(name, category, icon, description, excludes_from_treasury ? 1 : 0, category);
    const created = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ success: true, data: created });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.put("/:id", (req, res) => {
  try {
    const db = getDb();
    const method = db.prepare("SELECT is_system FROM payment_methods WHERE id = ?").get(req.params.id);
    if (!method) return res.status(404).json({ success: false, message: "وسيلة الدفع غير موجودة" });
    const { name, category, icon, description, excludes_from_treasury } = req.body || {};
    db.prepare(
      "UPDATE payment_methods SET name = COALESCE(?, name), category = COALESCE(?, category), icon = COALESCE(?, icon), description = COALESCE(?, description), excludes_from_treasury = COALESCE(?, excludes_from_treasury) WHERE id = ?"
    ).run(method.is_system ? undefined : name, category, icon, description, excludes_from_treasury != null ? (excludes_from_treasury ? 1 : 0) : undefined, req.params.id);
    res.json({ success: true, data: db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(req.params.id) });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.delete("/:id", (req, res) => {
  try {
    const db = getDb();
    const method = db.prepare("SELECT is_system, name FROM payment_methods WHERE id = ?").get(req.params.id);
    if (!method) return res.status(404).json({ success: false, message: "وسيلة الدفع غير موجودة" });
    if (method.is_system) return res.status(403).json({ success: false, message: `لا يمكن حذف "${method.name}" — وسيلة دفع محمية من النظام` });
    db.prepare("DELETE FROM payment_methods WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

module.exports = router;
