const express = require("express");
const { getDb } = require("../config/database");

const router = express.Router();

function normalizeImageUrls(payload = {}) {
  if (Array.isArray(payload.image_urls)) {
    return [...new Set(payload.image_urls.map((entry) => String(entry || "").trim()).filter(Boolean))];
  }

  if (typeof payload.image_urls === "string") {
    return [...new Set(payload.image_urls.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean))];
  }

  if (typeof payload.image_urls_text === "string") {
    return [...new Set(payload.image_urls_text.split(/[\n,]+/).map((entry) => entry.trim()).filter(Boolean))];
  }

  return [];
}

function loadImagesByItemIds(itemIds) {
  if (!itemIds.length) return new Map();
  const placeholders = itemIds.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT id, item_id, image_url, is_primary, sort_order
       FROM item_images
       WHERE item_id IN (${placeholders})
       ORDER BY item_id ASC, is_primary DESC, sort_order ASC, id ASC`,
    )
    .all(...itemIds);

  const map = new Map();
  rows.forEach((row) => {
    if (!map.has(row.item_id)) {
      map.set(row.item_id, []);
    }
    map.get(row.item_id).push(row);
  });
  return map;
}

function withImages(rows) {
  const ids = rows.map((row) => row.id);
  const imagesByItem = loadImagesByItemIds(ids);

  return rows.map((row) => {
    const imageRows = imagesByItem.get(row.id) || [];
    const imageUrls = imageRows.map((entry) => entry.image_url);
    const primary = imageRows.find((entry) => Number(entry.is_primary) === 1)?.image_url || imageUrls[0] || null;

    return {
      ...row,
      image_urls: imageUrls,
      primary_image_url: primary,
      image_count: imageUrls.length,
    };
  });
}

function storeItemImages(itemId, imageUrls) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("DELETE FROM item_images WHERE item_id = ?").run(itemId);
    if (!imageUrls.length) return;
    const stmt = db.prepare(
      "INSERT INTO item_images (item_id, image_url, is_primary, sort_order) VALUES (?, ?, ?, ?)",
    );
    imageUrls.forEach((url, index) => {
      stmt.run(itemId, url, index === 0 ? 1 : 0, index);
    });
  });
  tx();
}

function getCategoryPrefix(categoryId) {
  if (!categoryId) return null;
  const category = getDb()
    .prepare("SELECT sku_prefix FROM item_categories WHERE id = ?")
    .get(categoryId);
  return String(category?.sku_prefix || "").trim() || null;
}

function parseCodeSuffixForPrefix(code, prefix) {
  const source = String(code || "").trim();
  if (!source || !prefix) return null;
  const [left, right] = source.split(".");
  if (left !== String(prefix)) return null;
  const numeric = Number(right);
  if (!Number.isInteger(numeric) || numeric <= 0) return null;
  return numeric;
}

function nextCategorySequence(prefix) {
  if (!prefix) return null;
  const rows = getDb()
    .prepare("SELECT code FROM items WHERE code LIKE ?")
    .all(`${prefix}.%`);
  let max = 0;
  rows.forEach((row) => {
    const suffix = parseCodeSuffixForPrefix(row.code, prefix);
    if (suffix && suffix > max) max = suffix;
  });
  return max + 1;
}

function computeCodeAndSequence({ categoryId, incomingCode, currentCode }) {
  const prefix = getCategoryPrefix(categoryId);
  const normalizedIncoming = incomingCode === undefined ? undefined : String(incomingCode || "").trim();

  if (normalizedIncoming !== undefined && normalizedIncoming !== "") {
    return {
      code: normalizedIncoming,
      skuSequence: parseCodeSuffixForPrefix(normalizedIncoming, prefix),
    };
  }

  if (normalizedIncoming === "") {
    if (!prefix) return { code: null, skuSequence: null };
    const next = nextCategorySequence(prefix);
    return { code: `${prefix}.${next}`, skuSequence: next };
  }

  if (currentCode) {
    return {
      code: currentCode,
      skuSequence: parseCodeSuffixForPrefix(currentCode, prefix),
    };
  }

  if (!prefix) {
    return { code: null, skuSequence: null };
  }

  const next = nextCategorySequence(prefix);
  return { code: `${prefix}.${next}`, skuSequence: next };
}

function getItemsList(search = "", categoryId = null, includeDeleted = false) {
  let sql = `
    SELECT i.*, c.name AS category_name, c.sku_prefix, u.name AS unit_name,
           COALESCE((SELECT SUM(quantity) FROM stock_levels sl WHERE sl.item_id = i.id), 0) AS stock_quantity
    FROM items i
    LEFT JOIN item_categories c ON c.id = i.category_id
    LEFT JOIN units u ON u.id = i.unit_id
    WHERE 1 = 1
  `;
  const params = [];
  if (!includeDeleted) {
    sql += " AND i.deleted_at IS NULL";
  }
  if (search) {
    sql += " AND (i.name LIKE ? OR i.barcode LIKE ? OR i.code LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (categoryId) {
    sql += " AND i.category_id = ?";
    params.push(Number(categoryId));
  }
  sql += categoryId
    ? " ORDER BY (i.deleted_at IS NOT NULL) ASC, COALESCE(i.sku_sequence, 999999) ASC, i.id ASC"
    : " ORDER BY (i.deleted_at IS NOT NULL) ASC, i.id DESC";

  const rows = getDb().prepare(sql).all(...params);
  return withImages(rows);
}

router.get("/", (req, res) => {
  const search = String(req.query.search || "").trim();
  const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
  const includeDeleted = req.query.include_deleted === "1" || req.query.include_deleted === "true";
  const rows = getItemsList(search, categoryId, includeDeleted);
  res.json({ success: true, data: rows });
});

router.get("/search/detailed", (req, res) => {
  const query = String(req.query.q || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 200);
  const allItems = getItemsList("");

  const filtered = query
    ? allItems.filter((item) => {
        const name = String(item.name || "").toLowerCase();
        const code = String(item.code || "").toLowerCase();
        const barcode = String(item.barcode || "").toLowerCase();
        const category = String(item.category_name || "").toLowerCase();
        return name.includes(query) || code.includes(query) || barcode.includes(query) || category.includes(query);
      })
    : allItems;

  res.json({ success: true, data: filtered.slice(0, limit) });
});

router.get("/barcode/:barcode", (req, res) => {
  const row = getDb().prepare("SELECT * FROM items WHERE barcode = ?").get(req.params.barcode);
  if (!row) return res.status(404).json({ success: false, message: "Item not found" });
  const item = withImages([row])[0];
  return res.json({ success: true, data: item });
});

router.post("/", (req, res) => {
  const payload = req.body || {};
  const categoryId = payload.category_id ? Number(payload.category_id) : null;
  const sku = computeCodeAndSequence({
    categoryId,
    incomingCode: payload.code,
    currentCode: null,
  });

  const info = getDb()
    .prepare(
      `INSERT INTO items
       (code, sku_sequence, name, name_en, barcode, category_id, unit_id, sale_price, wholesale_price, purchase_price, tax_rate, item_type, description, is_active, min_stock_qty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      sku.code,
      sku.skuSequence,
      payload.name,
      payload.name_en || null,
      payload.barcode || null,
      categoryId,
      payload.unit_id ? Number(payload.unit_id) : null,
      Number(payload.sale_price || 0),
      Number(payload.wholesale_price || 0),
      Number(payload.purchase_price || payload.cost_price || 0),
      Number(payload.tax_rate || 0),
      payload.item_type || "product",
      payload.description || null,
      payload.is_active === false ? 0 : 1,
      0,
    );

  const imageUrls = normalizeImageUrls(payload);
  storeItemImages(info.lastInsertRowid, imageUrls);

  const row = getDb().prepare("SELECT * FROM items WHERE id = ?").get(info.lastInsertRowid);
  return res.status(201).json({ success: true, data: withImages([row])[0] });
});

