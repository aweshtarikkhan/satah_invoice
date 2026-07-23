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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkTaxes() {
  const { data: orgs } = await supabase.from('organizations').select('id').limit(1);
  if (!orgs || orgs.length === 0) return;
  
  const { data, error } = await supabase.from('tax_rates').select('*').eq('org_id', orgs[0].id);
  console.log("Taxes:", data);
}

checkTaxes();
