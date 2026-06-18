---
name: Marketing Automation
description: Campaigns, message templates, automated journeys via WhatsApp Cloud API & SMS
type: feature
---
- **Tables**: `message_templates`, `campaigns`, `campaign_recipients`, `journeys`, `journey_steps`, `journey_enrollments`, `message_logs`. All org-scoped, RLS via `get_user_org_id()`.
- **Channels**: WhatsApp via Meta Cloud Graph API v20 (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`). SMS via generic HTTP gateway (`SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID`).
- **Edge function** `send-campaign`: iterates pending recipients, renders body with `{{name}}` / `{{1}}` / `{{2}}` placeholders, sends, logs to `message_logs`, updates campaign counts.
- **WhatsApp templates**: when `wa_template_name` is set, sends template message with body parameters; otherwise free-form text (24h window only).
- **Audience types**: `all` (every client with phone/email), `overdue` (clients with overdue invoices), `tag`, `manual`.
- **Journeys**: trigger types: invoice_sent, invoice_overdue, invoice_paid, estimate_sent, client_created, manual. Steps are ordered `send_message` / `wait` (hours). Enrollments track `next_run_at` for cron processing (cron processor not yet wired).
- **Pages**: `/campaigns`, `/campaigns/:id`, `/marketing/templates`, `/journeys`, `/message-logs`. Sidebar group: **Marketing**.
