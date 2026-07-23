import { createClient } from '@supabase/supabase-js';

const url = "https://ewnsxsnjcolhdehrdrhf.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bnN4c25qY29saGRlaHJkcmhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyNzA4NDUsImV4cCI6MjA5OTg0Njg0NX0.OIMzCCy7XwHq0-V0jN60SUbslNIL5MINI3EdyR42ojk";

const supabase = createClient(url, key);

async function run() {
  console.log("=== BillsPage style ===");
  const { data: bData, error: bError } = await supabase.from("bills").select("*, vendors(name)");
  console.log("Bills:", bData?.length, "Error:", bError?.message);

  console.log("=== GstReturnsPage style ===");
  const { data: gData, error: gError } = await supabase.from("bills").select("*, vendors(name)").neq("status", "void").neq("status", "draft");
  console.log("GstReturns Bills:", gData?.length, "Error:", gError?.message);
}
run();
