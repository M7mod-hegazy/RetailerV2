const os = require("os");
const path = require("path");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, TextRun, HeadingLevel } = require("docx");

// Windows system font paths for Arabic support in PDF
const FONT_ARIAL = "C:\\Windows\\Fonts\\arial.ttf";
const FONT_ARIAL_BOLD = "C:\\Windows\\Fonts\\arialbd.ttf";

async function exportRowsToExcel(rows = [], worksheetName = "Report") {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(worksheetName);
  const headers = Object.keys(rows[0] || {});

  if (headers.length) {
    worksheet.addRow(headers);
    rows.forEach((row) => worksheet.addRow(headers.map((header) => row[header])));
  }

  const filePath = path.join(os.tmpdir(), `${worksheetName}-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function exportRowsToPdf(rows = [], title = "Report") {
  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 40 });
  const stream = fs.createWriteStream(filePath);

  doc.pipe(stream);
  doc.fontSize(18).text(title);
  doc.moveDown();
  rows.forEach((row) => {
    doc.fontSize(10).text(JSON.stringify(row));
    doc.moveDown(0.5);
  });
  doc.end();

  await new Promise((resolve) => stream.on("finish", resolve));
  return filePath;
}

/**
 * v2 exports: Arabic-friendly Excel and structured PDF (basic).
 * Note: PDFKit RTL shaping is limited; Excel is the primary high-quality export.
 */
async function exportRowsToExcelV2({
  rows = [],
  worksheetName = "Report",
  columns,
  rtl = true,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ElHegazi Retailer";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(worksheetName, {
    views: rtl ? [{ rightToLeft: true }] : undefined,
  });

  const keys = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.key)
    : Object.keys(safeRows[0] || {});
  const headers = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.label)
    : keys;

  if (keys.length) {
    // Title row
    worksheet.addRow([worksheetName]);
    const titleRow = worksheet.getRow(1);
    titleRow.font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
    titleRow.alignment = { vertical: "middle", horizontal: rtl ? "right" : "left" };
    titleRow.height = 28;
    worksheet.mergeCells(1, 1, 1, keys.length);

    // Empty spacer row
    worksheet.addRow([]);

    // Header row
    worksheet.addRow(headers);
    const headerRow = worksheet.getRow(3);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF0F172A" } },
        bottom: { style: "thin", color: { argb: "FF0F172A" } },
        left: { style: "thin", color: { argb: "FF0F172A" } },
        right: { style: "thin", color: { argb: "FF0F172A" } },
      };
    });

    // Data rows with alternating colors
    safeRows.forEach((row, rowIdx) => {
      const dataRow = worksheet.addRow(keys.map((k) => row?.[k] ?? ""));
      dataRow.height = 20;
      dataRow.eachCell((cell, colIdx) => {
        const isNumeric = typeof cell.value === "number";
        cell.alignment = { vertical: "middle", horizontal: isNumeric ? "left" : (rtl ? "right" : "left") };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        if (rowIdx % 2 === 0) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF8FAFC" },
          };
        }
        // Format numbers
        if (typeof cell.value === "number") {
          cell.numFmt = "#,##0.00";
        }
      });
    });

    // Auto-column widths based on content
    keys.forEach((k, idx) => {
      const header = headers[idx] || k;
      let maxWidth = String(header).length + 4;
      safeRows.slice(0, 50).forEach((row) => {
        const val = String(row?.[k] ?? "");
        if (val.length > maxWidth) maxWidth = Math.min(val.length, 30);
      });
      worksheet.getColumn(idx + 1).width = maxWidth + 2;
    });

    // Footer row
    worksheet.addRow([]);
    const footerRow = worksheet.addRow([`تم التصدير: ${new Date().toLocaleDateString("ar-EG")} - ${new Date().toLocaleTimeString("ar-EG")}`]);
    footerRow.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    footerRow.alignment = { horizontal: rtl ? "left" : "right" };
    worksheet.mergeCells(footerRow.number, 1, footerRow.number, keys.length);
  }

  const filePath = path.join(os.tmpdir(), `${worksheetName}-${Date.now()}.xlsx`);
  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

async function exportRowsToPdfV2({
  rows = [],
  title = "Report",
  columns,
}) {
  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.pdf`);
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(16).text(title, { align: "right" });
  doc.moveDown(0.5);

  const keys = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.key)
    : Object.keys(rows[0] || {});
  const headers = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.label)
    : keys;

  // Simple header line (PDFKit RTL limitations acknowledged)
  if (headers.length) {
    doc.fontSize(9).text(headers.join(" | "), { align: "right" });
    doc.moveDown(0.25);
    doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
    doc.moveDown(0.4);
  }

  rows.slice(0, 400).forEach((row) => {
    const line = keys.map((k) => (row?.[k] == null ? "" : String(row[k]))).join(" | ");
    doc.fontSize(8).text(line, { align: "right" });
  });

  doc.end();
  await new Promise((resolve) => stream.on("finish", resolve));
  return filePath;
}

