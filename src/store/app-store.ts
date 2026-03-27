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
  payment_terms: number;
  default_notes: string | null;
  default_terms: string | null;
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
