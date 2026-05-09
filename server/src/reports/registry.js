const REPORT_REGISTRY = {
  categories: [
    { id: "sales", label_key: "category_sales" },
    { id: "purchases", label_key: "category_purchases" },
    { id: "inventory", label_key: "category_inventory" },
    { id: "accounts", label_key: "category_accounts" },
    { id: "treasury", label_key: "category_treasury" },
    { id: "tax", label_key: "category_tax" },
    { id: "audit", label_key: "category_audit" },
  ],
  reports: [
    // ── Sales ──
    { id: "R01", cat: "sales", slug: "daily-sales", title_key: "r01_title", desc_key: "r01_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R02", cat: "sales", slug: "detailed-sales", title_key: "r02_title", desc_key: "r02_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "status", type: "select", label_key: "status", options: [{ value: "paid", label_key: "paid" }, { value: "unpaid", label_key: "unpaid" }, { value: "cancelled", label_key: "cancelled" }] },
      { key: "payment_type", type: "select", label_key: "payment_type", options: [{ value: "cash", label_key: "cash" }, { value: "card", label_key: "card" }, { value: "credit", label_key: "credit" }, { value: "wallet", label_key: "wallet" }] },
    ]},
    { id: "R03", cat: "sales", slug: "sales-by-item", title_key: "r03_title", desc_key: "r03_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    ]},
    { id: "R04", cat: "sales", slug: "sales-by-category", title_key: "r04_title", desc_key: "r04_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    ]},
    { id: "R05", cat: "sales", slug: "sales-by-cashier", title_key: "r05_title", desc_key: "r05_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "cashier_id", type: "lookup", label_key: "cashier", entity: "user" },
    ]},
    { id: "R06", cat: "sales", slug: "sales-by-payment", title_key: "r06_title", desc_key: "r06_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "payment_type", type: "select", label_key: "payment_type", options: [{ value: "cash", label_key: "cash" }, { value: "card", label_key: "card" }, { value: "credit", label_key: "credit" }, { value: "wallet", label_key: "wallet" }] },
    ]},
    { id: "R07", cat: "sales", slug: "sales-heatmap", title_key: "r07_title", desc_key: "r07_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    ]},
    { id: "R09", cat: "sales", slug: "period-comparison", title_key: "r09_title", desc_key: "r09_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
    { id: "R27", cat: "sales", slug: "shift-history", title_key: "r27_title", desc_key: "r27_desc", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
    { id: "R29", cat: "sales", slug: "gross-net-sales", title_key: "r29_title", desc_key: "r29_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R30", cat: "sales", slug: "sales-returns", title_key: "r30_title", desc_key: "r30_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
    ]},
    { id: "R31", cat: "sales", slug: "discount-analysis", title_key: "r31_title", desc_key: "r31_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "payment_type", type: "select", label_key: "payment_type", options: [{ value: "cash", label_key: "cash" }, { value: "card", label_key: "card" }, { value: "credit", label_key: "credit" }, { value: "wallet", label_key: "wallet" }] },
    ]},
    { id: "R32", cat: "sales", slug: "margin-by-item", title_key: "r32_title", desc_key: "r32_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    ]},
    { id: "R33", cat: "sales", slug: "margin-by-category", title_key: "r33_title", desc_key: "r33_desc", supportsDates: true, hasProfit: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    ]},
    { id: "R60", cat: "sales", slug: "margin-health", title_key: "r60_title", desc_key: "r60_desc", supportsDates: false, hasProfit: true, exportFormats: ["pdf", "excel", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
    ]},

    // ── Purchases ──
    { id: "R34", cat: "purchases", slug: "purchase-summary", title_key: "r34_title", desc_key: "r34_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
    ]},
    { id: "R35", cat: "purchases", slug: "detailed-purchases", title_key: "r35_title", desc_key: "r35_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
      { key: "status", type: "select", label_key: "status", options: [{ value: "paid", label_key: "paid" }, { value: "unpaid", label_key: "unpaid" }, { value: "cancelled", label_key: "cancelled" }] },
      { key: "payment_type", type: "select", label_key: "payment_type", options: [{ value: "cash", label_key: "cash" }, { value: "card", label_key: "card" }, { value: "credit", label_key: "credit" }, { value: "wallet", label_key: "wallet" }] },
    ]},
    { id: "R36", cat: "purchases", slug: "purchases-by-supplier", title_key: "r36_title", desc_key: "r36_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
    ]},
    { id: "R37", cat: "purchases", slug: "purchases-by-item", title_key: "r37_title", desc_key: "r37_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
    ]},
    { id: "R38", cat: "purchases", slug: "purchase-returns", title_key: "r38_title", desc_key: "r38_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
    ]},
    { id: "R39", cat: "purchases", slug: "supplier-pricing", title_key: "r39_title", desc_key: "r39_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
      { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
    ]},

    // ── Inventory ──
    { id: "R10", cat: "inventory", slug: "slow-moving", title_key: "r10_title", desc_key: "r10_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    ]},
    { id: "R11", cat: "inventory", slug: "stock-levels", title_key: "r11_title", desc_key: "r11_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    ]},
    { id: "R12", cat: "inventory", slug: "stock-movements", title_key: "r12_title", desc_key: "r12_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "movement_type", type: "select", label_key: "movement_type", options: [{ value: "in", label_key: "in" }, { value: "out", label_key: "out" }, { value: "transfer", label_key: "transfer" }] },
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    ]},
    { id: "R13", cat: "inventory", slug: "stock-valuation", title_key: "r13_title", desc_key: "r13_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    ]},
    { id: "R14", cat: "inventory", slug: "count-sheet", title_key: "r14_title", desc_key: "r14_desc", supportsDates: false, exportFormats: ["pdf", "excel", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    ]},
    { id: "R15", cat: "inventory", slug: "reorder", title_key: "r15_title", desc_key: "r15_desc", supportsDates: false, exportFormats: ["pdf", "excel", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    ]},
    { id: "R16", cat: "inventory", slug: "expiry", title_key: "r16_title", desc_key: "r16_desc", supportsDates: false, exportFormats: ["pdf", "excel", "print"], filters: [
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    ]},
    { id: "R40", cat: "inventory", slug: "inventory-aging", title_key: "r40_title", desc_key: "r40_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    ]},
    { id: "R41", cat: "inventory", slug: "dead-stock", title_key: "r41_title", desc_key: "r41_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "category_id", type: "lookup", label_key: "category", entity: "category" },
      { key: "item_id", type: "lookup", label_key: "product", entity: "product" },
      { key: "warehouse_id", type: "lookup", label_key: "warehouse", entity: "warehouse" },
    ]},

    // ── Accounts ──
    { id: "R18", cat: "accounts", slug: "ar-aging", title_key: "r18_title", desc_key: "r18_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
    ]},
    { id: "R19", cat: "accounts", slug: "ap-aging", title_key: "r19_title", desc_key: "r19_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier" },
    ]},
    { id: "R20", cat: "accounts", slug: "profit-loss", title_key: "r20_title", desc_key: "r20_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R24", cat: "accounts", slug: "customer-statement", title_key: "r24_title", desc_key: "r24_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer", required: true },
    ]},
    { id: "R25", cat: "accounts", slug: "top-customers", title_key: "r25_title", desc_key: "r25_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
    ]},
    { id: "R42", cat: "accounts", slug: "collection-efficiency", title_key: "r42_title", desc_key: "r42_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "customer_id", type: "lookup", label_key: "customer", entity: "customer" },
    ]},
    { id: "R43", cat: "accounts", slug: "supplier-statement", title_key: "r43_title", desc_key: "r43_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"], filters: [
      { key: "supplier_id", type: "lookup", label_key: "supplier", entity: "supplier", required: true },
    ]},

    // ── Treasury ──
    { id: "R21", cat: "treasury", slug: "cash-flow", title_key: "r21_title", desc_key: "r21_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R22", cat: "treasury", slug: "treasury", title_key: "r22_title", desc_key: "r22_desc", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R44", cat: "treasury", slug: "cash-consistency", title_key: "r44_title", desc_key: "r44_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
    { id: "R45", cat: "treasury", slug: "payment-method-flow", title_key: "r45_title", desc_key: "r45_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R46", cat: "treasury", slug: "bank-cash-split", title_key: "r46_title", desc_key: "r46_desc", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
    { id: "R47", cat: "treasury", slug: "reconciliation-exceptions", title_key: "r47_title", desc_key: "r47_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },

    // ── Tax ──
    { id: "R23", cat: "tax", slug: "vat", title_key: "r23_title", desc_key: "r23_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R48", cat: "tax", slug: "output-vat", title_key: "r48_title", desc_key: "r48_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R49", cat: "tax", slug: "input-vat", title_key: "r49_title", desc_key: "r49_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R50", cat: "tax", slug: "vat-filing-summary", title_key: "r50_title", desc_key: "r50_desc", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
    { id: "R51", cat: "tax", slug: "returns-tax-effect", title_key: "r51_title", desc_key: "r51_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },

    // ── Audit ──
    { id: "R08", cat: "audit", slug: "exceptions", title_key: "r08_title", desc_key: "r08_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
      { key: "status", type: "select", label_key: "status", options: [{ value: "paid", label_key: "paid" }, { value: "unpaid", label_key: "unpaid" }, { value: "cancelled", label_key: "cancelled" }] },
    ]},
    { id: "R28", cat: "audit", slug: "audit-log", title_key: "r28_title", desc_key: "r28_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
      { key: "user_id", type: "lookup", label_key: "user", entity: "user" },
      { key: "action", type: "select", label_key: "action", options: [] },
      { key: "resource", type: "text", label_key: "resource" },
    ]},
    { id: "R52", cat: "audit", slug: "user-activity", title_key: "r52_title", desc_key: "r52_desc", supportsDates: true, exportFormats: ["pdf", "excel", "print"], filters: [
      { key: "user_id", type: "lookup", label_key: "user", entity: "user" },
      { key: "action", type: "select", label_key: "action", options: [] },
    ]},
  ],
};

module.exports = { REPORT_REGISTRY };
