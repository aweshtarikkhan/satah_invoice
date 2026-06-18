import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Download, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";

const DOC_TYPES = ["Aadhaar", "PAN", "Offer Letter", "Appointment Letter", "Salary Slip", "Bank Proof", "Resume", "Other"];

export default function EmployeeDocumentsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const org = useAppStore((s) => s.organization);
  const { toast } = useToast();
  const [employees, setEmployees] = useState<any[]>([]);
  const [employeeId, setEmployeeId] = useState<string>(id || "");
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [docType, setDocType] = useState("Other");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!org?.id) return;
    (supabase as any).from("employees").select("id,name").eq("org_id", org.id).order("name").then(({ data }: any) => {
      setEmployees(data || []);
      if (!employeeId && data?.[0]?.id) setEmployeeId(data[0].id);
    });
  }, [org?.id]);

  const load = async () => {
    if (!employeeId) { setDocs([]); return; }
    const { data, error } = await (supabase as any).from("employee_documents").select("*").eq("employee_id", employeeId).order("uploaded_at", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setDocs(data || []);
  };
  useEffect(() => { load(); }, [employeeId]);

  const upload = async () => {
    if (!org?.id || !employeeId || !file) return;
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${org.id}/${employeeId}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from("employee-documents").upload(path, file);
    if (upErr) { setUploading(false); toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); return; }
    const { error } = await (supabase as any).from("employee_documents").insert({
      org_id: org.id, employee_id: employeeId, doc_type: docType, file_path: path, file_name: file.name,
    });
    setUploading(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { setOpen(false); setFile(null); setDocType("Other"); load(); toast({ title: "Uploaded" }); }
  };

  const download = async (d: any) => {
    const { data, error } = await supabase.storage.from("employee-documents").createSignedUrl(d.file_path, 60);
    if (error || !data) { toast({ title: "Download failed", variant: "destructive" }); return; }
    window.open(data.signedUrl, "_blank");
  };

  const remove = async (d: any) => {
    if (!confirm("Delete document?")) return;
    await supabase.storage.from("employee-documents").remove([d.file_path]);
    await (supabase as any).from("employee_documents").delete().eq("id", d.id);
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Employee Documents</h1>
          <p className="text-sm text-muted-foreground">Securely store ID proofs, offer letters and salary slips per employee.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select employee" /></SelectTrigger>
            <SelectContent>{employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => setOpen(true)} disabled={!employeeId}><Upload className="h-4 w-4 mr-2" />Upload</Button>
          <Button variant="outline" onClick={() => navigate("/employees")}>Back</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {docs.length === 0 ? <div className="p-8 text-center text-muted-foreground">No documents.</div>
          : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Type</TableHead><TableHead>File</TableHead><TableHead>Uploaded</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {docs.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell>{d.doc_type}</TableCell>
                    <TableCell className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{d.file_name}</TableCell>
                    <TableCell>{format(parseISO(d.uploaded_at), "dd MMM yyyy, HH:mm")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => download(d)}><Download className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>File</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={upload} disabled={uploading || !file}>{uploading ? "Uploading…" : "Upload"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
