const express = require("express");
const { getDb } = require("../config/database");
const { adjustStock } = require("../services/stockService");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("../services/dailySessionService");

const router = express.Router();

function ensurePurchaseReturnSettlementSchema(db) {
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN settlement_type TEXT NOT NULL DEFAULT 'account'"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN treasury_id INTEGER REFERENCES treasuries(id)"); } catch (_) {}
}

function getPurchaseWithLines(db, purchaseId) {
  const purchase = db.prepare(`
    SELECT p.*, s.name AS supplier_name
    FROM purchases p LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE p.id = ?
  `).get(purchaseId);
  if (!purchase) return null;
  const lines = db.prepare(`
    SELECT pl.*, i.name AS item_name,
           COALESCE((SELECT SUM(prl.quantity) FROM purchase_return_lines prl WHERE prl.purchase_line_id = pl.id), 0) AS returned_quantity
    FROM purchase_lines pl
    LEFT JOIN items i ON i.id = pl.item_id
    WHERE pl.purchase_id = ?
    ORDER BY pl.id ASC
  `).all(purchaseId);
  return {
    ...purchase,
    lines: lines.map(l => ({ ...l, returnable_quantity: Math.max(0, l.quantity - (l.returned_quantity || 0)) })),
  };
}

router.get("/", (req, res) => {
  const db = getDb();
  const { search = "", supplier_id, date_from, date_to } = req.query;
  const conditions = ["1=1"];
  const params = [];
  if (search) {
    conditions.push("(s.name LIKE ? OR CAST(p.id AS TEXT) LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (supplier_id) { conditions.push("p.supplier_id = ?"); params.push(supplier_id); }
  if (date_from) { conditions.push("date(p.created_at) >= date(?)"); params.push(date_from); }
  if (date_to) { conditions.push("date(p.created_at) <= date(?)"); params.push(date_to); }
  const purchases = db.prepare(`
    SELECT p.*, s.name AS supplier_name,
           (SELECT COUNT(*) FROM purchase_lines WHERE purchase_id = p.id) AS items_count
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.id DESC
  `).all(...params);
  res.json({ success: true, data: purchases });
});

router.get("/returns", (req, res) => {
  const db = getDb();
  ensurePurchaseReturnSettlementSchema(db);
  const { search = "", supplier_id, date_from, date_to } = req.query;
  const conditions = ["1=1"];
  const params = [];
  if (search) {
    conditions.push("(s.name LIKE ? OR CAST(pr.id AS TEXT) LIKE ? OR CAST(pr.purchase_id AS TEXT) LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (supplier_id) { conditions.push("pr.supplier_id = ?"); params.push(supplier_id); }
  if (date_from) { conditions.push("date(pr.created_at) >= date(?)"); params.push(date_from); }
  if (date_to) { conditions.push("date(pr.created_at) <= date(?)"); params.push(date_to); }
  const returns = db.prepare(`
    SELECT pr.*, s.name AS supplier_name
    FROM purchase_returns pr
    LEFT JOIN suppliers s ON s.id = pr.supplier_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY pr.id DESC
  `).all(...params);
  res.json({ success: true, data: returns });
});

router.get("/returns/:id", (req, res, next) => {
    try {
      const db = getDb();
      ensurePurchaseReturnSettlementSchema(db);
      const pr = db.prepare("SELECT * FROM purchase_returns WHERE id = ?").get(req.params.id);
      if (!pr) throw new Error("Return not found");
      const lines = db.prepare(`
        SELECT prl.*, i.name as item_name
        FROM purchase_return_lines prl
        LEFT JOIN items i ON i.id = prl.item_id
        WHERE prl.purchase_return_id = ?
      `).all(req.params.id);
      res.json({ success: true, data: { ...pr, lines } });
    } catch (e) { next(e); }
});

router.get("/:id", (req, res, next) => {
  try {
    const purchase = getPurchaseWithLines(getDb(), Number(req.params.id));
    if (!purchase) {
      const error = new Error("Purchase not found");
      error.status = 404;
      throw error;
    }
    res.json({ success: true, data: purchase });
  } catch (error) {
    next(error);
  }
});

router.post("/", (req, res, next) => {
  const db = getDb();

  try {
    const purchase = db.transaction(() => {
      const payload = req.body || {};
      const createdDate = normalizeDate(payload.created_at);
      assertCanWriteForDate(db, createdDate);
      let total = 0;
      for (const line of payload.lines || []) total += Number(line.quantity) * Number(line.unit_cost);

      const docNo = generateDocNumber('purchase_receipt');
      const result = db
        .prepare("INSERT INTO purchases (doc_no, supplier_id, total, created_at) VALUES (?, ?, ?, ?)")
        .run(docNo, payload.supplier_id || null, total, `${createdDate} ${new Date().toTimeString().slice(0, 8)}`);

      for (const line of payload.lines || []) {
        db.prepare(
          "INSERT INTO purchase_lines (purchase_id, item_id, quantity, unit_cost, line_total) VALUES (?, ?, ?, ?, ?)",
        ).run(
          result.lastInsertRowid,
          line.item_id,
          Number(line.quantity),
          Number(line.unit_cost),
          Number(line.quantity) * Number(line.unit_cost),
        );

        adjustStock({
          item_id: line.item_id,
          warehouse_id: line.warehouse_id || payload.warehouse_id || 1,
          quantityDelta: Number(line.quantity),
          movement_type: "purchase",
          reference_type: "purchase",
          reference_id: result.lastInsertRowid,
        });
      }

      if (payload.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance + ? WHERE id = ?").run(
          total,
          payload.supplier_id,
        );
        db.prepare(`
          INSERT INTO ajal_debts (invoice_id, supplier_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
          VALUES (?, ?, 'supplier', 'purchase', ?, 0, ?, 'open', ?)
        `).run(
          result.lastInsertRowid,
          payload.supplier_id,
          total,
          payload.due_date || null,
          payload.notes || null,
        );
      }

      // Update selling prices for lines where a new selling_price was provided
      const purchaseId = result.lastInsertRowid;
      const opId = `PUR-${purchaseId}`;
      const reason = `تحديث من فاتورة شراء #${purchaseId}`;
      const insertHistory = db.prepare(
        `INSERT INTO price_history (item_id, field, old_value, new_value, adjustment_type, adjustment_value, reason, operation_id, changed_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const line of payload.lines || []) {
        const newSalePrice = Number(line.selling_price);
        if (!newSalePrice || newSalePrice <= 0) continue;
        const current = db.prepare("SELECT sale_price FROM items WHERE id = ?").get(line.item_id);
        if (!current) continue;
        const oldPrice = Number(current.sale_price || 0);
        if (Math.abs(newSalePrice - oldPrice) < 0.001) continue;
        db.prepare("UPDATE items SET sale_price = ?, updated_at = datetime('now') WHERE id = ?").run(newSalePrice, line.item_id);
        insertHistory.run(line.item_id, "sale_price", oldPrice, newSalePrice, "absolute", newSalePrice, reason, opId, "purchase_form");
      }

      return getPurchaseWithLines(db, purchaseId);
    })();

    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/return", (req, res, next) => {
  const db = getDb();
  ensurePurchaseReturnSettlementSchema(db);

  try {
    const purchaseReturn = db.transaction(() => {
      const purchase = getPurchaseWithLines(db, Number(req.params.id));
      if (!purchase) {
        const error = new Error("Purchase not found");
        error.status = 404;
        throw error;
      }

      const payload = req.body || {};
      const createdDate = normalizeDate(payload.created_at);
      assertCanWriteForDate(db, createdDate);
      const settlementType = payload.settlement_type === "cash" ? "cash" : "account";
      let total = 0;
      const preparedLines = [];

      for (const entry of payload.lines || []) {
        const purchaseLine = purchase.lines.find((line) => line.id === Number(entry.purchase_line_id));
        if (!purchaseLine) {
          const error = new Error("Purchase line not found");
          error.status = 404;
          throw error;
        }

        const returnedQty =
          db
            .prepare(
              "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM purchase_return_lines WHERE purchase_line_id = ?",
            )
            .get(purchaseLine.id).quantity || 0;

        const remaining = purchaseLine.quantity - returnedQty;
        const quantity = Number(entry.quantity || 0);
        if (quantity <= 0 || quantity > remaining) {
          const error = new Error("Invalid purchase return quantity");
          error.status = 400;
          throw error;
        }

        const lineTotal = quantity * purchaseLine.unit_cost;
        total += lineTotal;
        preparedLines.push({
          purchase_line_id: purchaseLine.id,
          item_id: purchaseLine.item_id,
          quantity,
          unit_cost: purchaseLine.unit_cost,
          line_total: lineTotal,
        });
      }

      const returnDocNo = generateDocNumber('purchase_return');
      const treasuryId =
        settlementType === "cash"
          ? payload.treasury_id ||
            db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id ||
            1
          : null;

      if (settlementType === "cash") {
        const treasury = db.prepare("SELECT id FROM treasuries WHERE id = ?").get(treasuryId);
        if (!treasury) {
          const error = new Error("Treasury not found");
          error.status = 400;
          throw error;
        }
      }

      const purchaseReturnResult = db
        .prepare("INSERT INTO purchase_returns (doc_no, purchase_id, supplier_id, total, settlement_type, treasury_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(returnDocNo, purchase.id, purchase.supplier_id || null, total, settlementType, treasuryId, `${createdDate} ${new Date().toTimeString().slice(0, 8)}`);

      for (const line of preparedLines) {
        db.prepare(
          `INSERT INTO purchase_return_lines
           (purchase_return_id, purchase_line_id, item_id, quantity, unit_cost, line_total)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          purchaseReturnResult.lastInsertRowid,
          line.purchase_line_id,
          line.item_id,
          line.quantity,
          line.unit_cost,
          line.line_total,
        );

        adjustStock({
          item_id: line.item_id,
          warehouse_id: payload.warehouse_id || 1,
          quantityDelta: -line.quantity,
          movement_type: "purchase_return",
          reference_type: "purchase_return",
          reference_id: purchaseReturnResult.lastInsertRowid,
        });
      }

      if (settlementType === "cash") {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(total, treasuryId);
      } else if (purchase.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = MAX(0, opening_balance - ?) WHERE id = ?").run(
          total,
          purchase.supplier_id,
        );
      }

      return db.prepare("SELECT * FROM purchase_returns WHERE id = ?").get(purchaseReturnResult.lastInsertRowid);
    })();

    res.status(201).json({ success: true, data: purchaseReturn });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/void", (req, res, next) => {
  const db = getDb();
  try {
    db.transaction(() => {
      const purchase = getPurchaseWithLines(db, Number(req.params.id));
      if (!purchase) { const e = new Error("Purchase not found"); e.status = 404; throw e; }

      for (const line of purchase.lines || []) {
        adjustStock({
          item_id: line.item_id,
          warehouse_id: req.body?.warehouse_id || 1,
          quantityDelta: -line.quantity,
          movement_type: "purchase_void",
          reference_type: "purchase",
          reference_id: purchase.id,
        });
      }

      if (purchase.supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = MAX(0, opening_balance - ?) WHERE id = ?")
          .run(purchase.total, purchase.supplier_id);
      }

      db.prepare("UPDATE purchases SET status = 'voided' WHERE id = ?").run(purchase.id);
    })();
    res.json({ success: true });
  } catch (error) { next(error); }
});

module.exports = router;
