import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEMO_EMAIL = "demo@billflow.app";
const DEMO_PASSWORD = "demo123456";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    let demoUser = existingUsers?.users?.find((u: any) => u.email === DEMO_EMAIL);

    if (!demoUser) {
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: "Demo", last_name: "User" },
      });
      if (createErr) throw createErr;
      demoUser = newUser.user;
    }

    let { data: profile } = await admin.from("profiles").select("org_id").eq("user_id", demoUser!.id).single();
    let orgId = profile?.org_id as string | undefined;

    if (!orgId) {
      const { data: org, error: orgErr } = await admin.from("organizations").insert({
        name: "Demo Business Pvt. Ltd.",
        currency_code: "INR",
        invoice_prefix: "INV", estimate_prefix: "EST", payment_prefix: "PAY",
        credit_note_prefix: "CN",
        payment_terms: 30,
        gst_enabled: true, gst_number: "27AADCB2230M1ZT",
        qr_code_enabled: true, upi_id: "demo@upi",
        template_style: "compact",
        email: "billing@demobusiness.com", phone: "+91 9876543210",
        address: { line1: "123 Business Park", city: "Mumbai", state: "Maharashtra", zip: "400001", country: "India" },
        default_notes: "Thank you for your business!",
        default_terms: "Payment due within 30 days.",
        inventory_enabled: true,
      }).select().single();
      if (orgErr) throw orgErr;
      orgId = org.id;
      await admin.from("profiles").update({ org_id: orgId, first_name: "Demo", last_name: "User" }).eq("user_id", demoUser!.id);
      await admin.from("user_roles").upsert({ user_id: demoUser!.id, role: "owner" }, { onConflict: "user_id,role" });
    } else {
      // Wipe existing demo data so we can reseed with fresh 3-month-relative dates
      const { data: invs } = await admin.from("invoices").select("id").eq("org_id", orgId);
      const invIds = (invs || []).map((i: any) => i.id);
      if (invIds.length) await admin.from("invoice_lines").delete().in("invoice_id", invIds);
      const { data: cns } = await admin.from("credit_notes").select("id").eq("org_id", orgId);
      const cnIds = (cns || []).map((i: any) => i.id);
      if (cnIds.length) await admin.from("credit_note_lines").delete().in("credit_note_id", cnIds);
      const { data: ests } = await admin.from("estimates").select("id").eq("org_id", orgId);
      const estIds = (ests || []).map((i: any) => i.id);
      if (estIds.length) await admin.from("estimate_lines").delete().in("estimate_id", estIds);
      await admin.from("payments").delete().eq("org_id", orgId);
      await admin.from("credit_notes").delete().eq("org_id", orgId);
      await admin.from("estimates").delete().eq("org_id", orgId);
      await admin.from("invoices").delete().eq("org_id", orgId);
      await admin.from("business_expenses").delete().eq("org_id", orgId);
      await admin.from("items").delete().eq("org_id", orgId);
      await admin.from("clients").delete().eq("org_id", orgId);
      await admin.from("tax_rates").delete().eq("org_id", orgId);
    }

    // Helpers — all dates relative to today, spread over the last 90 days
    const today = new Date();
    const d = (days: number) => new Date(today.getTime() - days * 86400000).toISOString().split("T")[0];
    const fd = (days: number) => new Date(today.getTime() + days * 86400000).toISOString().split("T")[0];

    // Tax rates
    const { data: taxes } = await admin.from("tax_rates").insert([
      { org_id: orgId, name: "GST 18%", rate: 18, type: "simple", is_default: true },
      { org_id: orgId, name: "GST 12%", rate: 12, type: "simple" },
      { org_id: orgId, name: "GST 5%", rate: 5, type: "simple" },
    ]).select();
    const tax18 = taxes?.[0]?.id;
    const tax12 = taxes?.[1]?.id;
    const tax5 = taxes?.[2]?.id;

    // Items
    const { data: items } = await admin.from("items").insert([
      { org_id: orgId, name: "Web Development", description: "Custom web development services", unit_price: 25000, type: "service", unit: "hrs", tax_id: tax18 },
      { org_id: orgId, name: "Logo Design", description: "Professional logo design", unit_price: 8000, type: "service", unit: "nos", tax_id: tax18 },
      { org_id: orgId, name: "SEO Package", description: "Monthly SEO optimization", unit_price: 15000, type: "service", unit: "month", tax_id: tax18 },
      { org_id: orgId, name: "Business Cards", description: "500 premium business cards", unit_price: 2500, type: "product", unit: "box", tax_id: tax12, stock_quantity: 45 },
      { org_id: orgId, name: "Hosting (Annual)", description: "Cloud hosting for 1 year", unit_price: 12000, type: "service", unit: "year", tax_id: tax18 },
      { org_id: orgId, name: "Mobile App Development", description: "React Native mobile app", unit_price: 75000, type: "service", unit: "project", tax_id: tax18 },
      { org_id: orgId, name: "Steel Rods 12mm", description: "TMT steel rods", unit_price: 75, type: "product", unit: "kg", tax_id: tax18, stock_quantity: 850 },
      { org_id: orgId, name: "Cement Bag (50kg)", description: "OPC 53 grade cement", unit_price: 420, type: "product", unit: "bag", tax_id: tax12, stock_quantity: 120 },
      { org_id: orgId, name: "Paint - White", description: "Premium emulsion paint", unit_price: 380, type: "product", unit: "ltr", tax_id: tax18, stock_quantity: 8 },
      { org_id: orgId, name: "Wire Roll 1.5mm", description: "Copper electrical wire", unit_price: 2200, type: "product", unit: "roll", tax_id: tax18, stock_quantity: 3 },
      { org_id: orgId, name: "PVC Pipe 4-inch", description: "Drainage pipe 6 ft", unit_price: 280, type: "product", unit: "pcs", tax_id: tax12, stock_quantity: 0 },
      { org_id: orgId, name: "Sand (River)", description: "Construction grade sand", unit_price: 45, type: "product", unit: "kg", tax_id: tax5, stock_quantity: 2400 },
    ]).select();

    // Clients
    const { data: clients } = await admin.from("clients").insert([
      { org_id: orgId, display_name: "Rajesh Sharma", company_name: "Sharma Enterprises", email: "rajesh@sharma.co", phone: "+91 9812345678", opening_balance: 0 },
      { org_id: orgId, display_name: "Priya Patel", company_name: "Patel Solutions", email: "priya@patelsol.in", phone: "+91 9823456789", opening_balance: 0 },
      { org_id: orgId, display_name: "Amit Verma", company_name: "Verma Industries", email: "amit@verma.co.in", phone: "+91 9834567890", opening_balance: 0 },
      { org_id: orgId, display_name: "Sunita Gupta", company_name: "Gupta Traders", email: "sunita@guptatraders.com", phone: "+91 9845678901", opening_balance: 0 },
      { org_id: orgId, display_name: "Vikram Singh", company_name: "Singh Tech Pvt Ltd", email: "vikram@singhtech.in", phone: "+91 9856789012", opening_balance: 0 },
    ]).select();

    if (clients && items) {
      // Invoices spread across last ~90 days
      const invoiceRows = [
        { org_id: orgId, client_id: clients[0].id, invoice_number: "INV-001", issue_date: d(85), due_date: d(55), total: 29500, subtotal: 25000, total_tax: 4500, balance_due: 0, amount_paid: 29500, status: "paid" as const, paid_at: d(80) },
        { org_id: orgId, client_id: clients[1].id, invoice_number: "INV-002", issue_date: d(78), due_date: d(48), total: 17700, subtotal: 15000, total_tax: 2700, balance_due: 0, amount_paid: 17700, status: "paid" as const, paid_at: d(70) },
        { org_id: orgId, client_id: clients[2].id, invoice_number: "INV-003", issue_date: d(70), due_date: d(40), total: 9440, subtotal: 8000, total_tax: 1440, balance_due: 0, amount_paid: 9440, status: "paid" as const, paid_at: d(65) },
        { org_id: orgId, client_id: clients[3].id, invoice_number: "INV-004", issue_date: d(60), due_date: d(30), total: 88500, subtotal: 75000, total_tax: 13500, balance_due: 0, amount_paid: 88500, status: "paid" as const, paid_at: d(50) },
        { org_id: orgId, client_id: clients[4].id, invoice_number: "INV-005", issue_date: d(55), due_date: d(25), total: 14160, subtotal: 12000, total_tax: 2160, balance_due: 0, amount_paid: 14160, status: "paid" as const, paid_at: d(45) },
        { org_id: orgId, client_id: clients[0].id, invoice_number: "INV-006", issue_date: d(45), due_date: d(15), total: 2950, subtotal: 2500, total_tax: 450, balance_due: 0, amount_paid: 2950, status: "paid" as const, paid_at: d(40) },
        { org_id: orgId, client_id: clients[1].id, invoice_number: "INV-007", issue_date: d(40), due_date: d(10), total: 17700, subtotal: 15000, total_tax: 2700, balance_due: 17700, amount_paid: 0, status: "overdue" as const },
        { org_id: orgId, client_id: clients[2].id, invoice_number: "INV-008", issue_date: d(30), due_date: d(0), total: 9440, subtotal: 8000, total_tax: 1440, balance_due: 4440, amount_paid: 5000, status: "partial" as const },
        { org_id: orgId, client_id: clients[3].id, invoice_number: "INV-009", issue_date: d(20), due_date: fd(10), total: 88500, subtotal: 75000, total_tax: 13500, balance_due: 88500, amount_paid: 0, status: "sent" as const, sent_at: d(19) },
        { org_id: orgId, client_id: clients[4].id, invoice_number: "INV-010", issue_date: d(10), due_date: fd(20), total: 14160, subtotal: 12000, total_tax: 2160, balance_due: 14160, amount_paid: 0, status: "sent" as const, sent_at: d(9) },
        { org_id: orgId, client_id: clients[0].id, invoice_number: "INV-011", issue_date: d(5), due_date: fd(25), total: 45000, subtotal: 38135, total_tax: 6865, balance_due: 45000, amount_paid: 0, status: "sent" as const, sent_at: d(4) },
        { org_id: orgId, client_id: clients[1].id, invoice_number: "INV-012", issue_date: d(2), due_date: fd(28), total: 25000, subtotal: 21186, total_tax: 3814, balance_due: 25000, amount_paid: 0, status: "draft" as const },
      ];
      const { data: invoicesData } = await admin.from("invoices").insert(invoiceRows).select();

      if (invoicesData) {
        const lines = invoicesData.map((inv: any, i: number) => ({
          invoice_id: inv.id,
          name: items[i % items.length].name,
          quantity: 1,
          rate: Number(inv.subtotal),
          amount: Number(inv.subtotal),
          tax_id: tax18,
          tax_amount: Number(inv.total_tax),
          unit: items[i % items.length].unit,
          sort_order: 0,
        }));
        await admin.from("invoice_lines").insert(lines);

        // Payments aligned with paid/partial invoices
        const payRows: any[] = [];
        let pn = 1;
        for (const inv of invoicesData) {
          if (Number(inv.amount_paid) > 0) {
            payRows.push({
              org_id: orgId, client_id: inv.client_id, invoice_id: inv.id,
              payment_number: `PAY-${String(pn++).padStart(3, "0")}`,
              amount: Number(inv.amount_paid),
              payment_date: inv.paid_at ? inv.paid_at.split("T")[0] : d(5),
              payment_mode: ["bank_transfer", "upi", "cash"][pn % 3],
            });
          }
        }
        if (payRows.length) await admin.from("payments").insert(payRows);

        // Credit notes
        await admin.from("credit_notes").insert([
          { org_id: orgId, client_id: clients[0].id, invoice_id: invoicesData[0].id, credit_note_number: "CN-001", issue_date: d(50), total: 2950, subtotal: 2500, total_tax: 450, status: "open" as const },
          { org_id: orgId, client_id: clients[2].id, invoice_id: invoicesData[2].id, credit_note_number: "CN-002", issue_date: d(25), total: 1180, subtotal: 1000, total_tax: 180, status: "open" as const },
        ]);

        // Update client balances
        for (const c of clients) {
          const { data: cInvs } = await admin.from("invoices").select("balance_due").eq("client_id", c.id);
          const totalDue = (cInvs || []).reduce((s: number, i: any) => s + Number(i.balance_due), 0);
          await admin.from("clients").update({ opening_balance: totalDue }).eq("id", c.id);
        }
      }

      // Estimates spread over 3 months
      await admin.from("estimates").insert([
        { org_id: orgId, client_id: clients[0].id, estimate_number: "EST-001", issue_date: d(75), expiry_date: d(45), total: 50000, subtotal: 42373, total_tax: 7627, status: "accepted" as const },
        { org_id: orgId, client_id: clients[3].id, estimate_number: "EST-002", issue_date: d(50), expiry_date: d(20), total: 35000, subtotal: 29661, total_tax: 5339, status: "declined" as const },
        { org_id: orgId, client_id: clients[2].id, estimate_number: "EST-003", issue_date: d(20), expiry_date: fd(10), total: 60000, subtotal: 50847, total_tax: 9153, status: "sent" as const },
        { org_id: orgId, client_id: clients[4].id, estimate_number: "EST-004", issue_date: d(5), expiry_date: fd(25), total: 28000, subtotal: 23729, total_tax: 4271, status: "draft" as const },
      ]);
    }

    // Business expenses spread over 3 months
    await admin.from("business_expenses").insert([
      // Month 3 (oldest)
      { org_id: orgId, category: "Salary", description: "Staff salaries", amount: 150000, expense_date: d(85), is_recurring: true, recurring_frequency: "monthly" },
      { org_id: orgId, category: "Rent", description: "Office rent", amount: 35000, expense_date: d(83), is_recurring: true, recurring_frequency: "monthly" },
      { org_id: orgId, category: "Electricity", description: "Office electricity bill", amount: 4200, expense_date: d(80) },
      { org_id: orgId, category: "Internet", description: "Broadband connection", amount: 2000, expense_date: d(78) },
      { org_id: orgId, category: "Marketing", description: "Google Ads campaign", amount: 12000, expense_date: d(70) },
      // Month 2
      { org_id: orgId, category: "Salary", description: "Staff salaries", amount: 150000, expense_date: d(55), is_recurring: true, recurring_frequency: "monthly" },
      { org_id: orgId, category: "Rent", description: "Office rent", amount: 35000, expense_date: d(53), is_recurring: true, recurring_frequency: "monthly" },
      { org_id: orgId, category: "Electricity", description: "Office electricity bill", amount: 4800, expense_date: d(50) },
      { org_id: orgId, category: "Internet", description: "Broadband connection", amount: 2000, expense_date: d(48) },
      { org_id: orgId, category: "Software/Subscriptions", description: "Cloud services & tools", amount: 8000, expense_date: d(45) },
      { org_id: orgId, category: "Office Supplies", description: "Stationery & printing", amount: 3500, expense_date: d(40) },
      // Month 1 (most recent)
      { org_id: orgId, category: "Salary", description: "Staff salaries", amount: 150000, expense_date: d(25), is_recurring: true, recurring_frequency: "monthly" },
      { org_id: orgId, category: "Rent", description: "Office rent", amount: 35000, expense_date: d(23), is_recurring: true, recurring_frequency: "monthly" },
      { org_id: orgId, category: "Electricity", description: "Office electricity bill", amount: 4500, expense_date: d(20) },
      { org_id: orgId, category: "Internet", description: "Broadband connection", amount: 2000, expense_date: d(18) },
      { org_id: orgId, category: "Software/Subscriptions", description: "Cloud services & tools", amount: 8000, expense_date: d(15) },
      { org_id: orgId, category: "Transportation", description: "Client meeting travel", amount: 5000, expense_date: d(12) },
      { org_id: orgId, category: "Marketing", description: "Social media ads", amount: 9000, expense_date: d(7) },
    ]);

    return new Response(JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