/**
 * Word (DOCX) export with Arabic RTL support and premium styling
 * Creates a professional table document with proper formatting
 */
async function exportRowsToDocx({
  rows = [],
  title = "Report",
  columns,
  rtl = true,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const keys = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.key)
    : Object.keys(safeRows[0] || {});
  const headers = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.label)
    : keys;

  const tableRows = [];

  // Header row with dark background
  if (headers.length) {
    tableRows.push(new TableRow({
      tableHeader: true,
      children: headers.map((header) => new TableCell({
        borders: {
          top: { style: BorderStyle.SINGLE, size: 8, color: "0f172a" },
          bottom: { style: BorderStyle.SINGLE, size: 8, color: "0f172a" },
          left: { style: BorderStyle.SINGLE, size: 4, color: "0f172a" },
          right: { style: BorderStyle.SINGLE, size: 4, color: "0f172a" },
        },
        shading: { fill: "0f172a" },
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 100 },
          children: [new TextRun({ text: String(header), bold: true, color: "FFFFFF", size: 24, rightToLeft: rtl })],
        })],
      })),
    }));
  }

  // Data rows with alternating colors
  safeRows.slice(0, 1000).forEach((row, rowIdx) => {
    const isEven = rowIdx % 2 === 0;
    tableRows.push(new TableRow({
      children: keys.map((k) => {
        const value = row?.[k] ?? "";
        const isNumeric = typeof value === "number" || (!isNaN(Number(value)) && value !== "");
        return new TableCell({
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0" },
          },
          shading: isEven ? { fill: "f8fafc" } : undefined,
          children: [new Paragraph({
            alignment: isNumeric ? AlignmentType.LEFT : (rtl ? AlignmentType.RIGHT : AlignmentType.LEFT),
            spacing: { before: 60, after: 60 },
            children: [new TextRun({
              text: String(value),
              size: 22,
              rightToLeft: rtl,
              color: "0f172a",
            })],
          })],
        });
      }),
    }));
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 }, // 0.5 inch margins
        },
      },
      children: [
        // Title with accent bar
        new Paragraph({
          alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { after: 200 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 12, color: "0f172a" },
          },
          children: [new TextRun({ text: title, bold: true, size: 36, rightToLeft: rtl, color: "0f172a" })],
        }),
        new Paragraph({ text: "" }), // spacer
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: tableRows,
        }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: "" }),
        // Footer
        new Paragraph({
          alignment: rtl ? AlignmentType.LEFT : AlignmentType.RIGHT,
          children: [new TextRun({
            text: `تم التصدير: ${new Date().toLocaleDateString("ar-EG")} - ${new Date().toLocaleTimeString("ar-EG")}`,
            size: 18,
            color: "64748b",
            rightToLeft: rtl,
            italics: true,
          })],
        }),
      ],
    }],
  });

  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.docx`);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

/**
 * Enhanced PDF export with premium styling and proper RTL table layout
 */
async function exportRowsToPdfV3({
  rows = [],
  title = "Report",
  columns,
  filters = null,
}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const filePath = path.join(os.tmpdir(), `${title}-${Date.now()}.pdf`);
  const doc = new PDFDocument({
    margin: 40,
    size: "A4",
    layout: "portrait",
    autoFirstPage: true,
  });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const keys = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.key)
    : Object.keys(safeRows[0] || {});
  const headers = Array.isArray(columns) && columns.length
    ? columns.map((c) => c.label)
    : keys;

  // Helper to draw header on each page
  const drawHeader = () => {
    // Top accent bar
    doc.rect(0, 0, doc.page.width, 8).fill("#0f172a");
    // Title area with background
    doc.rect(40, 20, doc.page.width - 80, 35).fill("#f8fafc");
    doc.roundedRect(40, 20, doc.page.width - 80, 35, 4);
    doc.fill("#f8fafc");
    // Title text - use Arial for Arabic support
    doc.fontSize(16).font(FONT_ARIAL_BOLD).fillColor("#0f172a");
    doc.text(title, 50, 28, { align: "center" });
    // Filter info below title
    if (filters?.from && filters?.to) {
      doc.fontSize(9).font(FONT_ARIAL).fillColor("#64748b");
      doc.text(`الفترة: ${filters.from} إلى ${filters.to}`, 50, 48, { align: "center" });
    }
    doc.y = 70;
  };

  // Draw header on first page
  drawHeader();

  // Table header
  if (headers.length) {
    const pageWidth = doc.page.width - 80;
    const colWidth = Math.min(100, pageWidth / headers.length);

    // Header row background
    doc.rect(40, doc.y, pageWidth, 24).fill("#0f172a");
    doc.fillColor("#ffffff").fontSize(9).font(FONT_ARIAL_BOLD);

    let xPos = doc.page.width - 40;
    headers.forEach((header) => {
      doc.text(header, xPos - colWidth + 4, doc.y + 7, { width: colWidth - 8, align: "right" });
      xPos -= colWidth;
    });

    doc.y += 26;
  }

  // Data rows (limit to fit page)
  const maxRows = Math.min(safeRows.length, 500);
  const pageWidth = doc.page.width - 80;
  const colWidth = Math.min(100, pageWidth / keys.length);
  let pageNum = 1;

  safeRows.slice(0, maxRows).forEach((row, rowIdx) => {
    const rowY = doc.y;

    // Check for page overflow
    if (rowY > doc.page.height - 80) {
      // Footer for current page
      doc.fontSize(8).font(FONT_ARIAL).fillColor("#94a3b8");
      doc.text(`صفحة ${pageNum}`, 40, doc.page.height - 30, { align: "center" });
      // New page
      doc.addPage();
      pageNum++;
      drawHeader();
      // Redraw table header
      doc.rect(40, doc.y, pageWidth, 24).fill("#0f172a");
      doc.fillColor("#ffffff").fontSize(9).font(FONT_ARIAL_BOLD);
      let xPos = doc.page.width - 40;
      headers.forEach((header) => {
        doc.text(header, xPos - colWidth + 4, doc.y + 7, { width: colWidth - 8, align: "right" });
        xPos -= colWidth;
      });
      doc.y += 26;
    }

    const currentY = doc.y;

    // Alternating row background
    if (rowIdx % 2 === 0) {
      doc.rect(40, currentY, pageWidth, 20).fill("#f8fafc");
    }

    // Row border
    doc.rect(40, currentY, pageWidth, 20).stroke("#e2e8f0");

    doc.fillColor("#0f172a").fontSize(8).font(FONT_ARIAL);
    let xPos = doc.page.width - 40;
    keys.forEach((k) => {
      const value = row?.[k] == null ? "" : String(row[k]);
      doc.text(value, xPos - colWidth + 3, currentY + 6, { width: colWidth - 6, align: "right", ellipsis: true });
      xPos -= colWidth;
    });

    doc.y = currentY + 20;
  });

  // Footer
  doc.y = Math.max(doc.y + 10, doc.page.height - 60);
  doc.fontSize(8).font(FONT_ARIAL).fillColor("#94a3b8");
  doc.text(`تم التصدير: ${new Date().toLocaleDateString("ar-EG")} - ${new Date().toLocaleTimeString("ar-EG")}`, 40, doc.y, { align: "center" });

  if (safeRows.length > maxRows) {
    doc.moveDown(0.3);
    doc.text(`تم عرض ${maxRows} من أصل ${safeRows.length} صف. للتصدير الكامل استخدم Excel.`, { align: "center" });
  }

  // Page number on last page
  doc.text(`صفحة ${pageNum}`, 40, doc.page.height - 30, { align: "center" });

  doc.end();
  await new Promise((resolve) => stream.on("finish", resolve));
  return filePath;
}

module.exports = {
  exportRowsToExcel,
  exportRowsToPdf,
  exportRowsToExcelV2,
  exportRowsToPdfV2,
  exportRowsToDocx,
  exportRowsToPdfV3,
};
