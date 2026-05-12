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
    // Check if demo user exists
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    let demoUser = existingUsers?.users?.find((u: any) => u.email === DEMO_EMAIL);

    if (!demoUser) {
      // Create demo user
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: "Demo", last_name: "User" },
      });
      if (createErr) throw createErr;
      demoUser = newUser.user;
    }

    // Check if demo user has org
    const { data: profile } = await admin.from("profiles").select("org_id").eq("user_id", demoUser!.id).single();

    if (!profile?.org_id) {
      // Create org
      const { data: org, error: orgErr } = await admin.from("organizations").insert({
        name: "Demo Business Pvt. Ltd.",
        currency_code: "INR",
        invoice_prefix: "INV",
        estimate_prefix: "EST",
        payment_prefix: "PAY",
        payment_terms: 30,
        gst_enabled: true,
        gst_number: "27AADCB2230M1ZT",
        qr_code_enabled: true,
        upi_id: "demo@upi",
        template_style: "compact",
        email: "billing@demobusiness.com",
        phone: "+91 9876543210",
        address: { line1: "123 Business Park", city: "Mumbai", state: "Maharashtra", zip: "400001", country: "India" },
        default_notes: "Thank you for your business!",
        default_terms: "Payment due within 30 days.",
      }).select().single();
      if (orgErr) throw orgErr;

      await admin.from("profiles").update({ org_id: org.id, first_name: "Demo", last_name: "User" }).eq("user_id", demoUser!.id);
      await admin.from("user_roles").upsert({ user_id: demoUser!.id, role: "owner" }, { onConflict: "user_id,role" });

      // Seed demo data
      const orgId = org.id;

      // Tax rates
      const { data: taxes } = await admin.from("tax_rates").insert([
        { org_id: orgId, name: "GST 18%", rate: 18, type: "simple", is_default: true },
        { org_id: orgId, name: "GST 12%", rate: 12, type: "simple" },
        { org_id: orgId, name: "GST 5%", rate: 5, type: "simple" },
      ]).select();
      const tax18 = taxes?.[0]?.id;
      const tax12 = taxes?.[1]?.id;
      const tax5 = taxes?.[2]?.id;

      // Items — mix of services + products with various units (kg, ltr, pcs, box) for inventory demo
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
      const clientData = [
        { org_id: orgId, display_name: "Rajesh Sharma", company_name: "Sharma Enterprises", email: "rajesh@sharma.co", phone: "+91 9812345678", opening_balance: 0 },
        { org_id: orgId, display_name: "Priya Patel", company_name: "Patel Solutions", email: "priya@patelsol.in", phone: "+91 9823456789", opening_balance: 0 },
        { org_id: orgId, display_name: "Amit Verma", company_name: "Verma Industries", email: "amit@verma.co.in", phone: "+91 9834567890", opening_balance: 0 },
        { org_id: orgId, display_name: "Sunita Gupta", company_name: "Gupta Traders", email: "sunita@guptatraders.com", phone: "+91 9845678901", opening_balance: 0 },
        { org_id: orgId, display_name: "Vikram Singh", company_name: "Singh Tech Pvt Ltd", email: "vikram@singhtech.in", phone: "+91 9856789012", opening_balance: 0 },
      ];
      const { data: clients } = await admin.from("clients").insert(clientData).select();

      if (clients && items) {
        const today = new Date();
        const d = (days: number) => new Date(today.getTime() - days * 86400000).toISOString().split("T")[0];
        const fd = (days: number) => new Date(today.getTime() + days * 86400000).toISOString().split("T")[0];

        // Invoices
        const invoiceRows = [
          { org_id: orgId, client_id: clients[0].id, invoice_number: "INV-001", issue_date: d(60), due_date: d(30), total: 29500, subtotal: 25000, total_tax: 4500, balance_due: 0, amount_paid: 29500, status: "paid" as const, paid_at: d(25) },
          { org_id: orgId, client_id: clients[1].id, invoice_number: "INV-002", issue_date: d(45), due_date: d(15), total: 17700, subtotal: 15000, total_tax: 2700, balance_due: 17700, amount_paid: 0, status: "overdue" as const },
          { org_id: orgId, client_id: clients[2].id, invoice_number: "INV-003", issue_date: d(30), due_date: d(0), total: 9440, subtotal: 8000, total_tax: 1440, balance_due: 4440, amount_paid: 5000, status: "partial" as const },
          { org_id: orgId, client_id: clients[3].id, invoice_number: "INV-004", issue_date: d(10), due_date: fd(20), total: 88500, subtotal: 75000, total_tax: 13500, balance_due: 88500, amount_paid: 0, status: "sent" as const, sent_at: d(9) },
          { org_id: orgId, client_id: clients[4].id, invoice_number: "INV-005", issue_date: d(5), due_date: fd(25), total: 14160, subtotal: 12000, total_tax: 2160, balance_due: 14160, amount_paid: 0, status: "draft" as const },
          { org_id: orgId, client_id: clients[0].id, invoice_number: "INV-006", issue_date: d(90), due_date: d(60), total: 2800, subtotal: 2500, total_tax: 300, balance_due: 0, amount_paid: 2800, status: "paid" as const, paid_at: d(55) },
          { org_id: orgId, client_id: clients[1].id, invoice_number: "INV-007", issue_date: d(3), due_date: fd(27), total: 45000, subtotal: 38135, total_tax: 6865, balance_due: 45000, amount_paid: 0, status: "sent" as const, sent_at: d(2) },
          { org_id: orgId, client_id: clients[2].id, invoice_number: "INV-008", issue_date: d(20), due_date: fd(10), total: 25000, subtotal: 21186, total_tax: 3814, balance_due: 25000, amount_paid: 0, status: "sent" as const },
        ];
        const { data: invoicesData } = await admin.from("invoices").insert(invoiceRows).select();

        // Invoice lines
        if (invoicesData) {
          const lines = [
            { invoice_id: invoicesData[0].id, name: "Web Development", quantity: 1, rate: 25000, amount: 25000, tax_id: tax18, tax_amount: 4500, sort_order: 0 },
            { invoice_id: invoicesData[1].id, name: "SEO Package", quantity: 1, rate: 15000, amount: 15000, tax_id: tax18, tax_amount: 2700, sort_order: 0 },
            { invoice_id: invoicesData[2].id, name: "Logo Design", quantity: 1, rate: 8000, amount: 8000, tax_id: tax18, tax_amount: 1440, sort_order: 0 },
            { invoice_id: invoicesData[3].id, name: "Mobile App Development", quantity: 1, rate: 75000, amount: 75000, tax_id: tax18, tax_amount: 13500, sort_order: 0 },
            { invoice_id: invoicesData[4].id, name: "Hosting (Annual)", quantity: 1, rate: 12000, amount: 12000, tax_id: tax18, tax_amount: 2160, sort_order: 0 },
            { invoice_id: invoicesData[5].id, name: "Business Cards", quantity: 1, rate: 2500, amount: 2500, tax_id: tax12, tax_amount: 300, sort_order: 0 },
            { invoice_id: invoicesData[6].id, name: "Web Development", quantity: 1, rate: 25000, amount: 25000, tax_id: tax18, tax_amount: 4500, sort_order: 0 },
            { invoice_id: invoicesData[6].id, name: "SEO Package", quantity: 1, rate: 15000, amount: 15000, tax_id: tax18, tax_amount: 2700, sort_order: 1 },
            { invoice_id: invoicesData[7].id, name: "Web Development", quantity: 1, rate: 25000, amount: 25000, tax_id: tax18, tax_amount: 4500, sort_order: 0 },
          ];
          await admin.from("invoice_lines").insert(lines);

          // Payments
          await admin.from("payments").insert([
            { org_id: orgId, client_id: clients[0].id, invoice_id: invoicesData[0].id, payment_number: "PAY-001", amount: 29500, payment_date: d(25), payment_mode: "bank_transfer", reference_number: "NEFT-001" },
            { org_id: orgId, client_id: clients[2].id, invoice_id: invoicesData[2].id, payment_number: "PAY-002", amount: 5000, payment_date: d(5), payment_mode: "upi", reference_number: "UPI-002" },
            { org_id: orgId, client_id: clients[0].id, invoice_id: invoicesData[5].id, payment_number: "PAY-003", amount: 2800, payment_date: d(55), payment_mode: "cash" },
          ]);
        }

        // Update client opening balances
        for (const c of clients) {
          const { data: cInvs } = await admin.from("invoices").select("balance_due").eq("client_id", c.id);
          const totalDue = (cInvs || []).reduce((s: number, i: any) => s + Number(i.balance_due), 0);
          await admin.from("clients").update({ opening_balance: totalDue }).eq("id", c.id);
        }
      }

      // Estimates
      if (clients) {
        await admin.from("estimates").insert([
          { org_id: orgId, client_id: clients[0].id, estimate_number: "EST-001", issue_date: today.toISOString().split("T")[0], expiry_date: fd(30), total: 50000, subtotal: 42373, total_tax: 7627, status: "sent" as const },
          { org_id: orgId, client_id: clients[3].id, estimate_number: "EST-002", issue_date: today.toISOString().split("T")[0], expiry_date: fd(15), total: 35000, subtotal: 29661, total_tax: 5339, status: "draft" as const },
        ]);
      }

      // Business expenses
      await admin.from("business_expenses").insert([
        { org_id: orgId, category: "Salary", description: "Staff salaries", amount: 150000, expense_date: d(5), is_recurring: true, recurring_frequency: "monthly" },
        { org_id: orgId, category: "Rent", description: "Office rent", amount: 35000, expense_date: d(3), is_recurring: true, recurring_frequency: "monthly" },
        { org_id: orgId, category: "Electricity", description: "Office electricity bill", amount: 4500, expense_date: d(10), is_recurring: true, recurring_frequency: "monthly" },
        { org_id: orgId, category: "Internet", description: "Broadband connection", amount: 2000, expense_date: d(7), is_recurring: true, recurring_frequency: "monthly" },
        { org_id: orgId, category: "Software/Subscriptions", description: "Cloud services & tools", amount: 8000, expense_date: d(2), is_recurring: true, recurring_frequency: "monthly" },
        { org_id: orgId, category: "Marketing", description: "Google Ads campaign", amount: 12000, expense_date: d(15) },
        { org_id: orgId, category: "Office Supplies", description: "Stationery & printing", amount: 3500, expense_date: d(20) },
        { org_id: orgId, category: "Transportation", description: "Client meeting travel", amount: 5000, expense_date: d(12) },
      ]);
    }

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
