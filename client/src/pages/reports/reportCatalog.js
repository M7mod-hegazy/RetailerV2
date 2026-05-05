export const REPORT_CATEGORIES = [
  { id: "sales", label: "مبيعات" },
  { id: "purchases", label: "مشتريات" },
  { id: "inventory", label: "مخزون" },
  { id: "accounts", label: "حسابات" },
  { id: "treasury", label: "خزينة" },
  { id: "tax", label: "ضرائب" },
  { id: "audit", label: "تدقيق" },
];

/**
 * Single source of truth for the current Reports Center.
 * This is intentionally Arabic-first (RTL) and powers both:
 * - `/reports/center` catalog
 * - `/reports/:reportSlug` workspace metadata
 */
export const REPORT_CATALOG = [
  // ─────────────────────────────────────────────────────────────
  // SALES DOMAIN
  // ─────────────────────────────────────────────────────────────
  { id: "R01", cat: "sales", title: "الملخص اليومي للمبيعات", desc: "إيرادات وخصومات وعدد فواتير حسب اليوم.", slug: "daily-sales", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R02", cat: "sales", title: "المبيعات التفصيلية", desc: "كل الفواتير مع بيانات العميل وطريقة الدفع.", slug: "detailed-sales", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R03", cat: "sales", title: "مبيعات حسب الصنف", desc: "الأصناف الأكثر بيعاً حسب الكمية والإيراد.", slug: "sales-by-item", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R04", cat: "sales", title: "مبيعات حسب الفئة", desc: "توزيع المبيعات على التصنيفات.", slug: "sales-by-category", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R05", cat: "sales", title: "مبيعات حسب الكاشير", desc: "أداء المستخدمين حسب المبيعات وعدد الفواتير.", slug: "sales-by-cashier", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R06", cat: "sales", title: "مبيعات حسب طريقة الدفع", desc: "تجميع الفواتير حسب طريقة السداد.", slug: "sales-by-payment", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R07", cat: "sales", title: "خريطة حرارة المبيعات", desc: "توزيع الذروة حسب اليوم والساعة.", slug: "sales-heatmap", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
  { id: "R09", cat: "sales", title: "مقارنة فترتين", desc: "مقارنة مختصرة لملخص المبيعات.", slug: "period-comparison", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
  { id: "R29", cat: "sales", title: "المبيعات الإجمالية والصافية", desc: "إجمالي المبيعات بعد الخصومات والمرتجعات.", slug: "gross-net-sales", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R30", cat: "sales", title: "تقرير المرتجعات", desc: "تفاصيل مرتجعات المبيعات وتأثيرها.", slug: "sales-returns", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R31", cat: "sales", title: "تحليل الخصومات", desc: "إجمالي الخصومات وأنواعها وتأثيرها.", slug: "discount-analysis", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R32", cat: "sales", title: "هامش الربح حسب الصنف", desc: "تحليل هوامش الربح لكل صنف.", slug: "margin-by-item", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R33", cat: "sales", title: "هامش الربح حسب الفئة", desc: "تحليل هوامش الربح لكل تصنيف.", slug: "margin-by-category", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R27", cat: "sales", title: "تاريخ الورديات", desc: "إجماليات الورديات وفروق الصندوق.", slug: "shift-history", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },

  // ─────────────────────────────────────────────────────────────
  // PURCHASES DOMAIN
  // ─────────────────────────────────────────────────────────────
  { id: "R34", cat: "purchases", title: "ملخص المشتريات", desc: "إجمالي المشتريات حسب التاريخ والمورد.", slug: "purchase-summary", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R35", cat: "purchases", title: "المشتريات التفصيلية", desc: "تفاصيل أوامر الشراء والاستلام.", slug: "detailed-purchases", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R36", cat: "purchases", title: "مشتريات حسب المورد", desc: "تجميع المشتريات حسب المورد.", slug: "purchases-by-supplier", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R37", cat: "purchases", title: "مشتريات حسب الصنف", desc: "الأصناف الأكثر شراءً.", slug: "purchases-by-item", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R38", cat: "purchases", title: "مرتجعات المشتريات", desc: "تفاصيل مرتجعات المشتريات.", slug: "purchase-returns", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R39", cat: "purchases", title: "تحليل أسعار التوريد", desc: "مقارنة أسعار الموردين وتغيراتها.", slug: "supplier-pricing", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },

  // ─────────────────────────────────────────────────────────────
  // INVENTORY DOMAIN
  // ─────────────────────────────────────────────────────────────
  { id: "R10", cat: "inventory", title: "الأصناف الراكدة", desc: "أصناف لم تسجل مبيعات خلال الفترة.", slug: "slow-moving", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R11", cat: "inventory", title: "مستوى المخزون الحالي", desc: "الأرصدة الحالية وحدود إعادة الطلب.", slug: "stock-levels", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R12", cat: "inventory", title: "حركة المخزون التفصيلية", desc: "تفاصيل حركات المخزون.", slug: "stock-movements", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R13", cat: "inventory", title: "تقييم المخزون", desc: "قيمة المخزون الحالية حسب التكلفة.", slug: "stock-valuation", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R14", cat: "inventory", title: "ورقة جرد المخزون", desc: "رصيد النظام الحالي لكل صنف.", slug: "count-sheet", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
  { id: "R15", cat: "inventory", title: "تقرير إعادة الطلب", desc: "الأصناف منخفضة المخزون.", slug: "reorder", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
  { id: "R16", cat: "inventory", title: "تقرير انتهاء الصلاحية", desc: "يتطلب تفعيل تتبع الصلاحية (قيد الإعداد).", slug: "expiry", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
  { id: "R40", cat: "inventory", title: "تقادم المخزون", desc: "تحليل أعمار المخزون.", slug: "inventory-aging", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R41", cat: "inventory", title: "المخزون الراكد", desc: "أصناف بدون حركة لفترة طويلة.", slug: "dead-stock", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },

  // ─────────────────────────────────────────────────────────────
  // ACCOUNTS DOMAIN
  // ─────────────────────────────────────────────────────────────
  { id: "R17", cat: "accounts", title: "الملخص المالي اليومي", desc: "إجماليات مبيعات حسب التاريخ.", slug: "daily-financial", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R18", cat: "accounts", title: "ذمم العملاء", desc: "الأرصدة المستحقة على العملاء.", slug: "ar-aging", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R19", cat: "accounts", title: "ذمم الموردين", desc: "الأرصدة المستحقة للموردين.", slug: "ap-aging", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R20", cat: "accounts", title: "الأرباح والخسائر", desc: "إيرادات وتكاليف ومصروفات وصافي الربح.", slug: "profit-loss", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R24", cat: "accounts", title: "كشف حساب العميل", desc: "حركة فواتير العملاء خلال الفترة.", slug: "customer-statement", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R25", cat: "accounts", title: "أفضل العملاء", desc: "العملاء الأعلى إنفاقاً.", slug: "top-customers", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R26", cat: "accounts", title: "تحليل تقادم الذمم", desc: "تقادم الأرصدة المدينة.", slug: "customer-aging", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R42", cat: "accounts", title: "كفاءة التحصيل", desc: "تحليل سرعة تحصيل المستحقات.", slug: "collection-efficiency", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R43", cat: "accounts", title: "كشف حساب المورد", desc: "حركة فواتير الموردين خلال الفترة.", slug: "supplier-statement", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },

  // ─────────────────────────────────────────────────────────────
  // TREASURY DOMAIN
  // ─────────────────────────────────────────────────────────────
  { id: "R21", cat: "treasury", title: "التدفق النقدي", desc: "واردات وصادرات نقدية حسب التاريخ.", slug: "cash-flow", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R22", cat: "treasury", title: "الخزائن والحسابات البنكية", desc: "أرصدة الخزائن والبنوك.", slug: "treasury", supportsDates: false, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R44", cat: "treasury", title: "تناسق الصندوق", desc: "مطابقة أرصدة الصندوق الافتتاحية والختامية.", slug: "cash-consistency", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
  { id: "R45", cat: "treasury", title: "تدفق وسائل الدفع", desc: "تحليل التدفقات حسب طريقة الدفع.", slug: "payment-method-flow", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R46", cat: "treasury", title: "مقارنة البنك والصندوق", desc: "توزيع الأرصدة بين البنوك والصناديق.", slug: "bank-cash-split", supportsDates: false, exportFormats: ["pdf", "excel", "print"] },
  { id: "R47", cat: "treasury", title: "استثناءات التسوية", desc: "فروق التسوية والمشاكل المحاسبية.", slug: "reconciliation-exceptions", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },

  // ─────────────────────────────────────────────────────────────
  // TAX DOMAIN
  // ─────────────────────────────────────────────────────────────
  { id: "R23", cat: "tax", title: "ضريبة القيمة المضافة", desc: "المبيعات الخاضعة حسب نسبة الضريبة.", slug: "vat", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R48", cat: "tax", title: "ضريبة المخرجات", desc: "ضريبة المبيعات المستحقة.", slug: "output-vat", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R49", cat: "tax", title: "ضريبة المدخلات", desc: "ضريبة المشتريات القابلة للاسترداد.", slug: "input-vat", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R50", cat: "tax", title: "ملخص الإقرار الضريبي", desc: "ملخص شامل للفترة الضريبية.", slug: "vat-filing-summary", supportsDates: true, exportFormats: ["pdf", "excel", "word", "print"] },
  { id: "R51", cat: "tax", title: "تأثير المرتجعات الضريبي", desc: "تأثير المرتجعات على الضريبة.", slug: "returns-tax-effect", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },

  // ─────────────────────────────────────────────────────────────
  // AUDIT DOMAIN
  // ─────────────────────────────────────────────────────────────
  { id: "R08", cat: "audit", title: "تقرير الاستثناءات", desc: "الفواتير ذات الخصومات أو الحالات غير المعتادة.", slug: "exceptions", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
  { id: "R28", cat: "audit", title: "سجل التدقيق", desc: "سجل الأنشطة مع فلترة متقدمة.", slug: "audit-log", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
  { id: "R52", cat: "audit", title: "عمليات المستخدمين", desc: "تتبع أنشطة المستخدمين التفصيلية.", slug: "user-activity", supportsDates: true, exportFormats: ["pdf", "excel", "print"] },
];

export function getReportDefinitionBySlug(slug) {
  return REPORT_CATALOG.find((r) => r.slug === slug) || null;
}

