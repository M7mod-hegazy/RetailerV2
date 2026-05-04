const { getDb } = require("../config/database");
const { adjustStock } = require("./stockService");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("./dailySessionService");

function createReturn(invoiceId, payload) {
  const db = getDb();

  return db.transaction(() => {
    const createdDate = normalizeDate(payload.created_at);
    assertCanWriteForDate(db, createdDate);
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!invoice) {
      const err = new Error("Invoice not found");
      err.status = 404;
      throw err;
    }

    let total = 0;
    const preparedLines = [];

    for (const requestedLine of payload.lines || []) {
      const invoiceLine = db
        .prepare("SELECT * FROM invoice_lines WHERE id = ? AND invoice_id = ?")
        .get(requestedLine.invoice_line_id, invoiceId);

      if (!invoiceLine) {
        const err = new Error("Invoice line not found");
        err.status = 404;
        throw err;
      }

      const previousReturned =
        db
          .prepare(
            "SELECT COALESCE(SUM(quantity), 0) AS quantity FROM sales_return_lines WHERE invoice_line_id = ?",
          )
          .get(invoiceLine.id).quantity || 0;

      const remaining = invoiceLine.quantity - previousReturned;
      if (requestedLine.quantity <= 0 || requestedLine.quantity > remaining) {
        const err = new Error("Invalid return quantity");
        err.status = 400;
        throw err;
      }

      const lineTotal = invoiceLine.unit_price * requestedLine.quantity;
      total += lineTotal;
      preparedLines.push({
        invoice_line_id: invoiceLine.id,
        item_id: invoiceLine.item_id,
        quantity: requestedLine.quantity,
        line_total: lineTotal,
      });
    }

    const docNo = generateDocNumber('sales_return');
    const result = db
      .prepare(
        "INSERT INTO sales_returns (doc_no, invoice_id, customer_id, total, reason, refund_method, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        docNo,
        invoiceId,
        invoice.customer_id || null,
        total,
        payload.reason || null,
        payload.refund_method || "cash_back",
        `${createdDate} ${new Date().toTimeString().slice(0, 8)}`,
      );

    for (const line of preparedLines) {
      db.prepare(
        "INSERT INTO sales_return_lines (sales_return_id, invoice_line_id, item_id, quantity, line_total) VALUES (?, ?, ?, ?, ?)",
      ).run(result.lastInsertRowid, line.invoice_line_id, line.item_id, line.quantity, line.line_total);

      adjustStock({
        item_id: line.item_id,
        warehouse_id: payload.warehouse_id || 1,
        quantityDelta: line.quantity,
        movement_type: "sales_return",
        reference_type: "sales_return",
        reference_id: result.lastInsertRowid,
      });
    }

    if (invoice.customer_id && (invoice.payment_type === "credit" || payload.refund_method === "credit_note")) {
      db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(
        total,
        invoice.customer_id,
      );
    } else if (invoice.payment_type === "cash" || payload.refund_method === "cash_back") {
      const treasuryId =
        payload.treasury_id ||
        db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (treasuryId) {
        db.prepare("UPDATE treasuries SET balance = balance - ? WHERE id = ?").run(total, treasuryId);
      }
    }

    const invoiceLines = db.prepare("SELECT id, quantity FROM invoice_lines WHERE invoice_id = ?").all(invoiceId);
    const fullyReturned = invoiceLines.every((line) => {
      const returnedQty =
        db.prepare("SELECT COALESCE(SUM(quantity), 0) AS quantity FROM sales_return_lines WHERE invoice_line_id = ?").get(line.id)
          .quantity || 0;
      return returnedQty >= line.quantity;
    });
    db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(
      fullyReturned ? "returned" : "partially_returned",
      invoiceId,
    );

    return db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(result.lastInsertRowid);
  })();
}

function getReturns() {
  const db = getDb();
  return db.prepare(`
    SELECT sr.*, c.name as customer_name, i.invoice_no as original_invoice_no
    FROM sales_returns sr
    LEFT JOIN customers c ON c.id = sr.customer_id
    LEFT JOIN invoices i ON i.id = sr.invoice_id
    ORDER BY sr.id DESC
  `).all();
}

function getReturnDetails(id) {
  const db = getDb();
  const sr = db.prepare("SELECT * FROM sales_returns WHERE id = ?").get(id);
  if (!sr) return null;
  const lines = db.prepare(`
    SELECT srl.*, i.name as item_name
    FROM sales_return_lines srl
    LEFT JOIN items i ON i.id = srl.item_id
    WHERE srl.sales_return_id = ?
  `).all(id);
  return { ...sr, lines };
}

module.exports = { createReturn, getReturns, getReturnDetails };
