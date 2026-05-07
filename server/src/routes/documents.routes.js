const express = require("express");
const router = express.Router();
const { generateDocNumber } = require("../utils/docNumber");
const authMiddleware = require("../middleware/auth");

const VALID_TYPES = ["pos_sale", "purchase_receipt", "sales_return", "purchase_return"];

// POST /api/documents/reserve
// Atomically increments the daily sequence and returns the reserved doc number.
// The caller MUST use this exact number when saving the invoice.
// If the form is abandoned the gap in sequence is acceptable.
router.post("/reserve", authMiddleware, (req, res, next) => {
  try {
    const { type } = req.body;
    if (!VALID_TYPES.includes(type)) {
      const e = new Error(`Invalid document type: ${type}`);
      e.status = 400;
      throw e;
    }
    const docNo = generateDocNumber(type);
    res.json({ success: true, data: { doc_no: docNo } });
  } catch (e) { next(e); }
});

module.exports = router;
