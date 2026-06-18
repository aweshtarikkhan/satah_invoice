---
name: HRM Module
description: Employees, leaves, shifts, employee documents, monthly payroll runs with PF/ESIC/TDS and payslip PDFs.
type: feature
---
- Tables: `leaves`, `shifts`, `employee_documents`, `payroll_runs`, `payslips`. Employees extended with pan/bank_account/bank_ifsc/address/basic_percent/hra_percent/pf_applicable/esic_applicable/shift_id.
- Storage bucket `employee-documents` (private). Files keyed as `{org_id}/{employee_id}/{ts}_{file}`. RLS via storage.foldername()[1] = get_user_org_id().
- Payroll generation: working_days = days_in_month - holidays; presentEq = present + 0.5*half + min(paid_leave, allowance); gross = (monthly_salary / workingDays) * presentEq. Basic = gross*basic%, HRA = gross*hra%, allowances = remainder. PF = min(basic,15000)*12% if pf_applicable. ESIC = gross*0.75% if applicable and gross ≤ 21000. Net = gross - PF - ESIC - TDS - other. Re-generate wipes existing slips for the run.
- Approve & Post → inserts a `business_expenses` row category="Salary" for total net; status → approved. Mark All Paid → updates payment_status on every payslip, run.status → paid.
- Payslip PDF via jsPDF; client-side only.
- Routes: /shifts, /leaves, /employee-documents, /employees/:id/documents, /payroll, /payroll/:id.
