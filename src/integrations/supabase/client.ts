// This file is customized to support both Supabase Cloud (for Auth/Email) and VPS (for DB/Storage)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const VPS_SUPABASE_URL = import.meta.env.VITE_VPS_SUPABASE_URL;
const VPS_SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_VPS_SUPABASE_PUBLISHABLE_KEY;

// 1. Cloud Client: Always handles Authentication & Email operations
export const supabaseCloud = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// 2. VPS Client: Handles DB & Storage if configured
const hasVpsConfig = !!(VPS_SUPABASE_URL && VPS_SUPABASE_PUBLISHABLE_KEY);

const vpsClient = hasVpsConfig
  ? createClient<Database>(VPS_SUPABASE_URL, VPS_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  : supabaseCloud;

// 3. Sync auth session from Supabase Cloud to VPS Client
if (hasVpsConfig) {
  // Sync initial session
  supabaseCloud.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      vpsClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }
  });

  // Sync session changes (Login, Logout, Token refreshes)
  supabaseCloud.auth.onAuthStateChange((_event, session) => {
    if (session) {
      vpsClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    } else {
      vpsClient.auth.signOut();
    }
  });
}

// 4. Export a single proxied client
// This intercepts and routes 'auth' to Supabase Cloud, and everything else to the VPS Client
export const supabase = hasVpsConfig
  ? new Proxy(vpsClient, {
      get(target, prop, receiver) {
        if (prop === 'auth') {
          return supabaseCloud.auth;
        }
        return Reflect.get(target, prop, receiver);
      }
    })
  : supabaseCloud;