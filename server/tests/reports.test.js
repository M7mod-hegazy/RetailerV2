const fs = require("fs");
const os = require("os");
const path = require("path");
const { initDb, getDb, setDb } = require("../src/config/database");
const { getProfitLoss } = require("../src/services/reportService");

describe("reports analytics", () => {
  beforeEach(() => {
    setDb(null);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "retailer-reports-"));
    initDb(path.join(dir, "reports.db"));

    const db = getDb();
    db.prepare("INSERT INTO item_categories (name) VALUES (?)").run("مشروبات");
    db.prepare("INSERT INTO expense_categories (name) VALUES (?)").run("تشغيل");
    db.prepare("INSERT INTO units (name, symbol) VALUES (?, ?)").run("قطعة", "pcs");
    const itemId = db
      .prepare("INSERT INTO items (name, barcode, sale_price, purchase_price, category_id, unit_id) VALUES (?, ?, ?, ?, 1, 1)")
      .run("عصير", "RPT-001", 200, 80).lastInsertRowid;
    const customerId = db.prepare("INSERT INTO customers (name) VALUES (?)").run("عميل تقارير").lastInsertRowid;

    const invoiceId = db
      .prepare(
        "INSERT INTO invoices (invoice_no, customer_id, subtotal, discount, total, payment_type, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run("INV-RPT-1", customerId, 400, 20, 380, "cash", "paid", "2026-04-01").lastInsertRowid;
    db.prepare("INSERT INTO invoice_lines (invoice_id, item_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)").run(
      invoiceId,
      itemId,
      2,
      200,
      400,
    );

    db.prepare("INSERT INTO expenses (category_id, amount, notes, created_at) VALUES (?, ?, ?, ?)").run(1, 50, "كهرباء", "2026-04-01");
  });

  test("profit and loss uses integer ledger values and cogs", () => {
    const result = getProfitLoss("2026-04-01", "2026-04-30");
    expect(result.revenue).toBe(380);
    expect(result.discounts).toBe(20);
    expect(result.cost_of_goods_sold).toBe(160);
    expect(result.gross_profit).toBe(200);
    expect(result.expenses).toBe(50);
    expect(result.net_profit).toBe(150);
  });
});
