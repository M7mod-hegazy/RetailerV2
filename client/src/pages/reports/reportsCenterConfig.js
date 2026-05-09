import { TrendingUp, Package, Wallet, Receipt, FileText, Shield, ClipboardList, FileImage, FileSpreadsheet, Printer, Layers } from "lucide-react";

export const CATEGORIES = [
  { id: "sales",     label: "المبيعات",   icon: TrendingUp, color: "var(--success-DEFAULT,#10b981)" },
  { id: "purchases", label: "المشتريات",  icon: Package,    color: "var(--info-DEFAULT,#3b82f6)" },
  { id: "inventory", label: "المخزون",    icon: Layers,     color: "var(--primary-DEFAULT,#8b5cf6)" },
  { id: "accounts",  label: "الحسابات",   icon: Wallet,     color: "var(--warning-DEFAULT,#f59e0b)" },
  { id: "treasury",  label: "الخزينة",    icon: Receipt,    color: "#06b6d4" },
  { id: "tax",       label: "الضرائب",    icon: FileText,   color: "var(--error-DEFAULT,#ef4444)" },
  { id: "audit",     label: "التدقيق",    icon: Shield,     color: "var(--text-secondary,#94a3b8)" },
];

export const FORMAT_ICONS = {
  pdf:   { icon: FileImage,       color: "var(--error-DEFAULT,#ef4444)",   label: "PDF" },
  excel: { icon: FileSpreadsheet, color: "var(--success-DEFAULT,#10b981)", label: "Excel" },
  word:  { icon: FileText,        color: "var(--info-DEFAULT,#3b82f6)",    label: "Word" },
  print: { icon: Printer,         color: "var(--text-secondary,#94a3b8)", label: "طباعة" },
};

export const COST_METHODS = [
  { value: "wacc",           label: "متوسط التكلفة (WACC)" },
  { value: "last_purchase",  label: "آخر سعر شراء" },
  { value: "fifo",           label: "الوارد أولاً صادر أولاً (FIFO)" },
  { value: "purchase_price", label: "سعر الشراء" },
];

export const SCOPE_OPTIONS = {
  sales:     [{ type:"all",label:"الكل"},{ type:"category",label:"فئة منتجات"},{ type:"product",label:"منتج واحد"},{ type:"customer",label:"عميل"}],
  purchases: [{ type:"all",label:"الكل"},{ type:"category",label:"فئة منتجات"},{ type:"product",label:"منتج واحد"},{ type:"supplier",label:"مورد"}],
  inventory: [{ type:"all",label:"الكل"},{ type:"category",label:"فئة منتجات"},{ type:"product",label:"منتج واحد"}],
  accounts:  [{ type:"all",label:"الكل"},{ type:"customer",label:"عميل"},{ type:"supplier",label:"مورد"}],
  treasury:  [{ type:"all",label:"الكل"}],
  tax:       [{ type:"all",label:"الكل"},{ type:"customer",label:"عميل"}],
  audit:     [{ type:"all",label:"الكل"}],
};

// Preview columns using the same keys the server uses so previews match reality
export const PREVIEW_COLUMNS = {
  sales:     [
    {k:"date",l:"التاريخ",t:"date"},{k:"invoice_no",l:"رقم الفاتورة",t:"text"},
    {k:"customer_name",l:"العميل",t:"text"},{k:"total",l:"الإجمالي",t:"cur"},
    {k:"discount",l:"الخصم",t:"cur"},{k:"profit_margin",l:"الربح",t:"cur"},
  ],
  purchases: [
    {k:"date",l:"التاريخ",t:"date"},{k:"supplier_name",l:"المورد",t:"text"},
    {k:"item_name",l:"الصنف",t:"text"},{k:"quantity_purchased",l:"الكمية",t:"num"},
    {k:"total_cost",l:"التكلفة",t:"cur"},{k:"purchase_no",l:"رقم المشتريات",t:"text"},
  ],
  inventory: [
    {k:"item_code",l:"كود الصنف",t:"text"},{k:"item_name",l:"الصنف",t:"text"},
    {k:"category_name",l:"الفئة",t:"text"},{k:"quantity",l:"الرصيد",t:"num"},
    {k:"total_value",l:"القيمة",t:"cur"},{k:"stock_status",l:"الحالة",t:"text"},
  ],
  accounts:  [
    {k:"customer_name",l:"العميل",t:"text"},{k:"total_due",l:"المستحق",t:"cur"},
    {k:"aging_0_30",l:"0-30 يوم",t:"cur"},{k:"aging_31_60",l:"31-60 يوم",t:"cur"},
    {k:"aging_90_plus",l:"أكثر من 90",t:"cur"},{k:"last_invoice_date",l:"آخر فاتورة",t:"date"},
  ],
  treasury:  [
    {k:"date",l:"التاريخ",t:"date"},{k:"type",l:"النوع",t:"text"},
    {k:"total",l:"المبلغ",t:"cur"},{k:"tx_count",l:"الحركات",t:"num"},
    {k:"name",l:"الخزينة",t:"text"},{k:"balance",l:"الرصيد",t:"cur"},
  ],
  tax:       [
    {k:"tax_rate",l:"النسبة",t:"num"},{k:"taxable_sales",l:"المبيعات الخاضعة",t:"cur"},
    {k:"vat_amount",l:"قيمة الضريبة",t:"cur"},{k:"invoice_count",l:"عدد الفواتير",t:"num"},
  ],
  audit:     [
    {k:"created_at",l:"التاريخ",t:"date"},{k:"full_name",l:"المستخدم",t:"text"},
    {k:"action",l:"العملية",t:"text"},{k:"resource",l:"المورد",t:"text"},
  ],
};

