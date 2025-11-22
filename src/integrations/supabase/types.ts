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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      driver_sessions: {
        Row: {
          ended_at: string | null
          id: string
          is_active: boolean | null
          route_id: string | null
          started_at: string | null
          total_distance_km: number | null
          total_stops_completed: number | null
          user_id: string | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          route_id?: string | null
          started_at?: string | null
          total_distance_km?: number | null
          total_stops_completed?: number | null
          user_id?: string | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          is_active?: boolean | null
          route_id?: string | null
          started_at?: string | null
          total_distance_km?: number | null
          total_stops_completed?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_sessions_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers_live_location: {
        Row: {
          driver_id: string
          id: string
          lat: number
          lng: number
          updated_at: string
        }
        Insert: {
          driver_id: string
          id?: string
          lat: number
          lng: number
          updated_at?: string
        }
        Update: {
          driver_id?: string
          id?: string
          lat?: number
          lng?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_live_location_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          id: string
          is_resolved: boolean | null
          message: string | null
          predicted_date: string | null
          product_id: string | null
          resolved_at: string | null
          store_id: string | null
          urgency_score: number
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string | null
          predicted_date?: string | null
          product_id?: string | null
          resolved_at?: string | null
          store_id?: string | null
          urgency_score: number
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string | null
          predicted_date?: string | null
          product_id?: string | null
          resolved_at?: string | null
          store_id?: string | null
          urgency_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      location_events: {
        Row: {
          created_at: string | null
          distance_from_store_meters: number | null
          event_type: string
          id: string
          lat: number
          lng: number
          store_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          distance_from_store_meters?: number | null
          event_type: string
          id?: string
          lat: number
          lng: number
          store_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          distance_from_store_meters?: number | null
          event_type?: string
          id?: string
          lat?: number
          lng?: number
          store_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          suggested_retail_price: number | null
          type: string
          unit_type: string
          weight_per_unit: number | null
          wholesale_price: number | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          suggested_retail_price?: number | null
          type: string
          unit_type: string
          weight_per_unit?: number | null
          wholesale_price?: number | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          suggested_retail_price?: number | null
          type?: string
          unit_type?: string
          weight_per_unit?: number | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          preferred_language: string | null
          role: Database["public"]["Enums"]["app_role"]
          shirt_size: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id: string
          name: string
          phone?: string | null
          preferred_language?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          shirt_size?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          preferred_language?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          shirt_size?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      route_stops: {
        Row: {
          created_at: string | null
          id: string
          notes_to_worker: string | null
          planned_arrival_time: string | null
          planned_order: number
          route_id: string | null
          status: string | null
          store_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes_to_worker?: string | null
          planned_arrival_time?: string | null
          planned_order: number
          route_id?: string | null
          status?: string | null
          store_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes_to_worker?: string | null
          planned_arrival_time?: string | null
          planned_order?: number
          route_id?: string | null
          status?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          date: string
          estimated_distance_km: number | null
          estimated_duration_minutes: number | null
          estimated_profit: number | null
          id: string
          is_optimized: boolean | null
          optimization_score: number | null
          status: string | null
          territory: string | null
          type: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          date: string
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          estimated_profit?: number | null
          id?: string
          is_optimized?: boolean | null
          optimization_score?: number | null
          status?: string | null
          territory?: string | null
          type: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          date?: string
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          estimated_profit?: number | null
          id?: string
          is_optimized?: boolean | null
          optimization_score?: number | null
          status?: string | null
          territory?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_product_state: {
        Row: {
          average_sellthrough_days: number | null
          created_at: string | null
          id: string
          last_inventory_check_at: string | null
          last_inventory_level:
            | Database["public"]["Enums"]["inventory_level"]
            | null
          last_velocity_calculation: string | null
          next_estimated_reorder_date: string | null
          notes: string | null
          predicted_stockout_date: string | null
          product_id: string | null
          store_id: string | null
          updated_at: string | null
          urgency_score: number | null
          velocity_boxes_per_day: number | null
        }
        Insert: {
          average_sellthrough_days?: number | null
          created_at?: string | null
          id?: string
          last_inventory_check_at?: string | null
          last_inventory_level?:
            | Database["public"]["Enums"]["inventory_level"]
            | null
          last_velocity_calculation?: string | null
          next_estimated_reorder_date?: string | null
          notes?: string | null
          predicted_stockout_date?: string | null
          product_id?: string | null
          store_id?: string | null
          updated_at?: string | null
          urgency_score?: number | null
          velocity_boxes_per_day?: number | null
        }
        Update: {
          average_sellthrough_days?: number | null
          created_at?: string | null
          id?: string
          last_inventory_check_at?: string | null
          last_inventory_level?:
            | Database["public"]["Enums"]["inventory_level"]
            | null
          last_velocity_calculation?: string | null
          next_estimated_reorder_date?: string | null
          notes?: string | null
          predicted_stockout_date?: string | null
          product_id?: string | null
          store_id?: string | null
          updated_at?: string | null
          urgency_score?: number | null
          velocity_boxes_per_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_state_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_state_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          alt_phone: string | null
          created_at: string | null
          email: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          primary_contact_name: string | null
          responsiveness: Database["public"]["Enums"]["responsiveness"] | null
          status: Database["public"]["Enums"]["store_status"] | null
          sticker_status: Database["public"]["Enums"]["sticker_status"] | null
          tags: string[] | null
          type: Database["public"]["Enums"]["store_type"]
          updated_at: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          alt_phone?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          primary_contact_name?: string | null
          responsiveness?: Database["public"]["Enums"]["responsiveness"] | null
          status?: Database["public"]["Enums"]["store_status"] | null
          sticker_status?: Database["public"]["Enums"]["sticker_status"] | null
          tags?: string[] | null
          type: Database["public"]["Enums"]["store_type"]
          updated_at?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          alt_phone?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          primary_contact_name?: string | null
          responsiveness?: Database["public"]["Enums"]["responsiveness"] | null
          status?: Database["public"]["Enums"]["store_status"] | null
          sticker_status?: Database["public"]["Enums"]["sticker_status"] | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["store_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      visit_logs: {
        Row: {
          cash_collected: number | null
          created_at: string | null
          customer_response: string | null
          flags: string[] | null
          id: string
          inventory_levels: Json | null
          new_phone_number: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          photos: string[] | null
          products_delivered: Json | null
          sticker_status_update:
            | Database["public"]["Enums"]["sticker_status"]
            | null
          store_id: string | null
          user_id: string | null
          visit_datetime: string | null
          visit_type: Database["public"]["Enums"]["visit_type"]
        }
        Insert: {
          cash_collected?: number | null
          created_at?: string | null
          customer_response?: string | null
          flags?: string[] | null
          id?: string
          inventory_levels?: Json | null
          new_phone_number?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          photos?: string[] | null
          products_delivered?: Json | null
          sticker_status_update?:
            | Database["public"]["Enums"]["sticker_status"]
            | null
          store_id?: string | null
          user_id?: string | null
          visit_datetime?: string | null
          visit_type: Database["public"]["Enums"]["visit_type"]
        }
        Update: {
          cash_collected?: number | null
          created_at?: string | null
          customer_response?: string | null
          flags?: string[] | null
          id?: string
          inventory_levels?: Json | null
          new_phone_number?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          photos?: string[] | null
          products_delivered?: Json | null
          sticker_status_update?:
            | Database["public"]["Enums"]["sticker_status"]
            | null
          store_id?: string | null
          user_id?: string | null
          visit_datetime?: string | null
          visit_type?: Database["public"]["Enums"]["visit_type"]
        }
        Relationships: [
          {
            foreignKeyName: "visit_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_hubs: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          phone: string | null
          products_available: string[] | null
          rating: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          products_available?: string[] | null
          rating?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          products_available?: string[] | null
          rating?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role:
        | "admin"
        | "csr"
        | "driver"
        | "biker"
        | "ambassador"
        | "wholesaler"
        | "warehouse"
        | "accountant"
      inventory_level: "empty" | "quarter" | "half" | "threeQuarters" | "full"
      payment_method: "cash" | "zelle" | "cashapp" | "venmo" | "other"
      responsiveness: "call" | "text" | "both" | "none"
      sticker_status: "none" | "doorOnly" | "inStoreOnly" | "doorAndInStore"
      store_status: "active" | "inactive" | "prospect" | "needsFollowUp"
      store_type:
        | "bodega"
        | "smoke_shop"
        | "gas_station"
        | "wholesaler"
        | "other"
      visit_type: "delivery" | "inventoryCheck" | "coldLead" | "followUp"
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
      app_role: [
        "admin",
        "csr",
        "driver",
        "biker",
        "ambassador",
        "wholesaler",
        "warehouse",
        "accountant",
      ],
      inventory_level: ["empty", "quarter", "half", "threeQuarters", "full"],
      payment_method: ["cash", "zelle", "cashapp", "venmo", "other"],
      responsiveness: ["call", "text", "both", "none"],
      sticker_status: ["none", "doorOnly", "inStoreOnly", "doorAndInStore"],
      store_status: ["active", "inactive", "prospect", "needsFollowUp"],
      store_type: [
        "bodega",
        "smoke_shop",
        "gas_station",
        "wholesaler",
        "other",
      ],
      visit_type: ["delivery", "inventoryCheck", "coldLead", "followUp"],
    },
  },
} as const
