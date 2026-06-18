import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import ClientsPage from "./pages/ClientsPage";
import ClientDetailPage from "./pages/ClientDetailPage";
import ItemsPage from "./pages/ItemsPage";
import InventoryPage from "./pages/InventoryPage";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceBuilderPage from "./pages/InvoiceBuilderPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import EstimatesPage from "./pages/EstimatesPage";
import EstimateBuilderPage from "./pages/EstimateBuilderPage";
import EstimateDetailPage from "./pages/EstimateDetailPage";
import PaymentsPage from "./pages/PaymentsPage";
import RecordPaymentPage from "./pages/RecordPaymentPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import CreditNotesPage from "./pages/CreditNotesPage";
import CreditNoteBuilderPage from "./pages/CreditNoteBuilderPage";
import CreditNoteDetailPage from "./pages/CreditNoteDetailPage";
import InvoiceTemplatePage from "./pages/InvoiceTemplatePage";
import PortalPage from "./pages/PortalPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import CustomFieldsPage from "./pages/CustomFieldsPage";
import TemplateCustomizationPage from "./pages/TemplateCustomizationPage";
import BusinessExpensesPage from "./pages/BusinessExpensesPage";
import CustomerStatementPage from "./pages/CustomerStatementPage";
import AgingDetailsPage from "./pages/AgingDetailsPage";
import ProfitLossPage from "./pages/ProfitLossPage";
import RecurringInvoicesPage from "./pages/RecurringInvoicesPage";
import EmployeesPage from "./pages/EmployeesPage";
import AttendancePage from "./pages/AttendancePage";
import GstReturnsPage from "./pages/GstReturnsPage";
import DemoAutoLoginPage from "./pages/DemoAutoLoginPage";
import LandingPage from "./pages/LandingPage";
import VendorsPage from "./pages/VendorsPage";
import BillsPage from "./pages/BillsPage";
import BillBuilderPage from "./pages/BillBuilderPage";
import BillDetailPage from "./pages/BillDetailPage";
import ChartOfAccountsPage from "./pages/ChartOfAccountsPage";
import JournalEntriesPage from "./pages/JournalEntriesPage";
import BranchesPage from "./pages/BranchesPage";
import TdsPage from "./pages/TdsPage";
import AccountingReportsPage from "./pages/AccountingReportsPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import PurchaseOrderBuilderPage from "./pages/PurchaseOrderBuilderPage";
import PurchaseOrderDetailPage from "./pages/PurchaseOrderDetailPage";
import GrnsPage from "./pages/GrnsPage";
import GrnBuilderPage from "./pages/GrnBuilderPage";
import GrnDetailPage from "./pages/GrnDetailPage";
import DeliveryChallansPage from "./pages/DeliveryChallansPage";
import DeliveryChallanBuilderPage from "./pages/DeliveryChallanBuilderPage";
import InventoryValuationPage from "./pages/InventoryValuationPage";
import BankAccountsPage from "./pages/BankAccountsPage";
import BankAccountDetailPage from "./pages/BankAccountDetailPage";
import CashFlowPage from "./pages/CashFlowPage";
import ShiftsPage from "./pages/ShiftsPage";
import LeavesPage from "./pages/LeavesPage";
import EmployeeDocumentsPage from "./pages/EmployeeDocumentsPage";
import PayrollPage from "./pages/PayrollPage";
import PayrollRunDetailPage from "./pages/PayrollRunDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/demo" element={<DemoAutoLoginPage />} />
            <Route path="/try" element={<DemoAutoLoginPage />} />

            {/* Protected routes */}
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/clients" element={<ClientsPage />} />
              <Route path="/clients/:id" element={<ClientDetailPage />} />
              <Route path="/items" element={<ItemsPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/invoices/new" element={<InvoiceBuilderPage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/invoices/:id/edit" element={<InvoiceBuilderPage />} />
              <Route path="/estimates" element={<EstimatesPage />} />
              <Route path="/estimates/new" element={<EstimateBuilderPage />} />
              <Route path="/estimates/:id" element={<EstimateDetailPage />} />
              <Route path="/estimates/:id/edit" element={<EstimateBuilderPage />} />
              <Route path="/estimates/:id/convert" element={<EstimateDetailPage />} />
              <Route path="/payments" element={<PaymentsPage />} />
              <Route path="/payments/new" element={<RecordPaymentPage />} />
              <Route path="/credit-notes" element={<CreditNotesPage />} />
              <Route path="/credit-notes/new" element={<CreditNoteBuilderPage />} />
              <Route path="/credit-notes/:id" element={<CreditNoteDetailPage />} />
              <Route path="/credit-notes/:id/edit" element={<CreditNoteBuilderPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/templates" element={<InvoiceTemplatePage />} />
              <Route path="/templates/customize" element={<TemplateCustomizationPage />} />
              <Route path="/audit-logs" element={<AuditLogsPage />} />
              <Route path="/custom-fields" element={<CustomFieldsPage />} />
              <Route path="/expenses" element={<BusinessExpensesPage />} />
              <Route path="/aging-details" element={<AgingDetailsPage />} />
              <Route path="/profit-loss" element={<ProfitLossPage />} />
              <Route path="/gst-returns" element={<GstReturnsPage />} />
              <Route path="/recurring-invoices" element={<RecurringInvoicesPage />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/statements" element={<CustomerStatementPage />} />
              <Route path="/statements/:clientId" element={<CustomerStatementPage />} />
              <Route path="/vendors" element={<VendorsPage />} />
              <Route path="/bills" element={<BillsPage />} />
              <Route path="/bills/new" element={<BillBuilderPage />} />
              <Route path="/bills/:id" element={<BillDetailPage />} />
              <Route path="/bills/:id/edit" element={<BillBuilderPage />} />
              <Route path="/accounts" element={<ChartOfAccountsPage />} />
              <Route path="/journal" element={<JournalEntriesPage />} />
              <Route path="/branches" element={<BranchesPage />} />
              <Route path="/tds" element={<TdsPage />} />
              <Route path="/accounting-reports" element={<AccountingReportsPage />} />
              <Route path="/accounting-reports" element={<AccountingReportsPage />} />
              <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="/purchase-orders/new" element={<PurchaseOrderBuilderPage />} />
              <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
              <Route path="/purchase-orders/:id/edit" element={<PurchaseOrderBuilderPage />} />
              <Route path="/grns" element={<GrnsPage />} />
              <Route path="/grns/new" element={<GrnBuilderPage />} />
              <Route path="/grns/:id" element={<GrnDetailPage />} />
              <Route path="/grns/:id/edit" element={<GrnBuilderPage />} />
              <Route path="/delivery-challans" element={<DeliveryChallansPage />} />
              <Route path="/delivery-challans/new" element={<DeliveryChallanBuilderPage />} />
              <Route path="/delivery-challans/:id/edit" element={<DeliveryChallanBuilderPage />} />
              <Route path="/inventory-valuation" element={<InventoryValuationPage />} />
              <Route path="/bank-accounts" element={<BankAccountsPage />} />
              <Route path="/bank-accounts/:id" element={<BankAccountDetailPage />} />
              <Route path="/cash-flow" element={<CashFlowPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Public portal */}
            <Route path="/portal/:token" element={<PortalPage />} />

            {/* Redirects */}
            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