router.put("/:id", (req, res) => {
  const payload = req.body || {};
  const id = Number(req.params.id);
  const existing = getDb().prepare("SELECT * FROM items WHERE id = ?").get(id);
  if (!existing) {
    return res.status(404).json({ success: false, message: "Item not found" });
  }

  const categoryId =
    payload.category_id === undefined
      ? existing.category_id
      : payload.category_id
      ? Number(payload.category_id)
      : null;

  const sku = computeCodeAndSequence({
    categoryId,
    incomingCode: payload.code,
    currentCode: existing.code,
  });

  getDb()
    .prepare(
      `UPDATE items
       SET code = ?, sku_sequence = ?, name = ?, name_en = ?, barcode = ?, category_id = ?, unit_id = ?, sale_price = ?, wholesale_price = ?, purchase_price = ?, tax_rate = ?, item_type = ?, description = ?, is_active = ?, min_stock_qty = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    )
    .run(
      sku.code,
      sku.skuSequence,
      payload.name ?? existing.name,
      payload.name_en ?? existing.name_en,
      payload.barcode ?? existing.barcode,
      categoryId,
      payload.unit_id === undefined ? existing.unit_id : payload.unit_id ? Number(payload.unit_id) : null,
      Number(payload.sale_price ?? existing.sale_price ?? 0),
      Number(payload.wholesale_price ?? existing.wholesale_price ?? 0),
      Number(payload.purchase_price ?? payload.cost_price ?? existing.purchase_price ?? 0),
      Number(payload.tax_rate ?? existing.tax_rate ?? 0),
      payload.item_type ?? existing.item_type ?? "product",
      payload.description ?? existing.description,
      payload.is_active === undefined ? existing.is_active : payload.is_active === false ? 0 : 1,
      Number(payload.min_stock_qty ?? existing.min_stock_qty ?? 0),
      id,
    );

  if (payload.image_urls !== undefined || payload.image_urls_text !== undefined) {
    storeItemImages(id, normalizeImageUrls(payload));
  }

  const row = getDb().prepare("SELECT * FROM items WHERE id = ?").get(id);
  return res.json({ success: true, data: withImages([row])[0] });
});

// Swap the code and sku_sequence of two items (same category, adjacent positions)
router.post("/:id/swap/:otherId", (req, res) => {
  const db = getDb();
  const a = db.prepare("SELECT id, code, sku_sequence FROM items WHERE id = ?").get(req.params.id);
  const b = db.prepare("SELECT id, code, sku_sequence FROM items WHERE id = ?").get(req.params.otherId);
  if (!a || !b) return res.status(404).json({ success: false, message: "Item not found" });

  db.transaction(() => {
    db.prepare("UPDATE items SET code = ?, sku_sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(b.code, b.sku_sequence, a.id);
    db.prepare("UPDATE items SET code = ?, sku_sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(a.code, a.sku_sequence, b.id);
  })();

  return res.json({ success: true });
});

// Reorder all items in a category — reassigns codes and sku_sequence in the given order
router.post("/reorder", (req, res) => {
  const { category_id, ordered_ids } = req.body || {};
  if (!category_id || !Array.isArray(ordered_ids) || !ordered_ids.length) {
    return res.status(400).json({ success: false, message: "category_id and ordered_ids are required" });
  }
  const prefix = getCategoryPrefix(Number(category_id));
  if (!prefix) return res.status(400).json({ success: false, message: "Category not found or has no prefix" });

  const db = getDb();
  db.transaction(() => {
    ordered_ids.forEach((id, index) => {
      const seq = index + 1;
      db.prepare("UPDATE items SET code = ?, sku_sequence = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(`${prefix}.${seq}`, seq, Number(id));
    });
  })();

  return res.json({ success: true });
});

router.delete("/:id", (req, res) => {
  try {
    const existing = getDb().prepare("SELECT id FROM items WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "الصنف غير موجود" });
    getDb().prepare("UPDATE items SET deleted_at = datetime('now'), is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "تعذر حذف الصنف" });
  }
});

router.post("/:id/restore", (req, res) => {
  try {
    const existing = getDb().prepare("SELECT id FROM items WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: "الصنف غير موجود" });
    getDb().prepare("UPDATE items SET deleted_at = NULL, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: "تعذر استعادة الصنف" });
  }
});

router.post("/import", (req, res, next) => {
  const db = getDb();
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const overwriteExisting = req.body?.overwrite_existing === true;

  if (!rows.length) {
    return res.status(400).json({ success: false, message: "No rows provided" });
  }

  try {
    let success = 0;
    let failed = 0;
    const errors = [];

    const tx = db.transaction(() => {
      const insertStmt = db.prepare(
        `INSERT INTO items
         (code, sku_sequence, name, name_en, barcode, category_id, unit_id, sale_price, purchase_price, tax_rate, item_type, description, is_active, min_stock_qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );

      const updateStmt = db.prepare(
        `UPDATE items
         SET name = ?, sale_price = ?, purchase_price = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
      );

      const defaultUnit = db.prepare("SELECT id FROM units ORDER BY id ASC LIMIT 1").get();

      rows.forEach((rawRow, index) => {
        const row = rawRow || {};
        const name = String(row.name || "").trim();
        const barcode = String(row.barcode || "").trim();
        const salePrice = Number(row.price ?? row.sale_price ?? 0);
        const purchasePrice = Number(row.purchase_price ?? salePrice);

        if (!name) {
          failed += 1;
          errors.push({ row: index + 1, message: "Name is required" });
          return;
        }

        if (Number.isNaN(salePrice) || Number.isNaN(purchasePrice)) {
          failed += 1;
          errors.push({ row: index + 1, message: "Invalid price value" });
          return;
        }

        if (barcode) {
          const existing = db.prepare("SELECT id FROM items WHERE barcode = ?").get(barcode);
          if (existing) {
            if (!overwriteExisting) {
              failed += 1;
              errors.push({ row: index + 1, message: "Duplicate barcode" });
              return;
            }
            updateStmt.run(name, salePrice, purchasePrice, existing.id);
            success += 1;
            return;
          }
        }

        const categoryId = row.category_id ? Number(row.category_id) : null;
        const sku = computeCodeAndSequence({
          categoryId,
          incomingCode: row.code,
          currentCode: null,
        });

        insertStmt.run(
          sku.code,
          sku.skuSequence,
          name,
          null,
          barcode || null,
          categoryId,
          defaultUnit?.id || null,
          salePrice,
          purchasePrice,
          0,
          "product",
          null,
          1,
          0,
        );
        success += 1;
      });
    });

    tx();
    return res.json({ success: true, data: { success, failed, errors } });
  } catch (error) {
    return next(error);
  }
});

function resolvePriceField(price_field) {
  const map = { retail_price: "sale_price", wholesale_price: "wholesale_price", cost_price: "purchase_price" };
  return map[price_field] || "sale_price";
}

function calcNewPrice(oldPrice, direction, adjustment_type, value) {
  const signed = direction === "down" ? -Math.abs(value) : Math.abs(value);
  return adjustment_type === "percentage"
    ? Math.max(0, Math.round(oldPrice * (1 + signed / 100) * 100) / 100)
    : Math.max(0, Math.round((oldPrice + signed) * 100) / 100);
}

router.post("/bulk-price-update", (req, res, next) => {
  const db = getDb();
  try {
    const { item_ids, adjustment_type, adjustment_value, direction = "up", price_field = "retail_price", reason = "" } = req.body;
    const value = Math.abs(Number(adjustment_value || 0));
    if (value === 0) return res.status(400).json({ success: false, message: "قيمة التعديل لا يمكن أن تكون صفراً" });
    if (!Array.isArray(item_ids) || !item_ids.length) return res.status(400).json({ success: false, message: "يجب اختيار صنف واحد على الأقل" });

    const field = resolvePriceField(price_field);
    const operationId = `BPU-${Date.now()}`;
    let totalChanges = 0;

    const placeholders = item_ids.map(() => "?").join(",");
    const items = db.prepare(`SELECT id, ${field} as old_price FROM items WHERE id IN (${placeholders})`).all(...item_ids);

    const changedBy = req.user?.name || req.user?.username || "غير محدد";
    const insertHistory = db.prepare(
      `INSERT INTO price_history (item_id, field, old_value, new_value, adjustment_type, adjustment_value, reason, operation_id, changed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const updateItem = db.prepare(`UPDATE items SET ${field} = ?, updated_at = datetime('now') WHERE id = ?`);

    const run = db.transaction(() => {
      for (const item of items) {
        const newPrice = calcNewPrice(item.old_price, direction, adjustment_type, value);
        if (newPrice === item.old_price) continue;
        insertHistory.run(item.id, field, item.old_price, newPrice, adjustment_type, value, reason, operationId, changedBy);
        updateItem.run(newPrice, item.id);
        totalChanges++;
      }
    });
    run();

    res.json({ success: true, changes: totalChanges, operation_id: operationId });
  } catch (err) {
    next(err);
  }
});

router.post("/bulk-price-rollback", (req, res, next) => {
  const db = getDb();
  try {
    const { operation_id } = req.body;
    if (!operation_id) return res.status(400).json({ success: false, message: "operation_id مطلوب" });
    const history = db.prepare("SELECT * FROM price_history WHERE operation_id = ?").all(operation_id);
    if (!history.length) return res.status(404).json({ success: false, message: "العملية غير موجودة" });
    let restored = 0;
    const run = db.transaction(() => {
      for (const h of history) {
        db.prepare(`UPDATE items SET ${h.field} = ?, updated_at = datetime('now') WHERE id = ?`).run(h.old_value, h.item_id);
        restored++;
      }
      db.prepare("DELETE FROM price_history WHERE operation_id = ?").run(operation_id);
    });
    run();
    res.json({ success: true, restored });
  } catch (err) {
    next(err);
  }
});

router.get("/bulk-price-history", (req, res, next) => {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT operation_id, field, adjustment_type, adjustment_value, reason, changed_by,
             COUNT(*) as items_count, MIN(changed_at) as changed_at
      FROM price_history
      GROUP BY operation_id
      ORDER BY changed_at DESC
      LIMIT 50
    `).all();
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.get("/bulk-price-history/:operationId/items", (req, res, next) => {
  const db = getDb();
  try {
    const rows = db.prepare(`
      SELECT ph.item_id, ph.field, ph.old_value, ph.new_value, ph.adjustment_type, ph.adjustment_value,
             i.name AS item_name, i.barcode, c.name AS category_name
      FROM price_history ph
      LEFT JOIN items i ON i.id = ph.item_id
      LEFT JOIN item_categories c ON c.id = i.category_id
      WHERE ph.operation_id = ?
      ORDER BY i.name ASC
    `).all(req.params.operationId);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
