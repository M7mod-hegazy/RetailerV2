const express = require("express");
const { getDb } = require("../config/database");

const router = express.Router();

router.get("/", (req, res, next) => {
  try {
    const db = getDb();
    const data = db.prepare("SELECT * FROM branches ORDER BY name").all();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/", (req, res, next) => {
  try {
    const db = getDb();
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "اسم الفرع مطلوب" });

    const stmt = db.prepare("INSERT INTO branches (name) VALUES (?)");
    const result = stmt.run(name);
    res.status(201).json({ success: true, data: { id: result.lastInsertRowid, name } });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ success: false, message: "اسم الفرع موجود مسبقاً" });
    }
    next(err);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "اسم الفرع مطلوب" });

    const stmt = db.prepare("UPDATE branches SET name = ? WHERE id = ?");
    stmt.run(name, id);
    res.json({ success: true });
  } catch (err) {
    if (err.message.includes("UNIQUE constraint")) {
      return res.status(400).json({ success: false, message: "اسم الفرع موجود مسبقاً" });
    }
    next(err);
  }
});

router.delete("/:id", (req, res, next) => {
  try {
    const db = getDb();
    const id = Number(req.params.id);
    db.prepare("DELETE FROM branches WHERE id = ?").run(id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
