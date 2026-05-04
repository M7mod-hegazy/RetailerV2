import React, { Suspense, lazy, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { useAuthStore } from "./stores/authStore";
import api from "./services/api";
import ScreenLock from "./components/auth/ScreenLock";
import GlobalSearchPage from "./pages/search/GlobalSearchPage";
import FullPageLoader from "./components/ui/FullPageLoader";

const SetupWizard = lazy(() => import("./pages/setup/SetupWizard"));
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const LicenseActivationPage = lazy(() => import("./pages/auth/LicenseActivationPage"));
const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const AnalyticsPage = lazy(() => import("./pages/dashboard/AnalyticsPage"));
const FinanceWorkspacePage = lazy(() => import("./pages/workspaces/FinanceWorkspacePage"));
const PurchasesWorkspacePage = lazy(() => import("./pages/workspaces/PurchasesWorkspacePage"));
const InventoryWorkspacePage = lazy(() => import("./pages/workspaces/InventoryWorkspacePage"));
const OperationsWorkspacePage = lazy(() => import("./pages/workspaces/OperationsWorkspacePage"));
const CatalogWorkspacePage = lazy(() => import("./pages/workspaces/CatalogWorkspacePage"));
const PartiesWorkspacePage = lazy(() => import("./pages/workspaces/PartiesWorkspacePage"));
const ResourcesWorkspacePage = lazy(() => import("./pages/workspaces/ResourcesWorkspacePage"));
const TeamWorkspacePage = lazy(() => import("./pages/workspaces/TeamWorkspacePage"));
const CategoriesPage = lazy(() => import("./pages/definitions/CategoriesPage"));
const ItemsListPage = lazy(() => import("./pages/items/ItemsListPage"));
const CustomersListPage = lazy(() => import("./pages/customers/CustomersListPage"));
const SuppliersListPage = lazy(() => import("./pages/suppliers/SuppliersListPage"));
const RevenueCategoriesPage = lazy(() => import("./pages/definitions/RevenueCategoriesPage"));
const UnitsPage = lazy(() => import("./pages/definitions/UnitsPage"));
const WarehousesPage = lazy(() => import("./pages/definitions/WarehousesPage"));
const BranchesPage = lazy(() => import("./pages/definitions/BranchesPage"));
const BanksPage = lazy(() => import("./pages/definitions/BanksPage"));
const UsersPage = lazy(() => import("./pages/definitions/UsersPage"));
const EmployeesPage = lazy(() => import("./pages/definitions/EmployeesPage"));
const POSPage = lazy(() => import("./pages/pos/POSPage"));
const SalesReturnPage = lazy(() => import("./pages/sales/SalesReturnPage"));
const SalesReturnFormPage = lazy(() => import("./pages/sales/SalesReturnFormPage"));
const PurchasesListPage = lazy(() => import("./pages/purchases/PurchasesListPage"));
const PurchaseFormPage = lazy(() => import("./pages/purchases/PurchaseFormPage"));
const PurchaseOrdersPage = lazy(() => import("./pages/purchases/PurchaseOrdersPage"));
const PurchaseOrderFormPage = lazy(() => import("./pages/purchases/PurchaseOrderFormPage"));
const PurchaseReturnPage = lazy(() => import("./pages/purchases/PurchaseReturnPage"));
const PurchaseReturnFormPage = lazy(() => import("./pages/purchases/PurchaseReturnFormPage"));
const PaymentsListPage = lazy(() => import("./pages/payments/PaymentsListPage"));
const PaymentFormPage = lazy(() => import("./pages/payments/PaymentFormPage"));
const ChequesPage = lazy(() => import("./pages/operations/ChequesPage"));
const ExpensesListPage = lazy(() => import("./pages/expenses/ExpensesListPage"));
const RevenuesListPage = lazy(() => import("./pages/expenses/RevenuesListPage"));
const StockLevelsPage = lazy(() => import("./pages/stock/StockLevelsPage"));
const StockMovementsPage = lazy(() => import("./pages/stock/StockMovementsPage"));
const StockTransferPage = lazy(() => import("./pages/stock/StockTransferPage"));
const PhysicalCountPage = lazy(() => import("./pages/stock/PhysicalCountPage"));
const BulkPriceUpdatePage = lazy(() => import("./pages/operations/BulkPriceUpdate"));
const EmployeeAdjustmentsPage = lazy(() => import("./pages/operations/EmployeeAdjustments"));
const QuotationsPage = lazy(() => import("./pages/operations/QuotationsPage"));
const BranchTransferPage = lazy(() => import("./pages/operations/BranchTransferPage"));
const BranchTransferFormPage = lazy(() => import("./pages/operations/BranchTransferFormPage"));
const QuotationFormPage = lazy(() => import("./pages/operations/QuotationFormPage"));
const ReportsCenterPage = lazy(() => import("./pages/reports/ReportsCenter"));
const ReportWorkspacePage = lazy(() => import("./pages/reports/ReportWorkspacePage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const NotificationsPage = lazy(() => import("./pages/notifications/NotificationsPage"));
const PromotionsPage = lazy(() => import("./pages/definitions/PromotionsPage"));
const DailyTreasuryPage = lazy(() => import("./pages/pos/DailyTreasuryPage"));
const PaymentMethodsPage = lazy(() => import("./pages/operations/PaymentMethodsPage"));
const PaymentTransactionsPage = lazy(() => import("./pages/operations/PaymentTransactionsPage"));
const CustomerProfilePage = lazy(() => import("./pages/definitions/CustomerProfilePage"));
const SupplierProfilePage = lazy(() => import("./pages/definitions/SupplierProfilePage"));
const BankOperationsPage = lazy(() => import("./pages/operations/BankOperationsPage"));
const ExpenseCategoriesPage = lazy(() => import("./pages/definitions/ExpenseCategoriesPage"));
const CustomerAccountsPage = lazy(() => import("./pages/accounts/CustomerAccountsPage"));
const SupplierAccountsPage = lazy(() => import("./pages/accounts/SupplierAccountsPage"));

function AuthGuard({ children }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function SetupGuard({ children }) {
  const [status, setStatus] = useState({ loading: true, complete: false });

  useEffect(() => {
    let mounted = true;
    api
      .get("/api/settings/setup-status")
      .then((response) => {
        if (!mounted) return;
        setStatus({ loading: false, complete: Boolean(response.data.data.is_setup_complete) });
      })
      .catch(() => {
        if (!mounted) return;
        setStatus({ loading: false, complete: false });
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (status.loading) return <FullPageLoader text="جاري التحقق من الإعدادات..." />;
  if (!status.complete) return <Navigate to="/setup" replace />;
  return children;
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <ScreenLock />
      <GlobalSearchPage />
      <Routes>
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/activate-license" element={<LicenseActivationPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <SetupGuard>
                <AppShell>
                  <Routes>
                    <Route path="dashboard" element={<DashboardPage />} />
                    <Route path="analytics" element={<AnalyticsPage />} />
                    <Route path="workspace/finance" element={<FinanceWorkspacePage />} />
                    <Route path="workspace/purchases" element={<PurchasesWorkspacePage />} />
                    <Route path="workspace/inventory" element={<InventoryWorkspacePage />} />
                    <Route path="workspace/operations" element={<OperationsWorkspacePage />} />
                    <Route path="workspace/catalog" element={<CatalogWorkspacePage />} />
                    <Route path="workspace/parties" element={<PartiesWorkspacePage />} />
                    <Route path="workspace/resources" element={<ResourcesWorkspacePage />} />
                    <Route path="workspace/team" element={<TeamWorkspacePage />} />
                    <Route path="definitions/categories" element={<CategoriesPage />} />
                    <Route path="definitions/items" element={<ItemsListPage />} />
                    <Route path="definitions/customers" element={<CustomersListPage />} />
                    <Route path="definitions/customers/:id" element={<CustomerProfilePage />} />
                    <Route path="definitions/suppliers" element={<SuppliersListPage />} />
                    <Route path="definitions/suppliers/:id" element={<SupplierProfilePage />} />
                    <Route path="definitions/expense-categories" element={<ExpenseCategoriesPage />} />
                    <Route path="definitions/revenue-categories" element={<RevenueCategoriesPage />} />
                    <Route path="definitions/units" element={<UnitsPage />} />
                    <Route path="definitions/warehouses" element={<WarehousesPage />} />
                    <Route path="definitions/branches" element={<BranchesPage />} />
                    <Route path="definitions/treasuries" element={<Navigate to="/dashboard" replace />} />
                    <Route path="definitions/banks" element={<BanksPage />} />
                    <Route path="definitions/users" element={<UsersPage />} />
                    <Route path="definitions/employees" element={<EmployeesPage />} />
                    <Route path="pos" element={<POSPage />} />
                    <Route path="daily-treasury" element={<DailyTreasuryPage />} />
                    <Route path="operations/payment-methods" element={<PaymentMethodsPage />} />
                    <Route path="operations/payment-transactions" element={<PaymentTransactionsPage />} />
                    <Route path="sales/returns" element={<SalesReturnPage />} />
                    <Route path="sales/returns/new" element={<SalesReturnFormPage />} />
                    <Route path="purchases" element={<PurchasesListPage />} />
                    <Route path="purchases/new" element={<PurchaseFormPage />} />
                    <Route path="purchases/orders" element={<PurchaseOrdersPage />} />
                    <Route path="purchases/orders/new" element={<PurchaseOrderFormPage />} />
                    <Route path="purchases/returns" element={<PurchaseReturnPage />} />
                    <Route path="purchases/returns/new" element={<PurchaseReturnFormPage />} />
                    <Route path="payments" element={<PaymentsListPage />} />
                    <Route path="payments/new" element={<PaymentFormPage />} />
                    <Route path="accounts/customers" element={<CustomerAccountsPage />} />
                    <Route path="accounts/suppliers" element={<SupplierAccountsPage />} />
                    <Route path="operations/ajal-tracker" element={<Navigate to="/accounts/customers" replace />} />
                    <Route path="operations/cheques" element={<ChequesPage />} />
                    <Route path="operations/payment-transactions" element={<Navigate to="/operations/payment-methods" replace />} />
                    <Route path="operations/treasury-transfer" element={<Navigate to="/expenses" replace />} />
                    <Route path="operations/installments" element={<Navigate to="/accounts/customers" replace />} />
                    <Route path="operations/bank-operations" element={<BankOperationsPage />} />
                    <Route path="operations/bulk-price-update" element={<BulkPriceUpdatePage />} />
                    <Route path="operations/employee-adjustments" element={<EmployeeAdjustmentsPage />} />
                    <Route path="operations/branch-transfer" element={<BranchTransferPage />} />
                    <Route path="operations/branch-transfer/new" element={<BranchTransferFormPage />} />
                    <Route path="operations/quotations" element={<QuotationsPage />} />
                    <Route path="operations/quotations/new" element={<QuotationFormPage />} />
                    <Route path="reports/center" element={<ReportsCenterPage />} />
                    <Route path="reports/:reportSlug" element={<ReportWorkspacePage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="notifications" element={<NotificationsPage />} />
                    <Route path="definitions/promotions" element={<PromotionsPage />} />
                    <Route path="expenses" element={<ExpensesListPage />} />
                    <Route path="revenues" element={<RevenuesListPage />} />
                    <Route path="stock/levels" element={<StockLevelsPage />} />
                    <Route path="stock/movements" element={<StockMovementsPage />} />
                    <Route path="stock/transfer" element={<StockTransferPage />} />
                    <Route path="stock/physical-count" element={<PhysicalCountPage />} />
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </AppShell>
              </SetupGuard>
            </AuthGuard>
          }
        />
      </Routes>
    </Suspense>
  );
}
