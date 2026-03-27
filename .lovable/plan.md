
## Invoice Management App — Phase 1: Core MVP ✅

### Overview
Build a production-ready invoice management app (Zoho Invoice-style) with Supabase backend, starting with the core invoicing workflow: auth → org setup → clients → items → invoice builder → PDF preview → payments → dashboard.

### 1. Authentication & Organization Setup ✅
### 2. App Layout & Navigation ✅
### 3. Database Schema (Supabase) ✅
### 4. Client Management ✅
### 5. Items & Tax Rates ✅
### 6. Invoice Builder (Full-Featured) ✅
### 7. Invoice List & Detail ✅
### 8-12. Dashboard, Settings, Payments ✅

---

## Phase 2: Estimates & Reports ✅

### 1. Estimates with Convert to Invoice ✅
### 2. Reports Suite ✅

---

## Phase 3: Credit Notes, Templates & Client Portal ✅

### 1. Credit Notes ✅
- Credit notes table with status enum (draft/sent/void)
- Credit note builder (mirrors invoice builder)
- Credit note detail page with void and share link
- Link to specific invoice (optional)
- Sidebar navigation added

### 2. Invoice Template Gallery ✅
- 4 template styles: Classic, Modern, Minimal, Professional
- Visual preview cards with feature badges
- Template selection persisted to localStorage
- Templates page in sidebar

### 3. Client Portal ✅
- Portal tokens table with shareable links
- Public portal page (no auth required) at /portal/:token
- Supports invoices, estimates, and credit notes
- Auto-marks documents as "viewed" when opened
- Share link buttons on invoice and credit note detail pages
- Anon RLS policies for portal access

### Future Phases
- Recurring invoices
- Multi-currency with live exchange rates
- Payment gateway integration (Stripe)
- Audit logs
- Custom fields
- Advanced template customization (logo, colors)
