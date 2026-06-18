---
name: Inventory Depth (Phase 7)
description: Batch/serial tracking, PO→GRN workflow, delivery challans, FIFO and weighted-avg valuation.
type: feature
---
- `purchase_orders` + `purchase_order_lines`: status flow draft→sent→partial→received→closed/cancelled. PO line tracks `received_quantity`.
- `grns` + `grn_lines`: optional PO link; captures `batch_no`, `serial_no`, `expiry_date`, `unit_cost`, `warehouse_id`. On create: items.stock_quantity += qty, stock_movements logged with cost/batch/serial/warehouse, PO line received_quantity bumped, PO status recomputed.
- `bills.po_id` + `bills.grn_id` enable 3-way match (UI hint: create bill from GRN via `/bills/new?grn=…`).
- `delivery_challans` + `delivery_challan_lines`: vehicle, transporter, driver, eway-bill, destination, batch/serial per line.
- `items` adds `track_batches`, `track_serials`, `valuation_method` (default weighted_avg). Batch/serial inputs in GRN/DC are disabled unless item flag enabled.
- `stock_movements` extended with `batch_no`, `serial_no`, `expiry_date`, `unit_cost`, `warehouse_id`. InventoryValuationPage computes Weighted Avg + FIFO purely from movement history.
- Numbering: `organizations.{po,grn,dc}_prefix` + `{po,grn,dc}_next_number`, atomic increment after insert.
