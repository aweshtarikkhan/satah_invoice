import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/EmptyState";
import { ScrollText } from "lucide-react";
import { format } from "date-fns";

const actionColors: Record<string, string> = {
  create: "bg-success/15 text-success",
  update: "bg-primary/15 text-primary",
  delete: "bg-destructive/15 text-destructive",
  void: "bg-muted text-muted-foreground",
  send: "bg-purple-100 text-purple-700",
  payment_recorded: "bg-success/15 text-success",
  status_change: "bg-warning/15 text-warning",
};

export default function AuditLogsPage() {
  const org = useAppStore((s) => s.organization);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!org?.id) return;
    const fetch = async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }

      const { data } = await query;
      setLogs(data || []);
      setLoading(false);
    };
    fetch();
  }, [org?.id, entityFilter]);

  const filtered = search
    ? logs.filter((l) => l.description.toLowerCase().includes(search.toLowerCase()))
    : logs;

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="Audit Logs" description="Track all changes across your organization" />

      <div className="flex gap-3">
        <Input
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="invoice">Invoices</SelectItem>
            <SelectItem value="estimate">Estimates</SelectItem>
            <SelectItem value="credit_note">Credit Notes</SelectItem>
            <SelectItem value="client">Clients</SelectItem>
            <SelectItem value="item">Items</SelectItem>
            <SelectItem value="payment">Payments</SelectItem>
            <SelectItem value="settings">Settings</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No audit logs yet"
          description="Actions will be logged as you use the app"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{log.entity_type.replace("_", " ")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${actionColors[log.action] || ""}`}>
                        {log.action.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{log.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
