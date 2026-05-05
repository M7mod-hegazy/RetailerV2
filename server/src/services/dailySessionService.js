function localDate(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(dateText, days) {
  const d = new Date(`${dateText}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

function normalizeDate(value) {
  if (!value) return localDate();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return localDate(value);
}

function ensureDailySessionSchema(db) {
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN reopened_at TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN reopened_by INTEGER REFERENCES users(id)"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN reopen_reason TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN opening_adjusted_at TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN opening_adjusted_by INTEGER REFERENCES users(id)"); } catch (_) {}
  try { db.exec("ALTER TABLE daily_sessions ADD COLUMN opening_adjust_reason TEXT"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN settlement_type TEXT NOT NULL DEFAULT 'account'"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN treasury_id INTEGER REFERENCES treasuries(id)"); } catch (_) {}
}

function ensurePurchaseReturnSettlementSchema(db) {
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN settlement_type TEXT NOT NULL DEFAULT 'account'"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN treasury_id INTEGER REFERENCES treasuries(id)"); } catch (_) {}
}

function latestClosedBalanceBefore(db, dateText) {
  const row = db.prepare(`
    SELECT closing_balance
    FROM daily_sessions
    WHERE date < ? AND status = 'closed'
    ORDER BY date DESC
    LIMIT 1
  `).get(dateText);
  return Number(row?.closing_balance || 0);
}

function ensureSessionForDate(db, dateText) {
  ensureDailySessionSchema(db);
  let session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(dateText);
  if (!session) {
    const openingBalance = latestClosedBalanceBefore(db, dateText);
    db.prepare(
      "INSERT INTO daily_sessions (date, opening_balance, status) VALUES (?, ?, 'open')",
    ).run(dateText, openingBalance);
    session = db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(dateText);
  }
  return session;
}

function getSession(db, dateText, createIfMissing = false) {
  const targetDate = normalizeDate(dateText);
  if (createIfMissing) return ensureSessionForDate(db, targetDate);
  return db.prepare("SELECT * FROM daily_sessions WHERE date = ?").get(targetDate);
}

function assertCanWriteForDate(db, dateValue) {
  const targetDate = normalizeDate(dateValue);
  ensureDailySessionSchema(db);

  const blocker = db.prepare(`
    SELECT *
    FROM daily_sessions
    WHERE status = 'open' AND date < ?
    ORDER BY date ASC
    LIMIT 1
  `).get(targetDate);
  if (blocker) {
    const err = new Error(`يجب إغلاق يوم ${blocker.date} قبل تسجيل حركات جديدة.`);
    err.status = 423;
    err.code = "DAILY_SESSION_BLOCKED";
    err.data = { blocker_date: blocker.date, requested_date: targetDate, blocker };
    throw err;
  }

  const session = ensureSessionForDate(db, targetDate);
  if (session.status === "closed") {
    const err = new Error(`اليومية ${targetDate} مغلقة. أعد فتحها من شاشة الخزينة اليومية قبل إضافة أي حركة.`);
    err.status = 423;
    err.code = "DAILY_SESSION_CLOSED";
    err.data = { blocker_date: targetDate, requested_date: targetDate, blocker: session };
    throw err;
  }

  return session;
}

function scalar(db, sql, params = []) {
  const row = db.prepare(sql).get(...params);
  return Number(row?.total || 0);
}

function countScalar(db, sql, params = []) {
  const row = db.prepare(sql).get(...params);
  return Number(row?.count || 0);
}

function cashBreakdown(db, dateText, session) {
  const date = normalizeDate(dateText);
  const sessionId = session?.id || null;
  ensurePurchaseReturnSettlementSchema(db);

  // Installment invoices: cash received is the sum of payment_allocations
  // If no allocations, cash received is 0 (not the full invoice total)
  const posInstallmentCash = scalar(db, `
    SELECT COALESCE(SUM(pa.amount), 0) AS total
    FROM invoices i
    LEFT JOIN payment_allocations pa ON pa.invoice_id = i.id
    WHERE date(i.created_at) = ? AND i.payment_type = 'installments' AND i.status != 'cancelled'
  `, [date]);
  const posInstallmentCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM invoices
    WHERE date(created_at) = ? AND payment_type = 'installments' AND status != 'cancelled'
  `, [date]);

  // Multi-payment invoices: cash portion from payments table
  const posMultiCash = scalar(db, `
    SELECT COALESCE(SUM(p.amount), 0) AS total
    FROM payments p
    JOIN invoices i ON p.notes = 'Invoice ' || i.invoice_no
    WHERE date(i.created_at) = ? AND i.payment_type = 'multi' AND p.method = 'cash' AND i.status != 'cancelled'
  `, [date]);
  const posMultiCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM invoices
    WHERE date(created_at) = ? AND payment_type = 'multi' AND status != 'cancelled'
  `, [date]);

  const posCashSales = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM invoices
    WHERE date(created_at) = ? AND payment_type = 'cash' AND status != 'cancelled'
  `, [date]);
  const posCashSalesCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM invoices
    WHERE date(created_at) = ? AND payment_type = 'cash' AND status != 'cancelled'
  `, [date]);
  const posBankSales = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM invoices
    WHERE date(created_at) = ? AND payment_type IN ('bank_transfer', 'card', 'bank') AND status != 'cancelled'
  `, [date]);
  const posAllSales = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM invoices
    WHERE date(created_at) = ? AND status != 'cancelled'
  `, [date]);
  const posAllSalesCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM invoices
    WHERE date(created_at) = ? AND status != 'cancelled'
  `, [date]);

  // Cash from all POS sales (cash + installment payments + multi-payment cash portion)
  const posTotalCashReceived = posCashSales + posInstallmentCash + posMultiCash;

  const purchasesTotal = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM purchases
    WHERE date(created_at) = ? AND COALESCE(status, '') != 'voided'
  `, [date]);

  // Note: All purchases are treated as credit (payable) in the current system.
  // They create ajal_debts for suppliers, so cash_out for purchases is via supplier_payments.
  // purchases_cash remains 0 unless a cash purchase feature is added.
  const purchasesCash = 0;

  // Credit sales (installments/multi with non-cash portion) - reduces customer debt
  const posCreditSales = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM invoices
    WHERE date(created_at) = ? AND payment_type IN ('installments', 'credit') AND status != 'cancelled'
  `, [date]);
  const posCreditSalesCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM invoices
    WHERE date(created_at) = ? AND payment_type IN ('installments', 'credit') AND status != 'cancelled'
  `, [date]);

  // Sales returns that increased customer debt (account refund, not cash)
  const salesReturnsAccount = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM sales_returns
    WHERE date(created_at) = ? AND COALESCE(refund_method, 'cash_back') != 'cash_back'
  `, [date]);
  const purchaseReturnsCash = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM purchase_returns
    WHERE date(created_at) = ? AND COALESCE(settlement_type, 'account') = 'cash'
  `, [date]);
  const purchaseReturnsAccount = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM purchase_returns
    WHERE date(created_at) = ? AND COALESCE(settlement_type, 'account') != 'cash'
  `, [date]);
  const salesReturnsCash = scalar(db, `
    SELECT COALESCE(SUM(total), 0) AS total
    FROM sales_returns
    WHERE date(created_at) = ? AND COALESCE(refund_method, 'cash_back') = 'cash_back'
  `, [date]);

  const expensesCash = scalar(db, `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE date(created_at) = ? AND COALESCE(payment_method, 'cash') = 'cash'
  `, [date]);
  const expensesCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM expenses
    WHERE date(created_at) = ? AND COALESCE(payment_method, 'cash') = 'cash'
  `, [date]);
  const revenuesCash = scalar(db, `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM revenues
    WHERE date(created_at) = ? AND COALESCE(payment_method, 'cash') = 'cash'
  `, [date]);
  const revenuesCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM revenues
    WHERE date(created_at) = ? AND COALESCE(payment_method, 'cash') = 'cash'
  `, [date]);

  const customerPayments = scalar(db, `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'customer' AND method = 'cash'
  `, [date]);
  const customerPaymentsCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'customer' AND method = 'cash'
  `, [date]);
  const supplierPayments = scalar(db, `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'supplier' AND method = 'cash'
  `, [date]);
  const supplierPaymentsCount = countScalar(db, `
    SELECT COUNT(*) AS count
    FROM payments
    WHERE date(created_at) = ? AND party_type = 'supplier' AND method = 'cash'
  `, [date]);
  const nonCashPayments = scalar(db, `
    SELECT COALESCE(SUM(amount), 0) AS total
    FROM payments
    WHERE date(created_at) = ? AND COALESCE(method, 'cash') != 'cash'
  `, [date]);

  const customerAjalPayments = scalar(db, `
    SELECT COALESCE(SUM(ap.amount), 0) AS total
    FROM ajal_payments ap
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    LEFT JOIN ajal_debts d ON d.id = ap.debt_id
    WHERE date(COALESCE(ap.payment_date, ap.created_at)) = ?
      AND COALESCE(d.party_type, 'customer') = 'customer'
      AND COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash'
  `, [date]);
  const supplierAjalPayments = scalar(db, `
    SELECT COALESCE(SUM(ap.amount), 0) AS total
    FROM ajal_payments ap
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    LEFT JOIN ajal_debts d ON d.id = ap.debt_id
    WHERE date(COALESCE(ap.payment_date, ap.created_at)) = ?
      AND COALESCE(d.party_type, 'customer') = 'supplier'
      AND COALESCE(pm.type, pm.category, pm.name, 'cash') = 'cash'
  `, [date]);
  const nonCashAjalPayments = scalar(db, `
    SELECT COALESCE(SUM(ap.amount), 0) AS total
    FROM ajal_payments ap
    LEFT JOIN payment_methods pm ON pm.id = ap.payment_method_id
    WHERE date(COALESCE(ap.payment_date, ap.created_at)) = ?
      AND COALESCE(pm.type, pm.category, pm.name, 'cash') != 'cash'
  `, [date]);

  const withdrawals = sessionId
    ? scalar(db, `
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM daily_withdrawals
        WHERE session_id = ?
      `, [sessionId])
    : 0;

  const customerCashCollections = customerPayments + customerAjalPayments;
  const supplierCashPayments = supplierPayments + supplierAjalPayments;
  // Cash in = all cash received from sales (including installment/multi cash portions) + collections + revenues + purchase returns
  const cashIn = posTotalCashReceived + customerCashCollections + revenuesCash + purchaseReturnsCash;
  const cashOut = expensesCash + supplierCashPayments + salesReturnsCash + withdrawals;

  return {
    pos_cash_sales: posCashSales,
    pos_cash_sales_count: posCashSalesCount,
    pos_installment_cash: posInstallmentCash,
    pos_installment_count: posInstallmentCount,
    pos_multi_cash: posMultiCash,
    pos_multi_count: posMultiCount,
    pos_total_cash_received: posTotalCashReceived,
    pos_bank_sales: posBankSales,
    pos_all_sales: posAllSales,
    pos_all_sales_count: posAllSalesCount,
    purchases_cash: purchasesCash,
    purchases_payable_total: purchasesTotal,
    pos_credit_sales: posCreditSales,
    pos_credit_sales_count: posCreditSalesCount,
    sales_returns_account: salesReturnsAccount,
    purchase_returns_cash: purchaseReturnsCash,
    purchase_returns_payable_total: purchaseReturnsAccount,
    expenses_cash: expensesCash,
    expenses_count: expensesCount,
    revenues_cash: revenuesCash,
    revenues_count: revenuesCount,
    customer_payments: customerPayments,
    customer_payments_count: customerPaymentsCount,
    supplier_payments: supplierPayments,
    supplier_payments_count: supplierPaymentsCount,
    non_cash_movements_total: posBankSales + nonCashPayments + nonCashAjalPayments,
    ajal_payments: customerAjalPayments,
    supplier_ajal_payments: supplierAjalPayments,
    customer_cash_collections: customerCashCollections,
    supplier_cash_payments: supplierCashPayments,
    sales_returns_cash: salesReturnsCash,
    withdrawals,
    cash_in: cashIn,
    cash_out: cashOut,
  };
}

function calculateDailySummary(db, dateText, options = {}) {
  const date = normalizeDate(dateText);
  const session = getSession(db, date, Boolean(options.createIfMissing));
  if (!session) return null;

  const breakdown = cashBreakdown(db, date, session);
  const expectedCash = Number(session.opening_balance || 0) + breakdown.cash_in - breakdown.cash_out;
  const actual = session.actual_cash == null ? null : Number(session.actual_cash);
  const discrepancy = actual == null ? null : actual - expectedCash;

  const yDate = addDays(date, -1);
  const ySession = getSession(db, yDate, false);
  const yBreakdown = ySession ? cashBreakdown(db, yDate, ySession) : null;

  return {
    session,
    opening_balance: Number(session.opening_balance || 0),
    ...breakdown,
    expected_cash: expectedCash,
    actual_cash: actual,
    discrepancy,
    yesterday: yBreakdown ? {
      pos_all_sales: yBreakdown.pos_all_sales,
      expenses_cash: yBreakdown.expenses_cash,
      cash_in: yBreakdown.cash_in,
      cash_out: yBreakdown.cash_out,
    } : null,
  };
}

function closeDailySession(db, dateText, actualCash, notes, userId) {
  const date = normalizeDate(dateText);
  const session = getSession(db, date, false);
  if (!session) {
    const err = new Error("لا توجد يومية لهذا التاريخ");
    err.status = 400;
    throw err;
  }
  if (session.status === "closed") {
    const err = new Error("الجلسة مغلقة بالفعل");
    err.status = 400;
    throw err;
  }
  if (actualCash == null || actualCash === "") {
    const err = new Error("أدخل الرصيد الفعلي");
    err.status = 400;
    throw err;
  }

  const summary = calculateDailySummary(db, date);
  const actual = Number(actualCash);
  const discrepancy = actual - Number(summary.expected_cash || 0);

  db.prepare(`
    UPDATE daily_sessions
    SET actual_cash = ?, closing_balance = ?, discrepancy = ?,
        status = 'closed', notes = ?, closed_at = datetime('now'), closed_by = ?
    WHERE id = ?
  `).run(actual, actual, discrepancy, notes || null, userId || 1, session.id);

  const next = db.prepare("SELECT * FROM daily_sessions WHERE date > ? ORDER BY date ASC LIMIT 1").get(date);
  if (next && next.status === "open") {
    db.prepare("UPDATE daily_sessions SET opening_balance = ? WHERE id = ?").run(actual, next.id);
  }

  return db.prepare("SELECT * FROM daily_sessions WHERE id = ?").get(session.id);
}

module.exports = {
  assertCanWriteForDate,
  calculateDailySummary,
  closeDailySession,
  ensureDailySessionSchema,
  ensureSessionForDate,
  getSession,
  localDate,
  normalizeDate,
};
