import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth } from "@/lib/auth";
import { AppLayout } from "@/components/layout/AppLayout";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const ClientDetailPage = lazy(() => import("./pages/ClientDetailPage"));
const ItemsPage = lazy(() => import("./pages/ItemsPage"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const InvoiceBuilderPage = lazy(() => import("./pages/InvoiceBuilderPage"));
const InvoiceDetailPage = lazy(() => import("./pages/InvoiceDetailPage"));
const EstimatesPage = lazy(() => import("./pages/EstimatesPage"));
const EstimateBuilderPage = lazy(() => import("./pages/EstimateBuilderPage"));
const EstimateDetailPage = lazy(() => import("./pages/EstimateDetailPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const RecordPaymentPage = lazy(() => import("./pages/RecordPaymentPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const CreditNotesPage = lazy(() => import("./pages/CreditNotesPage"));
const CreditNoteBuilderPage = lazy(() => import("./pages/CreditNoteBuilderPage"));
const CreditNoteDetailPage = lazy(() => import("./pages/CreditNoteDetailPage"));
const InvoiceTemplatePage = lazy(() => import("./pages/InvoiceTemplatePage"));
const PortalPage = lazy(() => import("./pages/PortalPage"));
const AuditLogsPage = lazy(() => import("./pages/AuditLogsPage"));
const CustomFieldsPage = lazy(() => import("./pages/CustomFieldsPage"));
const TemplateCustomizationPage = lazy(() => import("./pages/TemplateCustomizationPage"));
const BusinessExpensesPage = lazy(() => import("./pages/BusinessExpensesPage"));
const CustomerStatementPage = lazy(() => import("./pages/CustomerStatementPage"));
const AgingDetailsPage = lazy(() => import("./pages/AgingDetailsPage"));
const ProfitLossPage = lazy(() => import("./pages/ProfitLossPage"));
const RecurringInvoicesPage = lazy(() => import("./pages/RecurringInvoicesPage"));
const EmployeesPage = lazy(() => import("./pages/EmployeesPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const GstReturnsPage = lazy(() => import("./pages/GstReturnsPage"));
const DemoAutoLoginPage = lazy(() => import("./pages/DemoAutoLoginPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const VendorsPage = lazy(() => import("./pages/VendorsPage"));
const BillsPage = lazy(() => import("./pages/BillsPage"));
const BillBuilderPage = lazy(() => import("./pages/BillBuilderPage"));
const BillDetailPage = lazy(() => import("./pages/BillDetailPage"));
const ChartOfAccountsPage = lazy(() => import("./pages/ChartOfAccountsPage"));
const JournalEntriesPage = lazy(() => import("./pages/JournalEntriesPage"));
const BranchesPage = lazy(() => import("./pages/BranchesPage"));
const TdsPage = lazy(() => import("./pages/TdsPage"));
const AccountingReportsPage = lazy(() => import("./pages/AccountingReportsPage"));
const PurchaseOrdersPage = lazy(() => import("./pages/PurchaseOrdersPage"));
const PurchaseOrderBuilderPage = lazy(() => import("./pages/PurchaseOrderBuilderPage"));
const PurchaseOrderDetailPage = lazy(() => import("./pages/PurchaseOrderDetailPage"));
const GrnsPage = lazy(() => import("./pages/GrnsPage"));
const GrnBuilderPage = lazy(() => import("./pages/GrnBuilderPage"));
const GrnDetailPage = lazy(() => import("./pages/GrnDetailPage"));
const DeliveryChallansPage = lazy(() => import("./pages/DeliveryChallansPage"));
const DeliveryChallanBuilderPage = lazy(() => import("./pages/DeliveryChallanBuilderPage"));
const InventoryValuationPage = lazy(() => import("./pages/InventoryValuationPage"));
const BankAccountsPage = lazy(() => import("./pages/BankAccountsPage"));
const BankAccountDetailPage = lazy(() => import("./pages/BankAccountDetailPage"));
const CashFlowPage = lazy(() => import("./pages/CashFlowPage"));
const ShiftsPage = lazy(() => import("./pages/ShiftsPage"));
const LeavesPage = lazy(() => import("./pages/LeavesPage"));
const EmployeeDocumentsPage = lazy(() => import("./pages/EmployeeDocumentsPage"));
const PayrollPage = lazy(() => import("./pages/PayrollPage"));
const PayrollRunDetailPage = lazy(() => import("./pages/PayrollRunDetailPage"));
const LeadsPage = lazy(() => import("./pages/LeadsPage"));
const PipelinePage = lazy(() => import("./pages/PipelinePage"));
const ActivitiesPage = lazy(() => import("./pages/ActivitiesPage"));
const MarketingTemplatesPage = lazy(() => import("./pages/MarketingTemplatesPage"));
const CampaignsPage = lazy(() => import("./pages/CampaignsPage"));
const CampaignDetailPage = lazy(() => import("./pages/CampaignDetailPage"));
const JourneysPage = lazy(() => import("./pages/JourneysPage"));
const MessageLogsPage = lazy(() => import("./pages/MessageLogsPage"));
const AdminPanelPage = lazy(() => import("./pages/AdminPanelPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<div className="flex h-screen w-screen items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div></div>}>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/demo" element={<DemoAutoLoginPage />} />
            <Route path="/try" element={<DemoAutoLoginPage />} />
            <Route path="/admin" element={<AdminPanelPage />} />

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
              <Route path="/shifts" element={<ShiftsPage />} />
              <Route path="/leaves" element={<LeavesPage />} />
              <Route path="/employees/:id/documents" element={<EmployeeDocumentsPage />} />
              <Route path="/employee-documents" element={<EmployeeDocumentsPage />} />
              <Route path="/payroll" element={<PayrollPage />} />
              <Route path="/payroll/:id" element={<PayrollRunDetailPage />} />
              <Route path="/leads" element={<LeadsPage />} />
              <Route path="/pipeline" element={<PipelinePage />} />
              <Route path="/activities" element={<ActivitiesPage />} />
              <Route path="/marketing/templates" element={<MarketingTemplatesPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
              <Route path="/journeys" element={<JourneysPage />} />
              <Route path="/message-logs" element={<MessageLogsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Public portal */}
            <Route path="/portal/:token" element={<PortalPage />} />

            {/* Redirects */}
            <Route path="/" element={<LandingPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
