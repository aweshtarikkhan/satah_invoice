---
name: CRM & Sales Pipeline
description: Leads, opportunities, configurable pipeline stages with Kanban board, activity log linked to leads/opps/clients.
type: feature
---
- Tables: `pipeline_stages` (sort_order, win_probability, is_won/is_lost, color), `leads` (status enum + tags[] + converted_client_id), `opportunities` (stage_id, client_id, lead_id, amount, probability, expected_close_date), `activities` (activity_type enum: call/meeting/email/note/task/whatsapp, due_at, completed_at, lead_id/opportunity_id/client_id).
- RPC `seed_default_pipeline(org_id)` seeds 6 stages: Prospecting/Qualification/Proposal/Negotiation/Won/Lost. Called lazily from PipelinePage when no stages exist.
- Lead → Client conversion creates a `clients` row from company/name+contact, sets lead.status='converted' and lead.converted_client_id.
- Kanban uses HTML5 native drag-and-drop. Dropping moves stage_id AND sets probability to stage.win_probability. Optimistic UI update + DB write.
- Pipeline KPI cards: count, total pipeline value, weighted forecast (sum of amount * probability/100).
- Routes: /leads, /pipeline, /activities. Sidebar group: "CRM".
