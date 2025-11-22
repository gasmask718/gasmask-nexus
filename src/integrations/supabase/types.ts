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
      acquisitions_pipeline: {
        Row: {
          actual_assignment_fee: number | null
          assigned_to: string | null
          buyer_contact: string | null
          buyer_name: string | null
          closing_date: string | null
          contract_signed_date: string | null
          created_at: string | null
          deal_notes: string | null
          expected_assignment_fee: number | null
          id: string
          lead_id: string | null
          offer_amount: number | null
          offer_sent_date: string | null
          status: Database["public"]["Enums"]["acquisition_status"] | null
          timeline: Json | null
          updated_at: string | null
        }
        Insert: {
          actual_assignment_fee?: number | null
          assigned_to?: string | null
          buyer_contact?: string | null
          buyer_name?: string | null
          closing_date?: string | null
          contract_signed_date?: string | null
          created_at?: string | null
          deal_notes?: string | null
          expected_assignment_fee?: number | null
          id?: string
          lead_id?: string | null
          offer_amount?: number | null
          offer_sent_date?: string | null
          status?: Database["public"]["Enums"]["acquisition_status"] | null
          timeline?: Json | null
          updated_at?: string | null
        }
        Update: {
          actual_assignment_fee?: number | null
          assigned_to?: string | null
          buyer_contact?: string | null
          buyer_name?: string | null
          closing_date?: string | null
          contract_signed_date?: string | null
          created_at?: string | null
          deal_notes?: string | null
          expected_assignment_fee?: number | null
          id?: string
          lead_id?: string | null
          offer_amount?: number | null
          offer_sent_date?: string | null
          status?: Database["public"]["Enums"]["acquisition_status"] | null
          timeline?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acquisitions_pipeline_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acquisitions_pipeline_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_communication_queue: {
        Row: {
          actioned_at: string | null
          actioned_by: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          reason: string
          status: string
          suggested_action: string
          urgency: number
        }
        Insert: {
          actioned_at?: string | null
          actioned_by?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          reason: string
          status?: string
          suggested_action: string
          urgency?: number
        }
        Update: {
          actioned_at?: string | null
          actioned_by?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          reason?: string
          status?: string
          suggested_action?: string
          urgency?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_communication_queue_actioned_by_fkey"
            columns: ["actioned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_comps: {
        Row: {
          arv: number | null
          as_is_value: number | null
          assignment_fee: number | null
          calculated_at: string | null
          comparable_properties: Json | null
          created_at: string | null
          id: string
          lead_id: string | null
          market_trends: Json | null
          offer_price: number | null
          profit_margin: number | null
          repair_cost: number | null
          resale_price: number | null
        }
        Insert: {
          arv?: number | null
          as_is_value?: number | null
          assignment_fee?: number | null
          calculated_at?: string | null
          comparable_properties?: Json | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          market_trends?: Json | null
          offer_price?: number | null
          profit_margin?: number | null
          repair_cost?: number | null
          resale_price?: number | null
        }
        Update: {
          arv?: number | null
          as_is_value?: number | null
          assignment_fee?: number | null
          calculated_at?: string | null
          comparable_properties?: Json | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          market_trends?: Json | null
          offer_price?: number | null
          profit_margin?: number | null
          repair_cost?: number | null
          resale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_comps_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_recommendations: {
        Row: {
          actioned_at: string | null
          actioned_by: string | null
          category: string
          confidence_score: number | null
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string | null
          id: string
          reasoning: string | null
          recommended_action: Json | null
          severity: string
          status: string
          title: string
        }
        Insert: {
          actioned_at?: string | null
          actioned_by?: string | null
          category: string
          confidence_score?: number | null
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          reasoning?: string | null
          recommended_action?: Json | null
          severity?: string
          status?: string
          title: string
        }
        Update: {
          actioned_at?: string | null
          actioned_by?: string | null
          category?: string
          confidence_score?: number | null
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          reasoning?: string | null
          recommended_action?: Json | null
          severity?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_recommendations_actioned_by_fkey"
            columns: ["actioned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_system_health: {
        Row: {
          communication_health_score: number | null
          drivers_health_avg: number | null
          id: string
          influencers_health_avg: number | null
          insights: Json | null
          inventory_health_score: number | null
          overall_health_score: number
          routes_efficiency_score: number | null
          snapshot_time: string
          stores_health_avg: number | null
          wholesalers_health_avg: number | null
        }
        Insert: {
          communication_health_score?: number | null
          drivers_health_avg?: number | null
          id?: string
          influencers_health_avg?: number | null
          insights?: Json | null
          inventory_health_score?: number | null
          overall_health_score: number
          routes_efficiency_score?: number | null
          snapshot_time?: string
          stores_health_avg?: number | null
          wholesalers_health_avg?: number | null
        }
        Update: {
          communication_health_score?: number | null
          drivers_health_avg?: number | null
          id?: string
          influencers_health_avg?: number | null
          insights?: Json | null
          inventory_health_score?: number | null
          overall_health_score?: number
          routes_efficiency_score?: number | null
          snapshot_time?: string
          stores_health_avg?: number | null
          wholesalers_health_avg?: number | null
        }
        Relationships: []
      }
      airbnb_candidates: {
        Row: {
          address: string
          bathrooms: number | null
          bedrooms: number | null
          city: string
          comparable_airbnbs: Json | null
          created_at: string | null
          daily_rate: number | null
          id: string
          investment_score: number | null
          monthly_revenue: number | null
          occupancy_rate: number | null
          seasonality_data: Json | null
          state: string
          yearly_revenue: number | null
          zip_code: string
        }
        Insert: {
          address: string
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          comparable_airbnbs?: Json | null
          created_at?: string | null
          daily_rate?: number | null
          id?: string
          investment_score?: number | null
          monthly_revenue?: number | null
          occupancy_rate?: number | null
          seasonality_data?: Json | null
          state: string
          yearly_revenue?: number | null
          zip_code: string
        }
        Update: {
          address?: string
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          comparable_airbnbs?: Json | null
          created_at?: string | null
          daily_rate?: number | null
          id?: string
          investment_score?: number | null
          monthly_revenue?: number | null
          occupancy_rate?: number | null
          seasonality_data?: Json | null
          state?: string
          yearly_revenue?: number | null
          zip_code?: string
        }
        Relationships: []
      }
      ambassador_commissions: {
        Row: {
          ambassador_id: string
          amount: number
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          notes: string | null
          order_id: string | null
          paid_at: string | null
          status: string
        }
        Insert: {
          ambassador_id: string
          amount: number
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string
        }
        Update: {
          ambassador_id?: string
          amount?: number
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_commissions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_links: {
        Row: {
          ambassador_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          ambassador_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          ambassador_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_links_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_regions: {
        Row: {
          active: boolean | null
          ambassador_id: string
          commission_rate: number | null
          created_at: string
          id: string
          region_id: string
          role: string | null
          stats: Json | null
        }
        Insert: {
          active?: boolean | null
          ambassador_id: string
          commission_rate?: number | null
          created_at?: string
          id?: string
          region_id: string
          role?: string | null
          stats?: Json | null
        }
        Update: {
          active?: boolean | null
          ambassador_id?: string
          commission_rate?: number | null
          created_at?: string
          id?: string
          region_id?: string
          role?: string | null
          stats?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_regions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_regions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassadors: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          tier: string
          total_earnings: number
          tracking_code: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          tier?: string
          total_earnings?: number
          tracking_code: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          tier?: string
          total_earnings?: number
          tracking_code?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassadors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_clients: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean | null
          last_used_at: string | null
          rate_limit: number | null
          role: Database["public"]["Enums"]["app_role"]
          scope: string[] | null
          secret_key: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          rate_limit?: number | null
          role: Database["public"]["Enums"]["app_role"]
          scope?: string[] | null
          secret_key: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          rate_limit?: number | null
          role?: Database["public"]["Enums"]["app_role"]
          scope?: string[] | null
          secret_key?: string
          user_id?: string | null
        }
        Relationships: []
      }
      assigned_closing_partner: {
        Row: {
          acquisition_id: string
          assigned_at: string
          assigned_by: string | null
          created_at: string
          id: string
          notes: string | null
          partner_id: string
          status: string
        }
        Insert: {
          acquisition_id: string
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_id: string
          status?: string
        }
        Update: {
          acquisition_id?: string
          assigned_at?: string
          assigned_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          partner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assigned_closing_partner_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisitions_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_closing_partner_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assigned_closing_partner_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "closing_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          role_type: Database["public"]["Enums"]["app_role"] | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          role_type?: Database["public"]["Enums"]["app_role"] | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          role_type?: Database["public"]["Enums"]["app_role"] | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automation_action_queue: {
        Row: {
          action_type: string
          ai_reasoning: string | null
          assigned_to: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          executed_at: string | null
          id: string
          priority: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          suggested_action: Json | null
        }
        Insert: {
          action_type: string
          ai_reasoning?: string | null
          assigned_to?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          executed_at?: string | null
          id?: string
          priority?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_action?: Json | null
        }
        Update: {
          action_type?: string
          ai_reasoning?: string | null
          assigned_to?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          executed_at?: string | null
          id?: string
          priority?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          suggested_action?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_action_queue_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_action_queue_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_communication_settings: {
        Row: {
          automation_type: string
          created_at: string
          frequency_limit: string | null
          id: string
          is_enabled: boolean
          message_template: string
          trigger_days: number | null
          updated_at: string
        }
        Insert: {
          automation_type: string
          created_at?: string
          frequency_limit?: string | null
          id?: string
          is_enabled?: boolean
          message_template: string
          trigger_days?: number | null
          updated_at?: string
        }
        Update: {
          automation_type?: string
          created_at?: string
          frequency_limit?: string | null
          id?: string
          is_enabled?: boolean
          message_template?: string
          trigger_days?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      automation_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          mode: string
          notes: string | null
          scope: string
          updated_at: string
          va_owner_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          mode?: string
          notes?: string | null
          scope: string
          updated_at?: string
          va_owner_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          mode?: string
          notes?: string | null
          scope?: string
          updated_at?: string
          va_owner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_settings_va_owner_id_fkey"
            columns: ["va_owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      call_logs: {
        Row: {
          ai_notes: string | null
          call_duration: number | null
          call_transcript: string | null
          called_at: string | null
          caller_id: string | null
          created_at: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          id: string
          lead_id: string | null
          outcome: string | null
          phone_number: string
          recording_url: string | null
          sentiment_analysis: Json | null
        }
        Insert: {
          ai_notes?: string | null
          call_duration?: number | null
          call_transcript?: string | null
          called_at?: string | null
          caller_id?: string | null
          created_at?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          lead_id?: string | null
          outcome?: string | null
          phone_number: string
          recording_url?: string | null
          sentiment_analysis?: Json | null
        }
        Update: {
          ai_notes?: string | null
          call_duration?: number | null
          call_transcript?: string | null
          called_at?: string | null
          caller_id?: string | null
          created_at?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          id?: string
          lead_id?: string | null
          outcome?: string | null
          phone_number?: string
          recording_url?: string | null
          sentiment_analysis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "call_logs_caller_id_fkey"
            columns: ["caller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      closing_partners: {
        Row: {
          address: string | null
          average_close_days: number | null
          city: string | null
          company_name: string
          contact_name: string | null
          created_at: string
          email: string | null
          fees_range: string | null
          id: string
          is_active: boolean
          notes: string | null
          partner_type: string
          phone: string | null
          rating: number | null
          state: string | null
          states_served: string[]
          wholesale_friendly: boolean
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          average_close_days?: number | null
          city?: string | null
          company_name: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          fees_range?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          partner_type: string
          phone?: string | null
          rating?: number | null
          state?: string | null
          states_served?: string[]
          wholesale_friendly?: boolean
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          average_close_days?: number | null
          city?: string | null
          company_name?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          fees_range?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          partner_type?: string
          phone?: string | null
          rating?: number | null
          state?: string | null
          states_served?: string[]
          wholesale_friendly?: boolean
          zip_code?: string | null
        }
        Relationships: []
      }
      communication_events: {
        Row: {
          channel: string | null
          created_at: string
          direction: string
          event_type: string
          external_contact: string | null
          id: string
          linked_entity_id: string | null
          linked_entity_type: string | null
          payload: Json | null
          store_id: string | null
          summary: string
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string
          direction: string
          event_type: string
          external_contact?: string | null
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          payload?: Json | null
          store_id?: string | null
          summary: string
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string
          direction?: string
          event_type?: string
          external_contact?: string | null
          id?: string
          linked_entity_id?: string | null
          linked_entity_type?: string | null
          payload?: Json | null
          store_id?: string | null
          summary?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_logs: {
        Row: {
          channel: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          direction: string
          driver_id: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          full_message: string | null
          id: string
          influencer_id: string | null
          outcome: string | null
          store_id: string | null
          summary: string
          wholesaler_id: string | null
        }
        Insert: {
          channel: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          direction: string
          driver_id?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          full_message?: string | null
          id?: string
          influencer_id?: string | null
          outcome?: string | null
          store_id?: string | null
          summary: string
          wholesaler_id?: string | null
        }
        Update: {
          channel?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: string
          driver_id?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          full_message?: string | null
          id?: string
          influencer_id?: string | null
          outcome?: string | null
          store_id?: string | null
          summary?: string
          wholesaler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesale_hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          category: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          message_template: string
          name: string
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          message_template: string
          name: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          message_template?: string
          name?: string
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          ai_keywords: string[] | null
          ai_last_summary: string | null
          ai_next_action: string | null
          ai_priority: number | null
          ai_sentiment: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          last_contact_date: string | null
          name: string
          notes: string | null
          organization: string | null
          phone: string | null
          relationship_score: number | null
          relationship_status: string
          tags: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          ai_keywords?: string[] | null
          ai_last_summary?: string | null
          ai_next_action?: string | null
          ai_priority?: number | null
          ai_sentiment?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          last_contact_date?: string | null
          name: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          relationship_score?: number | null
          relationship_status?: string
          tags?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          ai_keywords?: string[] | null
          ai_last_summary?: string | null
          ai_next_action?: string | null
          ai_priority?: number | null
          ai_sentiment?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          last_contact_date?: string | null
          name?: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          relationship_score?: number | null
          relationship_status?: string
          tags?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_customers: {
        Row: {
          address: string | null
          business_type: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          last_order_date: string | null
          name: string
          notes: string | null
          phone: string | null
          relationship_status: string | null
          state: string | null
          total_lifetime_value: number | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          business_type?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_order_date?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          relationship_status?: string | null
          state?: string | null
          total_lifetime_value?: number | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          business_type?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          last_order_date?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          relationship_status?: string | null
          state?: string | null
          total_lifetime_value?: number | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      customer_balance: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          last_invoice_date: string | null
          last_payment_date: string | null
          next_due_date: string | null
          outstanding_balance: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          last_invoice_date?: string | null
          last_payment_date?: string | null
          next_due_date?: string | null
          outstanding_balance?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          last_invoice_date?: string | null
          last_payment_date?: string | null
          next_due_date?: string | null
          outstanding_balance?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_balance_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_files: {
        Row: {
          created_at: string | null
          customer_id: string | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_files_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_invoices: {
        Row: {
          created_at: string | null
          customer_id: string | null
          due_date: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          pdf_url: string | null
          status: string | null
          subtotal: number | null
          tax: number | null
          total_amount: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          pdf_url?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          total_amount?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          pdf_url?: string | null
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_orders: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          items: Json | null
          notes: string | null
          order_date: string
          payment_method: string | null
          subtotal: number | null
          tax: number | null
          total: number | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          order_date?: string
          payment_method?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          items?: Json | null
          notes?: string | null
          order_date?: string
          payment_method?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          customer_id: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean | null
          last4: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          customer_id: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          customer_id?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payment_methods_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_portal_sessions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          last_accessed: string | null
          session_token: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          last_accessed?: string | null
          session_token: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          last_accessed?: string | null
          session_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_portal_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_receipts: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          payment_method: string | null
          pdf_url: string | null
          receipt_date: string | null
          receipt_number: string | null
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          receipt_date?: string | null
          receipt_number?: string | null
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          payment_method?: string | null
          pdf_url?: string | null
          receipt_date?: string | null
          receipt_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "crm_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "customer_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_missions: {
        Row: {
          created_at: string | null
          date: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      data_import_jobs: {
        Row: {
          ai_cleaning_summary: Json | null
          completed_at: string | null
          conflict_rules_applied: Json | null
          created_at: string
          file_id: string | null
          id: string
          rows_failed: number | null
          rows_inserted: number | null
          rows_total: number | null
          status: string
        }
        Insert: {
          ai_cleaning_summary?: Json | null
          completed_at?: string | null
          conflict_rules_applied?: Json | null
          created_at?: string
          file_id?: string | null
          id?: string
          rows_failed?: number | null
          rows_inserted?: number | null
          rows_total?: number | null
          status?: string
        }
        Update: {
          ai_cleaning_summary?: Json | null
          completed_at?: string | null
          conflict_rules_applied?: Json | null
          created_at?: string
          file_id?: string | null
          id?: string
          rows_failed?: number | null
          rows_inserted?: number | null
          rows_total?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_import_jobs_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      data_import_mapping: {
        Row: {
          destination_field: string
          file_id: string | null
          id: string
          required: boolean | null
          source_column: string
          type: string
          validation_rules: Json | null
        }
        Insert: {
          destination_field: string
          file_id?: string | null
          id?: string
          required?: boolean | null
          source_column: string
          type: string
          validation_rules?: Json | null
        }
        Update: {
          destination_field?: string
          file_id?: string | null
          id?: string
          required?: boolean | null
          source_column?: string
          type?: string
          validation_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "data_import_mapping_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "uploaded_files"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_closings: {
        Row: {
          acquisition_id: string | null
          assignment_fee: number
          buyer_entity: string | null
          buyer_name: string
          closing_costs: number | null
          closing_date: string
          closing_documents: Json | null
          commission_paid: number | null
          created_at: string | null
          id: string
          net_profit: number | null
          purchase_price: number
          title_company: string | null
          title_company_contact: string | null
          updated_at: string | null
          wire_received: boolean | null
          wire_sent: boolean | null
        }
        Insert: {
          acquisition_id?: string | null
          assignment_fee: number
          buyer_entity?: string | null
          buyer_name: string
          closing_costs?: number | null
          closing_date: string
          closing_documents?: Json | null
          commission_paid?: number | null
          created_at?: string | null
          id?: string
          net_profit?: number | null
          purchase_price: number
          title_company?: string | null
          title_company_contact?: string | null
          updated_at?: string | null
          wire_received?: boolean | null
          wire_sent?: boolean | null
        }
        Update: {
          acquisition_id?: string | null
          assignment_fee?: number
          buyer_entity?: string | null
          buyer_name?: string
          closing_costs?: number | null
          closing_date?: string
          closing_documents?: Json | null
          commission_paid?: number | null
          created_at?: string | null
          id?: string
          net_profit?: number | null
          purchase_price?: number
          title_company?: string | null
          title_company_contact?: string | null
          updated_at?: string | null
          wire_received?: boolean | null
          wire_sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_closings_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisitions_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      dedupe_suggestions: {
        Row: {
          created_at: string
          duplicate_id: string
          entity_id: string
          entity_type: string
          id: string
          merge_recommendation: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          similarity_score: number
          status: string | null
        }
        Insert: {
          created_at?: string
          duplicate_id: string
          entity_id: string
          entity_type: string
          id?: string
          merge_recommendation?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          similarity_score: number
          status?: string | null
        }
        Update: {
          created_at?: string
          duplicate_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          merge_recommendation?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          similarity_score?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dedupe_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_capacity_metrics: {
        Row: {
          biker_count: number
          city: string
          created_at: string
          current_load: number
          daily_capacity: number
          driver_count: number
          hiring_recommendation: string | null
          id: string
          state: string
          updated_at: string
          utilization_rate: number | null
        }
        Insert: {
          biker_count?: number
          city: string
          created_at?: string
          current_load?: number
          daily_capacity?: number
          driver_count?: number
          hiring_recommendation?: string | null
          id?: string
          state: string
          updated_at?: string
          utilization_rate?: number | null
        }
        Update: {
          biker_count?: number
          city?: string
          created_at?: string
          current_load?: number
          daily_capacity?: number
          driver_count?: number
          hiring_recommendation?: string | null
          id?: string
          state?: string
          updated_at?: string
          utilization_rate?: number | null
        }
        Relationships: []
      }
      delivery_manifest: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_date: string
          driver_id: string | null
          id: string
          manifest: Json
          notes: string | null
          status: string
          total_units: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_date: string
          driver_id?: string | null
          id?: string
          manifest?: Json
          notes?: string | null
          status?: string
          total_units?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          driver_id?: string | null
          id?: string
          manifest?: Json
          notes?: string | null
          status?: string
          total_units?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_manifest_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_manifest_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_payouts: {
        Row: {
          amount: number
          calculated_breakdown: Json | null
          created_at: string
          date: string
          driver_id: string
          id: string
          status: string
        }
        Insert: {
          amount: number
          calculated_breakdown?: Json | null
          created_at?: string
          date: string
          driver_id: string
          id?: string
          status?: string
        }
        Update: {
          amount?: number
          calculated_breakdown?: Json | null
          created_at?: string
          date?: string
          driver_id?: string
          id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payouts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_rewards: {
        Row: {
          calculated_tier: string
          created_at: string
          driver_id: string
          id: string
          last_updated: string
          total_xp: number
        }
        Insert: {
          calculated_tier?: string
          created_at?: string
          driver_id: string
          id?: string
          last_updated?: string
          total_xp?: number
        }
        Update: {
          calculated_tier?: string
          created_at?: string
          driver_id?: string
          id?: string
          last_updated?: string
          total_xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_rewards_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      driver_xp: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          source: string
          xp_amount: number
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          source: string
          xp_amount: number
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          source?: string
          xp_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_xp_driver_id_fkey"
            columns: ["driver_id"]
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
      esign_documents: {
        Row: {
          acquisition_id: string | null
          created_at: string
          document_type: string
          expires_at: string | null
          id: string
          lead_id: string
          pdf_url: string | null
          secure_token: string | null
          sent_at: string | null
          signed_at: string | null
          signed_url: string | null
          signer_email: string | null
          signer_ip: string | null
          signer_name: string
          signer_phone: string | null
          status: string
          viewed_at: string | null
        }
        Insert: {
          acquisition_id?: string | null
          created_at?: string
          document_type: string
          expires_at?: string | null
          id?: string
          lead_id: string
          pdf_url?: string | null
          secure_token?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_url?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name: string
          signer_phone?: string | null
          status?: string
          viewed_at?: string | null
        }
        Update: {
          acquisition_id?: string | null
          created_at?: string
          document_type?: string
          expires_at?: string | null
          id?: string
          lead_id?: string
          pdf_url?: string | null
          secure_token?: string | null
          sent_at?: string | null
          signed_at?: string | null
          signed_url?: string | null
          signer_email?: string | null
          signer_ip?: string | null
          signer_name?: string
          signer_phone?: string | null
          status?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "esign_documents_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisitions_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esign_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_report_logs: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          delivery_method: string
          id: string
          period: string
          recipient: string | null
          report_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          delivery_method: string
          id?: string
          period: string
          recipient?: string | null
          report_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          delivery_method?: string
          id?: string
          period?: string
          recipient?: string | null
          report_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "executive_report_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "executive_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      executive_reports: {
        Row: {
          data: Json
          delivered_channels: Json | null
          generated_at: string
          id: string
          is_read: boolean
          period: string
          report_date: string
        }
        Insert: {
          data: Json
          delivered_channels?: Json | null
          generated_at?: string
          id?: string
          is_read?: boolean
          period: string
          report_date: string
        }
        Update: {
          data?: Json
          delivered_channels?: Json | null
          generated_at?: string
          id?: string
          is_read?: boolean
          period?: string
          report_date?: string
        }
        Relationships: []
      }
      expansion_cities: {
        Row: {
          affordability_score: number | null
          ai_analysis: Json | null
          city: string
          created_at: string | null
          deployment_status: string | null
          expansion_priority: number | null
          id: string
          job_growth: number | null
          market_score: number | null
          median_home_price: number | null
          median_rent: number | null
          migration_trend: string | null
          population: number | null
          rent_strength: number | null
          state: string
          updated_at: string | null
        }
        Insert: {
          affordability_score?: number | null
          ai_analysis?: Json | null
          city: string
          created_at?: string | null
          deployment_status?: string | null
          expansion_priority?: number | null
          id?: string
          job_growth?: number | null
          market_score?: number | null
          median_home_price?: number | null
          median_rent?: number | null
          migration_trend?: string | null
          population?: number | null
          rent_strength?: number | null
          state: string
          updated_at?: string | null
        }
        Update: {
          affordability_score?: number | null
          ai_analysis?: Json | null
          city?: string
          created_at?: string | null
          deployment_status?: string | null
          expansion_priority?: number | null
          id?: string
          job_growth?: number | null
          market_score?: number | null
          median_home_price?: number | null
          median_rent?: number | null
          migration_trend?: string | null
          population?: number | null
          rent_strength?: number | null
          state?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      expansion_scores: {
        Row: {
          created_at: string
          driver_capacity_needed: number | null
          expected_roi: number | null
          id: string
          location_name: string
          location_type: string
          priority: number | null
          reasoning: string | null
          recommendations: Json | null
          score: number
          state: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          driver_capacity_needed?: number | null
          expected_roi?: number | null
          id?: string
          location_name: string
          location_type: string
          priority?: number | null
          reasoning?: string | null
          recommendations?: Json | null
          score: number
          state?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          driver_capacity_needed?: number | null
          expected_roi?: number | null
          id?: string
          location_name?: string
          location_type?: string
          priority?: number | null
          reasoning?: string | null
          recommendations?: Json | null
          score?: number
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      follow_up_logs: {
        Row: {
          channel: string
          created_at: string
          id: string
          lead_id: string
          message_sent: string | null
          next_action: string | null
          response_received: string | null
          sent_at: string
          sentiment: string | null
          sequence_id: string | null
          step_number: number
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          lead_id: string
          message_sent?: string | null
          next_action?: string | null
          response_received?: string | null
          sent_at?: string
          sentiment?: string | null
          sequence_id?: string | null
          step_number: number
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          lead_id?: string
          message_sent?: string | null
          next_action?: string | null
          response_received?: string | null
          sent_at?: string
          sentiment?: string | null
          sequence_id?: string | null
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_logs_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_sequences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          steps: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          steps?: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          steps?: Json
        }
        Relationships: []
      }
      followup_recommendations: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          priority_score: number
          reasoning: string | null
          recommended_action: string
          risk_level: string
          store_id: string
          suggested_date: string | null
          suggested_message: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          priority_score: number
          reasoning?: string | null
          recommended_action: string
          risk_level: string
          store_id: string
          suggested_date?: string | null
          suggested_message?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          priority_score?: number
          reasoning?: string | null
          recommended_action?: string
          risk_level?: string
          store_id?: string
          suggested_date?: string | null
          suggested_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followup_recommendations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_snapshots: {
        Row: {
          actual_revenue_total: number | null
          assumptions: Json | null
          created_at: string
          id: string
          period_end: string
          period_start: string
          period_type: string
          predicted_revenue_influencer: number
          predicted_revenue_stores: number
          predicted_revenue_total: number
          predicted_revenue_wholesale: number
        }
        Insert: {
          actual_revenue_total?: number | null
          assumptions?: Json | null
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          period_type: string
          predicted_revenue_influencer?: number
          predicted_revenue_stores?: number
          predicted_revenue_total?: number
          predicted_revenue_wholesale?: number
        }
        Update: {
          actual_revenue_total?: number | null
          assumptions?: Json | null
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          predicted_revenue_influencer?: number
          predicted_revenue_stores?: number
          predicted_revenue_total?: number
          predicted_revenue_wholesale?: number
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          created_at: string | null
          driver_id: string | null
          id: string
          message: string
          route_stop_id: string | null
          severity: string
          store_id: string | null
          timestamp: string
          type: string
        }
        Insert: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          message: string
          route_stop_id?: string | null
          severity: string
          store_id?: string | null
          timestamp?: string
          type: string
        }
        Update: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          message?: string
          route_stop_id?: string | null
          severity?: string
          store_id?: string | null
          timestamp?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_route_stop_id_fkey"
            columns: ["route_stop_id"]
            isOneToOne: false
            referencedRelation: "route_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fraud_flags_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_applicants: {
        Row: {
          ai_screening_score: number | null
          ai_screening_summary: string | null
          approved_at: string | null
          approved_by: string | null
          city: string | null
          created_at: string | null
          documents: Json | null
          email: string | null
          id: string
          interviewed_at: string | null
          interviewed_by: string | null
          name: string
          notes: string | null
          phone: string | null
          position: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          screened_at: string | null
          state: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_screening_score?: number | null
          ai_screening_summary?: string | null
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          created_at?: string | null
          documents?: Json | null
          email?: string | null
          id?: string
          interviewed_at?: string | null
          interviewed_by?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          screened_at?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_screening_score?: number | null
          ai_screening_summary?: string | null
          approved_at?: string | null
          approved_by?: string | null
          city?: string | null
          created_at?: string | null
          documents?: Json | null
          email?: string | null
          id?: string
          interviewed_at?: string | null
          interviewed_by?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          screened_at?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_applicants_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_applicants_interviewed_by_fkey"
            columns: ["interviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_applicants_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_contract_instances: {
        Row: {
          contract_id: string | null
          created_at: string | null
          generated_content: string
          id: string
          pdf_url: string | null
          signature_data: Json | null
          signed: boolean | null
          signed_at: string | null
          staff_id: string | null
        }
        Insert: {
          contract_id?: string | null
          created_at?: string | null
          generated_content: string
          id?: string
          pdf_url?: string | null
          signature_data?: Json | null
          signed?: boolean | null
          signed_at?: string | null
          staff_id?: string | null
        }
        Update: {
          contract_id?: string | null
          created_at?: string | null
          generated_content?: string
          id?: string
          pdf_url?: string | null
          signature_data?: Json | null
          signed?: boolean | null
          signed_at?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_contract_instances_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "hr_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_contract_instances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "hr_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_contracts: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          template_content: string
          template_name: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_content: string
          template_name: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          template_content?: string
          template_name?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      hr_documents: {
        Row: {
          applicant_id: string | null
          created_at: string | null
          document_name: string
          document_type: string
          document_url: string
          id: string
          notes: string | null
          staff_id: string | null
          updated_at: string | null
          uploaded_by: string | null
          verified: boolean | null
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          applicant_id?: string | null
          created_at?: string | null
          document_name: string
          document_type: string
          document_url: string
          id?: string
          notes?: string | null
          staff_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          applicant_id?: string | null
          created_at?: string | null
          document_name?: string
          document_type?: string
          document_url?: string
          id?: string
          notes?: string | null
          staff_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
          verified?: boolean | null
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_documents_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "hr_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_documents_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "hr_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employees: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          department: string | null
          email: string | null
          employment_type: string | null
          full_name: string
          id: string
          job_title: string
          phone: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employment_type?: string | null
          full_name: string
          id?: string
          job_title: string
          phone?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          employment_type?: string | null
          full_name?: string
          id?: string
          job_title?: string
          phone?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_employees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_interviews: {
        Row: {
          applicant_id: string | null
          created_at: string | null
          id: string
          interviewer_id: string | null
          notes: string | null
          result: string | null
          scheduled_for: string | null
        }
        Insert: {
          applicant_id?: string | null
          created_at?: string | null
          id?: string
          interviewer_id?: string | null
          notes?: string | null
          result?: string | null
          scheduled_for?: string | null
        }
        Update: {
          applicant_id?: string | null
          created_at?: string | null
          id?: string
          interviewer_id?: string | null
          notes?: string | null
          result?: string | null
          scheduled_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_interviews_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "hr_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_interviews_interviewer_id_fkey"
            columns: ["interviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_notifications: {
        Row: {
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          notification_type: string
          read: boolean | null
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          notification_type: string
          read?: boolean | null
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          notification_type?: string
          read?: boolean | null
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_onboarding_tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          due_date: string | null
          employee_id: string | null
          id: string
          status: string | null
          task: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          employee_id?: string | null
          id?: string
          status?: string | null
          task: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          due_date?: string | null
          employee_id?: string | null
          id?: string
          status?: string | null
          task?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_onboarding_tasks_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_payroll: {
        Row: {
          created_at: string | null
          employee_id: string | null
          id: string
          last_pay_date: string | null
          next_pay_date: string | null
          pay_rate: number | null
          pay_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_id?: string | null
          id?: string
          last_pay_date?: string | null
          next_pay_date?: string | null
          pay_rate?: number | null
          pay_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_id?: string | null
          id?: string
          last_pay_date?: string | null
          next_pay_date?: string | null
          pay_rate?: number | null
          pay_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_payroll_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_staff: {
        Row: {
          applicant_id: string | null
          city: string | null
          created_at: string | null
          hire_date: string | null
          id: string
          last_active_date: string | null
          notes: string | null
          performance_score: number | null
          position: string
          state: string | null
          status: string | null
          termination_date: string | null
          updated_at: string | null
          user_id: string | null
          xp_total: number | null
        }
        Insert: {
          applicant_id?: string | null
          city?: string | null
          created_at?: string | null
          hire_date?: string | null
          id?: string
          last_active_date?: string | null
          notes?: string | null
          performance_score?: number | null
          position: string
          state?: string | null
          status?: string | null
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string | null
          xp_total?: number | null
        }
        Update: {
          applicant_id?: string | null
          city?: string | null
          created_at?: string | null
          hire_date?: string | null
          id?: string
          last_active_date?: string | null
          notes?: string | null
          performance_score?: number | null
          position?: string
          state?: string | null
          status?: string | null
          termination_date?: string | null
          updated_at?: string | null
          user_id?: string | null
          xp_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_staff_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "hr_applicants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_staff_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_training_modules: {
        Row: {
          content: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          order_index: number | null
          passing_score: number | null
          quiz_questions: Json | null
          required_for_positions: string[] | null
          title: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          passing_score?: number | null
          quiz_questions?: Json | null
          required_for_positions?: string[] | null
          title: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          passing_score?: number | null
          quiz_questions?: Json | null
          required_for_positions?: string[] | null
          title?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      hr_training_progress: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          module_id: string | null
          quiz_answers: Json | null
          quiz_score: number | null
          staff_id: string | null
          started_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          module_id?: string | null
          quiz_answers?: Json | null
          quiz_score?: number | null
          staff_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          module_id?: string | null
          quiz_answers?: Json | null
          quiz_score?: number | null
          staff_id?: string | null
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_training_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "hr_training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_training_progress_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "hr_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_campaign_participants: {
        Row: {
          agreed_rate: number | null
          campaign_id: string
          created_at: string
          deliverables: Json | null
          id: string
          influencer_id: string
          performance_stats: Json | null
          role: string
          status: string
          tracking_link: string | null
        }
        Insert: {
          agreed_rate?: number | null
          campaign_id: string
          created_at?: string
          deliverables?: Json | null
          id?: string
          influencer_id: string
          performance_stats?: Json | null
          role: string
          status?: string
          tracking_link?: string | null
        }
        Update: {
          agreed_rate?: number | null
          campaign_id?: string
          created_at?: string
          deliverables?: Json | null
          id?: string
          influencer_id?: string
          performance_stats?: Json | null
          role?: string
          status?: string
          tracking_link?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_campaign_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "influencer_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_campaign_participants_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_campaigns: {
        Row: {
          budget: number | null
          created_at: string
          end_date: string | null
          expected_reach: number | null
          id: string
          name: string
          objective: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          created_at?: string
          end_date?: string | null
          expected_reach?: number | null
          id?: string
          name: string
          objective?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          created_at?: string
          end_date?: string | null
          expected_reach?: number | null
          id?: string
          name?: string
          objective?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      influencer_conversions: {
        Row: {
          campaign_id: string
          conversion_type: string
          created_at: string
          id: string
          occurred_at: string
          post_id: string | null
          store_id: string | null
          value: number | null
          wholesale_hub_id: string | null
        }
        Insert: {
          campaign_id: string
          conversion_type: string
          created_at?: string
          id?: string
          occurred_at?: string
          post_id?: string | null
          store_id?: string | null
          value?: number | null
          wholesale_hub_id?: string | null
        }
        Update: {
          campaign_id?: string
          conversion_type?: string
          created_at?: string
          id?: string
          occurred_at?: string
          post_id?: string | null
          store_id?: string | null
          value?: number | null
          wholesale_hub_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_conversions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "influencer_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_conversions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "influencer_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_conversions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "influencer_conversions_wholesale_hub_id_fkey"
            columns: ["wholesale_hub_id"]
            isOneToOne: false
            referencedRelation: "wholesale_hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      influencer_posts: {
        Row: {
          campaign_id: string
          caption: string | null
          created_at: string
          hashtags: Json | null
          id: string
          metrics: Json | null
          platform_post_id: string | null
          posted_at: string | null
          url: string | null
        }
        Insert: {
          campaign_id: string
          caption?: string | null
          created_at?: string
          hashtags?: Json | null
          id?: string
          metrics?: Json | null
          platform_post_id?: string | null
          posted_at?: string | null
          url?: string | null
        }
        Update: {
          campaign_id?: string
          caption?: string | null
          created_at?: string
          hashtags?: Json | null
          id?: string
          metrics?: Json | null
          platform_post_id?: string | null
          posted_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "influencer_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "influencer_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      influencers: {
        Row: {
          city: string | null
          created_at: string | null
          email: string | null
          engagement_rate: number
          followers: number
          id: string
          influencer_health_score: number | null
          name: string
          niche: string | null
          phone: string | null
          platform: string
          primary_region_id: string | null
          score: number | null
          status: string
          supported_regions: string[] | null
          updated_at: string | null
          username: string
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          email?: string | null
          engagement_rate?: number
          followers?: number
          id?: string
          influencer_health_score?: number | null
          name: string
          niche?: string | null
          phone?: string | null
          platform: string
          primary_region_id?: string | null
          score?: number | null
          status?: string
          supported_regions?: string[] | null
          updated_at?: string | null
          username: string
        }
        Update: {
          city?: string | null
          created_at?: string | null
          email?: string | null
          engagement_rate?: number
          followers?: number
          id?: string
          influencer_health_score?: number | null
          name?: string
          niche?: string | null
          phone?: string | null
          platform?: string
          primary_region_id?: string | null
          score?: number | null
          status?: string
          supported_regions?: string[] | null
          updated_at?: string | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencers_primary_region_id_fkey"
            columns: ["primary_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
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
      inventory_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
          product_id: string | null
          store_id: string | null
          units_changed: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          product_id?: string | null
          store_id?: string | null
          units_changed?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
          product_id?: string | null
          store_id?: string | null
          units_changed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_events_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_hubs: {
        Row: {
          created_at: string
          hub_id: string
          id: string
          last_restock_date: string | null
          max_stock: number | null
          product_id: string
          quantity_available: number
          quantity_reserved: number
          reorder_point: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hub_id: string
          id?: string
          last_restock_date?: string | null
          max_stock?: number | null
          product_id: string
          quantity_available?: number
          quantity_reserved?: number
          reorder_point?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hub_id?: string
          id?: string
          last_restock_date?: string | null
          max_stock?: number | null
          product_id?: string
          quantity_available?: number
          quantity_reserved?: number
          reorder_point?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_hubs_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "wholesale_hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_hubs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          from_id: string | null
          from_type: string | null
          id: string
          movement_type: string
          notes: string | null
          order_id: string | null
          product_id: string
          quantity: number
          to_id: string | null
          to_type: string | null
        }
        Insert: {
          created_at?: string
          from_id?: string | null
          from_type?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          order_id?: string | null
          product_id: string
          quantity: number
          to_id?: string | null
          to_type?: string | null
        }
        Update: {
          created_at?: string
          from_id?: string | null
          from_type?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string
          quantity?: number
          to_id?: string | null
          to_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_stores: {
        Row: {
          consumption_rate_per_day: number | null
          created_at: string
          estimated_units_remaining: number | null
          id: string
          inventory_level: string | null
          last_delivery_date: string | null
          last_order_date: string | null
          manual_override: boolean | null
          predicted_stockout_date: string | null
          product_id: string
          quantity_current: number
          quantity_sold_last_30_days: number | null
          reorder_point: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          consumption_rate_per_day?: number | null
          created_at?: string
          estimated_units_remaining?: number | null
          id?: string
          inventory_level?: string | null
          last_delivery_date?: string | null
          last_order_date?: string | null
          manual_override?: boolean | null
          predicted_stockout_date?: string | null
          product_id: string
          quantity_current?: number
          quantity_sold_last_30_days?: number | null
          reorder_point?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          consumption_rate_per_day?: number | null
          created_at?: string
          estimated_units_remaining?: number | null
          id?: string
          inventory_level?: string | null
          last_delivery_date?: string | null
          last_order_date?: string | null
          manual_override?: boolean | null
          predicted_stockout_date?: string | null
          product_id?: string
          quantity_current?: number
          quantity_sold_last_30_days?: number | null
          reorder_point?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stores_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_buy_boxes: {
        Row: {
          arv_criteria: Json | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          deal_criteria: Json | null
          id: string
          investor_name: string
          is_active: boolean | null
          max_price: number | null
          min_bathrooms: number | null
          min_bedrooms: number | null
          min_price: number | null
          preferred_property_types: string[] | null
          priority_level: number | null
          subscription_tier: string | null
          target_cities: string[] | null
          target_states: string[] | null
          target_zip_codes: string[] | null
          updated_at: string | null
        }
        Insert: {
          arv_criteria?: Json | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          deal_criteria?: Json | null
          id?: string
          investor_name: string
          is_active?: boolean | null
          max_price?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_price?: number | null
          preferred_property_types?: string[] | null
          priority_level?: number | null
          subscription_tier?: string | null
          target_cities?: string[] | null
          target_states?: string[] | null
          target_zip_codes?: string[] | null
          updated_at?: string | null
        }
        Update: {
          arv_criteria?: Json | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          deal_criteria?: Json | null
          id?: string
          investor_name?: string
          is_active?: boolean | null
          max_price?: number | null
          min_bathrooms?: number | null
          min_bedrooms?: number | null
          min_price?: number | null
          preferred_property_types?: string[] | null
          priority_level?: number | null
          subscription_tier?: string | null
          target_cities?: string[] | null
          target_states?: string[] | null
          target_zip_codes?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      investor_orders: {
        Row: {
          created_at: string | null
          id: string
          interested: boolean | null
          investor_id: string | null
          lead_id: string | null
          offer_amount: number | null
          response_notes: string | null
          sent_date: string | null
          status: string | null
          viewed: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          interested?: boolean | null
          investor_id?: string | null
          lead_id?: string | null
          offer_amount?: number | null
          response_notes?: string | null
          sent_date?: string | null
          status?: string | null
          viewed?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          interested?: boolean | null
          investor_id?: string | null
          lead_id?: string | null
          offer_amount?: number | null
          response_notes?: string | null
          sent_date?: string | null
          status?: string | null
          viewed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_orders_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_buy_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "investor_orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_subscriptions: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string | null
          id: string
          investor_id: string
          monthly_fee: number
          started_at: string
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          investor_id: string
          monthly_fee?: number
          started_at?: string
          stripe_subscription_id?: string | null
          tier: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          investor_id?: string
          monthly_fee?: number
          started_at?: string
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "investor_subscriptions_investor_id_fkey"
            columns: ["investor_id"]
            isOneToOne: false
            referencedRelation: "investor_buy_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          created_at: string
          due_date: string
          id: string
          invoice_number: string
          notes: string | null
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          store_id: string
          total_amount: number
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          due_date: string
          id?: string
          invoice_number: string
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          store_id: string
          total_amount: number
        }
        Update: {
          amount_paid?: number
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          store_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      land_bank: {
        Row: {
          acres: number | null
          address: string
          appreciation_model: Json | null
          city: string
          county: string | null
          created_at: string | null
          development_potential: string | null
          id: string
          is_opportunity: boolean | null
          long_term_value: number | null
          price: number | null
          price_per_acre: number | null
          state: string
          utilities_available: string[] | null
          zip_code: string
          zoning: string | null
        }
        Insert: {
          acres?: number | null
          address: string
          appreciation_model?: Json | null
          city: string
          county?: string | null
          created_at?: string | null
          development_potential?: string | null
          id?: string
          is_opportunity?: boolean | null
          long_term_value?: number | null
          price?: number | null
          price_per_acre?: number | null
          state: string
          utilities_available?: string[] | null
          zip_code: string
          zoning?: string | null
        }
        Update: {
          acres?: number | null
          address?: string
          appreciation_model?: Json | null
          city?: string
          county?: string | null
          created_at?: string | null
          development_potential?: string | null
          id?: string
          is_opportunity?: boolean | null
          long_term_value?: number | null
          price?: number | null
          price_per_acre?: number | null
          state?: string
          utilities_available?: string[] | null
          zip_code?: string
          zoning?: string | null
        }
        Relationships: []
      }
      lead_scores: {
        Row: {
          ai_reasoning: string | null
          assignment_potential: number | null
          created_at: string | null
          hedge_fund_appeal: number | null
          id: string
          lead_id: string | null
          motivation_score: number | null
          offer_likelihood: number | null
          overall_score: number | null
          scored_at: string | null
        }
        Insert: {
          ai_reasoning?: string | null
          assignment_potential?: number | null
          created_at?: string | null
          hedge_fund_appeal?: number | null
          id?: string
          lead_id?: string | null
          motivation_score?: number | null
          offer_likelihood?: number | null
          overall_score?: number | null
          scored_at?: string | null
        }
        Update: {
          ai_reasoning?: string | null
          assignment_potential?: number | null
          created_at?: string | null
          hedge_fund_appeal?: number | null
          id?: string
          lead_id?: string | null
          motivation_score?: number | null
          offer_likelihood?: number | null
          overall_score?: number | null
          scored_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_scores_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_raw: {
        Row: {
          address: string
          bathrooms: number | null
          bedrooms: number | null
          city: string
          county: string | null
          created_at: string | null
          distress_signals: Json | null
          equity: number | null
          estimated_value: number | null
          id: string
          last_sale_date: string | null
          last_sale_price: number | null
          lead_source: Database["public"]["Enums"]["lead_source"]
          lot_size: number | null
          mortgage_balance: number | null
          owner_email: string | null
          owner_name: string | null
          owner_phone: string | null
          property_type: Database["public"]["Enums"]["property_type"] | null
          scraped_at: string | null
          square_feet: number | null
          state: string
          year_built: number | null
          zip_code: string
        }
        Insert: {
          address: string
          bathrooms?: number | null
          bedrooms?: number | null
          city: string
          county?: string | null
          created_at?: string | null
          distress_signals?: Json | null
          equity?: number | null
          estimated_value?: number | null
          id?: string
          last_sale_date?: string | null
          last_sale_price?: number | null
          lead_source: Database["public"]["Enums"]["lead_source"]
          lot_size?: number | null
          mortgage_balance?: number | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          scraped_at?: string | null
          square_feet?: number | null
          state: string
          year_built?: number | null
          zip_code: string
        }
        Update: {
          address?: string
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string
          county?: string | null
          created_at?: string | null
          distress_signals?: Json | null
          equity?: number | null
          estimated_value?: number | null
          id?: string
          last_sale_date?: string | null
          last_sale_price?: number | null
          lead_source?: Database["public"]["Enums"]["lead_source"]
          lot_size?: number | null
          mortgage_balance?: number | null
          owner_email?: string | null
          owner_name?: string | null
          owner_phone?: string | null
          property_type?: Database["public"]["Enums"]["property_type"] | null
          scraped_at?: string | null
          square_feet?: number | null
          state?: string
          year_built?: number | null
          zip_code?: string
        }
        Relationships: []
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
      mass_offer_campaigns: {
        Row: {
          accepted_count: number
          campaign_name: string
          completed_at: string | null
          created_at: string
          id: string
          offer_formula: Json | null
          sent_count: number
          started_at: string | null
          status: string
          target_count: number
        }
        Insert: {
          accepted_count?: number
          campaign_name: string
          completed_at?: string | null
          created_at?: string
          id?: string
          offer_formula?: Json | null
          sent_count?: number
          started_at?: string | null
          status?: string
          target_count?: number
        }
        Update: {
          accepted_count?: number
          campaign_name?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          offer_formula?: Json | null
          sent_count?: number
          started_at?: string | null
          status?: string
          target_count?: number
        }
        Relationships: []
      }
      mission_assignments: {
        Row: {
          assigned_at: string
          completed_at: string | null
          due_at: string | null
          id: string
          mission_template_id: string
          progress_current: number
          progress_target: number
          status: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          completed_at?: string | null
          due_at?: string | null
          id?: string
          mission_template_id: string
          progress_current?: number
          progress_target?: number
          status?: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          completed_at?: string | null
          due_at?: string | null
          id?: string
          mission_template_id?: string
          progress_current?: number
          progress_target?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_assignments_mission_template_id_fkey"
            columns: ["mission_template_id"]
            isOneToOne: false
            referencedRelation: "mission_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_items: {
        Row: {
          category: string
          completed: boolean | null
          created_at: string | null
          hub_id: string | null
          id: string
          influencer_id: string | null
          mission_id: string
          priority: number
          reason: string | null
          store_id: string | null
        }
        Insert: {
          category: string
          completed?: boolean | null
          created_at?: string | null
          hub_id?: string | null
          id?: string
          influencer_id?: string | null
          mission_id: string
          priority?: number
          reason?: string | null
          store_id?: string | null
        }
        Update: {
          category?: string
          completed?: boolean | null
          created_at?: string | null
          hub_id?: string | null
          id?: string
          influencer_id?: string | null
          mission_id?: string
          priority?: number
          reason?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mission_items_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "wholesale_hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_items_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_items_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "daily_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_notifications: {
        Row: {
          badge_awarded: string | null
          created_at: string
          id: string
          message: string
          mission_id: string
          read: boolean
          title: string
          user_id: string
          xp_awarded: number
        }
        Insert: {
          badge_awarded?: string | null
          created_at?: string
          id?: string
          message: string
          mission_id: string
          read?: boolean
          title: string
          user_id: string
          xp_awarded?: number
        }
        Update: {
          badge_awarded?: string | null
          created_at?: string
          id?: string
          message?: string
          mission_id?: string
          read?: boolean
          title?: string
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "mission_notifications_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mission_templates: {
        Row: {
          cash_bonus: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          mission_type: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          target_count: number
          updated_at: string
          validity_days: number
          xp_reward: number
        }
        Insert: {
          cash_bonus?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          mission_type: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          target_count?: number
          updated_at?: string
          validity_days?: number
          xp_reward?: number
        }
        Update: {
          cash_bonus?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          mission_type?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          target_count?: number
          updated_at?: string
          validity_days?: number
          xp_reward?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_documents: {
        Row: {
          created_at: string | null
          document_type: string
          document_url: string | null
          e_signature_data: Json | null
          generated_by: string | null
          id: string
          lead_id: string | null
          sent_date: string | null
          signed: boolean | null
          signed_date: string | null
          terms: Json | null
          viewed: boolean | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          document_url?: string | null
          e_signature_data?: Json | null
          generated_by?: string | null
          id?: string
          lead_id?: string | null
          sent_date?: string | null
          signed?: boolean | null
          signed_date?: string | null
          terms?: Json | null
          viewed?: boolean | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          document_url?: string | null
          e_signature_data?: Json | null
          generated_by?: string | null
          id?: string
          lead_id?: string | null
          sent_date?: string | null
          signed?: boolean | null
          signed_date?: string | null
          terms?: Json | null
          viewed?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "offer_documents_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          assignment_fee: number
          bonuses: number | null
          closing_id: string | null
          commission: number | null
          created_at: string | null
          deal_id: string | null
          expenses: number | null
          id: string
          net_revenue: number | null
          paid_to: string | null
          payment_method: string | null
          payment_status: string | null
          payout_date: string | null
        }
        Insert: {
          assignment_fee: number
          bonuses?: number | null
          closing_id?: string | null
          commission?: number | null
          created_at?: string | null
          deal_id?: string | null
          expenses?: number | null
          id?: string
          net_revenue?: number | null
          paid_to?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payout_date?: string | null
        }
        Update: {
          assignment_fee?: number
          bonuses?: number | null
          closing_id?: string | null
          commission?: number | null
          created_at?: string | null
          deal_id?: string | null
          expenses?: number | null
          id?: string
          net_revenue?: number | null
          paid_to?: string | null
          payment_method?: string | null
          payment_status?: string | null
          payout_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payouts_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "deal_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "acquisitions_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payouts_paid_to_fkey"
            columns: ["paid_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string | null
          category: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          sku: string | null
          suggested_retail_price: number | null
          type: string
          unit_type: string
          units_per_box: number | null
          weight_per_unit: number | null
          wholesale_price: number | null
        }
        Insert: {
          brand_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sku?: string | null
          suggested_retail_price?: number | null
          type: string
          unit_type: string
          units_per_box?: number | null
          weight_per_unit?: number | null
          wholesale_price?: number | null
        }
        Update: {
          brand_id?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sku?: string | null
          suggested_retail_price?: number | null
          type?: string
          unit_type?: string
          units_per_box?: number | null
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
          driver_health_score: number | null
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
          driver_health_score?: number | null
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
          driver_health_score?: number | null
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
      real_estate_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          message: string
          notification_type: string
          priority: string
          read: boolean
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          message: string
          notification_type: string
          priority?: string
          read?: boolean
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          action_url?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          message?: string
          notification_type?: string
          priority?: string
          read?: boolean
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "real_estate_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      real_estate_team: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          performance_metrics: Json | null
          role: string
          specialization: string | null
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          performance_metrics?: Json | null
          role: string
          specialization?: string | null
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          performance_metrics?: Json | null
          role?: string
          specialization?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "real_estate_team_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      region_scorecards: {
        Row: {
          active_store_count: number | null
          avg_driver_health: number | null
          avg_store_health: number | null
          created_at: string
          id: string
          notes: string | null
          penetration_score: number | null
          potential_score: number | null
          priority_rank: number | null
          region_id: string
          route_efficiency_score: number | null
          snapshot_date: string
          store_count: number | null
          weekly_volume_estimated: number | null
        }
        Insert: {
          active_store_count?: number | null
          avg_driver_health?: number | null
          avg_store_health?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          penetration_score?: number | null
          potential_score?: number | null
          priority_rank?: number | null
          region_id: string
          route_efficiency_score?: number | null
          snapshot_date: string
          store_count?: number | null
          weekly_volume_estimated?: number | null
        }
        Update: {
          active_store_count?: number | null
          avg_driver_health?: number | null
          avg_store_health?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          penetration_score?: number | null
          potential_score?: number | null
          priority_rank?: number | null
          region_id?: string
          route_efficiency_score?: number | null
          snapshot_date?: string
          store_count?: number | null
          weekly_volume_estimated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "region_scorecards_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          city_cluster: string[] | null
          code: string | null
          country: string | null
          created_at: string
          id: string
          launch_date: string | null
          name: string
          notes: string | null
          primary_city: string | null
          state: string
          status: string
          target_monthly_volume: number | null
          target_store_count: number | null
          updated_at: string
        }
        Insert: {
          city_cluster?: string[] | null
          code?: string | null
          country?: string | null
          created_at?: string
          id?: string
          launch_date?: string | null
          name: string
          notes?: string | null
          primary_city?: string | null
          state: string
          status?: string
          target_monthly_volume?: number | null
          target_store_count?: number | null
          updated_at?: string
        }
        Update: {
          city_cluster?: string[] | null
          code?: string | null
          country?: string | null
          created_at?: string
          id?: string
          launch_date?: string | null
          name?: string
          notes?: string | null
          primary_city?: string | null
          state?: string
          status?: string
          target_monthly_volume?: number | null
          target_store_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          follow_up_date: string
          id: string
          influencer_id: string | null
          notes: string | null
          status: string
          store_id: string | null
          wholesaler_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          follow_up_date: string
          id?: string
          influencer_id?: string | null
          notes?: string | null
          status?: string
          store_id?: string | null
          wholesaler_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          follow_up_date?: string
          id?: string
          influencer_id?: string | null
          notes?: string | null
          status?: string
          store_id?: string | null
          wholesaler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_influencer_id_fkey"
            columns: ["influencer_id"]
            isOneToOne: false
            referencedRelation: "influencers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesale_hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      report_schedule_settings: {
        Row: {
          created_at: string | null
          daily_enabled: boolean | null
          daily_time: string | null
          id: string
          monthly_day: number | null
          monthly_enabled: boolean | null
          monthly_time: string | null
          recipient_emails: string[] | null
          updated_at: string | null
          weekly_day: string | null
          weekly_enabled: boolean | null
          weekly_time: string | null
        }
        Insert: {
          created_at?: string | null
          daily_enabled?: boolean | null
          daily_time?: string | null
          id?: string
          monthly_day?: number | null
          monthly_enabled?: boolean | null
          monthly_time?: string | null
          recipient_emails?: string[] | null
          updated_at?: string | null
          weekly_day?: string | null
          weekly_enabled?: boolean | null
          weekly_time?: string | null
        }
        Update: {
          created_at?: string | null
          daily_enabled?: boolean | null
          daily_time?: string | null
          id?: string
          monthly_day?: number | null
          monthly_enabled?: boolean | null
          monthly_time?: string | null
          recipient_emails?: string[] | null
          updated_at?: string | null
          weekly_day?: string | null
          weekly_enabled?: boolean | null
          weekly_time?: string | null
        }
        Relationships: []
      }
      risk_alerts: {
        Row: {
          alert_type: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_resolved: boolean | null
          message: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          alert_type: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_resolved?: boolean | null
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Update: {
          alert_type?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_checkins: {
        Row: {
          checkin_time: string
          completed: boolean | null
          created_at: string
          driver_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          photos: string[] | null
          route_id: string | null
          store_id: string | null
        }
        Insert: {
          checkin_time?: string
          completed?: boolean | null
          created_at?: string
          driver_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          photos?: string[] | null
          route_id?: string | null
          store_id?: string | null
        }
        Update: {
          checkin_time?: string
          completed?: boolean | null
          created_at?: string
          driver_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          photos?: string[] | null
          route_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_checkins_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_checkins_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes_generated"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_checkins_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      route_insights: {
        Row: {
          average_arrival_delay_minutes: number | null
          average_service_time_minutes: number | null
          best_time_window: string | null
          created_at: string
          id: string
          notes: string | null
          store_id: string
          updated_at: string
          visit_success_rate: number | null
        }
        Insert: {
          average_arrival_delay_minutes?: number | null
          average_service_time_minutes?: number | null
          best_time_window?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          store_id: string
          updated_at?: string
          visit_success_rate?: number | null
        }
        Update: {
          average_arrival_delay_minutes?: number | null
          average_service_time_minutes?: number | null
          best_time_window?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          store_id?: string
          updated_at?: string
          visit_success_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "route_insights_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      route_performance_snapshots: {
        Row: {
          avg_distance_km: number | null
          avg_route_duration_minutes: number | null
          completed_stops: number | null
          completion_rate: number | null
          coverage_score: number | null
          created_at: string
          date: string
          driver_id: string | null
          efficiency_score: number | null
          id: string
          late_checkins_count: number | null
          missed_stops_count: number | null
          notes: string | null
          total_routes: number | null
          total_stops: number | null
        }
        Insert: {
          avg_distance_km?: number | null
          avg_route_duration_minutes?: number | null
          completed_stops?: number | null
          completion_rate?: number | null
          coverage_score?: number | null
          created_at?: string
          date: string
          driver_id?: string | null
          efficiency_score?: number | null
          id?: string
          late_checkins_count?: number | null
          missed_stops_count?: number | null
          notes?: string | null
          total_routes?: number | null
          total_stops?: number | null
        }
        Update: {
          avg_distance_km?: number | null
          avg_route_duration_minutes?: number | null
          completed_stops?: number | null
          completion_rate?: number | null
          coverage_score?: number | null
          created_at?: string
          date?: string
          driver_id?: string | null
          efficiency_score?: number | null
          id?: string
          late_checkins_count?: number | null
          missed_stops_count?: number | null
          notes?: string | null
          total_routes?: number | null
          total_stops?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "route_performance_snapshots_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      routes_generated: {
        Row: {
          ai_confidence_score: number | null
          created_at: string
          date: string
          distance_km: number | null
          driver_id: string | null
          estimated_distance_km: number | null
          estimated_duration_minutes: number | null
          estimated_minutes: number | null
          id: string
          optimization_score: number | null
          status: string | null
          stops: Json
          updated_at: string
        }
        Insert: {
          ai_confidence_score?: number | null
          created_at?: string
          date: string
          distance_km?: number | null
          driver_id?: string | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          estimated_minutes?: number | null
          id?: string
          optimization_score?: number | null
          status?: string | null
          stops?: Json
          updated_at?: string
        }
        Update: {
          ai_confidence_score?: number | null
          created_at?: string
          date?: string
          distance_km?: number | null
          driver_id?: string | null
          estimated_distance_km?: number | null
          estimated_duration_minutes?: number | null
          estimated_minutes?: number | null
          id?: string
          optimization_score?: number | null
          status?: string | null
          stops?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_generated_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_prospects: {
        Row: {
          address: string | null
          ai_score: number | null
          assigned_to: string | null
          city: string | null
          contact_name: string | null
          converted_store_id: string | null
          created_at: string
          email: string | null
          id: string
          last_contacted: string | null
          likelihood_to_activate: number | null
          next_follow_up: string | null
          notes: string | null
          phone: string | null
          pipeline_stage: string
          priority: number | null
          source: string | null
          state: string | null
          store_name: string
          total_communications: number | null
          updated_at: string
          zipcode: string | null
        }
        Insert: {
          address?: string | null
          ai_score?: number | null
          assigned_to?: string | null
          city?: string | null
          contact_name?: string | null
          converted_store_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contacted?: string | null
          likelihood_to_activate?: number | null
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          priority?: number | null
          source?: string | null
          state?: string | null
          store_name: string
          total_communications?: number | null
          updated_at?: string
          zipcode?: string | null
        }
        Update: {
          address?: string | null
          ai_score?: number | null
          assigned_to?: string | null
          city?: string | null
          contact_name?: string | null
          converted_store_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          last_contacted?: string | null
          likelihood_to_activate?: number | null
          next_follow_up?: string | null
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          priority?: number | null
          source?: string | null
          state?: string | null
          store_name?: string
          total_communications?: number | null
          updated_at?: string
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_prospects_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_prospects_converted_store_id_fkey"
            columns: ["converted_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          notes: string | null
          prospect_id: string
          sales_user_id: string
          status: string
          task_type: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          notes?: string | null
          prospect_id: string
          sales_user_id: string
          status?: string
          task_type: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          notes?: string | null
          prospect_id?: string
          sales_user_id?: string
          status?: string
          task_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_tasks_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "sales_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tasks_sales_user_id_fkey"
            columns: ["sales_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          best_time_to_contact: string | null
          created_at: string | null
          demographics: Json | null
          distress_level: number | null
          email: string | null
          id: string
          lead_id: string | null
          motivation_score: number | null
          notes: string | null
          owner_name: string
          phone: string | null
          preferred_contact_method: string | null
          updated_at: string | null
          willingness_to_sell: number | null
        }
        Insert: {
          best_time_to_contact?: string | null
          created_at?: string | null
          demographics?: Json | null
          distress_level?: number | null
          email?: string | null
          id?: string
          lead_id?: string | null
          motivation_score?: number | null
          notes?: string | null
          owner_name: string
          phone?: string | null
          preferred_contact_method?: string | null
          updated_at?: string | null
          willingness_to_sell?: number | null
        }
        Update: {
          best_time_to_contact?: string | null
          created_at?: string | null
          demographics?: Json | null
          distress_level?: number | null
          email?: string | null
          id?: string
          lead_id?: string | null
          motivation_score?: number | null
          notes?: string | null
          owner_name?: string
          phone?: string | null
          preferred_contact_method?: string | null
          updated_at?: string | null
          willingness_to_sell?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "seller_profiles_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      store_credit_transactions: {
        Row: {
          amount: number
          created_at: string
          credit_account_id: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          transaction_type: string
        }
        Insert: {
          amount: number
          created_at?: string
          credit_account_id: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_type: string
        }
        Update: {
          amount?: number
          created_at?: string
          credit_account_id?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_credit_transactions_credit_account_id_fkey"
            columns: ["credit_account_id"]
            isOneToOne: false
            referencedRelation: "store_credits"
            referencedColumns: ["id"]
          },
        ]
      }
      store_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          store_id: string
          total_earned: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          store_id: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          store_id?: string
          total_earned?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_credits_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_items: {
        Row: {
          created_at: string
          discount_percent: number | null
          id: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_percent?: number | null
          id?: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_percent?: number | null
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      store_orders: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_fee: number
          driver_id: string | null
          estimated_delivery: string | null
          generated_by_ai: boolean | null
          hub_id: string | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_status: string
          status: string
          store_id: string
          subtotal: number
          tax: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          driver_id?: string | null
          estimated_delivery?: string | null
          generated_by_ai?: boolean | null
          hub_id?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_status?: string
          status?: string
          store_id: string
          subtotal?: number
          tax?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_fee?: number
          driver_id?: string | null
          estimated_delivery?: string | null
          generated_by_ai?: boolean | null
          hub_id?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_status?: string
          status?: string
          store_id?: string
          subtotal?: number
          tax?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "wholesale_hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_performance_snapshots: {
        Row: {
          ai_recommendation: string | null
          communication_score: number | null
          created_at: string
          daily_sales: number | null
          driver_visit_count: number | null
          id: string
          inventory_age_days: number | null
          monthly_sales: number | null
          performance_score: number | null
          restock_frequency: number | null
          risk_score: number | null
          sell_through_rate: number | null
          store_id: string
          weekly_sales: number | null
        }
        Insert: {
          ai_recommendation?: string | null
          communication_score?: number | null
          created_at?: string
          daily_sales?: number | null
          driver_visit_count?: number | null
          id?: string
          inventory_age_days?: number | null
          monthly_sales?: number | null
          performance_score?: number | null
          restock_frequency?: number | null
          risk_score?: number | null
          sell_through_rate?: number | null
          store_id: string
          weekly_sales?: number | null
        }
        Update: {
          ai_recommendation?: string | null
          communication_score?: number | null
          created_at?: string
          daily_sales?: number | null
          driver_visit_count?: number | null
          id?: string
          inventory_age_days?: number | null
          monthly_sales?: number | null
          performance_score?: number | null
          restock_frequency?: number | null
          risk_score?: number | null
          sell_through_rate?: number | null
          store_id?: string
          weekly_sales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_performance_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      store_rewards: {
        Row: {
          created_at: string
          id: string
          store_id: string
          tier: string
          total_points: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          tier?: string
          total_points?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          tier?: string
          total_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_rewards_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_subscriptions: {
        Row: {
          auto_renew: boolean
          created_at: string
          ends_at: string | null
          id: string
          payment_method: string | null
          plan_id: string
          started_at: string
          status: string
          store_id: string
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          payment_method?: string | null
          plan_id: string
          started_at?: string
          status?: string
          store_id: string
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          ends_at?: string | null
          id?: string
          payment_method?: string | null
          plan_id?: string
          started_at?: string
          status?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          id: string
          invoice_id: string | null
          notes: string | null
          order_id: string | null
          store_id: string
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          store_id: string
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          store_id?: string
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "store_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "store_wallet"
            referencedColumns: ["id"]
          },
        ]
      }
      store_wallet: {
        Row: {
          balance: number
          created_at: string
          credit_limit: number | null
          id: string
          payment_risk_score: number | null
          store_id: string
          total_paid: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          credit_limit?: number | null
          id?: string
          payment_risk_score?: number | null
          store_id: string
          total_paid?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          credit_limit?: number | null
          id?: string
          payment_risk_score?: number | null
          store_id?: string
          total_paid?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_wallet_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: true
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
          health_score: number | null
          id: string
          last_active_date: string | null
          last_performance_update: string | null
          last_visit_date: string | null
          last_visit_driver_id: string | null
          lat: number | null
          lng: number | null
          market_code: string | null
          name: string
          notes: string | null
          open_date: string | null
          performance_score: number | null
          performance_tier: string | null
          phone: string | null
          primary_contact_name: string | null
          region_id: string | null
          responsiveness: Database["public"]["Enums"]["responsiveness"] | null
          status: Database["public"]["Enums"]["store_status"] | null
          sticker_status: Database["public"]["Enums"]["sticker_status"] | null
          tags: string[] | null
          type: Database["public"]["Enums"]["store_type"]
          updated_at: string | null
          visit_frequency_target: number | null
          visit_risk_level: string | null
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
          health_score?: number | null
          id?: string
          last_active_date?: string | null
          last_performance_update?: string | null
          last_visit_date?: string | null
          last_visit_driver_id?: string | null
          lat?: number | null
          lng?: number | null
          market_code?: string | null
          name: string
          notes?: string | null
          open_date?: string | null
          performance_score?: number | null
          performance_tier?: string | null
          phone?: string | null
          primary_contact_name?: string | null
          region_id?: string | null
          responsiveness?: Database["public"]["Enums"]["responsiveness"] | null
          status?: Database["public"]["Enums"]["store_status"] | null
          sticker_status?: Database["public"]["Enums"]["sticker_status"] | null
          tags?: string[] | null
          type: Database["public"]["Enums"]["store_type"]
          updated_at?: string | null
          visit_frequency_target?: number | null
          visit_risk_level?: string | null
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
          health_score?: number | null
          id?: string
          last_active_date?: string | null
          last_performance_update?: string | null
          last_visit_date?: string | null
          last_visit_driver_id?: string | null
          lat?: number | null
          lng?: number | null
          market_code?: string | null
          name?: string
          notes?: string | null
          open_date?: string | null
          performance_score?: number | null
          performance_tier?: string | null
          phone?: string | null
          primary_contact_name?: string | null
          region_id?: string | null
          responsiveness?: Database["public"]["Enums"]["responsiveness"] | null
          status?: Database["public"]["Enums"]["store_status"] | null
          sticker_status?: Database["public"]["Enums"]["sticker_status"] | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["store_type"]
          updated_at?: string | null
          visit_frequency_target?: number | null
          visit_risk_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_last_visit_driver_id_fkey"
            columns: ["last_visit_driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          benefits: Json
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          tier: string
          updated_at: string
        }
        Insert: {
          benefits: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          tier: string
          updated_at?: string
        }
        Update: {
          benefits?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      supplier_compliance_scores: {
        Row: {
          complaint_count: number | null
          created_at: string
          defect_count: number | null
          id: string
          last_calculated: string
          on_time_delivery_rate: number | null
          order_accuracy_rate: number | null
          rating: string
          refund_count: number | null
          total_orders: number | null
          updated_at: string
          wholesaler_id: string
        }
        Insert: {
          complaint_count?: number | null
          created_at?: string
          defect_count?: number | null
          id?: string
          last_calculated?: string
          on_time_delivery_rate?: number | null
          order_accuracy_rate?: number | null
          rating?: string
          refund_count?: number | null
          total_orders?: number | null
          updated_at?: string
          wholesaler_id: string
        }
        Update: {
          complaint_count?: number | null
          created_at?: string
          defect_count?: number | null
          id?: string
          last_calculated?: string
          on_time_delivery_rate?: number | null
          order_accuracy_rate?: number | null
          rating?: string
          refund_count?: number | null
          total_orders?: number | null
          updated_at?: string
          wholesaler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_compliance_scores_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: true
            referencedRelation: "wholesale_hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_badges: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          name: string
          requirement_type: string | null
          requirement_value: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          requirement_type?: string | null
          requirement_value?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          requirement_type?: string | null
          requirement_value?: number | null
        }
        Relationships: []
      }
      training_completions: {
        Row: {
          completed_at: string | null
          id: string
          module_id: string
          score: number | null
          time_spent_minutes: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          module_id: string
          score?: number | null
          time_spent_minutes?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          module_id?: string
          score?: number | null
          time_spent_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_modules: {
        Row: {
          category: string
          content: string | null
          created_at: string | null
          description: string | null
          id: string
          is_required: boolean | null
          order_index: number | null
          required_for_role: Database["public"]["Enums"]["app_role"] | null
          title: string
          updated_at: string | null
          video_url: string | null
          xp_reward: number | null
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          order_index?: number | null
          required_for_role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          updated_at?: string | null
          video_url?: string | null
          xp_reward?: number | null
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_required?: boolean | null
          order_index?: number | null
          required_for_role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          updated_at?: string | null
          video_url?: string | null
          xp_reward?: number | null
        }
        Relationships: []
      }
      training_quizzes: {
        Row: {
          correct_answer: string
          created_at: string | null
          explanation: string | null
          id: string
          module_id: string
          options: Json
          question: string
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          module_id: string
          options: Json
          question: string
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          explanation?: string | null
          id?: string
          module_id?: string
          options?: Json
          question?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_quizzes_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "training_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_files: {
        Row: {
          created_at: string
          error_count: number | null
          errors: Json | null
          file_name: string
          file_type: string
          id: string
          preview_data: Json | null
          processed_count: number | null
          row_count: number | null
          status: string
          target_table: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          error_count?: number | null
          errors?: Json | null
          file_name: string
          file_type: string
          id?: string
          preview_data?: Json | null
          processed_count?: number | null
          row_count?: number | null
          status?: string
          target_table: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          error_count?: number | null
          errors?: Json | null
          file_name?: string
          file_type?: string
          id?: string
          preview_data?: Json | null
          processed_count?: number | null
          row_count?: number | null
          status?: string
          target_table?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "training_badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invite_token: string
          invited_by: string
          metadata: Json | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invite_token: string
          invited_by: string
          metadata?: Json | null
          phone?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_by?: string
          metadata?: Json | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          status: string
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          status?: string
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          payout_details: Json | null
          payout_method: string | null
          pending_balance: number
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          payout_details?: Json | null
          payout_method?: string | null
          pending_balance?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          payout_details?: Json | null
          payout_method?: string | null
          pending_balance?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses_listings: {
        Row: {
          address: string
          annual_rent: number | null
          cap_rate: number | null
          city: string
          created_at: string | null
          features: Json | null
          id: string
          investment_analysis: Json | null
          is_opportunity: boolean | null
          occupancy_rate: number | null
          price: number | null
          square_feet: number | null
          state: string
          zip_code: string
          zoning: string | null
        }
        Insert: {
          address: string
          annual_rent?: number | null
          cap_rate?: number | null
          city: string
          created_at?: string | null
          features?: Json | null
          id?: string
          investment_analysis?: Json | null
          is_opportunity?: boolean | null
          occupancy_rate?: number | null
          price?: number | null
          square_feet?: number | null
          state: string
          zip_code: string
          zoning?: string | null
        }
        Update: {
          address?: string
          annual_rent?: number | null
          cap_rate?: number | null
          city?: string
          created_at?: string | null
          features?: Json | null
          id?: string
          investment_analysis?: Json | null
          is_opportunity?: boolean | null
          occupancy_rate?: number | null
          price?: number | null
          square_feet?: number | null
          state?: string
          zip_code?: string
          zoning?: string | null
        }
        Relationships: []
      }
      wholesale_bids: {
        Row: {
          accepted_at: string | null
          created_at: string
          delivery_method: string
          estimated_delivery_hours: number
          id: string
          notes: string | null
          order_id: string
          price: number
          status: string
          wholesaler_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          delivery_method: string
          estimated_delivery_hours: number
          id?: string
          notes?: string | null
          order_id: string
          price: number
          status?: string
          wholesaler_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          delivery_method?: string
          estimated_delivery_hours?: number
          id?: string
          notes?: string | null
          order_id?: string
          price?: number
          status?: string
          wholesaler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_bids_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_bids_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesale_hubs"
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
          region_id: string | null
          status: string | null
          updated_at: string | null
          wholesaler_health_score: number | null
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
          region_id?: string | null
          status?: string | null
          updated_at?: string | null
          wholesaler_health_score?: number | null
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
          region_id?: string | null
          status?: string | null
          updated_at?: string | null
          wholesaler_health_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_hubs_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          quantity?: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "wholesale_products"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_orders: {
        Row: {
          commission_amount: number
          commission_percentage: number
          created_at: string
          delivered_at: string | null
          delivery_method: string
          driver_id: string | null
          id: string
          notes: string | null
          route_id: string | null
          status: string
          store_id: string
          subtotal: number
          total: number
          updated_at: string
          wholesaler_id: string
        }
        Insert: {
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          route_id?: string | null
          status?: string
          store_id: string
          subtotal?: number
          total?: number
          updated_at?: string
          wholesaler_id: string
        }
        Update: {
          commission_amount?: number
          commission_percentage?: number
          created_at?: string
          delivered_at?: string | null
          delivery_method?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          route_id?: string | null
          status?: string
          store_id?: string
          subtotal?: number
          total?: number
          updated_at?: string
          wholesaler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_orders_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_orders_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesale_hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesale_products: {
        Row: {
          brand_id: string | null
          case_size: number
          category: string
          created_at: string
          description: string | null
          eta_delivery_days: number
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price: number
          stock: number
          updated_at: string
          wholesaler_id: string
        }
        Insert: {
          brand_id?: string | null
          case_size?: number
          category: string
          created_at?: string
          description?: string | null
          eta_delivery_days?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price: number
          stock?: number
          updated_at?: string
          wholesaler_id: string
        }
        Update: {
          brand_id?: string | null
          case_size?: number
          category?: string
          created_at?: string
          description?: string | null
          eta_delivery_days?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price?: number
          stock?: number
          updated_at?: string
          wholesaler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_products_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesale_hubs"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_scores: {
        Row: {
          badges: Json | null
          created_at: string
          id: string
          last_activity_at: string | null
          level: number
          missions_completed: number
          role: Database["public"]["Enums"]["app_role"]
          stores_activated: number
          streak_days: number
          updated_at: string
          user_id: string
          wholesale_intros: number
          xp_total: number
        }
        Insert: {
          badges?: Json | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          level?: number
          missions_completed?: number
          role: Database["public"]["Enums"]["app_role"]
          stores_activated?: number
          streak_days?: number
          updated_at?: string
          user_id: string
          wholesale_intros?: number
          xp_total?: number
        }
        Update: {
          badges?: Json | null
          created_at?: string
          id?: string
          last_activity_at?: string | null
          level?: number
          missions_completed?: number
          role?: Database["public"]["Enums"]["app_role"]
          stores_activated?: number
          streak_days?: number
          updated_at?: string
          user_id?: string
          wholesale_intros?: number
          xp_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "worker_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      zip_density: {
        Row: {
          city: string | null
          density_score: number | null
          id: string
          last_updated: string
          population_estimate: number | null
          prospect_store_count: number | null
          region_id: string | null
          state: string | null
          store_count: number | null
          zip_code: string
        }
        Insert: {
          city?: string | null
          density_score?: number | null
          id?: string
          last_updated?: string
          population_estimate?: number | null
          prospect_store_count?: number | null
          region_id?: string | null
          state?: string | null
          store_count?: number | null
          zip_code: string
        }
        Update: {
          city?: string | null
          density_score?: number | null
          id?: string
          last_updated?: string
          population_estimate?: number | null
          prospect_store_count?: number | null
          region_id?: string | null
          state?: string | null
          store_count?: number | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "zip_density_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
        }
        Returns: string
      }
      update_relationship_status: { Args: never; Returns: undefined }
    }
    Enums: {
      acquisition_status:
        | "new"
        | "contacted"
        | "negotiating"
        | "offer_sent"
        | "signed"
        | "assigned"
        | "closed"
        | "dead"
      app_role:
        | "admin"
        | "csr"
        | "driver"
        | "biker"
        | "ambassador"
        | "wholesaler"
        | "warehouse"
        | "accountant"
        | "employee"
        | "store"
        | "wholesale"
        | "influencer"
        | "customer"
      inventory_level: "empty" | "quarter" | "half" | "threeQuarters" | "full"
      lead_source:
        | "probate"
        | "pre_foreclosure"
        | "tax_delinquent"
        | "code_violation"
        | "mls"
        | "expired_listing"
        | "fsbo"
        | "wholesale_network"
        | "zillow"
        | "redfin"
        | "direct_mail"
        | "cold_call"
      payment_method: "cash" | "zelle" | "cashapp" | "venmo" | "other"
      property_type:
        | "single_family"
        | "multi_family"
        | "condo"
        | "townhouse"
        | "land"
        | "commercial"
        | "warehouse"
        | "mixed_use"
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
      acquisition_status: [
        "new",
        "contacted",
        "negotiating",
        "offer_sent",
        "signed",
        "assigned",
        "closed",
        "dead",
      ],
      app_role: [
        "admin",
        "csr",
        "driver",
        "biker",
        "ambassador",
        "wholesaler",
        "warehouse",
        "accountant",
        "employee",
        "store",
        "wholesale",
        "influencer",
        "customer",
      ],
      inventory_level: ["empty", "quarter", "half", "threeQuarters", "full"],
      lead_source: [
        "probate",
        "pre_foreclosure",
        "tax_delinquent",
        "code_violation",
        "mls",
        "expired_listing",
        "fsbo",
        "wholesale_network",
        "zillow",
        "redfin",
        "direct_mail",
        "cold_call",
      ],
      payment_method: ["cash", "zelle", "cashapp", "venmo", "other"],
      property_type: [
        "single_family",
        "multi_family",
        "condo",
        "townhouse",
        "land",
        "commercial",
        "warehouse",
        "mixed_use",
      ],
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