// Ghost (sample) data rows using same column keys — realistic Arabic retail examples
export const GHOST_ROWS = {
  sales: [
    {date:"٠٤/٠٥",invoice_no:"INV-1024",customer_name:"أحمد البرقوقي",total:"١٢٬٤٥٠",discount:"٤٠٠",profit_margin:"٢٬٣٠٠"},
    {date:"٠٣/٠٥",invoice_no:"INV-1023",customer_name:"شركة النور",total:"٨٬٣٢٠",discount:"١٥٠",profit_margin:"١٬٧٥٠"},
    {date:"٠٣/٠٥",invoice_no:"INV-1022",customer_name:"نقدي",total:"٣٬٥٥٠",discount:"٠",profit_margin:"٨٢٠"},
  ],
  purchases: [
    {date:"٢٨/٠٤",supplier_name:"مورد النور",item_name:"شاشة سامسونج ٥٥ بوصة",quantity_purchased:"١٥",total_cost:"٢٧٬٠٠٠",purchase_no:"PO-231"},
    {date:"٠١/٠٥",supplier_name:"تك سبلاي",item_name:"كابل USB-C",quantity_purchased:"٢٠٠",total_cost:"١٬٩٠٠",purchase_no:"PO-232"},
  ],
  inventory: [
    {item_code:"SKU-001",item_name:"آيفون ١٦ برو",category_name:"موبايلات",quantity:"٤٧",total_value:"٤٤٬٦٥٠",stock_status:"متاح"},
    {item_code:"SKU-042",item_name:"سامسونج A55",category_name:"موبايلات",quantity:"٨٣",total_value:"١٦٬٦٠٠",stock_status:"متاح"},
    {item_code:"SKU-107",item_name:"جراب سيليكون",category_name:"إكسسوارات",quantity:"٥",total_value:"٣٥٠",stock_status:"منخفض"},
  ],
  accounts: [
    {customer_name:"أحمد البرقوقي",total_due:"١٢٬٤٠٠",aging_0_30:"٨٬٥٠٠",aging_31_60:"٣٬٩٠٠",aging_90_plus:"٠",last_invoice_date:"١٠/٠٤"},
    {customer_name:"شركة النور للتجارة",total_due:"٧٬٨٥٠",aging_0_30:"٢٬٠٠٠",aging_31_60:"٥٬٨٥٠",aging_90_plus:"٠",last_invoice_date:"٢٥/٠٣"},
  ],
  treasury: [
    {date:"٠١/٠٥",type:"تحصيل فاتورة",total:"٥٬٢٠٠",tx_count:"١",name:"الخزينة الرئيسية",balance:"٣٧٬٤٠٠"},
    {date:"٠٣/٠٥",type:"دفع مورد",total:"-١٢٬٠٠٠",tx_count:"٣",name:"الخزينة الرئيسية",balance:"٢٥٬٤٠٠"},
  ],
  tax: [
    {tax_rate:"١٤٪",taxable_sales:"٥٬٢٠٠",vat_amount:"٧٢٨",invoice_count:"١٢"},
    {tax_rate:"٠٪",taxable_sales:"٣٬٨٠٠",vat_amount:"٠",invoice_count:"٥"},
  ],
  audit: [
    {created_at:"١٤:٢٢ ٠٤/٠٥",full_name:"محمد السيد",action:"تعديل سعر",resource:"items/٨٨٢"},
    {created_at:"١٦:٠٥ ٠٣/٠٥",full_name:"سارة الحسن",action:"إنشاء فاتورة",resource:"invoices/٩١٢"},
  ],
};

export const COL_TYPE_STYLE = {
  date: "text-blue-500  bg-blue-500/8  border-blue-200/50",
  text: "text-zinc-500  bg-zinc-500/8  border-zinc-300/50",
  num:  "text-violet-500 bg-violet-500/8 border-violet-200/50",
  cur:  "text-emerald-600 bg-emerald-500/8 border-emerald-200/50",
};

export function fmtDate(d) { return d.toISOString().slice(0,10); }
