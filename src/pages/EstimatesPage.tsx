import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreHorizontal, FileText, ArrowRightLeft, Trash2, Copy } from "lucide-react";
import { format } from "date-fns";

type EstimateStatus = "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired" | "converted";

const statusMap: Record<EstimateStatus, { label: string; variant: "default" | "info" | "success" | "warning" | "danger" | "muted" }> = {
  draft: { label: "Draft", variant: "muted" },
  sent: { label: "Sent", variant: "info" },
  viewed: { label: "Viewed", variant: "default" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "danger" },
  expired: { label: "Expired", variant: "warning" },
  converted: { label: "Converted", variant: "success" },
};

export default function EstimatesPage() {
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  const fetchEstimates = async () => {
    if (!org?.id) return;
    setLoading(true);
    let query = supabase
      .from("estimates")
      .select("*, clients(display_name)")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false });

    if (tab !== "all") query = query.eq("status", tab as any);
    if (search) query = query.or(`estimate_number.ilike.%${search}%`);

    const { data } = await query;
    setEstimates(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEstimates(); }, [org?.id, tab, search]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: org?.currency_code || "USD" }).format(n);

  const handleDelete = async (id: string) => {
    await supabase.from("estimates").delete().eq("id", id);
    toast({ title: "Estimate deleted" });
    fetchEstimates();
  };

  const handleConvert = (id: string) => {
    navigate(`/estimates/${id}/convert`);
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Estimates"
        description="Create and manage estimates for your clients"
      >
        <Button onClick={() => navigate("/estimates/new")}>
          <Plus className="mr-1 h-4 w-4" /> New Estimate
        </Button>
      </PageHeader>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="declined">Declined</TabsTrigger>
            <TabsTrigger value="converted">Converted</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search estimates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {!loading && estimates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No estimates yet"
          description="Create your first estimate to get started."
          actionLabel="New Estimate"
          onAction={() => navigate("/estimates/new")}
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Estimate #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estimates.map((est) => {
                const s = statusMap[est.status as EstimateStatus] || statusMap.draft;
                return (
                  <TableRow
                    key={est.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/estimates/${est.id}`)}
                  >
                    <TableCell className="text-sm">{format(new Date(est.issue_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{est.estimate_number}</TableCell>
                    <TableCell>{est.clients?.display_name}</TableCell>
                    <TableCell className="text-sm">{format(new Date(est.expiry_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{fmt(Number(est.total))}</TableCell>
                    <TableCell><StatusBadge variant={s.variant}>{s.label}</StatusBadge></TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => navigate(`/estimates/${est.id}/edit`)}>
                            <FileText className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          {(est.status === "accepted" || est.status === "sent" || est.status === "draft") && est.status !== "converted" && (
                            <DropdownMenuItem onClick={() => handleConvert(est.id)}>
                              <ArrowRightLeft className="mr-2 h-4 w-4" /> Convert to Invoice
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(est.id)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
