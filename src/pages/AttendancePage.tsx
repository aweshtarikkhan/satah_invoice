import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import { ChevronLeft, ChevronRight, Save, Send } from "lucide-react";
import { NavLink } from "@/components/NavLink";

type Status = "present" | "absent" | "half_day" | "paid_leave" | "holiday";

const STATUS_OPTIONS: { value: Status; label: string; short: string; cls: string }[] = [
  { value: "present", label: "Present", short: "P", cls: "bg-green-100 text-green-700 border-green-300" },
  { value: "absent", label: "Absent", short: "A", cls: "bg-red-100 text-red-700 border-red-300" },
  { value: "half_day", label: "Half-day", short: "H", cls: "bg-amber-100 text-amber-700 border-amber-300" },
  { value: "paid_leave", label: "Paid Leave", short: "PL", cls: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "holiday", label: "Holiday", short: "HO", cls: "bg-muted text-muted-foreground border-border" },
];

interface Employee {
  id: string; name: string; monthly_salary: number; paid_leaves_per_month: number; is_active: boolean;
}
interface AttRow { id?: string; employee_id: string; attendance_date: string; status: Status; }

export default function AttendancePage() {
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [att, setAtt] = useState<Record<string, Status>>({}); // key: empId|date
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  const monthStart = useMemo(() => startOfMonth(parseISO(month + "-01")), [month]);
  const monthEnd = useMemo(() => endOfMonth(monthStart), [monthStart]);
  const days = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

  const load = async () => {
    if (!org?.id) return;
    setLoading(true);
    const [emps, atts] = await Promise.all([
      (supabase as any).from("employees").select("*").eq("org_id", org.id).eq("is_active", true).order("name"),
      (supabase as any).from("attendance").select("*").eq("org_id", org.id)
        .gte("attendance_date", format(monthStart, "yyyy-MM-dd"))
        .lte("attendance_date", format(monthEnd, "yyyy-MM-dd")),
    ]);
    if (emps.error) toast({ title: "Failed to load employees", description: emps.error.message, variant: "destructive" });
    setEmployees(emps.data || []);
    const map: Record<string, Status> = {};
    (atts.data || []).forEach((r: any) => { map[`${r.employee_id}|${r.attendance_date}`] = r.status; });
    setAtt(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [org?.id, month]);

  const setCell = (empId: string, dateStr: string, status: Status) => {
    setAtt((prev) => ({ ...prev, [`${empId}|${dateStr}`]: status }));
  };

  const cycle = (empId: string, dateStr: string) => {
    const current = att[`${empId}|${dateStr}`] || "present";
    const idx = STATUS_OPTIONS.findIndex((s) => s.value === current);
    const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length].value;
    setCell(empId, dateStr, next);
  };

  const markRowAll = (empId: string, status: Status) => {
    setAtt((prev) => {
      const next = { ...prev };
      days.forEach((d) => { next[`${empId}|${format(d, "yyyy-MM-dd")}`] = status; });
      return next;
    });
  };

  const save = async () => {
    if (!org?.id) return;
    setSaving(true);
    const rows: any[] = [];
    Object.entries(att).forEach(([k, status]) => {
      const [employee_id, attendance_date] = k.split("|");
      if (employees.find((e) => e.id === employee_id)) {
        rows.push({ org_id: org.id, employee_id, attendance_date, status });
      }
    });
    if (rows.length === 0) { setSaving(false); toast({ title: "Nothing to save" }); return; }
    const { error } = await (supabase as any).from("attendance").upsert(rows, { onConflict: "employee_id,attendance_date" });
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Attendance saved", description: `${rows.length} record(s).` });
  };

  // Summaries
  const summaries = useMemo(() => {
    return employees.map((emp) => {
      let p = 0, a = 0, h = 0, pl = 0, ho = 0;
      days.forEach((d) => {
        const s = att[`${emp.id}|${format(d, "yyyy-MM-dd")}`];
        if (s === "present") p++;
        else if (s === "absent") a++;
        else if (s === "half_day") h++;
        else if (s === "paid_leave") pl++;
        else if (s === "holiday") ho++;
      });
      const workingDays = days.length - ho;
      // Payable units: present=1, half=0.5, paid_leave=1 (within allowance), extra paid_leave treated as absent
      const allowedPL = emp.paid_leaves_per_month;
      const paidPL = Math.min(pl, allowedPL);
      const unpaidPL = Math.max(0, pl - allowedPL);
      const payableDays = p + h * 0.5 + paidPL; // unpaid_pl deducted (treated as absent)
      const perDay = workingDays > 0 ? emp.monthly_salary / workingDays : 0;
      const payable = perDay * payableDays;
      return { emp, p, a: a + unpaidPL, h, pl: paidPL, ho, workingDays, payableDays, payable };
    });
  }, [employees, days, att]);

  const totalPayable = summaries.reduce((s, r) => s + r.payable, 0);

  const postToExpenses = async () => {
    if (!org?.id) return;
    if (summaries.length === 0) return;
    if (!confirm(`Post ${formatCurrency(totalPayable)} as salary expense for ${format(monthStart, "MMM yyyy")}?`)) return;
    setPosting(true);
    const rows = summaries
      .filter((s) => s.payable > 0)
      .map((s) => ({
        org_id: org.id,
        category: "Salary",
        description: `Salary — ${s.emp.name} (${format(monthStart, "MMM yyyy")})`,
        amount: Number(s.payable.toFixed(2)),
        expense_date: format(monthEnd, "yyyy-MM-dd"),
        is_recurring: false,
        recurring_frequency: null,
      }));
    if (rows.length === 0) { setPosting(false); return; }
    const { error } = await (supabase as any).from("business_expenses").insert(rows);
    setPosting(false);
    if (error) toast({ title: "Failed to post", description: error.message, variant: "destructive" });
    else toast({ title: "Salaries posted to Expenses", description: `${rows.length} entries added.` });
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(monthStart);
    d.setMonth(d.getMonth() + delta);
    setMonth(format(d, "yyyy-MM"));
  };

  const statusBadge = (s: Status | undefined) => {
    const opt = STATUS_OPTIONS.find((o) => o.value === s) || STATUS_OPTIONS[0];
    return <span className={`inline-flex items-center justify-center h-6 w-7 rounded border text-[10px] font-semibold ${opt.cls}`}>{opt.short}</span>;
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Attendance</h1>
          <p className="text-sm text-muted-foreground">Click a cell to cycle: Present → Absent → Half → Paid Leave → Holiday.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild><NavLink to="/employees">Employees</NavLink></Button>
          <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
          <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-2" />{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {STATUS_OPTIONS.map((o) => (
          <span key={o.value} className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${o.cls}`}>
            <span className="font-semibold">{o.short}</span>{o.label}
          </span>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No active employees. <NavLink to="/employees" className="text-primary underline">Add one</NavLink>.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[180px]">Employee</TableHead>
                  {days.map((d) => (
                    <TableHead key={d.toISOString()} className="text-center px-1">
                      <div className="text-[10px] text-muted-foreground">{format(d, "EEE")}</div>
                      <div className="text-xs font-medium">{format(d, "d")}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center">Bulk</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium">{emp.name}</TableCell>
                    {days.map((d) => {
                      const ds = format(d, "yyyy-MM-dd");
                      const s = att[`${emp.id}|${ds}`];
                      return (
                        <TableCell key={ds} className="text-center p-1">
                          <button onClick={() => cycle(emp.id, ds)} title={ds}>
                            {statusBadge(s)}
                          </button>
                        </TableCell>
                      );
                    })}
                    <TableCell>
                      <Select onValueChange={(v) => markRowAll(emp.id, v as Status)}>
                        <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="Mark all" /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>All {o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {employees.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Monthly Summary — {format(monthStart, "MMMM yyyy")}</CardTitle>
            <Button onClick={postToExpenses} disabled={posting} variant="default">
              <Send className="h-4 w-4 mr-2" />{posting ? "Posting…" : "Post Salaries to Expenses"}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-center">Present</TableHead>
                  <TableHead className="text-center">Half</TableHead>
                  <TableHead className="text-center">Paid Leave</TableHead>
                  <TableHead className="text-center">Absent</TableHead>
                  <TableHead className="text-center">Holiday</TableHead>
                  <TableHead className="text-right">Payable Days</TableHead>
                  <TableHead className="text-right">Monthly Salary</TableHead>
                  <TableHead className="text-right">Payable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((r) => (
                  <TableRow key={r.emp.id}>
                    <TableCell className="font-medium">{r.emp.name}</TableCell>
                    <TableCell className="text-center">{r.p}</TableCell>
                    <TableCell className="text-center">{r.h}</TableCell>
                    <TableCell className="text-center">{r.pl}</TableCell>
                    <TableCell className="text-center">{r.a}</TableCell>
                    <TableCell className="text-center">{r.ho}</TableCell>
                    <TableCell className="text-right">{r.payableDays.toFixed(1)} / {r.workingDays}</TableCell>
                    <TableCell className="text-right">{formatCurrency(r.emp.monthly_salary)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(r.payable)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={8} className="text-right font-semibold">Total Payable</TableCell>
                  <TableCell className="text-right font-bold text-primary">{formatCurrency(totalPayable)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
