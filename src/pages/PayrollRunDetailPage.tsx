import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { ArrowLeft, Calculator, CheckCircle, FileText } from "lucide-react";
import jsPDF from "jspdf";

export default function PayrollRunDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const currency = (org as any)?.currency || "INR";
  const [run, setRun] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [slips, setSlips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id || !org?.id) return;
    setLoading(true);
    const [{ data: r }, { data: emps }, { data: ps }] = await Promise.all([
      (supabase as any).from("payroll_runs").select("*").eq("id", id).maybeSingle(),
      (supabase as any).from("employees").select("*").eq("org_id", org.id).eq("is_active", true).order("name"),
      (supabase as any).from("payslips").select("*").eq("run_id", id),
    ]);
    setRun(r); setEmployees(emps || []); setSlips(ps || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [id, org?.id]);

  const period = run ? parseISO(run.period_month) : null;
  const monthLabel = period ? format(period, "MMMM yyyy") : "";

  const generate = async () => {
    if (!run || !org?.id || !period) return;
    setBusy(true);
    const ms = startOfMonth(period), me = endOfMonth(period);
    const { data: att } = await (supabase as any).from("attendance").select("*").eq("org_id", org.id)
      .gte("attendance_date", format(ms, "yyyy-MM-dd")).lte("attendance_date", format(me, "yyyy-MM-dd"));
    const attMap: Record<string, string> = {};
    (att || []).forEach((a: any) => { attMap[`${a.employee_id}|${a.attendance_date}`] = a.status; });
    const days = eachDayOfInterval({ start: ms, end: me });

    const rows = employees.map((emp) => {
      let p = 0, h = 0, pl = 0, ho = 0;
      days.forEach((d) => {
        const s = attMap[`${emp.id}|${format(d, "yyyy-MM-dd")}`];
        if (s === "present") p++;
        else if (s === "half_day") h++;
        else if (s === "paid_leave") pl++;
        else if (s === "holiday") ho++;
      });
      const workingDays = days.length - ho;
      const allowedPL = Number(emp.paid_leaves_per_month || 0);
      const paidPL = Math.min(pl, allowedPL);
      const presentEq = p + h * 0.5 + paidPL;
      const lop = Math.max(0, workingDays - presentEq);
      const perDay = workingDays > 0 ? Number(emp.monthly_salary) / workingDays : 0;
      const gross = +(perDay * presentEq).toFixed(2);
      const basic = +(gross * (Number(emp.basic_percent || 50) / 100)).toFixed(2);
      const hra = +(gross * (Number(emp.hra_percent || 0) / 100)).toFixed(2);
      const allowances = +(gross - basic - hra).toFixed(2);
      const pf_employee = emp.pf_applicable ? +(Math.min(basic, 15000) * 0.12).toFixed(2) : 0;
      const esic_employee = emp.esic_applicable && gross <= 21000 ? +(gross * 0.0075).toFixed(2) : 0;
      const net_pay = +(gross - pf_employee - esic_employee).toFixed(2);
      return {
        run_id: run.id, org_id: org.id, employee_id: emp.id,
        working_days: workingDays, present_days: p, paid_leave_days: paidPL, lop_days: +lop.toFixed(2),
        gross_salary: gross, basic, hra, allowances,
        pf_employee, esic_employee, tds: 0, other_deductions: 0,
        net_pay, payment_status: "unpaid",
      };
    });

    await (supabase as any).from("payslips").delete().eq("run_id", run.id);
    if (rows.length) {
      const { error } = await (supabase as any).from("payslips").insert(rows);
      if (error) { setBusy(false); toast({ title: "Generate failed", description: error.message, variant: "destructive" }); return; }
    }
    const totals = rows.reduce((acc, r) => {
      acc.gross += r.gross_salary; acc.ded += r.pf_employee + r.esic_employee; acc.net += r.net_pay; return acc;
    }, { gross: 0, ded: 0, net: 0 });
    await (supabase as any).from("payroll_runs").update({
      total_gross: +totals.gross.toFixed(2),
      total_deductions: +totals.ded.toFixed(2),
      total_net: +totals.net.toFixed(2),
    }).eq("id", run.id);
    setBusy(false);
    toast({ title: "Payslips generated", description: `${rows.length} employees` });
    load();
  };

  const approveAndPost = async () => {
    if (!run || !org?.id || !period) return;
    if (!confirm(`Approve payroll for ${monthLabel} and post total net pay as a Salary expense?`)) return;
    setBusy(true);
    const total = slips.reduce((s, p) => s + Number(p.net_pay || 0), 0);
    if (total > 0) {
      await (supabase as any).from("business_expenses").insert({
        org_id: org.id,
        category: "Salary",
        description: `Payroll — ${monthLabel}`,
        amount: +total.toFixed(2),
        expense_date: format(endOfMonth(period), "yyyy-MM-dd"),
        is_recurring: false,
      });
    }
    await (supabase as any).from("payroll_runs").update({ status: "approved" }).eq("id", run.id);
    setBusy(false);
    toast({ title: "Approved & posted to Expenses" });
    load();
  };

  const markAllPaid = async () => {
    if (!run) return;
    setBusy(true);
    await (supabase as any).from("payslips").update({ payment_status: "paid", payment_date: format(new Date(), "yyyy-MM-dd") }).eq("run_id", run.id);
    await (supabase as any).from("payroll_runs").update({ status: "paid" }).eq("id", run.id);
    setBusy(false);
    toast({ title: "Marked as paid" });
    load();
  };

  const updateSlip = async (id: string, field: string, value: number) => {
    const slip = slips.find((s) => s.id === id);
    if (!slip) return;
    const patch: any = { [field]: value };
    if (["pf_employee","esic_employee","tds","other_deductions","gross_salary"].includes(field)) {
      const next = { ...slip, ...patch };
      patch.net_pay = +(Number(next.gross_salary) - Number(next.pf_employee) - Number(next.esic_employee) - Number(next.tds) - Number(next.other_deductions)).toFixed(2);
    }
    await (supabase as any).from("payslips").update(patch).eq("id", id);
    load();
  };

  const downloadSlip = (slip: any) => {
    const emp = employees.find((e) => e.id === slip.employee_id);
    if (!emp || !period) return;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text((org as any)?.name || "Payslip", 14, 18);
    doc.setFontSize(11); doc.text(`Payslip — ${monthLabel}`, 14, 26);
    doc.text(`Employee: ${emp.name}${emp.employee_code ? " ("+emp.employee_code+")" : ""}`, 14, 34);
    doc.text(`Designation: ${emp.designation || "-"}`, 14, 40);
    doc.text(`PAN: ${emp.pan || "-"}    Bank: ${emp.bank_account || "-"}  IFSC: ${emp.bank_ifsc || "-"}`, 14, 46);
    let y = 58;
    const line = (k: string, v: string, bold = false) => { if (bold) doc.setFont("helvetica", "bold"); else doc.setFont("helvetica", "normal"); doc.text(k, 14, y); doc.text(v, 180, y, { align: "right" }); y += 7; };
    doc.setFont("helvetica","bold"); doc.text("Earnings", 14, y); y += 6; doc.setFont("helvetica","normal");
    line("Basic", formatCurrency(Number(slip.basic), currency));
    line("HRA", formatCurrency(Number(slip.hra), currency));
    line("Allowances", formatCurrency(Number(slip.allowances), currency));
    line("Gross", formatCurrency(Number(slip.gross_salary), currency), true);
    y += 4;
    doc.setFont("helvetica","bold"); doc.text("Deductions", 14, y); y += 6; doc.setFont("helvetica","normal");
    line("PF (Employee)", formatCurrency(Number(slip.pf_employee), currency));
    line("ESIC (Employee)", formatCurrency(Number(slip.esic_employee), currency));
    line("TDS", formatCurrency(Number(slip.tds), currency));
    line("Other", formatCurrency(Number(slip.other_deductions), currency));
    y += 4;
    line("Net Pay", formatCurrency(Number(slip.net_pay), currency), true);
    y += 6;
    doc.setFontSize(9); doc.text(`Days — Working: ${slip.working_days} | Present: ${slip.present_days} | Paid Leave: ${slip.paid_leave_days} | LOP: ${slip.lop_days}`, 14, y);
    doc.save(`payslip_${emp.name.replace(/\s+/g,"_")}_${format(period,"yyyy-MM")}.pdf`);
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (!run) return <div className="p-6">Payroll run not found.</div>;

  const slipByEmp = useMemo(() => Object.fromEntries(slips.map((s) => [s.employee_id, s])), [slips]);
  const totals = slips.reduce((a, s) => ({ gross: a.gross + Number(s.gross_salary), ded: a.ded + Number(s.pf_employee) + Number(s.esic_employee) + Number(s.tds) + Number(s.other_deductions), net: a.net + Number(s.net_pay) }), { gross: 0, ded: 0, net: 0 });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("/payroll")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-2xl font-semibold">Payroll — {monthLabel}</h1>
            <div className="text-sm text-muted-foreground capitalize">Status: {run.status}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" onClick={generate} disabled={busy || run.status === "paid"}><Calculator className="h-4 w-4 mr-2" />{slips.length ? "Re-generate" : "Generate Payslips"}</Button>
          {slips.length > 0 && run.status === "draft" && <Button onClick={approveAndPost} disabled={busy}><CheckCircle className="h-4 w-4 mr-2" />Approve & Post Expense</Button>}
          {slips.length > 0 && run.status === "approved" && <Button onClick={markAllPaid} disabled={busy}><CheckCircle className="h-4 w-4 mr-2" />Mark All Paid</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Gross</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrency(totals.gross, currency)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Deductions</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatCurrency(totals.ded, currency)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Net Payable</CardTitle></CardHeader><CardContent className="text-2xl font-semibold text-primary">{formatCurrency(totals.net, currency)}</CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          {slips.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No payslips yet. Click "Generate Payslips" to compute from attendance.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">WD</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">PL</TableHead>
                <TableHead className="text-right">LOP</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">PF</TableHead>
                <TableHead className="text-right">ESIC</TableHead>
                <TableHead className="text-right">TDS</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Slip</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {employees.map((emp) => {
                  const s = slipByEmp[emp.id];
                  if (!s) return null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{emp.name}<div className="text-xs text-muted-foreground">{emp.employee_code || ""}</div></TableCell>
                      <TableCell className="text-right">{s.working_days}</TableCell>
                      <TableCell className="text-right">{s.present_days}</TableCell>
                      <TableCell className="text-right">{s.paid_leave_days}</TableCell>
                      <TableCell className="text-right">{s.lop_days}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(s.gross_salary), currency)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(s.pf_employee), currency)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(s.esic_employee), currency)}</TableCell>
                      <TableCell className="text-right w-24">
                        <Input type="number" className="h-7 text-right" defaultValue={s.tds} onBlur={(e) => updateSlip(s.id, "tds", Number(e.target.value || 0))} disabled={run.status === "paid"} />
                      </TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(Number(s.net_pay), currency)}</TableCell>
                      <TableCell><Badge variant="outline" className={s.payment_status === "paid" ? "bg-green-100 text-green-800 border-green-300" : ""}>{s.payment_status}</Badge></TableCell>
                      <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => downloadSlip(s)}><FileText className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
