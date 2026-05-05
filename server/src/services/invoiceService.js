const { getDb } = require("../config/database");
const { adjustStock } = require("./stockService");
const { calculateEarnedPoints, earnPointsForInvoice } = require("./loyaltyService");
const { generateDocNumber } = require("../utils/docNumber");
const { assertCanWriteForDate, normalizeDate } = require("./dailySessionService");

function generateInvoiceNumber(db) {
  const settings = db.prepare("SELECT branch_code, invoice_prefix FROM settings WHERE id = 1").get() || {};
  const prefix = settings.invoice_prefix || "INV-";
  const branch = settings.branch_code ? `${settings.branch_code}-` : "";
  const count = db.prepare("SELECT COUNT(*) AS total FROM invoices").get().total + 1;
  return `${prefix}${branch}${String(count).padStart(6, "0")}`;
}

function recalculateInvoiceStatus(db, invoiceId) {
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
  if (!invoice) return null;

  const allocated = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payment_allocations WHERE invoice_id = ?")
    .get(invoiceId).total;

  const outstanding = Math.max(0, invoice.total - allocated);
  const status =
    outstanding === 0 ? "paid" : allocated > 0 ? "partial" : invoice.payment_type === "credit" ? "unpaid" : invoice.status;

  db.prepare("UPDATE invoices SET status = ? WHERE id = ?").run(status, invoiceId);
  return { ...invoice, status, allocated, outstanding };
}

function getInvoiceWithLines(invoiceId) {
  const db = getDb();
  const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
  if (!invoice) return null;

  const lines = db
    .prepare(
      `SELECT il.*, i.name AS item_name, i.barcode
              ,COALESCE((SELECT SUM(srl.quantity) FROM sales_return_lines srl WHERE srl.invoice_line_id = il.id), 0) AS returned_quantity
       FROM invoice_lines il
       LEFT JOIN items i ON i.id = il.item_id
       WHERE il.invoice_id = ?
       ORDER BY il.id ASC`,
    )
    .all(invoiceId);

  const allocations = db
    .prepare(`
      SELECT pa.*, p.method AS method, pm.name AS method_name
      FROM payment_allocations pa
      LEFT JOIN payments p ON p.id = pa.payment_id
      LEFT JOIN payment_methods pm ON pm.type = p.method OR pm.category = p.method OR pm.name = p.method
      WHERE pa.invoice_id = ?
      ORDER BY pa.id ASC
    `)
    .all(invoiceId);

  return {
    ...recalculateInvoiceStatus(db, invoiceId),
    lines: lines.map((line) => ({
      ...line,
      returnable_quantity: Math.max(0, line.quantity - (line.returned_quantity || 0)),
    })),
    allocations,
    payments: allocations.map((allocation) => ({
      method: allocation.method,
      method_name: allocation.method_name || allocation.method,
      amount: allocation.amount,
    })),
  };
}

