import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function MessageLogsPage() {
  const org = useAppStore((s) => s.organization);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!org) return;
    supabase.from("message_logs").select("*").eq("org_id", org.id).order("sent_at", { ascending: false }).limit(200)
      .then(({ data }) => setLogs(data || []));
  }, [org?.id]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Message Logs</h1>
        <p className="text-sm text-muted-foreground">All outbound WhatsApp, SMS and Email messages.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Recent (last 200)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Time</TableHead><TableHead>Channel</TableHead><TableHead>To</TableHead>
              <TableHead>Status</TableHead><TableHead>Body / Error</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(l.sent_at), "dd MMM HH:mm")}</TableCell>
                  <TableCell><Badge variant="outline">{l.channel}</Badge></TableCell>
                  <TableCell className="text-xs">{l.to_address}</TableCell>
                  <TableCell><Badge variant={l.status === "sent" ? "default" : l.status === "failed" ? "destructive" : "secondary"}>{l.status}</Badge></TableCell>
                  <TableCell className="max-w-md truncate text-xs">{l.error ? <span className="text-red-600">{l.error}</span> : l.body}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No messages sent yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
