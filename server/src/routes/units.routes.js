const express = require("express");
const { getDb } = require("../config/database");

const router = express.Router();

router.get("/", (_req, res) => {
  const rows = getDb().prepare("SELECT * FROM units ORDER BY name ASC").all();
  res.json({ success: true, data: rows });
});

router.post("/", (req, res) => {
  const payload = req.body || {};
  const info = getDb().prepare("INSERT INTO units (name, symbol, is_active) VALUES (?, ?, ?)").run(
    payload.name,
    payload.symbol || null,
    payload.is_active === false ? 0 : 1,
  );
  res.status(201).json({ success: true, data: getDb().prepare("SELECT * FROM units WHERE id = ?").get(info.lastInsertRowid) });
});

router.put("/:id", (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare("UPDATE units SET name = ?, symbol = ?, is_active = ? WHERE id = ?")
    .run(payload.name, payload.symbol || null, payload.is_active === false ? 0 : 1, req.params.id);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM units WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", (req, res) => {
  try {
    getDb().prepare("DELETE FROM units WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف الوحدة لأنها مرتبطة بأصناف" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

module.exports = router;