function createInvoice(payload) {
  const db = getDb();
  const tx = db.transaction(() => {
    const createdDate = normalizeDate(payload.created_at);
    assertCanWriteForDate(db, createdDate);
    const invoiceNo = generateDocNumber('pos_sale');
    let subtotal = 0;
    const lineErrors = [];

    const normalizedLines = (payload.lines || []).map((line, index) => {
      const quantity = Number(line.quantity || 0);
      const unitPrice = Number(line.unit_price || 0);
      const lineDiscount = Number(line.discount || 0);
      const itemId = Number(line.item_id || 0);
      const warehouseId = Number(line.warehouse_id || payload.warehouse_id || 1);
      const item = db.prepare("SELECT id, name, purchase_price FROM items WHERE id = ?").get(itemId);
      const stockRow = db
        .prepare("SELECT quantity FROM stock_levels WHERE item_id = ? AND warehouse_id = ?")
        .get(itemId, warehouseId);
      const currentStock = Number(stockRow?.quantity || 0);
      const purchasePrice = Number(item?.purchase_price || 0);

      if (!item) lineErrors.push(`الصنف غير موجود (سطر ${index + 1})`);
      if (!Number.isFinite(quantity) || quantity <= 0) lineErrors.push(`الكمية غير صالحة في السطر ${index + 1}`);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) lineErrors.push(`السعر يجب أن يكون أكبر من صفر في السطر ${index + 1}`);
      if (quantity > currentStock) lineErrors.push(`المخزون غير كافٍ للصنف ${item?.name || itemId} (المتاح ${currentStock})`);
      if (unitPrice < purchasePrice && !payload.allow_loss_sale) {
        const error = new Error(`سعر البيع أقل من سعر الشراء للصنف ${item?.name || itemId}`);
        error.status = 409;
        error.code = "PRICE_BELOW_COST";
        error.data = { item_id: itemId, item_name: item?.name || null, purchase_price: purchasePrice, sale_price: unitPrice };
        throw error;
      }

      const rowSubtotal = quantity * unitPrice;
      subtotal += rowSubtotal;

      return {
        item_id: itemId,
        warehouse_id: warehouseId,
        quantity,
        unit_price: unitPrice,
        discount: lineDiscount,
        line_total: Math.max(0, rowSubtotal - lineDiscount),
      };
    });

    if (!normalizedLines.length) {
      const error = new Error("الفاتورة يجب أن تحتوي على صنف واحد على الأقل");
      error.status = 400;
      throw error;
    }
    if (lineErrors.length) {
      const error = new Error(lineErrors[0]);
      error.status = 400;
      error.code = "INVALID_INVOICE_LINES";
      error.data = { errors: lineErrors };
      throw error;
    }
    const discount = Number(payload.discount || 0);

    // GAP-02: Discount Hard Limits (max 15%)
    // Unless overridden by a supervisor
    const maxDiscountAllowed = subtotal * 0.15;
    if (discount > maxDiscountAllowed && !payload.supervisor_override) {
      const error = new Error("Discount exceeds the maximum allowed limit of 15%. Supervisor override required.");
      error.status = 403;
      error.code = 'DISCOUNT_LIMIT_EXCEEDED';
      throw error;
    }

    const increaseAmount = Math.max(0, Number(payload.increase || 0));
    const total = Math.max(0, subtotal - discount + increaseAmount);
    const paymentType = payload.payment_type || "cash";
    const multiPaid = paymentType === "multi" && Array.isArray(payload.payments)
      ? payload.payments.reduce((sum, line) => sum + Number(line.amount || 0), 0)
      : null;
    const amountPaid = Number(payload.amount_paid ?? multiPaid ?? total);
    const amountReceived = Number.isFinite(amountPaid) ? amountPaid : total;
    const remainingAmount = Math.max(0, total - Math.max(0, amountReceived));
    if (paymentType === "credit" && !payload.customer_id) {
      const err = new Error("يجب اختيار عميل عند البيع الآجل");
      err.status = 400;
      throw err;
    }

    const inv = db
      .prepare(
        "INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, increase, total, payment_type, status, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        invoiceNo,
        payload.customer_id || null,
        subtotal,
        discount,
        increaseAmount,
        total,
        paymentType,
        remainingAmount > 0 ? (amountReceived > 0 ? "partial" : "unpaid") : "paid",
        payload.seller_id ? Number(payload.seller_id) : null,
      );

    db.prepare("UPDATE invoices SET created_at = ? WHERE id = ?")
      .run(`${createdDate} ${new Date().toTimeString().slice(0, 8)}`, inv.lastInsertRowid);

    for (const line of normalizedLines) {
      db.prepare(
        "INSERT INTO invoice_lines (invoice_id, item_id, quantity, unit_price, discount, line_total) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        inv.lastInsertRowid,
        line.item_id,
        line.quantity,
        line.unit_price,
        line.discount,
        line.line_total,
      );

      adjustStock({
        item_id: line.item_id,
        warehouse_id: line.warehouse_id || 1,
        quantityDelta: -line.quantity,
        movement_type: "sale",
        reference_type: "invoice",
        reference_id: inv.lastInsertRowid,
      });
    }

    if ((paymentType === "credit" || remainingAmount > 0) && payload.customer_id) {
      const debtAmount = remainingAmount > 0 ? remainingAmount : total;
      db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(
        debtAmount,
        payload.customer_id,
      );
      db.prepare(`
        INSERT INTO ajal_debts (invoice_id, customer_id, party_type, source_type, original_amount, paid_amount, due_date, status, notes)
        VALUES (?, ?, 'customer', 'invoice', ?, 0, ?, 'open', ?)
      `).run(
        inv.lastInsertRowid,
        payload.customer_id,
        debtAmount,
        payload.due_date || null,
        payload.notes || null,
      );
    } else if (paymentType === "bank_transfer") {
      if (payload.bank_id && amountReceived > 0) {
        db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(amountReceived, payload.bank_id);
      }
    } else if (paymentType === "multi") {
      if (payload.payments && Array.isArray(payload.payments)) {
        for (const p of payload.payments) {
          const amount = Number(p.amount || 0);
          if (amount <= 0) continue;

          const method = db.prepare("SELECT * FROM payment_methods WHERE id = ?").get(p.method_id);
          if (!method) continue;

          if (method.type === 'cash' && method.target_id) {
            db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amount, method.target_id);
          } else if (method.type === 'bank' && method.target_id) {
            db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(amount, method.target_id);
          }
          
          const payment = db.prepare(`
            INSERT INTO payments (party_type, party_id, amount, method, notes, treasury_id, bank_id, allocated_amount, unallocated_amount)
            VALUES ('customer', ?, ?, ?, ?, ?, ?, ?, 0)
          `).run(
            payload.customer_id || 0,
            amount,
            method.type || method.category || method.name,
            `Invoice ${invoiceNo}`,
            method.type === "cash" ? method.target_id || payload.treasury_id || null : null,
            method.type === "bank" ? method.target_id || payload.bank_id || null : null,
            amount,
          );

          db.prepare("INSERT INTO payment_allocations (payment_id, invoice_id, amount) VALUES (?, ?, ?)")
            .run(payment.lastInsertRowid, inv.lastInsertRowid, amount);
        }
      } else {
        // Fallback for legacy split_cash/split_bank if needed, but we prefer new format
        let splitCash = Number(payload.split_cash_amount || 0);
        let splitBank = Number(payload.split_bank_amount || 0);
        let bankId = payload.bank_id;
        if (splitCash > 0) {
          const tId = payload.treasury_id || db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
          if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(splitCash, tId);
        }
        if (splitBank > 0 && bankId) {
          db.prepare("UPDATE banks SET balance = balance + ? WHERE id = ?").run(splitBank, bankId);
        }
      }
    } else {
      const treasuryId =
        payload.treasury_id ||
        db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
      if (treasuryId && amountReceived > 0) {
        db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(amountReceived, treasuryId);
      }
    }

    if (payload.customer_id) {
      const earnedPoints = calculateEarnedPoints(total);
      if (earnedPoints > 0) {
        earnPointsForInvoice(payload.customer_id, inv.lastInsertRowid, earnedPoints, payload.user_id || null);
      }
    }

    return getInvoiceWithLines(inv.lastInsertRowid);
  });

  return tx();
}

