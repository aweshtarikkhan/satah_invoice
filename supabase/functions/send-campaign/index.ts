import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, x-supabase-client-platform, apikey, content-type",
};

interface Recipient {
  id: string;
  to_address: string;
  name: string | null;
  vars: Record<string, string>;
}

function renderBody(body: string, vars: Record<string, string>, name?: string | null) {
  let out = body;
  out = out.replaceAll("{{name}}", name || "");
  for (const [k, v] of Object.entries(vars || {})) {
    out = out.replaceAll(`{{${k}}}`, String(v ?? ""));
  }
  // WhatsApp template numbered params {{1}} {{2}}
  const list = Object.values(vars || {});
  list.forEach((v, i) => {
    out = out.replaceAll(`{{${i + 1}}}`, String(v ?? ""));
  });
  return out;
}

async function sendWhatsApp(to: string, body: string, template?: { name: string; lang: string; params: string[] }) {
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) throw new Error("WhatsApp Cloud API not configured (WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing)");

  const url = `https://graph.facebook.com/v20.0/${phoneId}/messages`;
  const payload: any = template
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.lang || "en" },
          components: template.params.length
            ? [{ type: "body", parameters: template.params.map((p) => ({ type: "text", text: p })) }]
            : [],
        },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      };

  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `WhatsApp error ${res.status}`);
  return json?.messages?.[0]?.id || null;
}

async function sendSms(to: string, body: string) {
  // Placeholder generic HTTP SMS gateway. Configure SMS_API_URL & SMS_API_KEY.
  const url = Deno.env.get("SMS_API_URL");
  const key = Deno.env.get("SMS_API_KEY");
  const from = Deno.env.get("SMS_SENDER_ID") || "SATAH";
  if (!url || !key) throw new Error("SMS not configured (SMS_API_URL / SMS_API_KEY missing)");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to, from, text: body }),
  });
  if (!res.ok) throw new Error(`SMS error ${res.status}: ${await res.text()}`);
  const j = await res.json().catch(() => ({}));
  return j?.id || j?.message_id || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("campaign_id required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("*, template:message_templates(*)")
      .eq("id", campaign_id)
      .single();
    if (cErr || !campaign) throw new Error(cErr?.message || "Campaign not found");

    await supabase.from("campaigns").update({ status: "sending" }).eq("id", campaign_id);

    const { data: recipients } = await supabase
      .from("campaign_recipients")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "pending");

    let sent = 0;
    let failed = 0;

    for (const r of (recipients || []) as Recipient[]) {
      try {
        const body = renderBody(campaign.template?.body || "", r.vars || {}, r.name);
        let providerId: string | null = null;

        if (campaign.channel === "whatsapp") {
          const useTemplate = !!campaign.template?.wa_template_name;
          providerId = await sendWhatsApp(
            r.to_address,
            body,
            useTemplate
              ? {
                  name: campaign.template.wa_template_name!,
                  lang: campaign.template.wa_language || "en",
                  params: Object.values(r.vars || {}).map((v) => String(v ?? "")),
                }
              : undefined
          );
        } else if (campaign.channel === "sms") {
          providerId = await sendSms(r.to_address, body);
        } else {
          throw new Error(`Channel ${campaign.channel} not supported via this function`);
        }

        await supabase.from("campaign_recipients").update({
          status: "sent",
          provider_message_id: providerId,
          sent_at: new Date().toISOString(),
        }).eq("id", r.id);

        await supabase.from("message_logs").insert({
          org_id: campaign.org_id,
          channel: campaign.channel,
          to_address: r.to_address,
          template_id: campaign.template_id,
          campaign_id: campaign.id,
          body,
          status: "sent",
          provider_message_id: providerId,
        });

        sent++;
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        await supabase.from("campaign_recipients").update({ status: "failed", error: err }).eq("id", r.id);
        await supabase.from("message_logs").insert({
          org_id: campaign.org_id,
          channel: campaign.channel,
          to_address: r.to_address,
          template_id: campaign.template_id,
          campaign_id: campaign.id,
          body: "",
          status: "failed",
          error: err,
        });
        failed++;
      }
    }

    await supabase
      .from("campaigns")
      .update({
        status: "completed",
        sent_count: sent,
        failed_count: failed,
        total_count: (recipients?.length || 0),
      })
      .eq("id", campaign_id);

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
