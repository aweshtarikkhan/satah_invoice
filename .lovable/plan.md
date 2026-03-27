
## Invoice Management App — Phase 1: Core MVP

### Overview
Build a production-ready invoice management app (Zoho Invoice-style) with Supabase backend, starting with the core invoicing workflow: auth → org setup → clients → items → invoice builder → PDF preview → payments → dashboard.

### 1. Authentication & Organization Setup
- Email/password auth with Supabase Auth (login, signup, forgot/reset password)
- Organization profile creation on first login (name, logo, address, currency, tax info)
- Profiles table linked to auth.users, user_roles table for RBAC (Owner, Admin, Staff, Read-Only)

### 2. App Layout & Navigation
- Sidebar layout with collapsible navigation (shadcn Sidebar)
- Routes: Dashboard, Clients, Items, Invoices, Payments, Settings
- Top bar with global search (Ctrl+K command palette), user avatar/menu
- Status badges (Draft=gray, Sent=blue, Paid=green, Overdue=red with pulse, etc.)
- Responsive: sidebar collapses on tablet, hamburger on mobile

### 3. Database Schema (Supabase)
Tables with RLS policies:
- **organizations** — name, logo, address, currency, tax info, invoice prefix, payment terms
- **profiles** — linked to auth.users, org membership, role reference
- **user_roles** — role enum (owner/admin/staff/read_only)
- **clients** — display name, company, email, phone, billing/shipping address, status, payment terms
- **contacts** — multiple contacts per client
- **items** — name, description, SKU, type (product/service), unit price, unit, tax rate link
- **tax_rates** — name, rate percentage, type (simple/compound), is_default
- **invoices** — full invoice header (number, client, dates, status, currency, discount, totals, notes, terms)
- **invoice_lines** — line items with quantity, rate, discount, tax, sort order
- **payments** — payment records linked to invoices (amount, mode, reference, date)
- **credit_notes** + **credit_note_lines** + **credit_note_applications**

### 4. Client Management
- **List view**: Searchable/filterable table with Name, Company, Email, Outstanding balance, Status
- **Create/Edit**: Slide-over form with billing/shipping address, payment terms, currency
- **Detail page**: Tabs for overview, invoices, payments, and notes
- Bulk actions: delete, export CSV

### 5. Items & Tax Rates
- **Items catalog**: List with Name, SKU, Type, Rate, Tax; create/edit modal
- **Tax rates**: Configurable rates (simple + compound), set default

### 6. Invoice Builder (Full-Featured)
The core feature — a rich, interactive invoice editor:
- **Client selector** with autocomplete, auto-fills addresses
- **Line items table**: 
  - Item search/autocomplete from catalog, add new item inline
  - Drag-to-reorder with @dnd-kit
  - Per-line: quantity, rate, discount (% or fixed toggle), tax rate selector
  - Section headers to group line items
- **Totals panel**: Subtotal, invoice-level discount, tax breakdown, shipping charge, custom adjustment, total, amount paid, balance due — all auto-calculated
- **Payment terms dropdown** (Net 15/30/45/Custom) auto-updates due date
- **Notes & Terms**: Rich text areas
- **File attachments**: Drag & drop to Supabase Storage
- **Auto-save**: Draft saves every 60 seconds
- **Keyboard shortcuts**: Ctrl+S save, Ctrl+P preview
- **Auto-numbering**: Configurable prefix + sequence (e.g., INV-2024-0001)

### 7. Invoice List & Detail
- **List**: Tabs (All/Draft/Sent/Overdue/Paid), filterable table, bulk actions (send, download, void, delete)
- **Detail page**: 
  - Action bar: Edit, Send, Download PDF, Mark as Sent, Void, Duplicate
  - Status timeline (Created → Sent → Viewed → Paid)
  - Invoice preview (rendered as PDF would appear)
  - Payments section with "Record Payment" button
  - Activity log

### 8. Invoice PDF Preview
- Client-side PDF preview using @react-pdf/renderer
- Template: Organization logo, addresses, line items table, totals, notes/terms
- Watermarks: "DRAFT" for drafts, "VOID" for voided
- Download as PDF

### 9. Send Invoice (Email)
- Modal: To (pre-filled from client), CC, BCC, subject with template variables, HTML body preview
- Sends via Supabase Edge Function
- Logs to email history

### 10. Record Payment
- Modal: Date, amount (pre-filled with balance due), payment mode dropdown, reference number, notes
- Auto-updates invoice status (Partial → Paid)
- Payment receipt option

### 11. Dashboard
- Summary cards: Total Receivable, Overdue, Due Today, Due in 30 days
- Revenue bar chart (monthly, with period toggle)
- Invoice status doughnut chart
- Recent invoices table (last 10)
- Recent payments list
- Quick action buttons: + New Invoice, + New Client

### 12. Basic Settings
- **Organization profile**: Edit name, logo, address, tax info
- **Invoice settings**: Number prefix, default payment terms, default notes/terms
- **Users**: Invite users, assign roles

### Design System
- Primary: blue-700 (#0369a1), Success: green, Warning: amber, Danger: red
- Inter font, shadcn/ui components throughout
- Skeleton loaders, proper empty states with CTAs, toast notifications
- Light mode (dark mode deferred to later phase)

### Future Phases (not in this build)
- Estimates with convert-to-invoice
- Recurring invoices
- Credit notes
- Full reports suite
- Client portal
- Multi-currency with live exchange rates
- Payment gateway integration (Stripe)
- Audit logs
- Custom fields
- Invoice template gallery
