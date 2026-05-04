const express = require("express");
const { getDb } = require("../config/database");

const router = express.Router();

router.get("/", (_req, res) => {
  const rows = getDb().prepare("SELECT * FROM warehouses ORDER BY name ASC").all();
  res.json({ success: true, data: rows });
});

router.post("/", (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare("INSERT INTO warehouses (name, code, is_default) VALUES (?, ?, ?)")
    .run(payload.name, payload.code || null, payload.is_default ? 1 : 0);

  if (payload.is_default) {
    getDb().prepare("UPDATE warehouses SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END").run(info.lastInsertRowid);
  }

  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM warehouses WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare("UPDATE warehouses SET name = ?, code = ?, is_default = ? WHERE id = ?")
    .run(payload.name, payload.code || null, payload.is_default ? 1 : 0, req.params.id);
  if (payload.is_default) {
    getDb().prepare("UPDATE warehouses SET is_default = CASE WHEN id = ? THEN 1 ELSE 0 END").run(req.params.id);
  }
  res.json({ success: true, data: getDb().prepare("SELECT * FROM warehouses WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", (req, res) => {
  try {
    getDb().prepare("DELETE FROM warehouses WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف المستودع لأنه مرتبط بحركات مخزنية" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

module.exports = router;
