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
          name: string
          niche: string | null
          phone: string | null
          platform: string
          score: number | null
          status: string
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
          name: string
          niche?: string | null
          phone?: string | null
          platform: string
          score?: number | null
          status?: string
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
          name?: string
          niche?: string | null
          phone?: string | null
          platform?: string
          score?: number | null
          status?: string
          updated_at?: string | null
          username?: string
        }
        Relationships: []
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
