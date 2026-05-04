const express = require("express");
const { getDb } = require("../config/database");

const router = express.Router();

router.get("/", (_req, res) => {
  const rows = getDb()
    .prepare("SELECT * FROM item_categories ORDER BY CAST(COALESCE(sku_prefix, '0') AS INTEGER) ASC, id ASC")
    .all();
  res.json({ success: true, data: rows });
});

router.post("/", (req, res) => {
  const payload = req.body || {};
  const maxRow = getDb()
    .prepare("SELECT MAX(CAST(sku_prefix AS INTEGER)) AS m FROM item_categories WHERE sku_prefix GLOB '[0-9]*'")
    .get();
  const nextPrefix = String((maxRow?.m || 0) + 1);
  const info = getDb()
    .prepare("INSERT INTO item_categories (name, parent_id, sku_prefix, image_url) VALUES (?, ?, ?, ?)")
    .run(payload.name, payload.parent_id || null, nextPrefix, payload.image_url || null);
  res.status(201).json({
    success: true,
    data: getDb().prepare("SELECT * FROM item_categories WHERE id = ?").get(info.lastInsertRowid),
  });
});

router.put("/:id", (req, res) => {
  const payload = req.body || {};
  const existing = getDb().prepare("SELECT * FROM item_categories WHERE id = ?").get(req.params.id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "الفئة غير موجودة." });
  }
  getDb()
    .prepare("UPDATE item_categories SET name = ?, image_url = ? WHERE id = ?")
    .run(payload.name ?? existing.name, payload.image_url !== undefined ? payload.image_url : existing.image_url, req.params.id);
  res.json({ success: true, data: getDb().prepare("SELECT * FROM item_categories WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", (req, res) => {
  const countRow = getDb().prepare("SELECT COUNT(*) AS c FROM items WHERE category_id = ?").get(req.params.id);
  if (Number(countRow?.c || 0) > 0) {
    return res.status(409).json({
      success: false,
      message: "لا يمكن حذف الفئة لأنها تحتوي على أصناف. احذف الأصناف أو انقلها أولاً.",
    });
  }
  getDb().prepare("DELETE FROM item_categories WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
