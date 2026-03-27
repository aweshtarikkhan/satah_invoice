
## Invoice Management App

### Phase 1: Core MVP ✅
Auth, Layout, Clients, Items, Invoice Builder, Payments, Dashboard, Settings

### Phase 2: Estimates & Reports ✅
Estimates (convert to invoice), Reports Suite (charts, CSV export)

### Phase 3: Credit Notes, Templates & Client Portal ✅
Credit Notes, Invoice Template Gallery, Client Portal (token-based sharing)

### Phase 4: Audit Logs & Custom Fields ✅
Audit logging, Custom field definitions & values per entity type

### Phase 5: Multi-Currency & Template Customization ✅
- 20 currencies supported with symbols and formatting
- Currency utility library (lib/currency.ts) with live exchange rate fetching
- Exchange rates cache table
- Settings page updated with full currency list
- Invoice builder shows selected currency
- Template Customization page:
  - Logo upload to cloud storage
  - 4 template styles (classic, modern, minimal, professional)
  - 10 accent colors + custom color picker
  - 9 font options
  - Show/hide logo toggle
  - Live preview of template with current settings
- Template settings stored on organizations table

### Future Phases
- Recurring invoices
- Stripe payment gateway integration