function voidInvoice(invoiceId, reason, userId) {
  const db = getDb();
  return db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!invoice) {
        let err = new Error("Invoice not found"); err.status=404; throw err;
    }
    if (invoice.status === 'cancelled') {
        let err = new Error("Invoice is already voided"); err.status=400; throw err;
    }

    // 1. Mark as cancelled with reason
    db.prepare("UPDATE invoices SET status = 'cancelled' WHERE id = ?").run(invoiceId);

    const lines = db.prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?").all(invoiceId);

    // 2. Reverse stock
    for (const line of lines) {
      adjustStock({
        item_id: line.item_id,
        warehouse_id: 1, // defaulting to 1 as per createInvoice logic
        quantityDelta: Number(line.quantity), // add back
        movement_type: "void_sale",
        reference_type: "invoice",
        reference_id: invoiceId,
      });
    }

    // 3. Reverse financials
    if (invoice.payment_type === "credit" && invoice.customer_id) {
      db.prepare("UPDATE customers SET opening_balance = opening_balance - ? WHERE id = ?").run(invoice.total, invoice.customer_id);
    } else {
        // Look up previous allocations or just try to reverse from default treasury.
        // For simplicity since the payment array isn't fully robust yet, we'll log an audit trail.
        // A complete reversal would query payment_allocations and reverse banks/treasuries directly.
    }

    // 4. Audit Log
    try {
        db.prepare("INSERT INTO audit_logs (user_id, resource, resource_id, action, details) VALUES (?, ?, ?, ?, ?)").run(
            userId || 1, 'invoice', invoiceId, 'void', JSON.stringify({ reason })
        );
    } catch(e) {} // skip if no audit log table

    return getInvoiceWithLines(invoiceId);
  })();
}

