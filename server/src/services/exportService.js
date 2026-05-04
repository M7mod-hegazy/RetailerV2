const os = require("os");
const path = require("path");
const ExcelJS = require("exceljs");
const PDFDocument = require("pdfkit");
const fs = require("fs");

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

module.exports = { exportRowsToExcel, exportRowsToPdf };
