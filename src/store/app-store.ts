import { create } from "zustand";

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
  address: Record<string, string>;
  phone: string | null;
  email: string | null;
  website: string | null;
  tax_number: string | null;
  tax_name: string | null;
  currency_code: string;
  invoice_prefix: string;
  invoice_next_number: number;
  estimate_prefix: string;
  estimate_next_number: number;
  credit_note_prefix: string;
  credit_note_next_number: number;
  payment_prefix: string;
  payment_terms: number;
  default_notes: string | null;
  default_terms: string | null;
  template_style: string;
  template_accent_color: string;
  template_font: string;
  template_show_logo: boolean;
  template_paper_size: string;
  gst_enabled: boolean;
  gst_number: string | null;
  show_client_gst: boolean;
  qr_code_enabled: boolean;
}

interface AppState {
  organization: Organization | null;
  setOrganization: (org: Organization | null) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  organization: null,
  setOrganization: (org) => set({ organization: org }),
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
