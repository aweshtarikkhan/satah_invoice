---
name: Communication & Automation
description: Bulk WhatsApp payment reminders, reminder tracking (last_reminder_at/reminder_count), and manual "Generate Now" on recurring schedules.
type: feature
---
Invoices table has `last_reminder_at` and `reminder_count`. WhatsApp button on InvoiceDetailPage and BulkReminderDialog on InvoicesPage both increment these on send. The bulk reminder dialog excludes paid/void, shows overdue days badge, requires client.phone, and opens wa.me with a friendly reminder prefix plus the standard invoice message and portal link.

RecurringInvoicesPage has a Zap (⚡) "Generate Now" button per row that calls `generateRecurringInvoice(scheduleId)` from `src/lib/recurring.ts`. It clones the template invoice's lines, allocates the next invoice number, sets due_date based on the template's payment-term span, advances `next_run_date` by the schedule frequency, stamps `last_generated_at`, and navigates to the new draft invoice.
