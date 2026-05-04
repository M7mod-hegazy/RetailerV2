const { getDb } = require("../config/database");

/**
 * Generate a sequential document number in format PREFIX-YYYY-NNNNN.
 * Counter resets every calendar year.
 * @param {string} type - e.g. 'pos_sale', 'purchase_receipt'
 * @param {string} [overridePrefix] - optional prefix override; falls back to settings
 * @returns {string} e.g. "SEL-2026-00001"
 */
function generateDocNumber(type, overridePrefix) {
  const db = getDb();
  const year = new Date().getFullYear();

  // Lookup prefix from settings
  let prefix = overridePrefix;
  if (!prefix) {
    const settingKey = `doc_prefix_${type}`;
    const row = db.prepare("SELECT value FROM settings_kv WHERE key = ?").get(settingKey);
    prefix = row?.value || type.toUpperCase().slice(0, 4);
  }

  // Upsert sequence row
  const existing = db.prepare(
    "SELECT year, last_seq FROM document_sequences WHERE type = ?"
  ).get(type);

  let nextSeq;
  if (!existing) {
    db.prepare(
      "INSERT INTO document_sequences (type, year, last_seq) VALUES (?, ?, 1)"
    ).run(type, year);
    nextSeq = 1;
  } else if (existing.year !== year) {
    // New year — reset counter
    db.prepare(
      "UPDATE document_sequences SET year = ?, last_seq = 1 WHERE type = ?"
    ).run(year, type);
    nextSeq = 1;
  } else {
    nextSeq = existing.last_seq + 1;
    db.prepare(
      "UPDATE document_sequences SET last_seq = ? WHERE type = ?"
    ).run(nextSeq, type);
  }

  return `${prefix}-${year}-${String(nextSeq).padStart(5, "0")}`;
}

module.exports = { generateDocNumber };
