import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envText = fs.readFileSync('.env', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let key = match[1].trim();
    let val = match[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[key] = val;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInvoices() {
  // get org
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  const org = orgs[0];

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`*, clients(*), invoice_items(*)`)
    .eq("org_id", org.id)
    .neq("status", "void");
    
  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Found ${invoices.length} non-void invoices.`);
  
  let b2bInvoices = 0;
  let b2cInvoices = 0;
  let uniqueB2BBuyers = new Set();
  let uniqueB2CSStates = new Set();
  let uniqueHsnCodes = new Set();
  
  invoices.forEach(inv => {
    const hasGstin = inv.clients?.gstin && inv.clients.gstin.trim() !== '';
    if (hasGstin) {
      b2bInvoices++;
      uniqueB2BBuyers.add(inv.clients.gstin);
    } else {
      b2cInvoices++;
      // B2CS is grouped by state and tax rate
      const state = inv.clients?.billing_address ? 'state' : 'unknown state'; // Simplified for logging
      uniqueB2CSStates.add(state);
    }
    
    inv.invoice_items?.forEach(item => {
      if (item.hsn_code) {
        uniqueHsnCodes.add(item.hsn_code);
      }
    });
  });

  console.log({
    totalInvoices: invoices.length,
    b2bInvoices,
    uniqueB2BBuyers: uniqueB2BBuyers.size,
    b2cInvoices,
    uniqueB2CSStates: uniqueB2CSStates.size, // This is roughly B2CS Rows
    uniqueHsnCodes: uniqueHsnCodes.size // This is roughly HSN Rows
  });
}

checkInvoices();