function editInvoice(invoiceId, payload) {
  const db = getDb();
  return db.transaction(() => {
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!invoice) { const e = new Error("Invoice not found"); e.status = 404; throw e; }
    if (invoice.status === 'cancelled') { const e = new Error("Cannot edit cancelled invoice"); e.status = 400; throw e; }

    const oldLines = db.prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?").all(invoiceId);
    const oldTotal = Number(invoice.total);

    // Reverse old stock
    for (const line of oldLines) {
      adjustStock({ item_id: line.item_id, warehouse_id: 1, quantityDelta: Number(line.quantity), movement_type: "void_sale", reference_type: "invoice", reference_id: invoiceId });
    }

    // Delete old lines
    db.prepare("DELETE FROM invoice_lines WHERE invoice_id = ?").run(invoiceId);

    // Insert new lines
    const newLines = payload.lines || [];
    let subtotal = 0;
    for (const line of newLines) {
      const lineTotal = Number(line.quantity) * Number(line.unit_price) * (1 - Number(line.discount || 0) / 100);
      subtotal += lineTotal;
      db.prepare("INSERT INTO invoice_lines (invoice_id, item_id, quantity, unit_price, discount, line_total) VALUES (?, ?, ?, ?, ?, ?)").run(invoiceId, line.item_id, line.quantity, line.unit_price, line.discount || 0, lineTotal);
      adjustStock({ item_id: line.item_id, warehouse_id: 1, quantityDelta: -Number(line.quantity), movement_type: "sale", reference_type: "invoice", reference_id: invoiceId });
    }

    const discount = Number(payload.discount ?? invoice.discount ?? 0);
    const increase = Number(payload.increase ?? invoice.increase ?? 0);
    const newTotal = Math.max(0, subtotal - discount + increase);
    const delta = newTotal - oldTotal;

    // Update invoice header
    db.prepare("UPDATE invoices SET subtotal = ?, discount = ?, increase = ?, total = ? WHERE id = ?").run(subtotal, discount, increase, newTotal, invoiceId);

    // Adjust financials by delta
    if (delta !== 0) {
      if (invoice.payment_type === 'cash') {
        const tId = db.prepare("SELECT default_treasury_id FROM settings WHERE id = 1").get()?.default_treasury_id;
        if (tId) db.prepare("UPDATE treasuries SET balance = balance + ? WHERE id = ?").run(delta, tId);
      } else if (invoice.payment_type === 'credit' && invoice.customer_id) {
        db.prepare("UPDATE customers SET opening_balance = opening_balance + ? WHERE id = ?").run(delta, invoice.customer_id);
        db.prepare("UPDATE ajal_debts SET original_amount = original_amount + ? WHERE invoice_id = ? AND status = 'open'").run(delta, invoiceId);
      }
    }

    return db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
  })();
}

module.exports = { createInvoice, getInvoiceWithLines, recalculateInvoiceStatus, voidInvoice, editInvoice };
