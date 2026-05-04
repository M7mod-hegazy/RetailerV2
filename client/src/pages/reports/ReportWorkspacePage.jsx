import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import PageWrapper from "../../components/ui/PageWrapper";
import DataGrid from "../../components/ui/DataGrid";
import { ReportExportBar } from "../../components/ui/ReportExportBar";
import api from "../../services/api";

const REPORT_META = {
  "daily-sales": { title: "Daily Sales Summary", subtitle: "Revenue, discounts, and invoice count by day.", supportsDates: true, exportKind: "sales" },
  "detailed-sales": { title: "Detailed Sales", subtitle: "All invoices with customer and payment details.", supportsDates: true },
  "sales-by-item": { title: "Sales by Item", subtitle: "Best-selling items by quantity and revenue.", supportsDates: true },
  "sales-by-category": { title: "Sales by Category", subtitle: "Sales distribution across categories.", supportsDates: true },
  "sales-by-cashier": { title: "Sales by Cashier", subtitle: "Cashier performance by sales and invoice count.", supportsDates: true },
  "sales-by-payment": { title: "Sales by Payment Method", subtitle: "Grouped invoices by payment method.", supportsDates: true },
  "sales-heatmap": { title: "Sales Heatmap", subtitle: "Peak sales by weekday and hour.", supportsDates: true },
  exceptions: { title: "Exceptions Report", subtitle: "Invoices with unusual discounts or behavior.", supportsDates: true },
  "period-comparison": { title: "Period Comparison", subtitle: "Compare summary metrics between periods.", supportsDates: true },
  "slow-moving": { title: "Slow Moving Items", subtitle: "Items without recent sales in range.", supportsDates: true },
  "stock-levels": { title: "Current Stock Levels", subtitle: "Current balances and reorder points.", supportsDates: false },
  "stock-movements": { title: "Stock Movements", subtitle: "Detailed in/out inventory activity.", supportsDates: true },
  "stock-valuation": { title: "Stock Valuation", subtitle: "Current inventory valuation by cost.", supportsDates: false, exportKind: "inventory" },
  "count-sheet": { title: "Stock Count Sheet", subtitle: "System balances for all items.", supportsDates: false },
  reorder: { title: "Reorder Report", subtitle: "Low-stock items requiring replenishment.", supportsDates: false },
  expiry: { title: "Expiry Report", subtitle: "Available when expiry tracking data exists.", supportsDates: false },
  "daily-financial": { title: "Daily Financial Summary", subtitle: "Sales totals by date.", supportsDates: true },
  "ar-aging": { title: "Accounts Receivable Aging", subtitle: "Outstanding customer balances.", supportsDates: false },
  "ap-aging": { title: "Accounts Payable Aging", subtitle: "Outstanding supplier balances.", supportsDates: false },
  "profit-loss": { title: "Profit and Loss", subtitle: "Revenue, costs, expenses, and net profit.", supportsDates: true },
  "cash-flow": { title: "Cash Flow", subtitle: "Cash in and out by date.", supportsDates: true },
  treasury: { title: "Treasury and Bank Accounts", subtitle: "Current treasury and bank balances.", supportsDates: false },
  vat: { title: "VAT Report", subtitle: "Taxable sales grouped by tax rate.", supportsDates: true },
  "customer-statement": { title: "Customer Statement", subtitle: "Invoice movement by customer.", supportsDates: true },
  "top-customers": { title: "Top Customers", subtitle: "Highest spending customers.", supportsDates: true },
  "customer-aging": { title: "Customer Aging Analysis", subtitle: "Current receivable aging details.", supportsDates: false },
  "shift-history": { title: "Shift History", subtitle: "Shift totals and cashier performance.", supportsDates: false },
  "audit-log": { title: "Audit Log", subtitle: "Latest logged activities in the system.", supportsDates: false },
};

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function prettifyLabel(key) {
  const labels = {
    invoice_no: "Invoice #",
    customer_name: "Customer",
    supplier_name: "Supplier",
    date: "Date",
    total: "Total",
    total_sales: "Total Sales",
    invoice_count: "Invoice Count",
    quantity: "Quantity",
    quantity_sold: "Sold Qty",
    item_name: "Item",
    category_name: "Category",
    payment_type: "Payment Method",
    status: "Status",
    balance: "Balance",
    source: "Source",
    tax_rate: "Tax Rate",
    taxable_sales: "Taxable Sales",
    outstanding_balance: "Outstanding Balance",
    hour_slot: "Hour",
    weekday: "Weekday",
    action: "Action",
    resource: "Resource",
    created_at: "Created At",
    line_total: "Line Total",
  };
  return labels[key] || key;
}

