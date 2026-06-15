---
name: Opt-in Compliance & PWA
description: Phase 5 — manual IRN/E-way bill fields on invoice, multi-warehouse toggle, PWA install support.
type: feature
---
- Invoice builder shows two opt-in checkboxes: "E-invoice (IRN) details" (IRN, ack no, ack date) and "E-way bill details" (EWB no, validity, vehicle no, transport mode, distance km). Nothing auto-generated — user pastes values from NIC / GST portal. Fields persisted on `invoices` table.
- Invoice detail page renders IRN + E-way badges when present.
- Settings → Inventory has `multi_warehouse_enabled` Switch (org-level, default OFF). `warehouses` table exists for future per-line warehouse selector; current build keeps single-stock behavior.
- PWA: `public/manifest.webmanifest` + `public/sw.js` (network-first navigation, cache-first static assets, skips cross-origin/Supabase). Registered from `index.html`. Theme color matches primary blue.
