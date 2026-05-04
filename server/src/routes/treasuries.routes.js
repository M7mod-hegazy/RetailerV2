const express = require("express");
const { getDb } = require("../config/database");

const router = express.Router();

router.get("/", (_req, res) => {
  const rows = getDb().prepare("SELECT * FROM treasuries ORDER BY name ASC").all();
  res.json({ success: true, data: rows });
});

router.post("/", (req, res) => {
  const payload = req.body || {};
  const info = getDb()
    .prepare("INSERT INTO treasuries (name, code, balance) VALUES (?, ?, ?)")
    .run(payload.name, payload.code || null, Number(payload.balance || 0));
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM treasuries WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", (req, res) => {
  const payload = req.body || {};
  getDb()
    .prepare("UPDATE treasuries SET name = ?, code = ?, balance = ? WHERE id = ?")
    .run(payload.name, payload.code || null, Number(payload.balance || 0), req.params.id);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM treasuries WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", (req, res) => {
  try {
    getDb().prepare("DELETE FROM treasuries WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message?.includes("FOREIGN KEY")) return res.status(409).json({ success: false, message: "لا يمكن حذف الخزينة لأنها مرتبطة بعمليات مالية" });
    res.status(500).json({ success: false, message: "تعذر الحذف" });
  }
});

module.exports = router;
