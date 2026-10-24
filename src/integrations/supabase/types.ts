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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      banners: {
        Row: {
          button_link: string | null
          button_text: string | null
          created_at: string
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          mobile_image_url: string | null
          placement: string
          sort_order: number
          starts_at: string | null
          subtitle: string | null
          title: string | null
        }
        Insert: {
          button_link?: string | null
          button_text?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          mobile_image_url?: string | null
          placement?: string
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
        }
        Update: {
          button_link?: string | null
          button_text?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          mobile_image_url?: string | null
          placement?: string
          sort_order?: number
          starts_at?: string | null
          subtitle?: string | null
          title?: string | null
        }
        Relationships: []
      }
      business_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: string
          expense_date: string
          id: string
          notes: string
          payee: string
          payment_source: string
          receipt_reference: string
          request_fingerprint: string
          request_key: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          created_by: string
          expense_date: string
          id?: string
          notes?: string
          payee: string
          payment_source: string
          receipt_reference?: string
          request_fingerprint: string
          request_key: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: string
          expense_date?: string
          id?: string
          notes?: string
          payee?: string
          payment_source?: string
          receipt_reference?: string
          request_fingerprint?: string
          request_key?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          category_id: string | null
          code: string
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          min_order: number
          product_id: string | null
          starts_at: string | null
          type: string
          usage_limit: number | null
          used_count: number
          value: number
        }
        Insert: {
          category_id?: string | null
          code: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_order?: number
          product_id?: string | null
          starts_at?: string | null
          type?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Update: {
          category_id?: string | null
          code?: string
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          min_order?: number
          product_id?: string | null
          starts_at?: string | null
          type?: string
          usage_limit?: number | null
          used_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "coupons_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string
          id: string
          image_url: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          size: string | null
          unit_price: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          size?: string | null
          unit_price?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          size?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          checkout_key: string | null
          city: string | null
          country: string | null
          coupon_code: string | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_phone: string
          delivery_notes: string | null
          discount: number
          id: string
          order_number: string
          payment_method: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          postal_code: string | null
          request_fingerprint: string | null
          restocked_at: string | null
          shipping: number
          state: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          tracking_number: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address: string
          checkout_key?: string | null
          city?: string | null
          country?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_phone: string
          delivery_notes?: string | null
          discount?: number
          id?: string
          order_number?: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          postal_code?: string | null
          request_fingerprint?: string | null
          restocked_at?: string | null
          shipping?: number
          state?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string
          checkout_key?: string | null
          city?: string | null
          country?: string | null
          coupon_code?: string | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_notes?: string | null
          discount?: number
          id?: string
          order_number?: string
          payment_method?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          postal_code?: string | null
          request_fingerprint?: string | null
          restocked_at?: string | null
          shipping?: number
          state?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          tracking_number?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      pages: {
        Row: {
          content: string | null
          id: string
          image_url: string | null
          meta_description: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          id?: string
          image_url?: string | null
          meta_description?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          id?: string
          image_url?: string | null
          meta_description?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          bank_account_name: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_branch: string | null
          bank_enabled: boolean
          bank_instructions: string | null
          bank_name: string | null
          id: string
          qr_enabled: boolean
          qr_image_path: string | null
          qr_instructions: string | null
          qr_merchant_name: string | null
          qr_provider: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_enabled?: boolean
          bank_instructions?: string | null
          bank_name?: string | null
          id?: string
          qr_enabled?: boolean
          qr_image_path?: string | null
          qr_instructions?: string | null
          qr_merchant_name?: string | null
          qr_provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_enabled?: boolean
          bank_instructions?: string | null
          bank_name?: string | null
          id?: string
          qr_enabled?: boolean
          qr_image_path?: string | null
          qr_instructions?: string | null
          qr_merchant_name?: string | null
          qr_provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      payment_settings_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          snapshot: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          snapshot: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          snapshot?: Json
        }
        Relationships: []
      }
      pos_credit_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          customer_id: string
          id: string
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_credit_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "pos_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_credit_entries_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_customers: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          phone: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          name: string
          phone: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          phone?: string
        }
        Relationships: []
      }
      pos_repayments: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          created_by: string
          customer_id: string
          id: string
          payment_method: string
          request_fingerprint: string
          request_key: string
          voucher: Json
          voucher_number: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          created_by: string
          customer_id: string
          id?: string
          payment_method: string
          request_fingerprint: string
          request_key: string
          voucher: Json
          voucher_number: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          created_by?: string
          customer_id?: string
          id?: string
          payment_method?: string
          request_fingerprint?: string
          request_key?: string
          voucher?: Json
          voucher_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_repayments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "pos_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sale_items: {
        Row: {
          color: string | null
          discount: number
          id: string
          line_total: number
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          size: string | null
          sku: string | null
          unit_price: number
        }
        Insert: {
          color?: string | null
          discount: number
          id?: string
          line_total: number
          product_id: string
          product_name: string
          quantity: number
          sale_id: string
          size?: string | null
          sku?: string | null
          unit_price: number
        }
        Update: {
          color?: string | null
          discount?: number
          id?: string
          line_total?: number
          product_id?: string
          product_name?: string
          quantity?: number
          sale_id?: string
          size?: string | null
          sku?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "pos_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_sales: {
        Row: {
          cart_discount: number
          change_due: number
          created_at: string
          customer_id: string | null
          id: string
          item_discount: number
          operator_id: string
          payment_method: string
          receipt: Json
          receipt_number: string
          request_fingerprint: string
          request_key: string
          subtotal: number
          tax: number
          tax_rate: number
          tendered: number
          total: number
        }
        Insert: {
          cart_discount: number
          change_due?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          item_discount: number
          operator_id: string
          payment_method: string
          receipt: Json
          receipt_number: string
          request_fingerprint: string
          request_key: string
          subtotal: number
          tax: number
          tax_rate: number
          tendered?: number
          total: number
        }
        Update: {
          cart_discount?: number
          change_due?: number
          created_at?: string
          customer_id?: string | null
          id?: string
          item_discount?: number
          operator_id?: string
          payment_method?: string
          receipt?: Json
          receipt_number?: string
          request_fingerprint?: string
          request_key?: string
          subtotal?: number
          tax?: number
          tax_rate?: number
          tendered?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "pos_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string | null
          created_at: string
          id: string
          product_id: string
          size: string | null
          sku: string | null
          stock: number
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          product_id: string
          size?: string | null
          sku?: string | null
          stock?: number
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          product_id?: string
          size?: string | null
          sku?: string | null
          stock?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          colors: string[]
          created_at: string
          description: string | null
          fabric: string | null
          id: string
          images: string[]
          is_bestseller: boolean
          is_featured: boolean
          is_new: boolean
          is_published: boolean
          low_stock_threshold: number
          meta_description: string | null
          meta_title: string | null
          name: string
          price: number
          sale_price: number | null
          size_chart: string | null
          sizes: string[]
          sku: string | null
          slug: string
          stock: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          colors?: string[]
          created_at?: string
          description?: string | null
          fabric?: string | null
          id?: string
          images?: string[]
          is_bestseller?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_published?: boolean
          low_stock_threshold?: number
          meta_description?: string | null
          meta_title?: string | null
          name: string
          price?: number
          sale_price?: number | null
          size_chart?: string | null
          sizes?: string[]
          sku?: string | null
          slug: string
          stock?: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          colors?: string[]
          created_at?: string
          description?: string | null
          fabric?: string | null
          id?: string
          images?: string[]
          is_bestseller?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_published?: boolean
          low_stock_threshold?: number
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          price?: number
          sale_price?: number | null
          size_chart?: string | null
          sizes?: string[]
          sku?: string | null
          slug?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      purchase_bill_items: {
        Row: {
          bill_id: string
          description: string
          id: string
          line_total: number
          quantity: number
          sort_order: number
          unit_cost: number
        }
        Insert: {
          bill_id: string
          description: string
          id?: string
          line_total: number
          quantity: number
          sort_order: number
          unit_cost: number
        }
        Update: {
          bill_id?: string
          description?: string
          id?: string
          line_total?: number
          quantity?: number
          sort_order?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "purchase_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_bills: {
        Row: {
          bill_date: string
          bill_reference: string
          created_at: string
          created_by: string
          discount: number
          due_date: string | null
          id: string
          invoice_number: string
          notes: string
          request_fingerprint: string
          request_key: string
          subtotal: number
          tax: number
          tax_rate: number
          total: number
          vendor_id: string
          vendor_snapshot: Json
        }
        Insert: {
          bill_date: string
          bill_reference?: string
          created_at?: string
          created_by: string
          discount: number
          due_date?: string | null
          id?: string
          invoice_number: string
          notes?: string
          request_fingerprint: string
          request_key: string
          subtotal: number
          tax: number
          tax_rate: number
          total: number
          vendor_id: string
          vendor_snapshot: Json
        }
        Update: {
          bill_date?: string
          bill_reference?: string
          created_at?: string
          created_by?: string
          discount?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          notes?: string
          request_fingerprint?: string
          request_key?: string
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          vendor_id?: string
          vendor_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "purchase_bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payments: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          created_by: string
          id: string
          notes: string
          payment_date: string
          payment_source: string
          reference: string
          request_fingerprint: string
          request_key: string
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          created_by: string
          id?: string
          notes?: string
          payment_date: string
          payment_source: string
          reference?: string
          request_fingerprint: string
          request_key: string
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          created_by?: string
          id?: string
          notes?: string
          payment_date?: string
          payment_source?: string
          reference?: string
          request_fingerprint?: string
          request_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payments_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "purchase_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          body: string
          created_at: string
          id: string
          is_approved: boolean
          is_testimonial: boolean
          location: string | null
          product_id: string | null
          rating: number
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_testimonial?: boolean
          location?: string | null
          product_id?: string | null
          rating?: number
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          id?: string
          is_approved?: boolean
          is_testimonial?: boolean
          location?: string | null
          product_id?: string | null
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          address: string
          created_at: string
          created_by: string
          email: string
          id: string
          name: string
          notes: string
          phone: string
          updated_at: string
          updated_by: string
        }
        Insert: {
          address?: string
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          name: string
          notes?: string
          phone: string
          updated_at?: string
          updated_by?: string
        }
        Update: {
          address?: string
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          name?: string
          notes?: string
          phone?: string
          updated_at?: string
          updated_by?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_use_pos: { Args: never; Returns: boolean }
      complete_pos_sale: { Args: { p_request: Json }; Returns: string }
      get_business_day_summary: { Args: { p_date: string }; Returns: Json }
      get_khata_statement: { Args: { p_customer_id: string }; Returns: Json }
      get_pos_catalog: { Args: never; Returns: Json }
      get_pos_customer_balances: { Args: never; Returns: Json }
      get_pos_qr: { Args: never; Returns: Json }
      get_purchase_data: { Args: { p_bill_id?: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      place_order: {
        Args: {
          p_checkout_key: string
          p_coupon?: string
          p_customer: Json
          p_items: Json
          p_payment_method: string
        }
        Returns: Json
      }
      record_business_expense: { Args: { p_request: Json }; Returns: string }
      record_pos_repayment: { Args: { p_request: Json }; Returns: Json }
      record_purchase_bill: { Args: { p_request: Json }; Returns: string }
      record_purchase_payment: { Args: { p_request: Json }; Returns: string }
      restock_order: {
        Args: { p_items: Json; p_order_id: string }
        Returns: undefined
      }
      track_order: {
        Args: { p_contact: string; p_order_number: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "customer"
      order_status:
        | "pending"
        | "confirmed"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "returned"
      payment_status: "unpaid" | "paid" | "refunded"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "staff", "customer"],
      order_status: [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
      ],
      payment_status: ["unpaid", "paid", "refunded"],
    },
  },
} as const
