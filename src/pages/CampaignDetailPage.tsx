import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

export default function CampaignDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [recipients, setRecipients] = useState<any[]>([]);

  const load = async () => {
    const { data: c } = await supabase.from("campaigns").select("*, template:message_templates(*)").eq("id", id).single();
    const { data: r } = await supabase.from("campaign_recipients").select("*").eq("campaign_id", id).order("created_at");
    setCampaign(c); setRecipients(r || []);
  };
  useEffect(() => { load(); }, [id]);

  const sendNow = async () => {
    const t = toast.loading("Sending...");
    const { data, error } = await supabase.functions.invoke("send-campaign", { body: { campaign_id: id } });
    toast.dismiss(t);
    if (error) return toast.error(error.message);
    toast.success(`Sent: ${data?.sent}, Failed: ${data?.failed}`);
    load();
  };

  if (!campaign) return <div className="p-6">Loading...</div>;
  const pending = recipients.filter((r) => r.status === "pending").length;

  return (
    <div className="p-6 space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <p className="text-sm text-muted-foreground">{campaign.channel} • {campaign.template?.name}</p>
        </div>
        {pending > 0 && <Button onClick={sendNow}><Send className="h-4 w-4 mr-2" />Send {pending} Pending</Button>}
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{campaign.total_count}</div><div className="text-xs text-muted-foreground">Total</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-green-600">{campaign.sent_count}</div><div className="text-xs text-muted-foreground">Sent</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-red-600">{campaign.failed_count}</div><div className="text-xs text-muted-foreground">Failed</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold text-amber-600">{pending}</div><div className="text-xs text-muted-foreground">Pending</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Message Preview</CardTitle></CardHeader>
        <CardContent><pre className="text-sm whitespace-pre-wrap bg-muted p-3 rounded">{campaign.template?.body}</pre></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recipients</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>To</TableHead><TableHead>Status</TableHead><TableHead>Error</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {recipients.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-xs">{r.to_address}</TableCell>
                  <TableCell><Badge variant={r.status === "sent" ? "default" : r.status === "failed" ? "destructive" : "outline"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-xs text-red-600">{r.error || ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