export default function ReportWorkspacePage() {
  const { reportSlug } = useParams();
  const [searchParams] = useSearchParams();
  const definition = REPORT_META[reportSlug];

  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);
  const defaultFrom = useMemo(() => formatDate(monthStart), [monthStart]);
  const defaultTo = useMemo(() => formatDate(today), [today]);

  const initialFrom = useMemo(() => {
    const value = searchParams.get("start_date");
    return isValidDateString(value) ? value : defaultFrom;
  }, [defaultFrom, searchParams]);

  const initialTo = useMemo(() => {
    const value = searchParams.get("end_date");
    return isValidDateString(value) ? value : defaultTo;
  }, [defaultTo, searchParams]);

  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [appliedFrom, setAppliedFrom] = useState(initialFrom);
  const [appliedTo, setAppliedTo] = useState(initialTo);
  const [refreshTick, setRefreshTick] = useState(0);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setFrom(initialFrom);
    setTo(initialTo);
    setAppliedFrom(initialFrom);
    setAppliedTo(initialTo);
    setRefreshTick((current) => current + 1);
  }, [initialFrom, initialTo, reportSlug]);

  useEffect(() => {
    if (!definition) return undefined;

    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/api/reports/run/${reportSlug}`, {
          params: definition.supportsDates ? { start_date: appliedFrom, end_date: appliedTo } : undefined,
        });
        if (!mounted) return;
        setRows(Array.isArray(response.data?.data) ? response.data.data : []);
      } catch (error) {
        if (!mounted) return;
        setRows([]);
        toast.error(error.response?.data?.message || "Failed to load report");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [appliedFrom, appliedTo, definition, refreshTick, reportSlug]);

  const columns = useMemo(() => {
    const sample = rows[0];
    if (!sample) return [];
    return Object.keys(sample).map((key) => ({ key, label: prettifyLabel(key) }));
  }, [rows]);

  if (!definition) {
    return (
      <PageWrapper className="mx-auto max-w-4xl px-4 py-8">
        <div className="page-surface text-center">
          <h1 className="page-title">Report Not Available</h1>
          <p className="page-subtitle">This report is not known in the current system.</p>
          <Link to="/reports/center" className="btn btn-primary mt-4 inline-flex">
            Back to Reports Center
          </Link>
        </div>
      </PageWrapper>
    );
  }

  async function handleExport(format) {
    if (format === "print") {
      window.print();
      return;
    }
    if (!definition.exportKind) {
      toast.error("Export is currently available only for base reports");
      return;
    }
    const response = await api.get(`/api/reports/export/${definition.exportKind}`, {
      params: {
        format,
        start_date: definition.supportsDates ? appliedFrom : undefined,
        end_date: definition.supportsDates ? appliedTo : undefined,
      },
    });
    const exportPath = response.data?.data?.path;
    if (exportPath) {
      toast.success(`File prepared: ${exportPath}`);
    }
  }

  const hasPendingFilters = definition.supportsDates && (from !== appliedFrom || to !== appliedTo);
  const invalidRange = definition.supportsDates && from > to;

  function handleApplyFilters() {
    if (!definition.supportsDates) {
      setRefreshTick((current) => current + 1);
      return;
    }
    if (invalidRange) {
      toast.error("Start date must be earlier than or equal to end date");
      return;
    }
    setAppliedFrom(from);
    setAppliedTo(to);
    setRefreshTick((current) => current + 1);
  }

  function handleResetFilters() {
    setFrom(defaultFrom);
    setTo(defaultTo);
    setAppliedFrom(defaultFrom);
    setAppliedTo(defaultTo);
    setRefreshTick((current) => current + 1);
  }

  return (
    <PageWrapper className="mx-auto max-w-7xl space-y-5 px-4 py-4">
      <div className="page-header">
        <div>
          <h1 className="page-title">{definition.title}</h1>
          <p className="page-subtitle">{definition.subtitle}</p>
        </div>
        <Link to="/reports/center" className="btn btn-ghost">
          Reports Center
        </Link>
      </div>

      <div className="page-surface space-y-4">
        {definition.supportsDates ? (
          <div className="space-y-4 rounded-[18px] border border-border-subtle bg-[var(--bg-overlay)] px-4 py-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2 text-sm text-text-primary">
                <span className="block font-medium">From Date</span>
                <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="input w-full" />
              </label>
              <label className="space-y-2 text-sm text-text-primary">
                <span className="block font-medium">To Date</span>
                <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="input w-full" />
              </label>
              <div className="rounded-[14px] border border-border-subtle bg-[var(--bg-surface)] px-3 py-2 text-xs text-text-secondary">
                Report refresh is manual now. It runs only after clicking Apply.
                <div className="mt-1 text-[11px] text-text-muted">Applied range: {appliedFrom} to {appliedTo}</div>
              </div>
            </div>

            {invalidRange ? <div className="text-xs text-[var(--error-text)]">Start date must be earlier than or equal to end date.</div> : null}

            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" disabled={loading || invalidRange || !hasPendingFilters} onClick={handleApplyFilters}>
                Apply Filters
              </button>
              <button type="button" className="btn btn-ghost" onClick={handleResetFilters}>
                Reset to Current Month
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border-subtle bg-[var(--bg-overlay)] px-4 py-3 text-sm text-text-secondary">
            <span>This report always uses the latest available data.</span>
            <button type="button" className="btn btn-ghost" onClick={handleApplyFilters}>
              Refresh Report
            </button>
          </div>
        )}

        <ReportExportBar
          lang="en"
          formats={definition.exportKind ? ["pdf", "excel", "print"] : ["print"]}
          showSchedule={false}
          onExport={handleExport}
        />

        {loading ? (
          <div className="rounded-[18px] border border-border-subtle px-4 py-10 text-center text-text-secondary">Loading report...</div>
        ) : columns.length === 0 ? (
          <div className="rounded-[18px] border border-border-subtle px-4 py-10 text-center text-text-secondary">No data is currently available for this report.</div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <DataGrid
              data={rows}
              columns={columns.map(c => ({
                id: c.key,
                header: c.label,
                width: 150,
                sortable: true
              }))}
              rowKey={(row) => row.id || JSON.stringify(row)}
            />
          </div>
        )}
      </div>
    </PageWrapper>
  );
}