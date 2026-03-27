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
import ItemsPage from "./pages/ItemsPage";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceBuilderPage from "./pages/InvoiceBuilderPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import EstimatesPage from "./pages/EstimatesPage";
import EstimateBuilderPage from "./pages/EstimateBuilderPage";
import EstimateDetailPage from "./pages/EstimateDetailPage";
import PaymentsPage from "./pages/PaymentsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import CreditNotesPage from "./pages/CreditNotesPage";
import CreditNoteBuilderPage from "./pages/CreditNoteBuilderPage";
import CreditNoteDetailPage from "./pages/CreditNoteDetailPage";
import InvoiceTemplatePage from "./pages/InvoiceTemplatePage";
import PortalPage from "./pages/PortalPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import CustomFieldsPage from "./pages/CustomFieldsPage";
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
              <Route path="/items" element={<ItemsPage />} />
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
              <Route path="/credit-notes" element={<CreditNotesPage />} />
              <Route path="/credit-notes/new" element={<CreditNoteBuilderPage />} />
              <Route path="/credit-notes/:id" element={<CreditNoteDetailPage />} />
              <Route path="/credit-notes/:id/edit" element={<CreditNoteBuilderPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/templates" element={<InvoiceTemplatePage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* Public portal */}
            <Route path="/portal/:token" element={<PortalPage />} />

            {/* Redirects */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
