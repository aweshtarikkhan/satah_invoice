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
      accounts: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          is_system: boolean | null
          name: string
          org_id: string
          parent_id: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name: string
          org_id: string
          parent_id?: string | null
          type: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_system?: boolean | null
          name?: string
          org_id?: string
          parent_id?: string | null
          type?: Database["public"]["Enums"]["account_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
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
      bank_accounts: {
        Row: {
          account_id: string | null
          account_number: string | null
          account_type: string
          bank_name: string | null
          created_at: string
          currency: string | null
          current_balance: number
          id: string
          ifsc: string | null
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          org_id: string
          updated_at: string
          upi_id: string | null
        }
        Insert: {
          account_id?: string | null
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          created_at?: string
          currency?: string | null
          current_balance?: number
          id?: string
          ifsc?: string | null
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          org_id: string
          updated_at?: string
          upi_id?: string | null
        }
        Update: {
          account_id?: string | null
          account_number?: string | null
          account_type?: string
          bank_name?: string | null
          created_at?: string
          currency?: string | null
          current_balance?: number
          id?: string
          ifsc?: string | null
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          org_id?: string
          updated_at?: string
          upi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_accounts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_transactions: {
        Row: {
          amount: number
          balance_after: number | null
          bank_account_id: string
          counterparty: string | null
          created_at: string
          description: string | null
          direction: string
          id: string
          matched_id: string | null
          matched_type: string | null
          notes: string | null
          org_id: string
          reconciled: boolean
          reconciled_at: string | null
          reference: string | null
          source: string | null
          txn_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          bank_account_id: string
          counterparty?: string | null
          created_at?: string
          description?: string | null
          direction: string
          id?: string
          matched_id?: string | null
          matched_type?: string | null
          notes?: string | null
          org_id: string
          reconciled?: boolean
          reconciled_at?: string | null
          reference?: string | null
          source?: string | null
          txn_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          bank_account_id?: string
          counterparty?: string | null
          created_at?: string
          description?: string | null
          direction?: string
          id?: string
          matched_id?: string | null
          matched_type?: string | null
          notes?: string | null
          org_id?: string
          reconciled?: boolean
          reconciled_at?: string | null
          reference?: string | null
          source?: string | null
          txn_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_transactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_lines: {
        Row: {
          account_id: string | null
          amount: number | null
          bill_id: string
          created_at: string
          description: string
          discount: number | null
          hsn: string | null
          id: string
          item_id: string | null
          org_id: string
          quantity: number | null
          rate: number | null
          sort_order: number | null
          tax_amount: number | null
          tax_rate: number | null
          unit: string | null
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          bill_id: string
          created_at?: string
          description: string
          discount?: number | null
          hsn?: string | null
          id?: string
          item_id?: string | null
          org_id: string
          quantity?: number | null
          rate?: number | null
          sort_order?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          unit?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          bill_id?: string
          created_at?: string
          description?: string
          discount?: number | null
          hsn?: string | null
          id?: string
          item_id?: string | null
          org_id?: string
          quantity?: number | null
          rate?: number | null
          sort_order?: number | null
          tax_amount?: number | null
          tax_rate?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_payments: {
        Row: {
          amount: number
          bill_id: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          exchange_rate: number | null
          id: string
          notes: string | null
          org_id: string
          payment_date: string
          payment_method: string | null
          reference: string | null
          tds_amount: number | null
          updated_at: string
          vendor_id: string
        }
        Insert: {
          amount?: number
          bill_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          org_id: string
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          tds_amount?: number | null
          updated_at?: string
          vendor_id: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          exchange_rate?: number | null
          id?: string
          notes?: string | null
          org_id?: string
          payment_date?: string
          payment_method?: string | null
          reference?: string | null
          tds_amount?: number | null
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payments_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount_paid: number | null
          balance_due: number | null
          bill_date: string
          bill_number: string
          branch_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          discount: number | null
          due_date: string | null
          exchange_rate: number | null
          grn_id: string | null
          id: string
          notes: string | null
          org_id: string
          po_id: string | null
          round_off: number | null
          status: Database["public"]["Enums"]["bill_status"] | null
          subtotal: number | null
          tax_total: number | null
          tds_amount: number | null
          tds_section_id: string | null
          terms: string | null
          total: number | null
          updated_at: string
          vendor_bill_number: string | null
          vendor_id: string
        }
        Insert: {
          amount_paid?: number | null
          balance_due?: number | null
          bill_date?: string
          bill_number: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          discount?: number | null
          due_date?: string | null
          exchange_rate?: number | null
          grn_id?: string | null
          id?: string
          notes?: string | null
          org_id: string
          po_id?: string | null
          round_off?: number | null
          status?: Database["public"]["Enums"]["bill_status"] | null
          subtotal?: number | null
          tax_total?: number | null
          tds_amount?: number | null
          tds_section_id?: string | null
          terms?: string | null
          total?: number | null
          updated_at?: string
          vendor_bill_number?: string | null
          vendor_id: string
        }
        Update: {
          amount_paid?: number | null
          balance_due?: number | null
          bill_date?: string
          bill_number?: string
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          discount?: number | null
          due_date?: string | null
          exchange_rate?: number | null
          grn_id?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          po_id?: string | null
          round_off?: number | null
          status?: Database["public"]["Enums"]["bill_status"] | null
          subtotal?: number | null
          tax_total?: number | null
          tds_amount?: number | null
          tds_section_id?: string | null
          terms?: string | null
          total?: number | null
          updated_at?: string
          vendor_bill_number?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_tds_section_id_fkey"
            columns: ["tds_section_id"]
            isOneToOne: false
            referencedRelation: "tds_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: Json | null
          code: string | null
          created_at: string
          gstin: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          code?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          code?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_org_id_fkey"
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
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
            foreignKeyName: "business_expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
          hsn_code: string | null
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
          hsn_code?: string | null
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
          hsn_code?: string | null
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
          branch_id: string | null
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
          restock_inventory: boolean
          status: Database["public"]["Enums"]["credit_note_status"]
          subtotal: number
          terms_conditions: string | null
          total: number
          total_discount: number
          total_tax: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
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
          restock_inventory?: boolean
          status?: Database["public"]["Enums"]["credit_note_status"]
          subtotal?: number
          terms_conditions?: string | null
          total?: number
          total_discount?: number
          total_tax?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
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
          restock_inventory?: boolean
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
            foreignKeyName: "credit_notes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
      delivery_challan_lines: {
        Row: {
          batch_no: string | null
          created_at: string
          dc_id: string
          description: string
          id: string
          item_id: string | null
          org_id: string
          quantity: number
          serial_no: string | null
          sort_order: number | null
          unit: string | null
        }
        Insert: {
          batch_no?: string | null
          created_at?: string
          dc_id: string
          description: string
          id?: string
          item_id?: string | null
          org_id: string
          quantity?: number
          serial_no?: string | null
          sort_order?: number | null
          unit?: string | null
        }
        Update: {
          batch_no?: string | null
          created_at?: string
          dc_id?: string
          description?: string
          id?: string
          item_id?: string | null
          org_id?: string
          quantity?: number
          serial_no?: string | null
          sort_order?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challan_lines_dc_id_fkey"
            columns: ["dc_id"]
            isOneToOne: false
            referencedRelation: "delivery_challans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challan_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challan_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_challans: {
        Row: {
          branch_id: string | null
          challan_date: string
          challan_number: string
          client_id: string | null
          created_at: string
          created_by: string | null
          destination: string | null
          driver_name: string | null
          driver_phone: string | null
          eway_bill_number: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          org_id: string
          status: string
          transporter: string | null
          updated_at: string
          vehicle_number: string | null
          warehouse_id: string | null
        }
        Insert: {
          branch_id?: string | null
          challan_date?: string
          challan_number: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          eway_bill_number?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          org_id: string
          status?: string
          transporter?: string | null
          updated_at?: string
          vehicle_number?: string | null
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string | null
          challan_date?: string
          challan_number?: string
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          destination?: string | null
          driver_name?: string | null
          driver_phone?: string | null
          eway_bill_number?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          org_id?: string
          status?: string
          transporter?: string | null
          updated_at?: string
          vehicle_number?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_challans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_challans_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          doc_type: string
          employee_id: string
          file_name: string
          file_path: string
          id: string
          org_id: string
          uploaded_at: string
        }
        Insert: {
          doc_type?: string
          employee_id: string
          file_name: string
          file_path: string
          id?: string
          org_id: string
          uploaded_at?: string
        }
        Update: {
          doc_type?: string
          employee_id?: string
          file_name?: string
          file_path?: string
          id?: string
          org_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_documents_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_ifsc: string | null
          basic_percent: number
          created_at: string
          designation: string | null
          email: string | null
          employee_code: string | null
          esic_applicable: boolean
          hra_percent: number
          id: string
          is_active: boolean
          joining_date: string | null
          monthly_salary: number
          name: string
          notes: string | null
          org_id: string
          paid_leaves_per_month: number
          pan: string | null
          pf_applicable: boolean
          phone: string | null
          shift_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          basic_percent?: number
          created_at?: string
          designation?: string | null
          email?: string | null
          employee_code?: string | null
          esic_applicable?: boolean
          hra_percent?: number
          id?: string
          is_active?: boolean
          joining_date?: string | null
          monthly_salary?: number
          name: string
          notes?: string | null
          org_id: string
          paid_leaves_per_month?: number
          pan?: string | null
          pf_applicable?: boolean
          phone?: string | null
          shift_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_ifsc?: string | null
          basic_percent?: number
          created_at?: string
          designation?: string | null
          email?: string | null
          employee_code?: string | null
          esic_applicable?: boolean
          hra_percent?: number
          id?: string
          is_active?: boolean
          joining_date?: string | null
          monthly_salary?: number
          name?: string
          notes?: string | null
          org_id?: string
          paid_leaves_per_month?: number
          pan?: string | null
          pf_applicable?: boolean
          phone?: string | null
          shift_id?: string | null
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
          hsn_code: string | null
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
          hsn_code?: string | null
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
          hsn_code?: string | null
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
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
            foreignKeyName: "estimates_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
      grn_lines: {
        Row: {
          amount: number
          batch_no: string | null
          created_at: string
          description: string
          expiry_date: string | null
          grn_id: string
          id: string
          item_id: string | null
          org_id: string
          po_line_id: string | null
          quantity: number
          serial_no: string | null
          sort_order: number | null
          unit_cost: number
        }
        Insert: {
          amount?: number
          batch_no?: string | null
          created_at?: string
          description: string
          expiry_date?: string | null
          grn_id: string
          id?: string
          item_id?: string | null
          org_id: string
          po_line_id?: string | null
          quantity?: number
          serial_no?: string | null
          sort_order?: number | null
          unit_cost?: number
        }
        Update: {
          amount?: number
          batch_no?: string | null
          created_at?: string
          description?: string
          expiry_date?: string | null
          grn_id?: string
          id?: string
          item_id?: string | null
          org_id?: string
          po_line_id?: string | null
          quantity?: number
          serial_no?: string | null
          sort_order?: number | null
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "grn_lines_grn_id_fkey"
            columns: ["grn_id"]
            isOneToOne: false
            referencedRelation: "grns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grn_lines_po_line_id_fkey"
            columns: ["po_line_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      grns: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          grn_date: string
          grn_number: string
          id: string
          notes: string | null
          org_id: string
          po_id: string | null
          status: string
          transporter: string | null
          updated_at: string
          vehicle_number: string | null
          vendor_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          grn_date?: string
          grn_number: string
          id?: string
          notes?: string | null
          org_id: string
          po_id?: string | null
          status?: string
          transporter?: string | null
          updated_at?: string
          vehicle_number?: string | null
          vendor_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          grn_date?: string
          grn_number?: string
          id?: string
          notes?: string | null
          org_id?: string
          po_id?: string | null
          status?: string
          transporter?: string | null
          updated_at?: string
          vehicle_number?: string | null
          vendor_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grns_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          amount: number
          description: string | null
          discount: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          hsn_code: string | null
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
          hsn_code?: string | null
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
          hsn_code?: string | null
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
          ack_date: string | null
          ack_no: string | null
          adjustment: number
          adjustment_name: string | null
          amount_paid: number
          balance_due: number
          billing_address: Json | null
          branch_id: string | null
          client_id: string
          created_at: string
          currency_code: string
          deduct_stock: boolean
          discount: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          due_date: string
          eway_bill_no: string | null
          eway_distance_km: number | null
          eway_transport_mode: string | null
          eway_valid_until: string | null
          eway_vehicle_no: string | null
          exchange_rate: number
          expenses: number
          id: string
          invoice_number: string
          irn: string | null
          irn_qr: string | null
          issue_date: string
          last_reminder_at: string | null
          notes: string | null
          org_id: string
          paid_at: string | null
          reference_number: string | null
          reminder_count: number
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
          ack_date?: string | null
          ack_no?: string | null
          adjustment?: number
          adjustment_name?: string | null
          amount_paid?: number
          balance_due?: number
          billing_address?: Json | null
          branch_id?: string | null
          client_id: string
          created_at?: string
          currency_code?: string
          deduct_stock?: boolean
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          due_date?: string
          eway_bill_no?: string | null
          eway_distance_km?: number | null
          eway_transport_mode?: string | null
          eway_valid_until?: string | null
          eway_vehicle_no?: string | null
          exchange_rate?: number
          expenses?: number
          id?: string
          invoice_number: string
          irn?: string | null
          irn_qr?: string | null
          issue_date?: string
          last_reminder_at?: string | null
          notes?: string | null
          org_id: string
          paid_at?: string | null
          reference_number?: string | null
          reminder_count?: number
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
          ack_date?: string | null
          ack_no?: string | null
          adjustment?: number
          adjustment_name?: string | null
          amount_paid?: number
          balance_due?: number
          billing_address?: Json | null
          branch_id?: string | null
          client_id?: string
          created_at?: string
          currency_code?: string
          deduct_stock?: boolean
          discount?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          due_date?: string
          eway_bill_no?: string | null
          eway_distance_km?: number | null
          eway_transport_mode?: string | null
          eway_valid_until?: string | null
          eway_vehicle_no?: string | null
          exchange_rate?: number
          expenses?: number
          id?: string
          invoice_number?: string
          irn?: string | null
          irn_qr?: string | null
          issue_date?: string
          last_reminder_at?: string | null
          notes?: string | null
          org_id?: string
          paid_at?: string | null
          reference_number?: string | null
          reminder_count?: number
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
            foreignKeyName: "invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
          hsn_code: string | null
          id: string
          is_active: boolean
          name: string
          org_id: string
          sku: string | null
          stock_quantity: number
          tax_id: string | null
          track_batches: boolean | null
          track_serials: boolean | null
          type: Database["public"]["Enums"]["item_type"]
          unit: string | null
          unit_price: number
          updated_at: string
          valuation_method: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          sku?: string | null
          stock_quantity?: number
          tax_id?: string | null
          track_batches?: boolean | null
          track_serials?: boolean | null
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string | null
          unit_price?: number
          updated_at?: string
          valuation_method?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          hsn_code?: string | null
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          sku?: string | null
          stock_quantity?: number
          tax_id?: string | null
          track_batches?: boolean | null
          track_serials?: boolean | null
          type?: Database["public"]["Enums"]["item_type"]
          unit?: string | null
          unit_price?: number
          updated_at?: string
          valuation_method?: string | null
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
      journal_entries: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          entry_date: string
          id: string
          is_posted: boolean | null
          narration: string | null
          org_id: string
          reference: string | null
          source_id: string | null
          source_type: string | null
          total_credit: number | null
          total_debit: number | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          is_posted?: boolean | null
          narration?: string | null
          org_id: string
          reference?: string | null
          source_id?: string | null
          source_type?: string | null
          total_credit?: number | null
          total_debit?: number | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          entry_date?: string
          id?: string
          is_posted?: boolean | null
          narration?: string | null
          org_id?: string
          reference?: string | null
          source_id?: string | null
          source_type?: string | null
          total_credit?: number | null
          total_debit?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_entries_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_lines: {
        Row: {
          account_id: string
          branch_id: string | null
          created_at: string
          credit: number | null
          debit: number | null
          description: string | null
          entry_id: string
          id: string
          org_id: string
          sort_order: number | null
        }
        Insert: {
          account_id: string
          branch_id?: string | null
          created_at?: string
          credit?: number | null
          debit?: number | null
          description?: string | null
          entry_id: string
          id?: string
          org_id: string
          sort_order?: number | null
        }
        Update: {
          account_id?: string
          branch_id?: string | null
          created_at?: string
          credit?: number | null
          debit?: number | null
          description?: string | null
          entry_id?: string
          id?: string
          org_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leaves: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days: number
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          org_id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          employee_id: string
          end_date: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          org_id: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          org_id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leaves_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaves_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: Json | null
          bill_prefix: string | null
          created_at: string
          credit_note_next_number: number
          credit_note_prefix: string
          currency_code: string
          date_format: string
          dc_next_number: number | null
          dc_prefix: string | null
          default_notes: string | null
          default_terms: string | null
          email: string | null
          estimate_next_number: number
          estimate_prefix: string
          fiscal_year_start: number
          grn_next_number: number | null
          grn_prefix: string | null
          gst_enabled: boolean
          gst_number: string | null
          id: string
          inventory_enabled: boolean
          invoice_next_number: number
          invoice_prefix: string
          irp_gsp_provider: string | null
          irp_username: string | null
          logo_url: string | null
          low_stock_threshold: number
          multi_warehouse_enabled: boolean
          name: string
          next_bill_number: number | null
          payment_prefix: string
          payment_terms: number
          phone: string | null
          po_next_number: number | null
          po_prefix: string | null
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
          bill_prefix?: string | null
          created_at?: string
          credit_note_next_number?: number
          credit_note_prefix?: string
          currency_code?: string
          date_format?: string
          dc_next_number?: number | null
          dc_prefix?: string | null
          default_notes?: string | null
          default_terms?: string | null
          email?: string | null
          estimate_next_number?: number
          estimate_prefix?: string
          fiscal_year_start?: number
          grn_next_number?: number | null
          grn_prefix?: string | null
          gst_enabled?: boolean
          gst_number?: string | null
          id?: string
          inventory_enabled?: boolean
          invoice_next_number?: number
          invoice_prefix?: string
          irp_gsp_provider?: string | null
          irp_username?: string | null
          logo_url?: string | null
          low_stock_threshold?: number
          multi_warehouse_enabled?: boolean
          name: string
          next_bill_number?: number | null
          payment_prefix?: string
          payment_terms?: number
          phone?: string | null
          po_next_number?: number | null
          po_prefix?: string | null
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
          bill_prefix?: string | null
          created_at?: string
          credit_note_next_number?: number
          credit_note_prefix?: string
          currency_code?: string
          date_format?: string
          dc_next_number?: number | null
          dc_prefix?: string | null
          default_notes?: string | null
          default_terms?: string | null
          email?: string | null
          estimate_next_number?: number
          estimate_prefix?: string
          fiscal_year_start?: number
          grn_next_number?: number | null
          grn_prefix?: string | null
          gst_enabled?: boolean
          gst_number?: string | null
          id?: string
          inventory_enabled?: boolean
          invoice_next_number?: number
          invoice_prefix?: string
          irp_gsp_provider?: string | null
          irp_username?: string | null
          logo_url?: string | null
          low_stock_threshold?: number
          multi_warehouse_enabled?: boolean
          name?: string
          next_bill_number?: number | null
          payment_prefix?: string
          payment_terms?: number
          phone?: string | null
          po_next_number?: number | null
          po_prefix?: string | null
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
          branch_id: string | null
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
          branch_id?: string | null
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
          branch_id?: string | null
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
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
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
      payroll_runs: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          org_id: string
          period_month: string
          status: Database["public"]["Enums"]["payroll_status"]
          total_deductions: number
          total_gross: number
          total_net: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          org_id: string
          period_month: string
          status?: Database["public"]["Enums"]["payroll_status"]
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string
          period_month?: string
          status?: Database["public"]["Enums"]["payroll_status"]
          total_deductions?: number
          total_gross?: number
          total_net?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          allowances: number
          basic: number
          created_at: string
          employee_id: string
          esic_employee: number
          gross_salary: number
          hra: number
          id: string
          lop_days: number
          net_pay: number
          org_id: string
          other_deductions: number
          paid_leave_days: number
          payment_date: string | null
          payment_status: string
          pf_employee: number
          present_days: number
          run_id: string
          tds: number
          updated_at: string
          working_days: number
        }
        Insert: {
          allowances?: number
          basic?: number
          created_at?: string
          employee_id: string
          esic_employee?: number
          gross_salary?: number
          hra?: number
          id?: string
          lop_days?: number
          net_pay?: number
          org_id: string
          other_deductions?: number
          paid_leave_days?: number
          payment_date?: string | null
          payment_status?: string
          pf_employee?: number
          present_days?: number
          run_id: string
          tds?: number
          updated_at?: string
          working_days?: number
        }
        Update: {
          allowances?: number
          basic?: number
          created_at?: string
          employee_id?: string
          esic_employee?: number
          gross_salary?: number
          hra?: number
          id?: string
          lop_days?: number
          net_pay?: number
          org_id?: string
          other_deductions?: number
          paid_leave_days?: number
          payment_date?: string | null
          payment_status?: string
          pf_employee?: number
          present_days?: number
          run_id?: string
          tds?: number
          updated_at?: string
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
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
      purchase_order_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          hsn: string | null
          id: string
          item_id: string | null
          org_id: string
          po_id: string
          quantity: number
          rate: number
          received_quantity: number
          sort_order: number | null
          tax_rate: number | null
          unit: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          hsn?: string | null
          id?: string
          item_id?: string | null
          org_id: string
          po_id: string
          quantity?: number
          rate?: number
          received_quantity?: number
          sort_order?: number | null
          tax_rate?: number | null
          unit?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          hsn?: string | null
          id?: string
          item_id?: string | null
          org_id?: string
          po_id?: string
          quantity?: number
          rate?: number
          received_quantity?: number
          sort_order?: number | null
          tax_rate?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          branch_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          expected_date: string | null
          id: string
          notes: string | null
          org_id: string
          po_date: string
          po_number: string
          status: string
          subtotal: number
          tax_amount: number
          terms: string | null
          total: number
          updated_at: string
          vendor_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          org_id: string
          po_date?: string
          po_number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          total?: number
          updated_at?: string
          vendor_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          expected_date?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          po_date?: string
          po_number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          terms?: string | null
          total?: number
          updated_at?: string
          vendor_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      shifts: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          start_time: string
          updated_at: string
          working_days: number[]
        }
        Insert: {
          created_at?: string
          end_time?: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          start_time?: string
          updated_at?: string
          working_days?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          balance_after: number | null
          batch_no: string | null
          change_qty: number
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          item_id: string
          org_id: string
          reason: string
          ref_id: string | null
          ref_number: string | null
          ref_type: string | null
          serial_no: string | null
          unit_cost: number | null
          warehouse_id: string | null
        }
        Insert: {
          balance_after?: number | null
          batch_no?: string | null
          change_qty: number
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          item_id: string
          org_id: string
          reason: string
          ref_id?: string | null
          ref_number?: string | null
          ref_type?: string | null
          serial_no?: string | null
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Update: {
          balance_after?: number | null
          batch_no?: string | null
          change_qty?: number
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          item_id?: string
          org_id?: string
          reason?: string
          ref_id?: string | null
          ref_number?: string | null
          ref_type?: string | null
          serial_no?: string | null
          unit_cost?: number | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      tds_deductions: {
        Row: {
          base_amount: number
          created_at: string
          deduction_date: string
          id: string
          org_id: string
          rate: number
          section_id: string
          source_id: string
          source_type: string
          tds_amount: number
          vendor_id: string | null
        }
        Insert: {
          base_amount: number
          created_at?: string
          deduction_date?: string
          id?: string
          org_id: string
          rate: number
          section_id: string
          source_id: string
          source_type: string
          tds_amount: number
          vendor_id?: string | null
        }
        Update: {
          base_amount?: number
          created_at?: string
          deduction_date?: string
          id?: string
          org_id?: string
          rate?: number
          section_id?: string
          source_id?: string
          source_type?: string
          tds_amount?: number
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tds_deductions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tds_deductions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "tds_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tds_deductions_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      tds_sections: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          rate: number
          threshold: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          rate?: number
          threshold?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          rate?: number
          threshold?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tds_sections_org_id_fkey"
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
      vendors: {
        Row: {
          balance_due: number | null
          billing_address: Json | null
          created_at: string
          currency: string | null
          display_name: string | null
          email: string | null
          gstin: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          opening_balance: number | null
          org_id: string
          pan: string | null
          payment_terms: number | null
          phone: string | null
          shipping_address: Json | null
          tags: string[] | null
          tds_section_id: string | null
          updated_at: string
        }
        Insert: {
          balance_due?: number | null
          billing_address?: Json | null
          created_at?: string
          currency?: string | null
          display_name?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          opening_balance?: number | null
          org_id: string
          pan?: string | null
          payment_terms?: number | null
          phone?: string | null
          shipping_address?: Json | null
          tags?: string[] | null
          tds_section_id?: string | null
          updated_at?: string
        }
        Update: {
          balance_due?: number | null
          billing_address?: Json | null
          created_at?: string
          currency?: string | null
          display_name?: string | null
          email?: string | null
          gstin?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          opening_balance?: number | null
          org_id?: string
          pan?: string | null
          payment_terms?: number | null
          phone?: string | null
          shipping_address?: Json | null
          tags?: string[] | null
          tds_section_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendors_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendors_tds_section_fk"
            columns: ["tds_section_id"]
            isOneToOne: false
            referencedRelation: "tds_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: Json | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          bill_prefix: string | null
          created_at: string
          credit_note_next_number: number
          credit_note_prefix: string
          currency_code: string
          date_format: string
          dc_next_number: number | null
          dc_prefix: string | null
          default_notes: string | null
          default_terms: string | null
          email: string | null
          estimate_next_number: number
          estimate_prefix: string
          fiscal_year_start: number
          grn_next_number: number | null
          grn_prefix: string | null
          gst_enabled: boolean
          gst_number: string | null
          id: string
          inventory_enabled: boolean
          invoice_next_number: number
          invoice_prefix: string
          irp_gsp_provider: string | null
          irp_username: string | null
          logo_url: string | null
          low_stock_threshold: number
          multi_warehouse_enabled: boolean
          name: string
          next_bill_number: number | null
          payment_prefix: string
          payment_terms: number
          phone: string | null
          po_next_number: number | null
          po_prefix: string | null
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
      seed_default_accounting: {
        Args: { p_org_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "asset" | "liability" | "equity" | "income" | "expense"
      app_role: "owner" | "admin" | "staff" | "read_only"
      attendance_status:
        | "present"
        | "absent"
        | "half_day"
        | "paid_leave"
        | "holiday"
      bill_status: "draft" | "received" | "partial" | "paid" | "cancelled"
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
      leave_status: "pending" | "approved" | "rejected"
      leave_type: "casual" | "sick" | "paid" | "unpaid" | "other"
      payroll_status: "draft" | "approved" | "paid"
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
      account_type: ["asset", "liability", "equity", "income", "expense"],
      app_role: ["owner", "admin", "staff", "read_only"],
      attendance_status: [
        "present",
        "absent",
        "half_day",
        "paid_leave",
        "holiday",
      ],
      bill_status: ["draft", "received", "partial", "paid", "cancelled"],
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
      leave_status: ["pending", "approved", "rejected"],
      leave_type: ["casual", "sick", "paid", "unpaid", "other"],
      payroll_status: ["draft", "approved", "paid"],
      tax_type: ["simple", "compound"],
    },
  },
} as const
