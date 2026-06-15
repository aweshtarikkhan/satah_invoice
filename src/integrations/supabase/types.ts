export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          attendance_date: string
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          org_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
        }
        Insert: {
          attendance_date: string
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          org_id: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Update: {
          attendance_date?: string
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          org_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          org_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          org_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          org_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      business_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          expense_date: string
          id: string
          is_recurring: boolean
          org_id: string
          recurring_frequency: string | null
          updated_at: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          org_id: string
          recurring_frequency?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          org_id?: string
          recurring_frequency?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_address: Json | null
          company_name: string | null
          created_at: string
          credit_limit: number
          currency_code: string | null
          display_name: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          mobile: string | null
          notes: string | null
          opening_balance: number
          org_id: string
          payment_terms: number | null
          phone: string | null
          shipping_address: Json | null
          status: Database["public"]["Enums"]["client_status"]
          tags: string[] | null
          tax_number: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          billing_address?: Json | null
          company_name?: string | null
          created_at?: string
          credit_limit?: number
          currency_code?: string | null
          display_name: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          opening_balance?: number
          org_id: string
          payment_terms?: number | null
          phone?: string | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          tax_number?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          billing_address?: Json | null
          company_name?: string | null
          created_at?: string
          credit_limit?: number
          currency_code?: string | null
          display_name?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          mobile?: string | null
          notes?: string | null
          opening_balance?: number
          org_id?: string
          payment_terms?: number | null
          phone?: string | null
          shipping_address?: Json | null
          status?: Database["public"]["Enums"]["client_status"]
          tags?: string[] | null
          tax_number?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          client_id: string
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_primary: boolean
          last_name: string
          phone: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_primary?: boolean
          last_name: string
          phone?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_primary?: boolean
          last_name?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_note_lines: {
        Row: {
          amount: number
          credit_note_id: string
          description: string | null
          discount: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          id: string
          item_id: string | null
          name: string
          quantity: number
          rate: number
          sort_order: number
          tax_amount: number
          tax_id: string | null
          unit: string | null
        }
        Insert: {
          amount?: number
          credit_note_id: string
          description?: string | null
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          id?: string
          item_id?: string | null
          name: string
          quantity?: number
          rate?: number
          sort_order?: number
          tax_amount?: number
          tax_id?: string | null
          unit?: string | null
        }
        Update: {
          amount?: number
          credit_note_id?: string
          description?: string | null
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          id?: string
          item_id?: string | null
          name?: string
          quantity?: number
          rate?: number
          sort_order?: number
          tax_amount?: number
          tax_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_lines_credit_note_id_fkey"
            columns: ["credit_note_id"]
            isOneToOne: false
            referencedRelation: "credit_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          client_id: string
          created_at: string
          credit_note_number: string
          currency_code: string
          discount: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          exchange_rate: number
          id: string
          invoice_id: string | null
          issue_date: string
          notes: string | null
          org_id: string
          reference_number: string | null
          status: Database["public"]["Enums"]["credit_note_status"]
          subtotal: number
          terms_conditions: string | null
          total: number
          total_discount: number
          total_tax: number
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          credit_note_number: string
          currency_code?: string
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          issue_date?: string
          notes?: string | null
          org_id: string
          reference_number?: string | null
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          terms_conditions?: string | null
          total?: number
          total_discount?: number
          total_tax?: number
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          credit_note_number?: string
          currency_code?: string
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          exchange_rate?: number
          id?: string
          invoice_id?: string | null
          issue_date?: string
          notes?: string | null
          org_id?: string
          reference_number?: string | null
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          terms_conditions?: string | null
          total?: number
          total_discount?: number
          total_tax?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          entity_type: string
          field_name: string
          field_options: Json | null
          field_type: string
          id: string
          is_required: boolean
          org_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          entity_type: string
          field_name: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_required?: boolean
          org_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          entity_type?: string
          field_name?: string
          field_options?: Json | null
          field_type?: string
          id?: string
          is_required?: boolean
          org_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          created_at: string
          entity_id: string
          field_id: string
          id: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          entity_id: string
          field_id: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string
          field_id?: string
          id?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          designation: string | null
          email: string | null
          employee_code: string | null
          id: string
          is_active: boolean
          joining_date: string | null
          monthly_salary: number
          name: string
          notes: string | null
          org_id: string
          paid_leaves_per_month: number
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          designation?: string | null
          email?: string | null
          employee_code?: string | null
          id?: string
          is_active?: boolean
          joining_date?: string | null
          monthly_salary?: number
          name: string
          notes?: string | null
          org_id: string
          paid_leaves_per_month?: number
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          designation?: string | null
          email?: string | null
          employee_code?: string | null
          id?: string
          is_active?: boolean
          joining_date?: string | null
          monthly_salary?: number
          name?: string
          notes?: string | null
          org_id?: string
          paid_leaves_per_month?: number
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_lines: {
        Row: {
          amount: number
          description: string | null
          discount: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          estimate_id: string
          id: string
          item_id: string | null
          name: string
          quantity: number
          rate: number
          sort_order: number
          tax_amount: number
          tax_id: string | null
          unit: string | null
        }
        Insert: {
          amount?: number
          description?: string | null
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          estimate_id: string
          id?: string
          item_id?: string | null
          name: string
          quantity?: number
          rate?: number
          sort_order?: number
          tax_amount?: number
          tax_id?: string | null
          unit?: string | null
        }
        Update: {
          amount?: number
          description?: string | null
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          estimate_id?: string
          id?: string
          item_id?: string | null
          name?: string
          quantity?: number
          rate?: number
          sort_order?: number
          tax_amount?: number
          tax_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_lines_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          accepted_at: string | null
          adjustment: number
          adjustment_name: string | null
          client_id: string
          converted_invoice_id: string | null
          created_at: string
          currency_code: string
          declined_at: string | null
          discount: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          estimate_number: string
          exchange_rate: number
          expiry_date: string
          id: string
          issue_date: string
          notes: string | null
          org_id: string
          reference_number: string | null
          sent_at: string | null
          shipping_charge: number
          status: Database["public"]["Enums"]["estimate_status"]
          subtotal: number
          terms_conditions: string | null
          total: number
          total_discount: number
          total_tax: number
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          adjustment?: number
          adjustment_name?: string | null
          client_id: string
          converted_invoice_id?: string | null
          created_at?: string
          currency_code?: string
          declined_at?: string | null
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          estimate_number: string
          exchange_rate?: number
          expiry_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          org_id: string
          reference_number?: string | null
          sent_at?: string | null
          shipping_charge?: number
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number
          terms_conditions?: string | null
          total?: number
          total_discount?: number
          total_tax?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          adjustment?: number
          adjustment_name?: string | null
          client_id?: string
          converted_invoice_id?: string | null
          created_at?: string
          currency_code?: string
          declined_at?: string | null
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          estimate_number?: string
          exchange_rate?: number
          expiry_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          org_id?: string
          reference_number?: string | null
          sent_at?: string | null
          shipping_charge?: number
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number
          terms_conditions?: string | null
          total?: number
          total_discount?: number
          total_tax?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_converted_invoice_id_fkey"
            columns: ["converted_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base_currency: string
          fetched_at: string
          id: string
          rate: number
          target_currency: string
        }
        Insert: {
          base_currency?: string
          fetched_at?: string
          id?: string
          rate: number
          target_currency: string
        }
        Update: {
          base_currency?: string
          fetched_at?: string
          id?: string
          rate?: number
          target_currency?: string
        }
        Relationships: []
      }
      invoice_lines: {
        Row: {
          amount: number
          description: string | null
          discount: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          id: string
          invoice_id: string
          item_id: string | null
          name: string
          quantity: number
          rate: number
          sort_order: number
          tax_amount: number
          tax_id: string | null
          unit: string | null
        }
        Insert: {
          amount?: number
          description?: string | null
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          id?: string
          invoice_id: string
          item_id?: string | null
          name: string
          quantity?: number
          rate?: number
          sort_order?: number
          tax_amount?: number
          tax_id?: string | null
          unit?: string | null
        }
        Update: {
          amount?: number
          description?: string | null
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          id?: string
          invoice_id?: string
          item_id?: string | null
          name?: string
          quantity?: number
          rate?: number
          sort_order?: number
          tax_amount?: number
          tax_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          adjustment: number
          adjustment_name: string | null
          amount_paid: number
          balance_due: number
          billing_address: Json | null
          client_id: string
          created_at: string
          currency_code: string
          deduct_stock: boolean
          discount: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          due_date: string
          exchange_rate: number
          expenses: number
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          org_id: string
          paid_at: string | null
          reference_number: string | null
          sent_at: string | null
          shipping_address: Json | null
          shipping_charge: number
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          terms_conditions: string | null
          total: number
          total_discount: number
          total_tax: number
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          adjustment?: number
          adjustment_name?: string | null
          amount_paid?: number
          balance_due?: number
          billing_address?: Json | null
          client_id: string
          created_at?: string
          currency_code?: string
          deduct_stock?: boolean
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          due_date?: string
          exchange_rate?: number
          expenses?: number
          id?: string
          invoice_number: string
          issue_date?: string
          notes?: string | null
          org_id: string
          paid_at?: string | null
          reference_number?: string | null
          sent_at?: string | null
          shipping_address?: Json | null
          shipping_charge?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          terms_conditions?: string | null
          total?: number
          total_discount?: number
          total_tax?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          adjustment?: number
          adjustment_name?: string | null
          amount_paid?: number
          balance_due?: number
          billing_address?: Json | null
          client_id?: string
          created_at?: string
          currency_code?: string
          deduct_stock?: boolean
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          due_date?: string
          exchange_rate?: number
          expenses?: number
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          reference_number?: string | null
          sent_at?: string | null
          shipping_address?: Json | null
          shipping_charge?: number
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          terms_conditions?: string | null
          total?: number
          total_discount?: number
          total_tax?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          sku: string | null
          stock_quantity: number
          tax_id: string | null
          type: Database["public"]["Enums"]["item_type"]
          unit: string | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          sku?: string | null
          stock_quantity?: number
          tax_id?: string | null
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          sku?: string | null
          stock_quantity?: number
          tax_id?: string | null
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: Json | null
          created_at: string
          credit_note_next_number: number
          credit_note_prefix: string
          currency_code: string
          date_format: string
          default_notes: string | null
          default_terms: string | null
          email: string | null
          estimate_next_number: number
          estimate_prefix: string
          fiscal_year_start: number
          gst_enabled: boolean
          gst_number: string | null
          id: string
          inventory_enabled: boolean
          invoice_next_number: number
          invoice_prefix: string
          logo_url: string | null
          low_stock_threshold: number
          name: string
          payment_prefix: string
          payment_terms: number
          phone: string | null
          qr_code_enabled: boolean
          show_client_gst: boolean
          tax_name: string | null
          tax_number: string | null
          template_accent_color: string
          template_font: string
          template_paper_size: string
          template_show_logo: boolean
          template_style: string
          timezone: string
          updated_at: string
          upi_id: string | null
          website: string | null
        }
        Insert: {
          address?: Json | null
          created_at?: string
          credit_note_next_number?: number
          credit_note_prefix?: string
          currency_code?: string
          date_format?: string
          default_notes?: string | null
          default_terms?: string | null
          email?: string | null
          estimate_next_number?: number
          estimate_prefix?: string
          fiscal_year_start?: number
          gst_enabled?: boolean
          gst_number?: string | null
          id?: string
          inventory_enabled?: boolean
          invoice_next_number?: number
          invoice_prefix?: string
          logo_url?: string | null
          low_stock_threshold?: number
          name: string
          payment_prefix?: string
          payment_terms?: number
          phone?: string | null
          qr_code_enabled?: boolean
          show_client_gst?: boolean
          tax_name?: string | null
          tax_number?: string | null
          template_accent_color?: string
          template_font?: string
          template_paper_size?: string
          template_show_logo?: boolean
          template_style?: string
          timezone?: string
          updated_at?: string
          upi_id?: string | null
          website?: string | null
        }
        Update: {
          address?: Json | null
          created_at?: string
          credit_note_next_number?: number
          credit_note_prefix?: string
          currency_code?: string
          date_format?: string
          default_notes?: string | null
          default_terms?: string | null
          email?: string | null
          estimate_next_number?: number
          estimate_prefix?: string
          fiscal_year_start?: number
          gst_enabled?: boolean
          gst_number?: string | null
          id?: string
          inventory_enabled?: boolean
          invoice_next_number?: number
          invoice_prefix?: string
          logo_url?: string | null
          low_stock_threshold?: number
          name?: string
          payment_prefix?: string
          payment_terms?: number
          phone?: string | null
          qr_code_enabled?: boolean
          show_client_gst?: boolean
          tax_name?: string | null
          tax_number?: string | null
          template_accent_color?: string
          template_font?: string
          template_paper_size?: string
          template_show_logo?: boolean
          template_style?: string
          timezone?: string
          updated_at?: string
          upi_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          currency_code: string
          id: string
          invoice_id: string | null
          notes: string | null
          org_id: string
          payment_date: string
          payment_mode: string
          payment_number: string
          reference_number: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          currency_code?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          org_id: string
          payment_date?: string
          payment_mode?: string
          payment_number: string
          reference_number?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          currency_code?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          org_id?: string
          payment_date?: string
          payment_mode?: string
          payment_number?: string
          reference_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_tokens: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          expires_at: string | null
          id: string
          org_id: string
          token: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          expires_at?: string | null
          id?: string
          org_id: string
          token?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          expires_at?: string | null
          id?: string
          org_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_tokens_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          org_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          org_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          org_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_invoices: {
        Row: {
          client_id: string
          created_at: string
          currency_code: string
          frequency: string
          id: string
          is_active: boolean
          last_generated_at: string | null
          next_run_date: string
          notes: string | null
          org_id: string
          template_invoice_id: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          currency_code?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          next_run_date?: string
          notes?: string | null
          org_id: string
          template_invoice_id?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          currency_code?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_at?: string | null
          next_run_date?: string
          notes?: string | null
          org_id?: string
          template_invoice_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_invoices_template_invoice_id_fkey"
            columns: ["template_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          components: Json | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          rate: number
          type: Database["public"]["Enums"]["tax_type"]
        }
        Insert: {
          components?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          rate: number
          type?: Database["public"]["Enums"]["tax_type"]
        }
        Update: {
          components?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          rate?: number
          type?: Database["public"]["Enums"]["tax_type"]
        }
        Relationships: [
          {
            foreignKeyName: "tax_rates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_organization_for_current_user: {
        Args: { org_name: string }
        Returns: {
          address: Json | null
          created_at: string
          credit_note_next_number: number
          credit_note_prefix: string
          currency_code: string
          date_format: string
          default_notes: string | null
          default_terms: string | null
          email: string | null
          estimate_next_number: number
          estimate_prefix: string
          fiscal_year_start: number
          gst_enabled: boolean
          gst_number: string | null
          id: string
          inventory_enabled: boolean
          invoice_next_number: number
          invoice_prefix: string
          logo_url: string | null
          low_stock_threshold: number
          name: string
          payment_prefix: string
          payment_terms: number
          phone: string | null
          qr_code_enabled: boolean
          show_client_gst: boolean
          tax_name: string | null
          tax_number: string | null
          template_accent_color: string
          template_font: string
          template_paper_size: string
          template_show_logo: boolean
          template_style: string
          timezone: string
          updated_at: string
          upi_id: string | null
          website: string | null
        }
        SetofOptions: {
          from: "*"
          to: "organizations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_portal_bundle: { Args: { p_token: string }; Returns: Json }
      get_user_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_portal_viewed: { Args: { p_token: string }; Returns: undefined }
    }
    Enums: {
      app_role: "owner" | "admin" | "staff" | "read_only"
      attendance_status:
        | "present"
        | "absent"
        | "half_day"
        | "paid_leave"
        | "holiday"
      client_status: "active" | "inactive"
      credit_note_status: "draft" | "sent" | "void"
      discount_type: "percentage" | "fixed"
      estimate_status:
        | "draft"
        | "sent"
        | "viewed"
        | "accepted"
        | "declined"
        | "expired"
        | "converted"
      invoice_status:
        | "draft"
        | "sent"
        | "viewed"
        | "partial"
        | "paid"
        | "overdue"
        | "void"
      item_type: "service" | "product"
      tax_type: "simple" | "compound"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "staff", "read_only"],
      attendance_status: [
        "present",
        "absent",
        "half_day",
        "paid_leave",
        "holiday",
      ],
      client_status: ["active", "inactive"],
      credit_note_status: ["draft", "sent", "void"],
      discount_type: ["percentage", "fixed"],
      estimate_status: [
        "draft",
        "sent",
        "viewed",
        "accepted",
        "declined",
        "expired",
        "converted",
      ],
      invoice_status: [
        "draft",
        "sent",
        "viewed",
        "partial",
        "paid",
        "overdue",
        "void",
      ],
      item_type: ["service", "product"],
      tax_type: ["simple", "compound"],
    },
  },
} as const
