const express = require("express");
const { createInvoice, getInvoiceWithLines, editInvoice, cancelInvoice, amendInvoice } = require("../services/invoiceService");
const { createReturn, getReturns, getReturnDetails } = require("../services/returnService");
const { adjustStock } = require("../services/stockService");
const { getDb } = require("../config/database");

const router = express.Router();

router.get("/", (req, res) => {
  try {
    const db = getDb();
    const { date_from, date_to, sort = "created_at", dir = "desc", search = "", customer_id } = req.query;
    const allowedSort = ["created_at", "total", "invoice_no", "payment_type", "status"];
    const safeSort = allowedSort.includes(sort) ? `i.${sort}` : "i.created_at";
    const safeDir  = dir === "asc" ? "ASC" : "DESC";
    const conditions = [];
    const params = [];
    if (date_from && date_to) {
      conditions.push("date(i.created_at) BETWEEN date(?) AND date(?)");
      params.push(date_from, date_to);
    } else if (date_from || date_to) {
      const day = date_from || date_to;
      conditions.push("date(i.created_at) = date(?)");
      params.push(day);
    }
    if (search) {
      conditions.push("(c.name LIKE ? OR i.invoice_no LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (customer_id) { conditions.push("i.customer_id = ?"); params.push(customer_id); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db.prepare(`
      SELECT i.id, i.invoice_no, i.subtotal, i.discount, i.total,
             i.payment_type, i.status, i.created_at,
             c.name AS customer_name, c.phone AS customer_phone,
             (SELECT COUNT(*) FROM invoice_lines WHERE invoice_id = i.id) AS items_count
      FROM invoices i
      LEFT JOIN customers c ON c.id = i.customer_id
      ${where}
      ORDER BY ${safeSort} ${safeDir}
      LIMIT 100
    `).all(...params);
    const summary = rows.reduce((acc, r) => ({ count: acc.count + 1, total: acc.total + Number(r.total || 0) }), { count: 0, total: 0 });
    res.json({ success: true, data: rows, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Returns the most recent unit_price this item was sold at
router.get("/last-price/:itemId", (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare(`
      SELECT il.unit_price
      FROM invoice_lines il
      JOIN invoices i ON i.id = il.invoice_id
      WHERE il.item_id = ? AND i.status != 'cancelled'
      ORDER BY i.created_at DESC
      LIMIT 1
    `).get(Number(req.params.itemId));
    res.json({ success: true, data: row?.unit_price ?? null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/returns", (req, res) => {
  try {
    const db = getDb();
    const { search = "", customer_id, date_from, date_to } = req.query;
    const conditions = ["1=1"];
    const params = [];
    if (search) {
      conditions.push("(c.name LIKE ? OR CAST(sr.id AS TEXT) LIKE ? OR i.invoice_no LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (customer_id) { conditions.push("sr.customer_id = ?"); params.push(customer_id); }
    if (date_from) { conditions.push("date(sr.created_at) >= date(?)"); params.push(date_from); }
    if (date_to) { conditions.push("date(sr.created_at) <= date(?)"); params.push(date_to); }
    const returns = db.prepare(`
      SELECT sr.*, c.name AS customer_name, i.invoice_no AS original_invoice_no
      FROM sales_returns sr
      LEFT JOIN customers c ON c.id = sr.customer_id
      LEFT JOIN invoices i ON i.id = sr.invoice_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY sr.id DESC
    `).all(...params);
    res.json({ success: true, data: returns });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/returns/:id", (req, res, next) => {
    try {
        const sr = getReturnDetails(Number(req.params.id));
        if (!sr) throw new Error("Return not found");
        res.json({ success: true, data: sr });
    } catch (e) { next(e); }
});

router.post("/general-return", (req, res, next) => {
  try {
    const db = getDb();
    const { lines, customer_id, refund_method, notes, reason } = req.body;
    if (!lines || !lines.length) { const e = new Error("يجب إضافة أصناف"); e.status = 400; throw e; }

    const result = db.transaction(() => {
      const docNo = "GR-" + Date.now();
      let total = 0;
      for (const line of lines) {
        total += Number(line.quantity) * Number(line.unit_price);
      }

      const ret = db.prepare(`
        INSERT INTO sales_returns (doc_no, invoice_id, customer_id, total, refund_method, reason, notes, created_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `).run(docNo, customer_id || null, total, refund_method || 'cash_back', reason || 'other', notes || null);

      for (const line of lines) {
        const lineTotal = Number(line.quantity) * Number(line.unit_price);
        db.prepare("INSERT INTO sales_return_lines (sales_return_id, invoice_line_id, item_id, quantity, unit_price, line_total) VALUES (?, NULL, ?, ?, ?, ?)").run(ret.lastInsertRowid, line.item_id, line.quantity, line.unit_price, lineTotal);
        adjustStock({ item_id: line.item_id, warehouse_id: line.warehouse_id || 1, quantityDelta: Number(line.quantity), movement_type: "sales_return", reference_type: "sales_return", reference_id: ret.lastInsertRowid });
      }

      if (refund_method === 'cash_back' || !refund_method) {
        const tId = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(total, tId);
      } else if (refund_method === 'credit_note' && customer_id) {
        db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(total, customer_id);
      }

      return { id: ret.lastInsertRowid, doc_no: docNo, total };
    })();

    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post("/general-purchase-return", (req, res, next) => {
  try {
    const db = getDb();
    const { lines, supplier_id, refund_method, notes, reason } = req.body;
    if (!lines || !lines.length) { const e = new Error("يجب إضافة أصناف"); e.status = 400; throw e; }

    const result = db.transaction(() => {
      const docNo = "GPR-" + Date.now();
      let total = 0;
      for (const line of lines) {
        total += Number(line.quantity) * Number(line.unit_price);
      }

      const ret = db.prepare(`
        INSERT INTO purchase_returns (doc_no, purchase_id, supplier_id, total, refund_method, reason, notes, created_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
      `).run(docNo, supplier_id || null, total, refund_method || 'cash_back', reason || 'other', notes || null);

      for (const line of lines) {
        const lineTotal = Number(line.quantity) * Number(line.unit_price);
        db.prepare("INSERT INTO purchase_return_lines (purchase_return_id, purchase_line_id, item_id, quantity, unit_cost, unit_price, line_total) VALUES (?, NULL, ?, ?, ?, ?, ?)").run(ret.lastInsertRowid, line.item_id, line.quantity, line.unit_price, line.unit_price, lineTotal);
        // Stock goes out on purchase return
        adjustStock({ item_id: line.item_id, warehouse_id: line.warehouse_id || 1, quantityDelta: -Number(line.quantity), movement_type: "purchase_return", reference_type: "purchase_return", reference_id: ret.lastInsertRowid });
      }

      if (refund_method === 'cash_back' || !refund_method) {
        const tId = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(total, tId);
      } else if (refund_method === 'credit_note' && supplier_id) {
        db.prepare("UPDATE suppliers SET opening_balance = opening_balance - ? WHERE id = ?").run(total, supplier_id);
      }

      return { id: ret.lastInsertRowid, doc_no: docNo, total };
    })();

    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.get("/:id", (req, res, next) => {
  try {
    const invoice = getInvoiceWithLines(Number(req.params.id));
    if (!invoice) {
      const error = new Error("Invoice not found");
      error.status = 404;
      throw error;
    }
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", (req, res, next) => {
  try {
    const result = editInvoice(Number(req.params.id), req.body);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
});

router.post("/", (req, res) => {
  const invoice = createInvoice(req.body || {});
  res.status(201).json({ success: true, data: invoice });
});

router.post("/:id/return", (req, res, next) => {
  try {
    const salesReturn = createReturn(Number(req.params.id), req.body || {});
    res.status(201).json({ success: true, data: salesReturn });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/void", (req, res, next) => {
  try {
    if (!req.body.reason) {
      const error = new Error("Void reason is required");
      error.status = 400;
      throw error;
    }
    const { voidInvoice } = require("../services/invoiceService");
    const voided = voidInvoice(Number(req.params.id), req.body.reason, req.user?.id || 1);
    res.json({ success: true, data: voided });
  } catch (error) {
    next(error);
  }
});

router.get("/cancel-reasons", (_req, res) => {
  res.json({
    success: true,
    data: [
      "خطأ في البيانات",
      "طلب العميل الإلغاء",
      "خطأ في السعر",
      "خطأ في الكمية",
      "تكرار الفاتورة",
      "تعديل الفاتورة",
    ],
  });
});

router.delete("/:id", (req, res, next) => {
  try {
    const result = cancelInvoice(Number(req.params.id), req.body?.reason, req.user?.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.put("/:id/amend", (req, res, next) => {
  try {
    const result = amendInvoice(Number(req.params.id), req.body, req.user?.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
