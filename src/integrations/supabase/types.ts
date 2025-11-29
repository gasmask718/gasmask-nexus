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
      advisor_action_log: {
        Row: {
          action_label: string
          action_type: string
          created_at: string
          id: string
          notes: string | null
          priority: number | null
          related_entity_id: string | null
          related_entity_type: string | null
          source_session_id: string | null
          status: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action_label: string
          action_type: string
          created_at?: string
          id?: string
          notes?: string | null
          priority?: number | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          source_session_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action_label?: string
          action_type?: string
          created_at?: string
          id?: string
          notes?: string | null
          priority?: number | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          source_session_id?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advisor_action_log_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "advisor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      advisor_scenarios: {
        Row: {
          ai_analysis: string | null
          ai_recommendations: string[] | null
          baseline_metrics: Json | null
          created_at: string
          id: string
          inputs: Json | null
          is_favorable: boolean | null
          projected_metrics: Json | null
          risk_rating: string | null
          scenario_name: string
          scenario_type: string
          user_id: string | null
        }
        Insert: {
          ai_analysis?: string | null
          ai_recommendations?: string[] | null
          baseline_metrics?: Json | null
          created_at?: string
          id?: string
          inputs?: Json | null
          is_favorable?: boolean | null
          projected_metrics?: Json | null
          risk_rating?: string | null
          scenario_name: string
          scenario_type: string
          user_id?: string | null
        }
        Update: {
          ai_analysis?: string | null
          ai_recommendations?: string[] | null
          baseline_metrics?: Json | null
          created_at?: string
          id?: string
          inputs?: Json | null
          is_favorable?: boolean | null
          projected_metrics?: Json | null
          risk_rating?: string | null
          scenario_name?: string
          scenario_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      advisor_sessions: {
        Row: {
          action_items: Json | null
          ai_recommendations: string[] | null
          ai_summary: string | null
          confidence_score: number | null
          context_sources: string[] | null
          created_at: string
          id: string
          input_prompt: string | null
          mode: string | null
          risk_level: string | null
          session_type: string
          time_window: string | null
          user_id: string | null
        }
        Insert: {
          action_items?: Json | null
          ai_recommendations?: string[] | null
          ai_summary?: string | null
          confidence_score?: number | null
          context_sources?: string[] | null
          created_at?: string
          id?: string
          input_prompt?: string | null
          mode?: string | null
          risk_level?: string | null
          session_type?: string
          time_window?: string | null
          user_id?: string | null
        }
        Update: {
          action_items?: Json | null
          ai_recommendations?: string[] | null
          ai_summary?: string | null
          confidence_score?: number | null
          context_sources?: string[] | null
          created_at?: string
          id?: string
          input_prompt?: string | null
          mode?: string | null
          risk_level?: string | null
          session_type?: string
          time_window?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      advisor_triggers: {
        Row: {
          auto_generated_task: boolean | null
          category: string
          condition_detected: string
          created_at: string
          details: Json | null
          id: string
          recommended_action: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string | null
          trigger_name: string
          trigger_type: string
        }
        Insert: {
          auto_generated_task?: boolean | null
          category: string
          condition_detected: string
          created_at?: string
          details?: Json | null
          id?: string
          recommended_action?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string | null
          trigger_name: string
          trigger_type: string
        }
        Update: {
          auto_generated_task?: boolean | null
          category?: string
          condition_detected?: string
          created_at?: string
          details?: Json | null
          id?: string
          recommended_action?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string | null
          trigger_name?: string
          trigger_type?: string
        }
        Relationships: []
      }
      ai_command_logs: {
        Row: {
          affected_entity_ids: string[] | null
          affected_entity_type: string | null
          created_at: string
          error_message: string | null
          executed_at: string | null
          id: string
          input_text: string
          parsed_intent: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          affected_entity_ids?: string[] | null
          affected_entity_type?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          input_text: string
          parsed_intent?: Json | null
          status?: string
          user_id?: string | null
        }
        Update: {
          affected_entity_ids?: string[] | null
          affected_entity_type?: string | null
          created_at?: string
          error_message?: string | null
          executed_at?: string | null
          id?: string
          input_text?: string
          parsed_intent?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_command_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      ai_daily_briefings: {
        Row: {
          ai_summary: string | null
          brand: string | null
          briefing_date: string
          briefing_type: string
          content: Json
          created_at: string
          id: string
        }
        Insert: {
          ai_summary?: string | null
          brand?: string | null
          briefing_date?: string
          briefing_type: string
          content: Json
          created_at?: string
          id?: string
        }
        Update: {
          ai_summary?: string | null
          brand?: string | null
          briefing_date?: string
          briefing_type?: string
          content?: Json
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      ai_follow_up_log: {
        Row: {
          action_category: string | null
          action_taken: string
          brand: string | null
          created_at: string
          created_by: string | null
          entity_id: string | null
          entity_type: string
          escalated: boolean | null
          escalation_level: number | null
          id: string
          message_sent: string | null
          metadata: Json | null
          next_follow_up_date: string | null
          region: string | null
          result: string | null
        }
        Insert: {
          action_category?: string | null
          action_taken: string
          brand?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type: string
          escalated?: boolean | null
          escalation_level?: number | null
          id?: string
          message_sent?: string | null
          metadata?: Json | null
          next_follow_up_date?: string | null
          region?: string | null
          result?: string | null
        }
        Update: {
          action_category?: string | null
          action_taken?: string
          brand?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string | null
          entity_type?: string
          escalated?: boolean | null
          escalation_level?: number | null
          id?: string
          message_sent?: string | null
          metadata?: Json | null
          next_follow_up_date?: string | null
          region?: string | null
          result?: string | null
        }
        Relationships: []
      }
      ai_follow_up_settings: {
        Row: {
          category: string
          created_at: string
          evening_enabled: boolean | null
          id: string
          is_enabled: boolean | null
          midday_enabled: boolean | null
          morning_enabled: boolean | null
          settings: Json
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          evening_enabled?: boolean | null
          id?: string
          is_enabled?: boolean | null
          midday_enabled?: boolean | null
          morning_enabled?: boolean | null
          settings?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          evening_enabled?: boolean | null
          id?: string
          is_enabled?: boolean | null
          midday_enabled?: boolean | null
          morning_enabled?: boolean | null
          settings?: Json
          updated_at?: string
        }
        Relationships: []
      }
      ai_kpi_snapshots: {
        Row: {
          active_stores: number | null
          brand: string | null
          created_at: string
          deliveries_today: number | null
          id: string
          inactive_stores: number | null
          low_stock_items: number | null
          region: string | null
          snapshot_date: string
          total_invoices: number | null
          total_revenue: number | null
          total_stores: number | null
          unpaid_invoices: number | null
        }
        Insert: {
          active_stores?: number | null
          brand?: string | null
          created_at?: string
          deliveries_today?: number | null
          id?: string
          inactive_stores?: number | null
          low_stock_items?: number | null
          region?: string | null
          snapshot_date?: string
          total_invoices?: number | null
          total_revenue?: number | null
          total_stores?: number | null
          unpaid_invoices?: number | null
        }
        Update: {
          active_stores?: number | null
          brand?: string | null
          created_at?: string
          deliveries_today?: number | null
          id?: string
          inactive_stores?: number | null
          low_stock_items?: number | null
          region?: string | null
          snapshot_date?: string
          total_invoices?: number | null
          total_revenue?: number | null
          total_stores?: number | null
          unpaid_invoices?: number | null
        }
        Relationships: []
      }
      ai_ops_log: {
        Row: {
          created_at: string
          cycle_type: string
          errors: Json | null
          id: string
          notes: string | null
          results: Json
          run_at: string
          success: boolean
        }
        Insert: {
          created_at?: string
          cycle_type: string
          errors?: Json | null
          id?: string
          notes?: string | null
          results?: Json
          run_at?: string
          success?: boolean
        }
        Update: {
          created_at?: string
          cycle_type?: string
          errors?: Json | null
          id?: string
          notes?: string | null
          results?: Json
          run_at?: string
          success?: boolean
        }
        Relationships: []
      }
      ai_playbooks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          steps: Json
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          steps?: Json
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          steps?: Json
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_playbooks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      ai_risk_insights: {
        Row: {
          brand: string | null
          created_at: string
          details: string | null
          entity_id: string | null
          entity_type: string
          expires_at: string | null
          headline: string
          id: string
          recommended_action: string | null
          region: string | null
          risk_level: string
          risk_score: number
          risk_type: string
          source_data: Json | null
          status: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_type: string
          expires_at?: string | null
          headline: string
          id?: string
          recommended_action?: string | null
          region?: string | null
          risk_level?: string
          risk_score?: number
          risk_type: string
          source_data?: Json | null
          status?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          details?: string | null
          entity_id?: string | null
          entity_type?: string
          expires_at?: string | null
          headline?: string
          id?: string
          recommended_action?: string | null
          region?: string | null
          risk_level?: string
          risk_score?: number
          risk_type?: string
          source_data?: Json | null
          status?: string
        }
        Relationships: []
      }
      ai_routine_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          playbook_id: string | null
          result: Json | null
          routine_id: string | null
          run_at: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          playbook_id?: string | null
          result?: Json | null
          routine_id?: string | null
          run_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          playbook_id?: string | null
          result?: Json | null
          routine_id?: string | null
          run_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_routine_logs_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "ai_playbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_routine_logs_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "ai_routines"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_routines: {
        Row: {
          active: boolean
          created_at: string
          frequency: string
          id: string
          next_run_at: string
          notify_user: boolean
          playbook_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          frequency?: string
          id?: string
          next_run_at?: string
          notify_user?: boolean
          playbook_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          frequency?: string
          id?: string
          next_run_at?: string
          notify_user?: boolean
          playbook_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_routines_playbook_id_fkey"
            columns: ["playbook_id"]
            isOneToOne: false
            referencedRelation: "ai_playbooks"
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
      ai_work_tasks: {
        Row: {
          assigned_to_worker_id: string | null
          auto_assigned: boolean | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          department: string | null
          error_message: string | null
          id: string
          input_data: Json | null
          output: Json | null
          parent_task_id: string | null
          priority: string
          started_at: string | null
          status: string
          tags: string[] | null
          task_details: string | null
          task_title: string
        }
        Insert: {
          assigned_to_worker_id?: string | null
          auto_assigned?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output?: Json | null
          parent_task_id?: string | null
          priority?: string
          started_at?: string | null
          status?: string
          tags?: string[] | null
          task_details?: string | null
          task_title: string
        }
        Update: {
          assigned_to_worker_id?: string | null
          auto_assigned?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          output?: Json | null
          parent_task_id?: string | null
          priority?: string
          started_at?: string | null
          status?: string
          tags?: string[] | null
          task_details?: string | null
          task_title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_work_tasks_assigned_to_worker_id_fkey"
            columns: ["assigned_to_worker_id"]
            isOneToOne: false
            referencedRelation: "ai_workers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_work_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "ai_work_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_workers: {
        Row: {
          created_at: string
          description: string | null
          experience_points: number | null
          id: string
          kpi_metrics: Json | null
          last_task_at: string | null
          memory: Json | null
          status: string
          tasks_completed: number | null
          tasks_failed: number | null
          worker_department: string
          worker_name: string
          worker_role: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          experience_points?: number | null
          id?: string
          kpi_metrics?: Json | null
          last_task_at?: string | null
          memory?: Json | null
          status?: string
          tasks_completed?: number | null
          tasks_failed?: number | null
          worker_department: string
          worker_name: string
          worker_role: string
        }
        Update: {
          created_at?: string
          description?: string | null
          experience_points?: number | null
          id?: string
          kpi_metrics?: Json | null
          last_task_at?: string | null
          memory?: Json | null
          status?: string
          tasks_completed?: number | null
          tasks_failed?: number | null
          worker_department?: string
          worker_name?: string
          worker_role?: string
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
      ambassador_assignments: {
        Row: {
          ambassador_id: string | null
          commission_rate: number | null
          company_id: string | null
          created_at: string | null
          id: string
          role_type: string | null
          wholesaler_id: string | null
        }
        Insert: {
          ambassador_id?: string | null
          commission_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          role_type?: string | null
          wholesaler_id?: string | null
        }
        Update: {
          ambassador_id?: string | null
          commission_rate?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          role_type?: string | null
          wholesaler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_assignments_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_assignments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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
      ambassador_profiles: {
        Row: {
          brand: string
          commission_rate: number | null
          country: string | null
          created_at: string | null
          id: string
          instagram_handle: string | null
          notes: string | null
          referral_code: string | null
          status: string
          tiktok_handle: string | null
          user_id: string
        }
        Insert: {
          brand?: string
          commission_rate?: number | null
          country?: string | null
          created_at?: string | null
          id?: string
          instagram_handle?: string | null
          notes?: string | null
          referral_code?: string | null
          status?: string
          tiktok_handle?: string | null
          user_id: string
        }
        Update: {
          brand?: string
          commission_rate?: number | null
          country?: string | null
          created_at?: string | null
          id?: string
          instagram_handle?: string | null
          notes?: string | null
          referral_code?: string | null
          status?: string
          tiktok_handle?: string | null
          user_id?: string
        }
        Relationships: []
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
      automation_logs: {
        Row: {
          action_type: string
          automation_rule_id: string | null
          brand: string | null
          business_id: string | null
          communication_log_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          error_message: string | null
          event_type: string
          id: string
          message_sent: string | null
          recipient_email: string | null
          recipient_phone: string | null
          status: string | null
        }
        Insert: {
          action_type: string
          automation_rule_id?: string | null
          brand?: string | null
          business_id?: string | null
          communication_log_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          message_sent?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          status?: string | null
        }
        Update: {
          action_type?: string
          automation_rule_id?: string | null
          brand?: string | null
          business_id?: string | null
          communication_log_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          message_sent?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_communication_log_id_fkey"
            columns: ["communication_log_id"]
            isOneToOne: false
            referencedRelation: "communication_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_type: string
          brand: string | null
          business_id: string | null
          conditions: Json | null
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          is_enabled: boolean | null
          metadata: Json | null
          template_message: string
          updated_at: string
        }
        Insert: {
          action_type?: string
          brand?: string | null
          business_id?: string | null
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          is_enabled?: boolean | null
          metadata?: Json | null
          template_message: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          brand?: string | null
          business_id?: string | null
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          is_enabled?: boolean | null
          metadata?: Json | null
          template_message?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
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
      autopilot_settings: {
        Row: {
          auto_assign_routes: boolean | null
          auto_create_tasks: boolean | null
          auto_financial_corrections: boolean | null
          auto_send_communications: boolean | null
          autopilot_enabled: boolean | null
          created_at: string
          id: string
          severity_threshold: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auto_assign_routes?: boolean | null
          auto_create_tasks?: boolean | null
          auto_financial_corrections?: boolean | null
          auto_send_communications?: boolean | null
          autopilot_enabled?: boolean | null
          created_at?: string
          id?: string
          severity_threshold?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auto_assign_routes?: boolean | null
          auto_create_tasks?: boolean | null
          auto_financial_corrections?: boolean | null
          auto_send_communications?: boolean | null
          autopilot_enabled?: boolean | null
          created_at?: string
          id?: string
          severity_threshold?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      batch_upload_history: {
        Row: {
          brands_detected: string[] | null
          created_at: string | null
          error_count: number | null
          file_name: string
          id: string
          rows_processed: number | null
          success_count: number | null
          va_id: string | null
        }
        Insert: {
          brands_detected?: string[] | null
          created_at?: string | null
          error_count?: number | null
          file_name: string
          id?: string
          rows_processed?: number | null
          success_count?: number | null
          va_id?: string | null
        }
        Update: {
          brands_detected?: string[] | null
          created_at?: string | null
          error_count?: number | null
          file_name?: string
          id?: string
          rows_processed?: number | null
          success_count?: number | null
          va_id?: string | null
        }
        Relationships: []
      }
      biker_profiles: {
        Row: {
          created_at: string | null
          default_city: string | null
          id: string
          notes: string | null
          primary_transport: string | null
          region: string | null
          status: string
          user_id: string
          zone: string | null
        }
        Insert: {
          created_at?: string | null
          default_city?: string | null
          id?: string
          notes?: string | null
          primary_transport?: string | null
          region?: string | null
          status?: string
          user_id: string
          zone?: string | null
        }
        Update: {
          created_at?: string | null
          default_city?: string | null
          id?: string
          notes?: string | null
          primary_transport?: string | null
          region?: string | null
          status?: string
          user_id?: string
          zone?: string | null
        }
        Relationships: []
      }
      biker_routes: {
        Row: {
          biker_name: string
          biker_phone: string | null
          completed: boolean | null
          created_at: string | null
          delivery_summary: string | null
          id: string
          route_date: string
          store_master_id: string | null
          updated_at: string | null
        }
        Insert: {
          biker_name: string
          biker_phone?: string | null
          completed?: boolean | null
          created_at?: string | null
          delivery_summary?: string | null
          id?: string
          route_date: string
          store_master_id?: string | null
          updated_at?: string | null
        }
        Update: {
          biker_name?: string
          biker_phone?: string | null
          completed?: boolean | null
          created_at?: string | null
          delivery_summary?: string | null
          id?: string
          route_date?: string
          store_master_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biker_routes_store_master_id_fkey"
            columns: ["store_master_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_crm_contacts: {
        Row: {
          brand: Database["public"]["Enums"]["brand_type"]
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string | null
          id: string
          last_contacted: string | null
          store_brand_account_id: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          brand: Database["public"]["Enums"]["brand_type"]
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          last_contacted?: string | null
          store_brand_account_id: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          brand?: Database["public"]["Enums"]["brand_type"]
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          last_contacted?: string | null
          store_brand_account_id?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_crm_contacts_store_brand_account_id_fkey"
            columns: ["store_brand_account_id"]
            isOneToOne: false
            referencedRelation: "store_brand_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_inventory_movements: {
        Row: {
          brand: Database["public"]["Enums"]["brand_type"]
          created_at: string | null
          id: string
          movement_type: string
          product_type: string
          quantity: number | null
          store_brand_account_id: string | null
        }
        Insert: {
          brand: Database["public"]["Enums"]["brand_type"]
          created_at?: string | null
          id?: string
          movement_type: string
          product_type: string
          quantity?: number | null
          store_brand_account_id?: string | null
        }
        Update: {
          brand?: Database["public"]["Enums"]["brand_type"]
          created_at?: string | null
          id?: string
          movement_type?: string
          product_type?: string
          quantity?: number | null
          store_brand_account_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_inventory_movements_store_brand_account_id_fkey"
            columns: ["store_brand_account_id"]
            isOneToOne: false
            referencedRelation: "store_brand_accounts"
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
      budget_profiles: {
        Row: {
          budget_period: string | null
          category_budgets: Json | null
          created_at: string
          end_date: string | null
          id: string
          is_active: boolean | null
          profile_name: string
          profile_type: string
          start_date: string
          total_budget: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          budget_period?: string | null
          category_budgets?: Json | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          profile_name: string
          profile_type: string
          start_date: string
          total_budget?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          budget_period?: string | null
          category_budgets?: Json | null
          created_at?: string
          end_date?: string | null
          id?: string
          is_active?: boolean | null
          profile_name?: string
          profile_type?: string
          start_date?: string
          total_budget?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      business_expenses: {
        Row: {
          amount: number
          approved_by: string | null
          brand: string | null
          category: string
          created_at: string
          department: string | null
          description: string | null
          expense_date: string
          id: string
          payment_method: string | null
          receipt_url: string | null
          recurring: boolean | null
          recurring_frequency: string | null
          tags: string[] | null
          vendor: string | null
        }
        Insert: {
          amount?: number
          approved_by?: string | null
          brand?: string | null
          category: string
          created_at?: string
          department?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          recurring?: boolean | null
          recurring_frequency?: string | null
          tags?: string[] | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          approved_by?: string | null
          brand?: string | null
          category?: string
          created_at?: string
          department?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          payment_method?: string | null
          receipt_url?: string | null
          recurring?: boolean | null
          recurring_frequency?: string | null
          tags?: string[] | null
          vendor?: string | null
        }
        Relationships: []
      }
      business_members: {
        Row: {
          business_id: string
          id: string
          invited_by: string | null
          joined_at: string | null
          permissions: Json | null
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          permissions?: Json | null
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          permissions?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_revenue_streams: {
        Row: {
          brand: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          growth_rate: number | null
          id: string
          is_active: boolean | null
          last_30_days: number | null
          monthly_average: number | null
          region: string | null
          stream_name: string
          stream_type: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          growth_rate?: number | null
          id?: string
          is_active?: boolean | null
          last_30_days?: number | null
          monthly_average?: number | null
          region?: string | null
          stream_name: string
          stream_type: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          growth_rate?: number | null
          id?: string
          is_active?: boolean | null
          last_30_days?: number | null
          monthly_average?: number | null
          region?: string | null
          stream_name?: string
          stream_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      business_transactions: {
        Row: {
          amount: number
          brand: string | null
          category: string
          created_at: string
          description: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          receipt_url: string | null
          region: string | null
          subcategory: string | null
          tags: string[] | null
          transaction_date: string
          transaction_type: string
          updated_at: string
        }
        Insert: {
          amount?: number
          brand?: string | null
          category: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          receipt_url?: string | null
          region?: string | null
          subcategory?: string | null
          tags?: string[] | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          brand?: string | null
          category?: string
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          receipt_url?: string | null
          region?: string | null
          subcategory?: string | null
          tags?: string[] | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      businesses: {
        Row: {
          address: string | null
          billing_email: string | null
          city: string | null
          created_at: string | null
          email: string | null
          id: string
          industry: string | null
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          slug: string
          state: string | null
          subscription_status: string | null
          subscription_tier: string | null
          theme_config: Json | null
          trial_ends_at: string | null
          updated_at: string | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          billing_email?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          slug: string
          state?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          theme_config?: Json | null
          trial_ends_at?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          billing_email?: string | null
          city?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          slug?: string
          state?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          theme_config?: Json | null
          trial_ends_at?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      call_center_ai_agents: {
        Row: {
          allowed_actions: Json | null
          business_name: string
          compliance_version: string | null
          created_at: string | null
          escalation_rules: Json | null
          greeting_message: string | null
          id: string
          is_active: boolean | null
          knowledge_base: Json | null
          name: string
          personality: string | null
          response_scripts: Json | null
          updated_at: string | null
          voice_selection: string | null
        }
        Insert: {
          allowed_actions?: Json | null
          business_name: string
          compliance_version?: string | null
          created_at?: string | null
          escalation_rules?: Json | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          knowledge_base?: Json | null
          name: string
          personality?: string | null
          response_scripts?: Json | null
          updated_at?: string | null
          voice_selection?: string | null
        }
        Update: {
          allowed_actions?: Json | null
          business_name?: string
          compliance_version?: string | null
          created_at?: string | null
          escalation_rules?: Json | null
          greeting_message?: string | null
          id?: string
          is_active?: boolean | null
          knowledge_base?: Json | null
          name?: string
          personality?: string | null
          response_scripts?: Json | null
          updated_at?: string | null
          voice_selection?: string | null
        }
        Relationships: []
      }
      call_center_alerts: {
        Row: {
          acknowledged: boolean | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          call_log_id: string | null
          created_at: string | null
          description: string | null
          id: string
          keywords_detected: string[] | null
          severity: string
        }
        Insert: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          call_log_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          keywords_detected?: string[] | null
          severity: string
        }
        Update: {
          acknowledged?: boolean | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          call_log_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          keywords_detected?: string[] | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_center_alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_center_alerts_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_center_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      call_center_analytics: {
        Row: {
          answered_calls: number | null
          avg_duration: number | null
          business_name: string
          conversion_rate: number | null
          created_at: string | null
          date: string
          id: string
          lead_quality_score: number | null
          metrics: Json | null
          missed_calls: number | null
          revenue_generated: number | null
          total_calls: number | null
        }
        Insert: {
          answered_calls?: number | null
          avg_duration?: number | null
          business_name: string
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          id?: string
          lead_quality_score?: number | null
          metrics?: Json | null
          missed_calls?: number | null
          revenue_generated?: number | null
          total_calls?: number | null
        }
        Update: {
          answered_calls?: number | null
          avg_duration?: number | null
          business_name?: string
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          id?: string
          lead_quality_score?: number | null
          metrics?: Json | null
          missed_calls?: number | null
          revenue_generated?: number | null
          total_calls?: number | null
        }
        Relationships: []
      }
      call_center_dialer_campaigns: {
        Row: {
          ai_agent_id: string | null
          appointments_set: number | null
          business_name: string
          call_script: string | null
          calls_connected: number | null
          calls_made: number | null
          created_at: string | null
          id: string
          name: string
          phone_number_id: string | null
          retry_logic: Json | null
          status: string | null
          target_list: Json | null
          updated_at: string | null
          voicemail_drop_url: string | null
        }
        Insert: {
          ai_agent_id?: string | null
          appointments_set?: number | null
          business_name: string
          call_script?: string | null
          calls_connected?: number | null
          calls_made?: number | null
          created_at?: string | null
          id?: string
          name: string
          phone_number_id?: string | null
          retry_logic?: Json | null
          status?: string | null
          target_list?: Json | null
          updated_at?: string | null
          voicemail_drop_url?: string | null
        }
        Update: {
          ai_agent_id?: string | null
          appointments_set?: number | null
          business_name?: string
          call_script?: string | null
          calls_connected?: number | null
          calls_made?: number | null
          created_at?: string | null
          id?: string
          name?: string
          phone_number_id?: string | null
          retry_logic?: Json | null
          status?: string | null
          target_list?: Json | null
          updated_at?: string | null
          voicemail_drop_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_center_dialer_campaigns_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "call_center_ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_center_dialer_campaigns_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "call_center_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      call_center_emails: {
        Row: {
          ai_handled: boolean | null
          body: string | null
          business_name: string
          category: string | null
          contact_id: string | null
          created_at: string | null
          direction: string
          from_address: string
          id: string
          priority: string | null
          subject: string | null
          to_address: string
        }
        Insert: {
          ai_handled?: boolean | null
          body?: string | null
          business_name: string
          category?: string | null
          contact_id?: string | null
          created_at?: string | null
          direction: string
          from_address: string
          id?: string
          priority?: string | null
          subject?: string | null
          to_address: string
        }
        Update: {
          ai_handled?: boolean | null
          body?: string | null
          business_name?: string
          category?: string | null
          contact_id?: string | null
          created_at?: string | null
          direction?: string
          from_address?: string
          id?: string
          priority?: string | null
          subject?: string | null
          to_address?: string
        }
        Relationships: []
      }
      call_center_logs: {
        Row: {
          ai_agent_id: string | null
          answered_by: string | null
          assigned_department: string | null
          business_name: string | null
          caller_id: string
          created_at: string | null
          direction: string
          duration: number | null
          emotion_detected: string | null
          id: string
          outcome: string | null
          phone_number_id: string | null
          recording_url: string | null
          sentiment_score: number | null
          summary: string | null
          tags: string[] | null
          transcript: string | null
        }
        Insert: {
          ai_agent_id?: string | null
          answered_by?: string | null
          assigned_department?: string | null
          business_name?: string | null
          caller_id: string
          created_at?: string | null
          direction: string
          duration?: number | null
          emotion_detected?: string | null
          id?: string
          outcome?: string | null
          phone_number_id?: string | null
          recording_url?: string | null
          sentiment_score?: number | null
          summary?: string | null
          tags?: string[] | null
          transcript?: string | null
        }
        Update: {
          ai_agent_id?: string | null
          answered_by?: string | null
          assigned_department?: string | null
          business_name?: string | null
          caller_id?: string
          created_at?: string | null
          direction?: string
          duration?: number | null
          emotion_detected?: string | null
          id?: string
          outcome?: string | null
          phone_number_id?: string | null
          recording_url?: string | null
          sentiment_score?: number | null
          summary?: string | null
          tags?: string[] | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_center_logs_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "call_center_ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_center_logs_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "call_center_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      call_center_messages: {
        Row: {
          ai_reply: boolean | null
          business_name: string | null
          contact_id: string | null
          created_at: string | null
          direction: string
          from_number: string
          id: string
          media_urls: string[] | null
          message_body: string | null
          phone_number_id: string | null
          status: string | null
          to_number: string
        }
        Insert: {
          ai_reply?: boolean | null
          business_name?: string | null
          contact_id?: string | null
          created_at?: string | null
          direction: string
          from_number: string
          id?: string
          media_urls?: string[] | null
          message_body?: string | null
          phone_number_id?: string | null
          status?: string | null
          to_number: string
        }
        Update: {
          ai_reply?: boolean | null
          business_name?: string | null
          contact_id?: string | null
          created_at?: string | null
          direction?: string
          from_number?: string
          id?: string
          media_urls?: string[] | null
          message_body?: string | null
          phone_number_id?: string | null
          status?: string | null
          to_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_center_messages_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: false
            referencedRelation: "call_center_phone_numbers"
            referencedColumns: ["id"]
          },
        ]
      }
      call_center_phone_numbers: {
        Row: {
          after_hours_forwarding: string | null
          business_name: string
          created_at: string | null
          default_ai_agent_id: string | null
          default_routing_rules: Json | null
          id: string
          is_active: boolean | null
          label: string
          phone_number: string
          type: string
          updated_at: string | null
          voicemail_greeting_url: string | null
        }
        Insert: {
          after_hours_forwarding?: string | null
          business_name: string
          created_at?: string | null
          default_ai_agent_id?: string | null
          default_routing_rules?: Json | null
          id?: string
          is_active?: boolean | null
          label: string
          phone_number: string
          type: string
          updated_at?: string | null
          voicemail_greeting_url?: string | null
        }
        Update: {
          after_hours_forwarding?: string | null
          business_name?: string
          created_at?: string | null
          default_ai_agent_id?: string | null
          default_routing_rules?: Json | null
          id?: string
          is_active?: boolean | null
          label?: string
          phone_number?: string
          type?: string
          updated_at?: string | null
          voicemail_greeting_url?: string | null
        }
        Relationships: []
      }
      call_center_recordings: {
        Row: {
          call_log_id: string | null
          created_at: string | null
          duration: number | null
          file_size: number | null
          id: string
          recording_url: string
          transcription_status: string | null
        }
        Insert: {
          call_log_id?: string | null
          created_at?: string | null
          duration?: number | null
          file_size?: number | null
          id?: string
          recording_url: string
          transcription_status?: string | null
        }
        Update: {
          call_log_id?: string | null
          created_at?: string | null
          duration?: number | null
          file_size?: number | null
          id?: string
          recording_url?: string
          transcription_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_center_recordings_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_center_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      call_center_routing_rules: {
        Row: {
          actions: Json
          business_name: string | null
          conditions: Json
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          updated_at: string | null
        }
        Insert: {
          actions?: Json
          business_name?: string | null
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          updated_at?: string | null
        }
        Update: {
          actions?: Json
          business_name?: string | null
          conditions?: Json
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      call_center_tasks: {
        Row: {
          assigned_to: string | null
          business_name: string | null
          call_log_id: string | null
          created_at: string | null
          created_by_ai: boolean | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          status: string | null
          task_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          business_name?: string | null
          call_log_id?: string | null
          created_at?: string | null
          created_by_ai?: boolean | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          task_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          business_name?: string | null
          call_log_id?: string | null
          created_at?: string | null
          created_by_ai?: boolean | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          task_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_center_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_center_tasks_call_log_id_fkey"
            columns: ["call_log_id"]
            isOneToOne: false
            referencedRelation: "call_center_logs"
            referencedColumns: ["id"]
          },
        ]
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
      campaign_messages: {
        Row: {
          campaign_id: string
          created_at: string | null
          delivered_at: string | null
          external_id: string | null
          id: string
          message_content: string
          recipient_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          delivered_at?: string | null
          external_id?: string | null
          id?: string
          message_content: string
          recipient_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          delivered_at?: string | null
          external_id?: string | null
          id?: string
          message_content?: string
          recipient_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string | null
          contact_name: string | null
          contact_value: string
          created_at: string | null
          delivered_at: string | null
          failed_reason: string | null
          id: string
          metadata: Json | null
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          contact_name?: string | null
          contact_value: string
          created_at?: string | null
          delivered_at?: string | null
          failed_reason?: string | null
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          contact_name?: string | null
          contact_value?: string
          created_at?: string | null
          delivered_at?: string | null
          failed_reason?: string | null
          id?: string
          metadata?: Json | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_stats: {
        Row: {
          campaign_id: string
          id: string
          metadata: Json | null
          metric_name: string
          metric_value: number
          recorded_at: string | null
        }
        Insert: {
          campaign_id: string
          id?: string
          metadata?: Json | null
          metric_name: string
          metric_value?: number
          recorded_at?: string | null
        }
        Update: {
          campaign_id?: string
          id?: string
          metadata?: Json | null
          metric_name?: string
          metric_value?: number
          recorded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          business_id: string
          channel: string
          click_count: number | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          delivered_count: number | null
          failed_count: number | null
          id: string
          message_template: string | null
          name: string
          open_count: number | null
          reply_count: number | null
          scheduled_at: string | null
          sent_count: number | null
          settings: Json | null
          status: string
          subject: string | null
          total_recipients: number | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          channel: string
          click_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          message_template?: string | null
          name: string
          open_count?: number | null
          reply_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          settings?: Json | null
          status?: string
          subject?: string | null
          total_recipients?: number | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          channel?: string
          click_count?: number | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          delivered_count?: number | null
          failed_count?: number | null
          id?: string
          message_template?: string | null
          name?: string
          open_count?: number | null
          reply_count?: number | null
          scheduled_at?: string | null
          sent_count?: number | null
          settings?: Json | null
          status?: string
          subject?: string | null
          total_recipients?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ceo_actions: {
        Row: {
          action_type: string
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          related_brand: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          status: string | null
          title: string
        }
        Insert: {
          action_type: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          related_brand?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string | null
          title: string
        }
        Update: {
          action_type?: string
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          related_brand?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      ceo_decisions: {
        Row: {
          actual_impact: Json | null
          confidence_score: number | null
          created_at: string | null
          decision: string
          decision_type: string
          entity_id: string | null
          entity_type: string
          expected_impact: Json | null
          id: string
          implemented_at: string | null
          reasoning: string | null
          status: string | null
        }
        Insert: {
          actual_impact?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          decision: string
          decision_type: string
          entity_id?: string | null
          entity_type: string
          expected_impact?: Json | null
          id?: string
          implemented_at?: string | null
          reasoning?: string | null
          status?: string | null
        }
        Update: {
          actual_impact?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          decision?: string
          decision_type?: string
          entity_id?: string | null
          entity_type?: string
          expected_impact?: Json | null
          id?: string
          implemented_at?: string | null
          reasoning?: string | null
          status?: string | null
        }
        Relationships: []
      }
      ceo_forecasts: {
        Row: {
          ai_reasoning: string | null
          confidence_score: number | null
          created_at: string | null
          data_sources: Json | null
          forecast_date: string
          forecast_type: string
          id: string
          predictions: Json | null
          timeframe: string
        }
        Insert: {
          ai_reasoning?: string | null
          confidence_score?: number | null
          created_at?: string | null
          data_sources?: Json | null
          forecast_date?: string
          forecast_type: string
          id?: string
          predictions?: Json | null
          timeframe: string
        }
        Update: {
          ai_reasoning?: string | null
          confidence_score?: number | null
          created_at?: string | null
          data_sources?: Json | null
          forecast_date?: string
          forecast_type?: string
          id?: string
          predictions?: Json | null
          timeframe?: string
        }
        Relationships: []
      }
      ceo_learning_logs: {
        Row: {
          applied_at: string | null
          created_at: string | null
          data_source: string
          id: string
          insights: Json | null
          learning_type: string
          performance_improvement: number | null
          strategy_adjustments: Json | null
        }
        Insert: {
          applied_at?: string | null
          created_at?: string | null
          data_source: string
          id?: string
          insights?: Json | null
          learning_type: string
          performance_improvement?: number | null
          strategy_adjustments?: Json | null
        }
        Update: {
          applied_at?: string | null
          created_at?: string | null
          data_source?: string
          id?: string
          insights?: Json | null
          learning_type?: string
          performance_improvement?: number | null
          strategy_adjustments?: Json | null
        }
        Relationships: []
      }
      ceo_reports: {
        Row: {
          ai_confidence_score: number | null
          bottlenecks: Json | null
          cashflow_forecast: Json | null
          created_at: string | null
          created_by: string | null
          id: string
          kpi_summary: Json | null
          pipeline_status: Json | null
          priority_plan: Json | null
          recommendations: string | null
          report_date: string
          report_type: string
          team_performance: Json | null
        }
        Insert: {
          ai_confidence_score?: number | null
          bottlenecks?: Json | null
          cashflow_forecast?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kpi_summary?: Json | null
          pipeline_status?: Json | null
          priority_plan?: Json | null
          recommendations?: string | null
          report_date?: string
          report_type?: string
          team_performance?: Json | null
        }
        Update: {
          ai_confidence_score?: number | null
          bottlenecks?: Json | null
          cashflow_forecast?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          kpi_summary?: Json | null
          pipeline_status?: Json | null
          priority_plan?: Json | null
          recommendations?: string | null
          report_date?: string
          report_type?: string
          team_performance?: Json | null
        }
        Relationships: []
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
          ai_confidence_score: number | null
          brand: string | null
          business_id: string | null
          call_duration: number | null
          channel: string
          contact_id: string | null
          created_at: string
          created_by: string | null
          delivery_status: string | null
          direction: string
          driver_id: string | null
          follow_up_date: string | null
          follow_up_required: boolean | null
          full_message: string | null
          id: string
          influencer_id: string | null
          message_content: string | null
          outcome: string | null
          performed_by: string | null
          recipient_email: string | null
          recipient_phone: string | null
          recording_url: string | null
          sender_email: string | null
          sender_phone: string | null
          store_id: string | null
          summary: string
          wholesaler_id: string | null
        }
        Insert: {
          ai_confidence_score?: number | null
          brand?: string | null
          business_id?: string | null
          call_duration?: number | null
          channel: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_status?: string | null
          direction: string
          driver_id?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          full_message?: string | null
          id?: string
          influencer_id?: string | null
          message_content?: string | null
          outcome?: string | null
          performed_by?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          recording_url?: string | null
          sender_email?: string | null
          sender_phone?: string | null
          store_id?: string | null
          summary: string
          wholesaler_id?: string | null
        }
        Update: {
          ai_confidence_score?: number | null
          brand?: string | null
          business_id?: string | null
          call_duration?: number | null
          channel?: string
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          delivery_status?: string | null
          direction?: string
          driver_id?: string | null
          follow_up_date?: string | null
          follow_up_required?: boolean | null
          full_message?: string | null
          id?: string
          influencer_id?: string | null
          message_content?: string | null
          outcome?: string | null
          performed_by?: string | null
          recipient_email?: string | null
          recipient_phone?: string | null
          recording_url?: string | null
          sender_email?: string | null
          sender_phone?: string | null
          store_id?: string | null
          summary?: string
          wholesaler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
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
          brand: Database["public"]["Enums"]["brand_type"] | null
          category: Database["public"]["Enums"]["template_category"]
          content: string
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          message_template: string
          name: string
          subject: string | null
          template_type: Database["public"]["Enums"]["template_type"] | null
          tone_config: Json | null
          updated_at: string | null
          usage_count: number | null
          variables: Json | null
        }
        Insert: {
          brand?: Database["public"]["Enums"]["brand_type"] | null
          category: Database["public"]["Enums"]["template_category"]
          content: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          message_template: string
          name: string
          subject?: string | null
          template_type?: Database["public"]["Enums"]["template_type"] | null
          tone_config?: Json | null
          updated_at?: string | null
          usage_count?: number | null
          variables?: Json | null
        }
        Update: {
          brand?: Database["public"]["Enums"]["brand_type"] | null
          category?: Database["public"]["Enums"]["template_category"]
          content?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          message_template?: string
          name?: string
          subject?: string | null
          template_type?: Database["public"]["Enums"]["template_type"] | null
          tone_config?: Json | null
          updated_at?: string | null
          usage_count?: number | null
          variables?: Json | null
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
      companies: {
        Row: {
          boro: string | null
          brand_focus: string[] | null
          created_at: string | null
          created_by: string | null
          default_billing_address: string | null
          default_city: string | null
          default_email: string | null
          default_phone: string | null
          default_state: string | null
          health_score: number | null
          id: string
          name: string
          neighborhood: string | null
          notes: string | null
          payment_reliability_score: number | null
          payment_reliability_tier: string | null
          rpa_status: string | null
          sells_flowers: boolean | null
          tags: string[] | null
          total_orders: number | null
          total_revenue: number | null
          type: string
          updated_at: string | null
        }
        Insert: {
          boro?: string | null
          brand_focus?: string[] | null
          created_at?: string | null
          created_by?: string | null
          default_billing_address?: string | null
          default_city?: string | null
          default_email?: string | null
          default_phone?: string | null
          default_state?: string | null
          health_score?: number | null
          id?: string
          name: string
          neighborhood?: string | null
          notes?: string | null
          payment_reliability_score?: number | null
          payment_reliability_tier?: string | null
          rpa_status?: string | null
          sells_flowers?: boolean | null
          tags?: string[] | null
          total_orders?: number | null
          total_revenue?: number | null
          type: string
          updated_at?: string | null
        }
        Update: {
          boro?: string | null
          brand_focus?: string[] | null
          created_at?: string | null
          created_by?: string | null
          default_billing_address?: string | null
          default_city?: string | null
          default_email?: string | null
          default_phone?: string | null
          default_state?: string | null
          health_score?: number | null
          id?: string
          name?: string
          neighborhood?: string | null
          notes?: string | null
          payment_reliability_score?: number | null
          payment_reliability_tier?: string | null
          rpa_status?: string | null
          sells_flowers?: boolean | null
          tags?: string[] | null
          total_orders?: number | null
          total_revenue?: number | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      company_contacts: {
        Row: {
          can_receive_email: boolean | null
          can_receive_sms: boolean | null
          company_id: string
          created_at: string | null
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          can_receive_email?: boolean | null
          can_receive_sms?: boolean | null
          company_id: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          can_receive_email?: boolean | null
          can_receive_sms?: boolean | null
          company_id?: string
          created_at?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_backup_settings: {
        Row: {
          auto_export_enabled: boolean | null
          business_id: string
          created_at: string
          export_failures: number | null
          export_frequency: string | null
          export_time: string | null
          id: string
          last_export_at: string | null
          next_export_at: string | null
          storage_config: Json | null
          storage_provider: string | null
          updated_at: string
        }
        Insert: {
          auto_export_enabled?: boolean | null
          business_id: string
          created_at?: string
          export_failures?: number | null
          export_frequency?: string | null
          export_time?: string | null
          id?: string
          last_export_at?: string | null
          next_export_at?: string | null
          storage_config?: Json | null
          storage_provider?: string | null
          updated_at?: string
        }
        Update: {
          auto_export_enabled?: boolean | null
          business_id?: string
          created_at?: string
          export_failures?: number | null
          export_frequency?: string | null
          export_time?: string | null
          id?: string
          last_export_at?: string | null
          next_export_at?: string | null
          storage_config?: Json | null
          storage_provider?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_backup_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
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
          business_id: string | null
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
          business_id?: string | null
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
          business_id?: string | null
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
            foreignKeyName: "crm_contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
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
      crm_exports: {
        Row: {
          business_id: string
          completed_at: string | null
          created_at: string
          created_by: string
          error_message: string | null
          export_type: string
          file_url: string | null
          filters: Json | null
          format: string
          id: string
          record_count: number | null
          status: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          error_message?: string | null
          export_type: string
          file_url?: string | null
          filters?: Json | null
          format: string
          id?: string
          record_count?: number | null
          status?: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          error_message?: string | null
          export_type?: string
          file_url?: string | null
          filters?: Json | null
          format?: string
          id?: string
          record_count?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_exports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_exports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_imports: {
        Row: {
          business_id: string
          can_rollback: boolean | null
          completed_at: string | null
          created_at: string
          created_by: string
          duplicate_rows: number | null
          error_message: string | null
          failed_rows: number | null
          file_name: string
          file_url: string | null
          id: string
          import_type: string
          mapping: Json | null
          status: string
          successful_rows: number | null
          total_rows: number | null
          validation_errors: Json | null
        }
        Insert: {
          business_id: string
          can_rollback?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          duplicate_rows?: number | null
          error_message?: string | null
          failed_rows?: number | null
          file_name: string
          file_url?: string | null
          id?: string
          import_type: string
          mapping?: Json | null
          status?: string
          successful_rows?: number | null
          total_rows?: number | null
          validation_errors?: Json | null
        }
        Update: {
          business_id?: string
          can_rollback?: boolean | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          duplicate_rows?: number | null
          error_message?: string | null
          failed_rows?: number | null
          file_name?: string
          file_url?: string | null
          id?: string
          import_type?: string
          mapping?: Json | null
          status?: string
          successful_rows?: number | null
          total_rows?: number | null
          validation_errors?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_imports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_imports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_snapshots: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          file_url: string | null
          id: string
          metadata: Json | null
          record_counts: Json | null
          size_bytes: number | null
          snapshot_data: Json
          snapshot_type: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          record_counts?: Json | null
          size_bytes?: number | null
          snapshot_data: Json
          snapshot_type?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          record_counts?: Json | null
          size_bytes?: number | null
          snapshot_data?: Json
          snapshot_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      deal_sheets: {
        Row: {
          acquisition_id: string | null
          created_at: string | null
          created_by: string | null
          downloads_count: number | null
          email_template: string | null
          id: string
          investor_pitch_deck_url: string | null
          lead_id: string | null
          pdf_url: string | null
          sms_template: string | null
          social_media_copy: string | null
          summary: string | null
          title: string
          views_count: number | null
        }
        Insert: {
          acquisition_id?: string | null
          created_at?: string | null
          created_by?: string | null
          downloads_count?: number | null
          email_template?: string | null
          id?: string
          investor_pitch_deck_url?: string | null
          lead_id?: string | null
          pdf_url?: string | null
          sms_template?: string | null
          social_media_copy?: string | null
          summary?: string | null
          title: string
          views_count?: number | null
        }
        Update: {
          acquisition_id?: string | null
          created_at?: string | null
          created_by?: string | null
          downloads_count?: number | null
          email_template?: string | null
          id?: string
          investor_pitch_deck_url?: string | null
          lead_id?: string | null
          pdf_url?: string | null
          sms_template?: string | null
          social_media_copy?: string | null
          summary?: string | null
          title?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deal_sheets_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisitions_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_sheets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_sheets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
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
      direct_customers: {
        Row: {
          auth_user_id: string | null
          channel: string | null
          company_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          updated_at: string | null
          vip_status: boolean | null
        }
        Insert: {
          auth_user_id?: string | null
          channel?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          vip_status?: boolean | null
        }
        Update: {
          auth_user_id?: string | null
          channel?: string | null
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          updated_at?: string | null
          vip_status?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      driver_profiles: {
        Row: {
          created_at: string | null
          default_city: string | null
          id: string
          insurance_verified: boolean | null
          license_number: string | null
          notes: string | null
          pay_type: string | null
          region: string | null
          status: string
          user_id: string
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string | null
          default_city?: string | null
          id?: string
          insurance_verified?: boolean | null
          license_number?: string | null
          notes?: string | null
          pay_type?: string | null
          region?: string | null
          status?: string
          user_id: string
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string | null
          default_city?: string | null
          id?: string
          insurance_verified?: boolean | null
          license_number?: string | null
          notes?: string | null
          pay_type?: string | null
          region?: string | null
          status?: string
          user_id?: string
          vehicle_type?: string | null
        }
        Relationships: []
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
      driver_route_stops: {
        Row: {
          amount_owed: number | null
          brand: string | null
          company_id: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          route_id: string | null
          sequence: number | null
          store_id: string | null
          task_type: string | null
        }
        Insert: {
          amount_owed?: number | null
          brand?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          route_id?: string | null
          sequence?: number | null
          store_id?: string | null
          task_type?: string | null
        }
        Update: {
          amount_owed?: number | null
          brand?: string | null
          company_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          route_id?: string | null
          sequence?: number | null
          store_id?: string | null
          task_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_route_stops_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "driver_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_route_stops_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_routes: {
        Row: {
          created_at: string | null
          driver_id: string | null
          id: string
          notes: string | null
          route_date: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          route_date: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          driver_id?: string | null
          id?: string
          notes?: string | null
          route_date?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_routes_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "grabba_drivers"
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
      excel_analyses: {
        Row: {
          action_plan: Json | null
          ai_recommendations: string | null
          ai_summary: string | null
          analysis_results: Json | null
          attached_to_brand: string | null
          attached_to_store: string | null
          columns_detected: Json | null
          created_at: string | null
          data_classification: Json | null
          file_name: string
          id: string
          status: string | null
          upload_date: string | null
          uploaded_by: string | null
        }
        Insert: {
          action_plan?: Json | null
          ai_recommendations?: string | null
          ai_summary?: string | null
          analysis_results?: Json | null
          attached_to_brand?: string | null
          attached_to_store?: string | null
          columns_detected?: Json | null
          created_at?: string | null
          data_classification?: Json | null
          file_name: string
          id?: string
          status?: string | null
          upload_date?: string | null
          uploaded_by?: string | null
        }
        Update: {
          action_plan?: Json | null
          ai_recommendations?: string | null
          ai_summary?: string | null
          analysis_results?: Json | null
          attached_to_brand?: string | null
          attached_to_store?: string | null
          columns_detected?: Json | null
          created_at?: string | null
          data_classification?: Json | null
          file_name?: string
          id?: string
          status?: string | null
          upload_date?: string | null
          uploaded_by?: string | null
        }
        Relationships: []
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
      financial_ai_insights: {
        Row: {
          created_at: string
          data: Json | null
          description: string
          expires_at: string | null
          id: string
          insight_category: string
          insight_type: string
          is_business: boolean | null
          recommendations: string[] | null
          severity: string | null
          status: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          data?: Json | null
          description: string
          expires_at?: string | null
          id?: string
          insight_category: string
          insight_type: string
          is_business?: boolean | null
          recommendations?: string[] | null
          severity?: string | null
          status?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          data?: Json | null
          description?: string
          expires_at?: string | null
          id?: string
          insight_category?: string
          insight_type?: string
          is_business?: boolean | null
          recommendations?: string[] | null
          severity?: string | null
          status?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      financial_forecasts: {
        Row: {
          assumptions: Json | null
          confidence_score: number | null
          created_at: string
          end_date: string
          forecast_period: string
          forecast_type: string
          id: string
          is_business: boolean | null
          predicted_expenses: number | null
          predicted_profit: number | null
          predicted_revenue: number | null
          start_date: string
          user_id: string | null
        }
        Insert: {
          assumptions?: Json | null
          confidence_score?: number | null
          created_at?: string
          end_date: string
          forecast_period: string
          forecast_type: string
          id?: string
          is_business?: boolean | null
          predicted_expenses?: number | null
          predicted_profit?: number | null
          predicted_revenue?: number | null
          start_date: string
          user_id?: string | null
        }
        Update: {
          assumptions?: Json | null
          confidence_score?: number | null
          created_at?: string
          end_date?: string
          forecast_period?: string
          forecast_type?: string
          id?: string
          is_business?: boolean | null
          predicted_expenses?: number | null
          predicted_profit?: number | null
          predicted_revenue?: number | null
          start_date?: string
          user_id?: string | null
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
      grabba_autopilot_tasks: {
        Row: {
          brand: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entity_id: string | null
          entity_type: string | null
          floor: number
          id: string
          metadata: Json | null
          notes: string | null
          priority: string
          source: string
          status: string
          suggested_due_date: string | null
          title: string
          type: string
        }
        Insert: {
          brand?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          floor?: number
          id?: string
          metadata?: Json | null
          notes?: string | null
          priority?: string
          source?: string
          status?: string
          suggested_due_date?: string | null
          title: string
          type: string
        }
        Update: {
          brand?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entity_id?: string | null
          entity_type?: string | null
          floor?: number
          id?: string
          metadata?: Json | null
          notes?: string | null
          priority?: string
          source?: string
          status?: string
          suggested_due_date?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      grabba_drivers: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          region: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          region?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          region?: string | null
        }
        Relationships: []
      }
      grabba_playbooks: {
        Row: {
          brand: string | null
          checklist: Json | null
          created_at: string
          default_priority: string
          default_type: string
          description: string | null
          floor: number
          id: string
          is_active: boolean | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          checklist?: Json | null
          created_at?: string
          default_priority?: string
          default_type: string
          description?: string | null
          floor?: number
          id?: string
          is_active?: boolean | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          checklist?: Json | null
          created_at?: string
          default_priority?: string
          default_type?: string
          description?: string | null
          floor?: number
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      holdings_airbnb_units: {
        Row: {
          asset_id: string
          cleaning_fee: number | null
          created_at: string | null
          estimated_monthly_revenue_aggressive: number | null
          estimated_monthly_revenue_base: number | null
          estimated_monthly_revenue_conservative: number | null
          id: string
          listing_name: string
          management_fee_percent: number | null
          nightly_rate_target_high: number
          nightly_rate_target_low: number
          nightly_rate_target_mid: number
          occupancy_target_percent: number | null
          platform: string
          updated_at: string | null
        }
        Insert: {
          asset_id: string
          cleaning_fee?: number | null
          created_at?: string | null
          estimated_monthly_revenue_aggressive?: number | null
          estimated_monthly_revenue_base?: number | null
          estimated_monthly_revenue_conservative?: number | null
          id?: string
          listing_name: string
          management_fee_percent?: number | null
          nightly_rate_target_high: number
          nightly_rate_target_low: number
          nightly_rate_target_mid: number
          occupancy_target_percent?: number | null
          platform: string
          updated_at?: string | null
        }
        Update: {
          asset_id?: string
          cleaning_fee?: number | null
          created_at?: string | null
          estimated_monthly_revenue_aggressive?: number | null
          estimated_monthly_revenue_base?: number | null
          estimated_monthly_revenue_conservative?: number | null
          id?: string
          listing_name?: string
          management_fee_percent?: number | null
          nightly_rate_target_high?: number
          nightly_rate_target_low?: number
          nightly_rate_target_mid?: number
          occupancy_target_percent?: number | null
          platform?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holdings_airbnb_units_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "holdings_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings_assets: {
        Row: {
          acquisition_pipeline_id: string | null
          address: string
          asset_type: string
          city: string
          closing_costs: number
          created_at: string | null
          current_value: number
          equity: number | null
          hold_strategy: string
          id: string
          market: string | null
          name: string
          purchase_price: number
          rehab_costs: number
          state: string
          status: string
          total_basis: number | null
          updated_at: string | null
          zip_code: string
        }
        Insert: {
          acquisition_pipeline_id?: string | null
          address: string
          asset_type: string
          city: string
          closing_costs?: number
          created_at?: string | null
          current_value?: number
          equity?: number | null
          hold_strategy?: string
          id?: string
          market?: string | null
          name: string
          purchase_price?: number
          rehab_costs?: number
          state: string
          status?: string
          total_basis?: number | null
          updated_at?: string | null
          zip_code: string
        }
        Update: {
          acquisition_pipeline_id?: string | null
          address?: string
          asset_type?: string
          city?: string
          closing_costs?: number
          created_at?: string | null
          current_value?: number
          equity?: number | null
          hold_strategy?: string
          id?: string
          market?: string | null
          name?: string
          purchase_price?: number
          rehab_costs?: number
          state?: string
          status?: string
          total_basis?: number | null
          updated_at?: string | null
          zip_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_assets_acquisition_pipeline_id_fkey"
            columns: ["acquisition_pipeline_id"]
            isOneToOne: false
            referencedRelation: "acquisitions_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings_expenses: {
        Row: {
          amount: number
          asset_id: string
          created_at: string | null
          description: string | null
          expense_date: string
          expense_type: string
          id: string
          recurrence_rule: string | null
          recurring: boolean | null
        }
        Insert: {
          amount: number
          asset_id: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          expense_type: string
          id?: string
          recurrence_rule?: string | null
          recurring?: boolean | null
        }
        Update: {
          amount?: number
          asset_id?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          expense_type?: string
          id?: string
          recurrence_rule?: string | null
          recurring?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "holdings_expenses_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "holdings_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings_kpis: {
        Row: {
          avg_cap_rate: number | null
          avg_dscr: number | null
          created_at: string | null
          id: string
          monthly_expenses: number | null
          monthly_income: number | null
          net_cashflow: number | null
          period: string
          portfolio_value: number | null
          total_debt: number | null
          total_equity: number | null
          total_units_owned: number | null
        }
        Insert: {
          avg_cap_rate?: number | null
          avg_dscr?: number | null
          created_at?: string | null
          id?: string
          monthly_expenses?: number | null
          monthly_income?: number | null
          net_cashflow?: number | null
          period: string
          portfolio_value?: number | null
          total_debt?: number | null
          total_equity?: number | null
          total_units_owned?: number | null
        }
        Update: {
          avg_cap_rate?: number | null
          avg_dscr?: number | null
          created_at?: string | null
          id?: string
          monthly_expenses?: number | null
          monthly_income?: number | null
          net_cashflow?: number | null
          period?: string
          portfolio_value?: number | null
          total_debt?: number | null
          total_equity?: number | null
          total_units_owned?: number | null
        }
        Relationships: []
      }
      holdings_loans: {
        Row: {
          amortization_years: number | null
          asset_id: string
          created_at: string | null
          current_balance: number
          dscr_covenant: number | null
          escrow_taxes_insurance: number | null
          id: string
          interest_rate: number
          lender_name: string
          loan_type: string
          maturity_date: string
          monthly_payment_principal_interest: number
          next_rate_change_date: string | null
          original_balance: number
          status: string
          total_monthly_payment: number | null
          updated_at: string | null
        }
        Insert: {
          amortization_years?: number | null
          asset_id: string
          created_at?: string | null
          current_balance: number
          dscr_covenant?: number | null
          escrow_taxes_insurance?: number | null
          id?: string
          interest_rate: number
          lender_name: string
          loan_type: string
          maturity_date: string
          monthly_payment_principal_interest: number
          next_rate_change_date?: string | null
          original_balance: number
          status?: string
          total_monthly_payment?: number | null
          updated_at?: string | null
        }
        Update: {
          amortization_years?: number | null
          asset_id?: string
          created_at?: string | null
          current_balance?: number
          dscr_covenant?: number | null
          escrow_taxes_insurance?: number | null
          id?: string
          interest_rate?: number
          lender_name?: string
          loan_type?: string
          maturity_date?: string
          monthly_payment_principal_interest?: number
          next_rate_change_date?: string | null
          original_balance?: number
          status?: string
          total_monthly_payment?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holdings_loans_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "holdings_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings_payments: {
        Row: {
          amount: number
          asset_id: string
          created_at: string | null
          id: string
          notes: string | null
          received_date: string
          reference: string | null
          source_type: string
        }
        Insert: {
          amount: number
          asset_id: string
          created_at?: string | null
          id?: string
          notes?: string | null
          received_date?: string
          reference?: string | null
          source_type: string
        }
        Update: {
          amount?: number
          asset_id?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          received_date?: string
          reference?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_payments_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "holdings_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings_rent_roll: {
        Row: {
          asset_id: string
          created_at: string | null
          deposits_held: number | null
          id: string
          lease_end_date: string | null
          lease_start_date: string | null
          monthly_rent: number
          payment_day: number | null
          status: string
          tenant_name: string | null
          tenant_type: string
          unit_identifier: string
          updated_at: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string | null
          deposits_held?: number | null
          id?: string
          lease_end_date?: string | null
          lease_start_date?: string | null
          monthly_rent?: number
          payment_day?: number | null
          status?: string
          tenant_name?: string | null
          tenant_type: string
          unit_identifier: string
          updated_at?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string | null
          deposits_held?: number | null
          id?: string
          lease_end_date?: string | null
          lease_start_date?: string | null
          monthly_rent?: number
          payment_day?: number | null
          status?: string
          tenant_name?: string | null
          tenant_type?: string
          unit_identifier?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holdings_rent_roll_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "holdings_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings_targets: {
        Row: {
          created_at: string | null
          equity_target: number
          id: string
          monthly_cashflow_target: number
          portfolio_value_target: number
          timeline_months: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          equity_target: number
          id?: string
          monthly_cashflow_target: number
          portfolio_value_target: number
          timeline_months: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          equity_target?: number
          id?: string
          monthly_cashflow_target?: number
          portfolio_value_target?: number
          timeline_months?: number
          updated_at?: string | null
        }
        Relationships: []
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
      investor_email_logs: {
        Row: {
          clicked_at: string | null
          deal_sheet_id: string | null
          id: string
          interest_level: string | null
          investor_email: string
          investor_id: string | null
          notes: string | null
          opened_at: string | null
          responded_at: string | null
          response_type: string | null
          sent_at: string | null
        }
        Insert: {
          clicked_at?: string | null
          deal_sheet_id?: string | null
          id?: string
          interest_level?: string | null
          investor_email: string
          investor_id?: string | null
          notes?: string | null
          opened_at?: string | null
          responded_at?: string | null
          response_type?: string | null
          sent_at?: string | null
        }
        Update: {
          clicked_at?: string | null
          deal_sheet_id?: string | null
          id?: string
          interest_level?: string | null
          investor_email?: string
          investor_id?: string | null
          notes?: string | null
          opened_at?: string | null
          responded_at?: string | null
          response_type?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_email_logs_deal_sheet_id_fkey"
            columns: ["deal_sheet_id"]
            isOneToOne: false
            referencedRelation: "deal_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      investor_engagement: {
        Row: {
          created_at: string | null
          deal_sheet_id: string | null
          declined: boolean | null
          engagement_score: number | null
          engagement_type: string
          id: string
          interested: boolean | null
          investor_id: string
          last_interaction_at: string | null
          notes: string | null
          offer_amount: number | null
          total_interactions: number | null
        }
        Insert: {
          created_at?: string | null
          deal_sheet_id?: string | null
          declined?: boolean | null
          engagement_score?: number | null
          engagement_type: string
          id?: string
          interested?: boolean | null
          investor_id: string
          last_interaction_at?: string | null
          notes?: string | null
          offer_amount?: number | null
          total_interactions?: number | null
        }
        Update: {
          created_at?: string | null
          deal_sheet_id?: string | null
          declined?: boolean | null
          engagement_score?: number | null
          engagement_type?: string
          id?: string
          interested?: boolean | null
          investor_id?: string
          last_interaction_at?: string | null
          notes?: string | null
          offer_amount?: number | null
          total_interactions?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "investor_engagement_deal_sheet_id_fkey"
            columns: ["deal_sheet_id"]
            isOneToOne: false
            referencedRelation: "deal_sheets"
            referencedColumns: ["id"]
          },
        ]
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
          brand: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_type: string | null
          due_date: string
          id: string
          invoice_number: string
          invoice_pdf_url: string | null
          notes: string | null
          order_id: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          store_id: string | null
          subtotal: number | null
          tax: number | null
          total: number | null
          total_amount: number | null
        }
        Insert: {
          amount_paid?: number
          brand?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          due_date: string
          id?: string
          invoice_number: string
          invoice_pdf_url?: string | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          store_id?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          total_amount?: number | null
        }
        Update: {
          amount_paid?: number
          brand?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          due_date?: string
          id?: string
          invoice_number?: string
          invoice_pdf_url?: string | null
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          store_id?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      lender_applications: {
        Row: {
          acquisition_id: string | null
          arv: number | null
          borrower_credit_score: number | null
          borrower_email: string | null
          borrower_name: string | null
          borrower_phone: string | null
          created_at: string
          decision_date: string | null
          dscr: number | null
          id: string
          lead_id: string
          lender_id: string
          loan_amount: number
          loan_purpose: string
          loan_to_cost: number | null
          ltv: number | null
          monthly_rent: number | null
          notes: string | null
          product_id: string | null
          property_value: number | null
          purchase_price: number | null
          rehab_budget: number | null
          status: string
          submitted_at: string | null
          underwriter_notes: string | null
          updated_at: string
        }
        Insert: {
          acquisition_id?: string | null
          arv?: number | null
          borrower_credit_score?: number | null
          borrower_email?: string | null
          borrower_name?: string | null
          borrower_phone?: string | null
          created_at?: string
          decision_date?: string | null
          dscr?: number | null
          id?: string
          lead_id: string
          lender_id: string
          loan_amount: number
          loan_purpose: string
          loan_to_cost?: number | null
          ltv?: number | null
          monthly_rent?: number | null
          notes?: string | null
          product_id?: string | null
          property_value?: number | null
          purchase_price?: number | null
          rehab_budget?: number | null
          status?: string
          submitted_at?: string | null
          underwriter_notes?: string | null
          updated_at?: string
        }
        Update: {
          acquisition_id?: string | null
          arv?: number | null
          borrower_credit_score?: number | null
          borrower_email?: string | null
          borrower_name?: string | null
          borrower_phone?: string | null
          created_at?: string
          decision_date?: string | null
          dscr?: number | null
          id?: string
          lead_id?: string
          lender_id?: string
          loan_amount?: number
          loan_purpose?: string
          loan_to_cost?: number | null
          ltv?: number | null
          monthly_rent?: number | null
          notes?: string | null
          product_id?: string | null
          property_value?: number | null
          purchase_price?: number | null
          rehab_budget?: number | null
          status?: string
          submitted_at?: string | null
          underwriter_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lender_applications_acquisition_id_fkey"
            columns: ["acquisition_id"]
            isOneToOne: false
            referencedRelation: "acquisitions_pipeline"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lender_applications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lender_applications_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lender_applications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "loan_products"
            referencedColumns: ["id"]
          },
        ]
      }
      lenders: {
        Row: {
          asset_types: string[] | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          interest_rate_range: string | null
          is_active: boolean
          lender_name: string
          lender_type: string
          max_loan_amount: number | null
          max_loan_to_cost: number | null
          max_ltv: number | null
          min_credit_score: number | null
          min_loan_amount: number | null
          notes: string | null
          phone: string | null
          points_range: string | null
          rating: number | null
          rehab_holdback_available: boolean | null
          speed_to_close_days: number | null
          states_active: string[]
          typical_terms: string | null
          website: string | null
        }
        Insert: {
          asset_types?: string[] | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_rate_range?: string | null
          is_active?: boolean
          lender_name: string
          lender_type: string
          max_loan_amount?: number | null
          max_loan_to_cost?: number | null
          max_ltv?: number | null
          min_credit_score?: number | null
          min_loan_amount?: number | null
          notes?: string | null
          phone?: string | null
          points_range?: string | null
          rating?: number | null
          rehab_holdback_available?: boolean | null
          speed_to_close_days?: number | null
          states_active?: string[]
          typical_terms?: string | null
          website?: string | null
        }
        Update: {
          asset_types?: string[] | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          interest_rate_range?: string | null
          is_active?: boolean
          lender_name?: string
          lender_type?: string
          max_loan_amount?: number | null
          max_loan_to_cost?: number | null
          max_ltv?: number | null
          min_credit_score?: number | null
          min_loan_amount?: number | null
          notes?: string | null
          phone?: string | null
          points_range?: string | null
          rating?: number | null
          rehab_holdback_available?: boolean | null
          speed_to_close_days?: number | null
          states_active?: string[]
          typical_terms?: string | null
          website?: string | null
        }
        Relationships: []
      }
      loan_analysis: {
        Row: {
          ai_analysis: string | null
          arv: number | null
          calculated_at: string
          cap_rate: number | null
          dscr: number | null
          id: string
          lead_id: string
          loan_to_cost: number | null
          ltv: number | null
          max_allowable_loan: number | null
          monthly_expenses: number | null
          monthly_rent: number | null
          property_value: number
          purchase_price: number
          qualifying_products: Json | null
          recommended_strategy: string | null
          rehab_budget: number | null
        }
        Insert: {
          ai_analysis?: string | null
          arv?: number | null
          calculated_at?: string
          cap_rate?: number | null
          dscr?: number | null
          id?: string
          lead_id: string
          loan_to_cost?: number | null
          ltv?: number | null
          max_allowable_loan?: number | null
          monthly_expenses?: number | null
          monthly_rent?: number | null
          property_value: number
          purchase_price: number
          qualifying_products?: Json | null
          recommended_strategy?: string | null
          rehab_budget?: number | null
        }
        Update: {
          ai_analysis?: string | null
          arv?: number | null
          calculated_at?: string
          cap_rate?: number | null
          dscr?: number | null
          id?: string
          lead_id?: string
          loan_to_cost?: number | null
          ltv?: number | null
          max_allowable_loan?: number | null
          monthly_expenses?: number | null
          monthly_rent?: number | null
          property_value?: number
          purchase_price?: number
          qualifying_products?: Json | null
          recommended_strategy?: string | null
          rehab_budget?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_analysis_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads_raw"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_docs: {
        Row: {
          application_id: string
          doc_name: string
          doc_type: string
          file_url: string
          id: string
          notes: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          application_id: string
          doc_name: string
          doc_type: string
          file_url: string
          id?: string
          notes?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          application_id?: string
          doc_name?: string
          doc_type?: string
          file_url?: string
          id?: string
          notes?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_docs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "lender_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_docs_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_payoffs: {
        Row: {
          application_id: string
          created_at: string
          funded_amount: number
          funded_date: string
          id: string
          interest_rate: number
          monthly_payment: number | null
          payoff_amount: number | null
          payoff_date: string | null
          status: string
          term_months: number
          total_interest_paid: number | null
        }
        Insert: {
          application_id: string
          created_at?: string
          funded_amount: number
          funded_date: string
          id?: string
          interest_rate: number
          monthly_payment?: number | null
          payoff_amount?: number | null
          payoff_date?: string | null
          status?: string
          term_months: number
          total_interest_paid?: number | null
        }
        Update: {
          application_id?: string
          created_at?: string
          funded_amount?: number
          funded_date?: string
          id?: string
          interest_rate?: number
          monthly_payment?: number | null
          payoff_amount?: number | null
          payoff_date?: string | null
          status?: string
          term_months?: number
          total_interest_paid?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_payoffs_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "lender_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_products: {
        Row: {
          created_at: string
          cross_collateral_ok: boolean | null
          id: string
          interest_rate_max: number
          interest_rate_min: number
          is_active: boolean
          lender_id: string
          max_loan: number
          max_loan_to_cost: number | null
          max_ltv: number
          min_credit_score: number | null
          min_dscr: number | null
          min_loan: number
          min_ltv: number
          origination_points: number | null
          prepayment_penalty: string | null
          product_name: string
          product_type: string
          property_types: string[] | null
          rehab_holdback: boolean | null
          states_available: string[] | null
          term_months: number | null
        }
        Insert: {
          created_at?: string
          cross_collateral_ok?: boolean | null
          id?: string
          interest_rate_max: number
          interest_rate_min: number
          is_active?: boolean
          lender_id: string
          max_loan: number
          max_loan_to_cost?: number | null
          max_ltv: number
          min_credit_score?: number | null
          min_dscr?: number | null
          min_loan: number
          min_ltv: number
          origination_points?: number | null
          prepayment_penalty?: string | null
          product_name: string
          product_type: string
          property_types?: string[] | null
          rehab_holdback?: boolean | null
          states_available?: string[] | null
          term_months?: number | null
        }
        Update: {
          created_at?: string
          cross_collateral_ok?: boolean | null
          id?: string
          interest_rate_max?: number
          interest_rate_min?: number
          is_active?: boolean
          lender_id?: string
          max_loan?: number
          max_loan_to_cost?: number | null
          max_ltv?: number
          min_credit_score?: number | null
          min_dscr?: number | null
          min_loan?: number
          min_ltv?: number
          origination_points?: number | null
          prepayment_penalty?: string | null
          product_name?: string
          product_type?: string
          property_types?: string[] | null
          rehab_holdback?: boolean | null
          states_available?: string[] | null
          term_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_products_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_underwriting: {
        Row: {
          application_id: string
          appraisal_value: number | null
          approved_loan_amount: number | null
          approved_points: number | null
          approved_rate: number | null
          approved_term_months: number | null
          comps_verified: boolean | null
          conditions: string[] | null
          created_at: string
          decision: string | null
          decision_date: string | null
          decision_notes: string | null
          id: string
          insurance_quoted: boolean | null
          property_condition: string | null
          title_clear: boolean | null
          underwriter_id: string | null
        }
        Insert: {
          application_id: string
          appraisal_value?: number | null
          approved_loan_amount?: number | null
          approved_points?: number | null
          approved_rate?: number | null
          approved_term_months?: number | null
          comps_verified?: boolean | null
          conditions?: string[] | null
          created_at?: string
          decision?: string | null
          decision_date?: string | null
          decision_notes?: string | null
          id?: string
          insurance_quoted?: boolean | null
          property_condition?: string | null
          title_clear?: boolean | null
          underwriter_id?: string | null
        }
        Update: {
          application_id?: string
          appraisal_value?: number | null
          approved_loan_amount?: number | null
          approved_points?: number | null
          approved_rate?: number | null
          approved_term_months?: number | null
          comps_verified?: boolean | null
          conditions?: string[] | null
          created_at?: string
          decision?: string | null
          decision_date?: string | null
          decision_notes?: string | null
          id?: string
          insurance_quoted?: boolean | null
          property_condition?: string | null
          title_clear?: boolean | null
          underwriter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loan_underwriting_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "lender_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_underwriting_underwriter_id_fkey"
            columns: ["underwriter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      machine_service_logs: {
        Row: {
          created_at: string | null
          id: string
          issue_description: string | null
          machine_name: string
          office_id: string | null
          resolved_at: string | null
          service_action: string | null
          serviced_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          issue_description?: string | null
          machine_name: string
          office_id?: string | null
          resolved_at?: string | null
          service_action?: string | null
          serviced_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          issue_description?: string | null
          machine_name?: string
          office_id?: string | null
          resolved_at?: string | null
          service_action?: string | null
          serviced_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "machine_service_logs_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "production_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_engines: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          performance_metrics: Json | null
          type: string
          updated_at: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          performance_metrics?: Json | null
          type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          performance_metrics?: Json | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
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
      networth_snapshots: {
        Row: {
          assets_breakdown: Json | null
          created_at: string
          id: string
          liabilities_breakdown: Json | null
          net_worth: number | null
          notes: string | null
          snapshot_date: string
          total_assets: number | null
          total_liabilities: number | null
          user_id: string
        }
        Insert: {
          assets_breakdown?: Json | null
          created_at?: string
          id?: string
          liabilities_breakdown?: Json | null
          net_worth?: number | null
          notes?: string | null
          snapshot_date?: string
          total_assets?: number | null
          total_liabilities?: number | null
          user_id: string
        }
        Update: {
          assets_breakdown?: Json | null
          created_at?: string
          id?: string
          liabilities_breakdown?: Json | null
          net_worth?: number | null
          notes?: string | null
          snapshot_date?: string
          total_assets?: number | null
          total_liabilities?: number | null
          user_id?: string
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
      payroll_records: {
        Row: {
          base_pay: number
          bonuses: number | null
          commissions: number | null
          created_at: string
          deductions: number | null
          employee_id: string | null
          employee_name: string
          employee_type: string
          hourly_rate: number | null
          hours_worked: number | null
          id: string
          net_pay: number
          notes: string | null
          paid_at: string | null
          pay_period_end: string
          pay_period_start: string
          status: string | null
        }
        Insert: {
          base_pay?: number
          bonuses?: number | null
          commissions?: number | null
          created_at?: string
          deductions?: number | null
          employee_id?: string | null
          employee_name: string
          employee_type: string
          hourly_rate?: number | null
          hours_worked?: number | null
          id?: string
          net_pay?: number
          notes?: string | null
          paid_at?: string | null
          pay_period_end: string
          pay_period_start: string
          status?: string | null
        }
        Update: {
          base_pay?: number
          bonuses?: number | null
          commissions?: number | null
          created_at?: string
          deductions?: number | null
          employee_id?: string | null
          employee_name?: string
          employee_type?: string
          hourly_rate?: number | null
          hours_worked?: number | null
          id?: string
          net_pay?: number
          notes?: string | null
          paid_at?: string | null
          pay_period_end?: string
          pay_period_start?: string
          status?: string | null
        }
        Relationships: []
      }
      personal_manual_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          description: string | null
          entry_date: string
          entry_type: string
          id: string
          receipt_url: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          receipt_url?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          receipt_url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      personal_transactions: {
        Row: {
          ai_categorized: boolean | null
          amount: number
          category: string
          created_at: string
          description: string | null
          id: string
          is_recurring: boolean | null
          merchant: string | null
          payment_method: string | null
          receipt_url: string | null
          subcategory: string | null
          tags: string[] | null
          transaction_date: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          ai_categorized?: boolean | null
          amount?: number
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          merchant?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          subcategory?: string | null
          tags?: string[] | null
          transaction_date?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          ai_categorized?: boolean | null
          amount?: number
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          merchant?: string | null
          payment_method?: string | null
          receipt_url?: string | null
          subcategory?: string | null
          tags?: string[] | null
          transaction_date?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      pod_ai_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      pod_designs: {
        Row: {
          ai_description: string | null
          approval_user_id: string | null
          approved_by_va: boolean | null
          category: string
          created_at: string | null
          design_image_url: string | null
          generated_by_ai: boolean | null
          id: string
          mockup_urls: string[] | null
          platforms_uploaded: string[] | null
          seo_keywords: string[] | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          variations_created: number | null
        }
        Insert: {
          ai_description?: string | null
          approval_user_id?: string | null
          approved_by_va?: boolean | null
          category: string
          created_at?: string | null
          design_image_url?: string | null
          generated_by_ai?: boolean | null
          id?: string
          mockup_urls?: string[] | null
          platforms_uploaded?: string[] | null
          seo_keywords?: string[] | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          variations_created?: number | null
        }
        Update: {
          ai_description?: string | null
          approval_user_id?: string | null
          approved_by_va?: boolean | null
          category?: string
          created_at?: string | null
          design_image_url?: string | null
          generated_by_ai?: boolean | null
          id?: string
          mockup_urls?: string[] | null
          platforms_uploaded?: string[] | null
          seo_keywords?: string[] | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          variations_created?: number | null
        }
        Relationships: []
      }
      pod_marketplace_accounts: {
        Row: {
          api_key: string | null
          connection_status: string | null
          created_at: string | null
          id: string
          platform_name: string
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          connection_status?: string | null
          created_at?: string | null
          id?: string
          platform_name: string
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          connection_status?: string | null
          created_at?: string | null
          id?: string
          platform_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pod_sales: {
        Row: {
          buyer_geo: string | null
          design_id: string | null
          id: string
          order_date: string | null
          platform: string
          profit: number | null
          sale_price: number | null
          sku: string | null
        }
        Insert: {
          buyer_geo?: string | null
          design_id?: string | null
          id?: string
          order_date?: string | null
          platform: string
          profit?: number | null
          sale_price?: number | null
          sku?: string | null
        }
        Update: {
          buyer_geo?: string | null
          design_id?: string | null
          id?: string
          order_date?: string | null
          platform?: string
          profit?: number | null
          sale_price?: number | null
          sku?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_sales_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "pod_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_videos: {
        Row: {
          ai_script_used: string | null
          ai_voice_used: string | null
          created_at: string | null
          design_id: string | null
          id: string
          performance_metrics: Json | null
          platform_ready_versions: Json | null
          video_url: string | null
        }
        Insert: {
          ai_script_used?: string | null
          ai_voice_used?: string | null
          created_at?: string | null
          design_id?: string | null
          id?: string
          performance_metrics?: Json | null
          platform_ready_versions?: Json | null
          video_url?: string | null
        }
        Update: {
          ai_script_used?: string | null
          ai_voice_used?: string | null
          created_at?: string | null
          design_id?: string | null
          id?: string
          performance_metrics?: Json | null
          platform_ready_versions?: Json | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_videos_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "pod_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      production_batches: {
        Row: {
          boxes_produced: number | null
          brand: string
          created_at: string | null
          id: string
          office_id: string | null
          produced_by: string | null
          shift_label: string | null
          tubes_total: number | null
        }
        Insert: {
          boxes_produced?: number | null
          brand: string
          created_at?: string | null
          id?: string
          office_id?: string | null
          produced_by?: string | null
          shift_label?: string | null
          tubes_total?: number | null
        }
        Update: {
          boxes_produced?: number | null
          brand?: string
          created_at?: string | null
          id?: string
          office_id?: string | null
          produced_by?: string | null
          shift_label?: string | null
          tubes_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_batches_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "production_offices"
            referencedColumns: ["id"]
          },
        ]
      }
      production_costs: {
        Row: {
          batch_number: string | null
          brand: string | null
          cost_per_unit: number | null
          created_at: string
          id: string
          labor_cost: number | null
          material_cost: number | null
          notes: string | null
          overhead_cost: number | null
          product_type: string
          production_date: string
          quantity_produced: number
          total_cost: number
        }
        Insert: {
          batch_number?: string | null
          brand?: string | null
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          labor_cost?: number | null
          material_cost?: number | null
          notes?: string | null
          overhead_cost?: number | null
          product_type: string
          production_date?: string
          quantity_produced?: number
          total_cost?: number
        }
        Update: {
          batch_number?: string | null
          brand?: string | null
          cost_per_unit?: number | null
          created_at?: string
          id?: string
          labor_cost?: number | null
          material_cost?: number | null
          notes?: string | null
          overhead_cost?: number | null
          product_type?: string
          production_date?: string
          quantity_produced?: number
          total_cost?: number
        }
        Relationships: []
      }
      production_offices: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          location: string | null
          name: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      production_profiles: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          role: string
          shift: string | null
          station: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          role: string
          shift?: string | null
          station?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          role?: string
          shift?: string | null
          station?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      production_tools_issued: {
        Row: {
          id: string
          issued_at: string | null
          issued_to: string | null
          office_id: string | null
          quantity: number | null
          returned_at: string | null
          tool_name: string
        }
        Insert: {
          id?: string
          issued_at?: string | null
          issued_to?: string | null
          office_id?: string | null
          quantity?: number | null
          returned_at?: string | null
          tool_name: string
        }
        Update: {
          id?: string
          issued_at?: string | null
          issued_to?: string | null
          office_id?: string | null
          quantity?: number | null
          returned_at?: string | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_tools_issued_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "production_offices"
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
      scheduled_tasks: {
        Row: {
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          last_run_at: string | null
          payload: Json | null
          recurrence_rule: string | null
          run_at: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          last_run_at?: string | null
          payload?: Json | null
          recurrence_rule?: string | null
          run_at: string
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          last_run_at?: string | null
          payload?: Json | null
          recurrence_rule?: string | null
          run_at?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_tasks_created_by_fkey"
            columns: ["created_by"]
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
      store_ai_insights: {
        Row: {
          brand: Database["public"]["Enums"]["brand_type"] | null
          created_at: string | null
          id: string
          insight_data: Json | null
          insight_type: string
          store_master_id: string | null
        }
        Insert: {
          brand?: Database["public"]["Enums"]["brand_type"] | null
          created_at?: string | null
          id?: string
          insight_data?: Json | null
          insight_type: string
          store_master_id?: string | null
        }
        Update: {
          brand?: Database["public"]["Enums"]["brand_type"] | null
          created_at?: string | null
          id?: string
          insight_data?: Json | null
          insight_type?: string
          store_master_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_ai_insights_store_master_id_fkey"
            columns: ["store_master_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      store_brand_accounts: {
        Row: {
          active_status: boolean | null
          brand: Database["public"]["Enums"]["brand_type"]
          created_at: string | null
          credit_terms: Database["public"]["Enums"]["credit_terms_type"] | null
          id: string
          last_order_date: string | null
          loyalty_level:
            | Database["public"]["Enums"]["loyalty_level_type"]
            | null
          store_master_id: string
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          active_status?: boolean | null
          brand: Database["public"]["Enums"]["brand_type"]
          created_at?: string | null
          credit_terms?: Database["public"]["Enums"]["credit_terms_type"] | null
          id?: string
          last_order_date?: string | null
          loyalty_level?:
            | Database["public"]["Enums"]["loyalty_level_type"]
            | null
          store_master_id: string
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          active_status?: boolean | null
          brand?: Database["public"]["Enums"]["brand_type"]
          created_at?: string | null
          credit_terms?: Database["public"]["Enums"]["credit_terms_type"] | null
          id?: string
          last_order_date?: string | null
          loyalty_level?:
            | Database["public"]["Enums"]["loyalty_level_type"]
            | null
          store_master_id?: string
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_brand_accounts_store_master_id_fkey"
            columns: ["store_master_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      store_contacts: {
        Row: {
          can_receive_sms: boolean | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          name: string
          phone: string | null
          role: string | null
          store_id: string
        }
        Insert: {
          can_receive_sms?: boolean | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          phone?: string | null
          role?: string | null
          store_id: string
        }
        Update: {
          can_receive_sms?: boolean | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          phone?: string | null
          role?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_contacts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      store_master: {
        Row: {
          address: string
          city: string
          created_at: string | null
          email: string | null
          id: string
          notes: string | null
          owner_name: string | null
          phone: string | null
          state: string
          store_name: string
          store_type: string | null
          updated_at: string | null
          zip: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          state: string
          store_name: string
          store_type?: string | null
          updated_at?: string | null
          zip: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          owner_name?: string | null
          phone?: string | null
          state?: string
          store_name?: string
          store_type?: string | null
          updated_at?: string | null
          zip?: string
        }
        Relationships: []
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
      store_payments: {
        Row: {
          company_id: string | null
          created_at: string | null
          created_by: string | null
          due_date: string | null
          id: string
          invoice_id: string | null
          issue_date: string | null
          order_id: string | null
          owed_amount: number | null
          paid_amount: number | null
          payment_method: string | null
          payment_status: string | null
          store_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          issue_date?: string | null
          order_id?: string | null
          owed_amount?: number | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          store_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          due_date?: string | null
          id?: string
          invoice_id?: string | null
          issue_date?: string | null
          order_id?: string | null
          owed_amount?: number | null
          paid_amount?: number | null
          payment_method?: string | null
          payment_status?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "wholesale_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_payments_store_id_fkey"
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
      store_profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          contact_name: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          preferred_delivery_day: string | null
          state: string | null
          status: string
          store_name: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_delivery_day?: string | null
          state?: string | null
          status?: string
          store_name: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_delivery_day?: string | null
          state?: string | null
          status?: string
          store_name?: string
          user_id?: string
        }
        Relationships: []
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
      store_tube_inventory: {
        Row: {
          brand: string
          created_by: string | null
          current_tubes_left: number | null
          id: string
          last_updated: string | null
          store_id: string
        }
        Insert: {
          brand: string
          created_by?: string | null
          current_tubes_left?: number | null
          id?: string
          last_updated?: string | null
          store_id: string
        }
        Update: {
          brand?: string
          created_by?: string | null
          current_tubes_left?: number | null
          id?: string
          last_updated?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_tube_inventory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
          boro: string | null
          company_id: string | null
          connected_group_id: string | null
          created_at: string | null
          created_by: string | null
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
          neighborhood: string | null
          notes: string | null
          notes_old: string | null
          notes_overview: string | null
          open_date: string | null
          performance_score: number | null
          performance_tier: string | null
          phone: string | null
          primary_contact_name: string | null
          prime_time_energy: boolean | null
          region_id: string | null
          responsiveness: Database["public"]["Enums"]["responsiveness"] | null
          rpa_status: string | null
          sells_flowers: boolean | null
          special_information: string | null
          status: Database["public"]["Enums"]["store_status"] | null
          sticker_status: Database["public"]["Enums"]["sticker_status"] | null
          store_code: string | null
          tags: string[] | null
          type: Database["public"]["Enums"]["store_type"]
          updated_at: string | null
          visit_frequency_target: number | null
          visit_risk_level: string | null
          wholesaler_name: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          alt_phone?: string | null
          boro?: string | null
          company_id?: string | null
          connected_group_id?: string | null
          created_at?: string | null
          created_by?: string | null
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
          neighborhood?: string | null
          notes?: string | null
          notes_old?: string | null
          notes_overview?: string | null
          open_date?: string | null
          performance_score?: number | null
          performance_tier?: string | null
          phone?: string | null
          primary_contact_name?: string | null
          prime_time_energy?: boolean | null
          region_id?: string | null
          responsiveness?: Database["public"]["Enums"]["responsiveness"] | null
          rpa_status?: string | null
          sells_flowers?: boolean | null
          special_information?: string | null
          status?: Database["public"]["Enums"]["store_status"] | null
          sticker_status?: Database["public"]["Enums"]["sticker_status"] | null
          store_code?: string | null
          tags?: string[] | null
          type: Database["public"]["Enums"]["store_type"]
          updated_at?: string | null
          visit_frequency_target?: number | null
          visit_risk_level?: string | null
          wholesaler_name?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          alt_phone?: string | null
          boro?: string | null
          company_id?: string | null
          connected_group_id?: string | null
          created_at?: string | null
          created_by?: string | null
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
          neighborhood?: string | null
          notes?: string | null
          notes_old?: string | null
          notes_overview?: string | null
          open_date?: string | null
          performance_score?: number | null
          performance_tier?: string | null
          phone?: string | null
          primary_contact_name?: string | null
          prime_time_energy?: boolean | null
          region_id?: string | null
          responsiveness?: Database["public"]["Enums"]["responsiveness"] | null
          rpa_status?: string | null
          sells_flowers?: boolean | null
          special_information?: string | null
          status?: Database["public"]["Enums"]["store_status"] | null
          sticker_status?: Database["public"]["Enums"]["sticker_status"] | null
          store_code?: string | null
          tags?: string[] | null
          type?: Database["public"]["Enums"]["store_type"]
          updated_at?: string | null
          visit_frequency_target?: number | null
          visit_risk_level?: string | null
          wholesaler_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      subscription_expenses: {
        Row: {
          amount: number
          auto_renew: boolean | null
          billing_cycle: string | null
          cancellation_url: string | null
          category: string
          created_at: string
          id: string
          is_active: boolean | null
          is_business: boolean | null
          next_billing_date: string | null
          notes: string | null
          service_name: string
          updated_at: string
        }
        Insert: {
          amount?: number
          auto_renew?: boolean | null
          billing_cycle?: string | null
          cancellation_url?: string | null
          category: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_business?: boolean | null
          next_billing_date?: string | null
          notes?: string | null
          service_name: string
          updated_at?: string
        }
        Update: {
          amount?: number
          auto_renew?: boolean | null
          billing_cycle?: string | null
          cancellation_url?: string | null
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_business?: boolean | null
          next_billing_date?: string | null
          notes?: string | null
          service_name?: string
          updated_at?: string
        }
        Relationships: []
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
      term_sheets: {
        Row: {
          accepted_at: string | null
          application_id: string
          borrower_name: string
          conditions: string[] | null
          created_at: string
          dscr: number | null
          expiration_date: string | null
          id: string
          interest_rate: number
          lender_id: string
          loan_amount: number
          ltv: number | null
          origination_points: number | null
          pdf_url: string | null
          property_address: string
          sent_at: string | null
          status: string
          term_months: number
          term_sheet_number: string | null
        }
        Insert: {
          accepted_at?: string | null
          application_id: string
          borrower_name: string
          conditions?: string[] | null
          created_at?: string
          dscr?: number | null
          expiration_date?: string | null
          id?: string
          interest_rate: number
          lender_id: string
          loan_amount: number
          ltv?: number | null
          origination_points?: number | null
          pdf_url?: string | null
          property_address: string
          sent_at?: string | null
          status?: string
          term_months: number
          term_sheet_number?: string | null
        }
        Update: {
          accepted_at?: string | null
          application_id?: string
          borrower_name?: string
          conditions?: string[] | null
          created_at?: string
          dscr?: number | null
          expiration_date?: string | null
          id?: string
          interest_rate?: number
          lender_id?: string
          loan_amount?: number
          ltv?: number | null
          origination_points?: number | null
          pdf_url?: string | null
          property_address?: string
          sent_at?: string | null
          status?: string
          term_months?: number
          term_sheet_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "term_sheets_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "lender_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_sheets_lender_id_fkey"
            columns: ["lender_id"]
            isOneToOne: false
            referencedRelation: "lenders"
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
      unmatched_messages: {
        Row: {
          ai_confidence_score: number | null
          ai_suggested_contact_id: string | null
          business_id: string | null
          channel: string
          created_at: string
          id: string
          matched_at: string | null
          matched_by: string | null
          message_content: string | null
          sender_email: string | null
          sender_phone: string | null
          status: string | null
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_suggested_contact_id?: string | null
          business_id?: string | null
          channel: string
          created_at?: string
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          message_content?: string | null
          sender_email?: string | null
          sender_phone?: string | null
          status?: string | null
        }
        Update: {
          ai_confidence_score?: number | null
          ai_suggested_contact_id?: string | null
          business_id?: string | null
          channel?: string
          created_at?: string
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          message_content?: string | null
          sender_email?: string | null
          sender_phone?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unmatched_messages_ai_suggested_contact_id_fkey"
            columns: ["ai_suggested_contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unmatched_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unmatched_messages_matched_by_fkey"
            columns: ["matched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          extra_roles: string[] | null
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: string | null
          primary_role: string
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          extra_roles?: string[] | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          primary_role: string
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          extra_roles?: string[] | null
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: string | null
          primary_role?: string
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      va_attempts: {
        Row: {
          answers: Json | null
          completed_at: string | null
          created_at: string | null
          id: string
          lesson_id: string | null
          passed: boolean | null
          score: number | null
          time_spent_minutes: number | null
          va_id: string | null
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          passed?: boolean | null
          score?: number | null
          time_spent_minutes?: number | null
          va_id?: string | null
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          lesson_id?: string | null
          passed?: boolean | null
          score?: number | null
          time_spent_minutes?: number | null
          va_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "va_attempts_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "va_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "va_attempts_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "vas"
            referencedColumns: ["id"]
          },
        ]
      }
      va_lessons: {
        Row: {
          category: string
          content: string | null
          created_at: string | null
          difficulty: number | null
          estimated_minutes: number | null
          id: string
          is_required: boolean | null
          order_index: number | null
          quiz_questions: Json | null
          title: string
          updated_at: string | null
          video_url: string | null
          xp_reward: number | null
        }
        Insert: {
          category: string
          content?: string | null
          created_at?: string | null
          difficulty?: number | null
          estimated_minutes?: number | null
          id?: string
          is_required?: boolean | null
          order_index?: number | null
          quiz_questions?: Json | null
          title: string
          updated_at?: string | null
          video_url?: string | null
          xp_reward?: number | null
        }
        Update: {
          category?: string
          content?: string | null
          created_at?: string | null
          difficulty?: number | null
          estimated_minutes?: number | null
          id?: string
          is_required?: boolean | null
          order_index?: number | null
          quiz_questions?: Json | null
          title?: string
          updated_at?: string | null
          video_url?: string | null
          xp_reward?: number | null
        }
        Relationships: []
      }
      va_performance_metrics: {
        Row: {
          ai_evaluation_score: number | null
          appointments_set: number | null
          call_attempts: number | null
          contacts_made: number | null
          contracts_signed: number | null
          conversations: number | null
          created_at: string | null
          data_entries: number | null
          date: string | null
          id: string
          va_id: string | null
        }
        Insert: {
          ai_evaluation_score?: number | null
          appointments_set?: number | null
          call_attempts?: number | null
          contacts_made?: number | null
          contracts_signed?: number | null
          conversations?: number | null
          created_at?: string | null
          data_entries?: number | null
          date?: string | null
          id?: string
          va_id?: string | null
        }
        Update: {
          ai_evaluation_score?: number | null
          appointments_set?: number | null
          call_attempts?: number | null
          contacts_made?: number | null
          contracts_signed?: number | null
          conversations?: number | null
          created_at?: string | null
          data_entries?: number | null
          date?: string | null
          id?: string
          va_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "va_performance_metrics_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "vas"
            referencedColumns: ["id"]
          },
        ]
      }
      va_permissions: {
        Row: {
          allowed_brands: string[]
          can_access_ai_engine: boolean | null
          can_access_dashboard: boolean | null
          can_access_delivery_routing: boolean | null
          can_access_upload_engine: boolean | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          va_role: Database["public"]["Enums"]["va_role"]
        }
        Insert: {
          allowed_brands?: string[]
          can_access_ai_engine?: boolean | null
          can_access_dashboard?: boolean | null
          can_access_delivery_routing?: boolean | null
          can_access_upload_engine?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          va_role: Database["public"]["Enums"]["va_role"]
        }
        Update: {
          allowed_brands?: string[]
          can_access_ai_engine?: boolean | null
          can_access_dashboard?: boolean | null
          can_access_delivery_routing?: boolean | null
          can_access_upload_engine?: boolean | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          va_role?: Database["public"]["Enums"]["va_role"]
        }
        Relationships: []
      }
      va_profiles: {
        Row: {
          created_at: string | null
          id: string
          label: string | null
          notes: string | null
          permissions_bundle: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          permissions_bundle?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string | null
          notes?: string | null
          permissions_bundle?: string | null
          user_id?: string
        }
        Relationships: []
      }
      va_scores: {
        Row: {
          created_at: string | null
          id: string
          metric_type: string
          metric_value: number | null
          notes: string | null
          period_end: string | null
          period_start: string | null
          va_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metric_type: string
          metric_value?: number | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          va_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metric_type?: string
          metric_value?: number | null
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          va_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "va_scores_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "vas"
            referencedColumns: ["id"]
          },
        ]
      }
      va_skills: {
        Row: {
          created_at: string | null
          id: string
          last_evaluated: string | null
          proficiency_level: number | null
          skill_type: string
          va_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_evaluated?: string | null
          proficiency_level?: number | null
          skill_type: string
          va_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_evaluated?: string | null
          proficiency_level?: number | null
          skill_type?: string
          va_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "va_skills_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "vas"
            referencedColumns: ["id"]
          },
        ]
      }
      va_tasks: {
        Row: {
          ai_instructions: Json | null
          assigned_at: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          entity_id: string | null
          entity_type: string | null
          id: string
          priority: number | null
          result: Json | null
          status: string | null
          task_type: string
          updated_at: string | null
          va_id: string | null
        }
        Insert: {
          ai_instructions?: Json | null
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          priority?: number | null
          result?: Json | null
          status?: string | null
          task_type: string
          updated_at?: string | null
          va_id?: string | null
        }
        Update: {
          ai_instructions?: Json | null
          assigned_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          priority?: number | null
          result?: Json | null
          status?: string | null
          task_type?: string
          updated_at?: string | null
          va_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "va_tasks_va_id_fkey"
            columns: ["va_id"]
            isOneToOne: false
            referencedRelation: "vas"
            referencedColumns: ["id"]
          },
        ]
      }
      vas: {
        Row: {
          created_at: string | null
          email: string | null
          hired_date: string | null
          id: string
          name: string
          phone: string | null
          skill_score: number | null
          status: string | null
          success_rate: number | null
          tier: number | null
          total_tasks_completed: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          hired_date?: string | null
          id?: string
          name: string
          phone?: string | null
          skill_score?: number | null
          status?: string | null
          success_rate?: number | null
          tier?: number | null
          total_tasks_completed?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          hired_date?: string | null
          id?: string
          name?: string
          phone?: string | null
          skill_score?: number | null
          status?: string | null
          success_rate?: number | null
          tier?: number | null
          total_tasks_completed?: number | null
          updated_at?: string | null
          user_id?: string | null
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
      wholesale_ai_sourcing: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          product_name: string
          status: string | null
          suggested_resale_price: number | null
          suggested_supplier: string | null
          supplier_cost: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          product_name: string
          status?: string | null
          suggested_resale_price?: number | null
          suggested_supplier?: string | null
          supplier_cost?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          product_name?: string
          status?: string | null
          suggested_resale_price?: number | null
          suggested_supplier?: string | null
          supplier_cost?: number | null
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
      wholesale_costs: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          notes: string | null
          order_reference: string | null
          product_type: string
          purchase_date: string
          quality_rating: number | null
          quantity: number
          received_date: string | null
          supplier: string
          total_cost: number
          unit_cost: number
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_reference?: string | null
          product_type: string
          purchase_date?: string
          quality_rating?: number | null
          quantity?: number
          received_date?: string | null
          supplier: string
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_reference?: string | null
          product_type?: string
          purchase_date?: string
          quality_rating?: number | null
          quantity?: number
          received_date?: string | null
          supplier?: string
          total_cost?: number
          unit_cost?: number
        }
        Relationships: []
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
          boxes: number | null
          brand: string | null
          commission_amount: number
          commission_percentage: number
          company_id: string | null
          created_at: string
          created_by: string | null
          customer_type: string | null
          delivered_at: string | null
          delivery_method: string
          driver_id: string | null
          id: string
          notes: string | null
          order_date: string | null
          route_id: string | null
          status: string
          store_id: string
          subtotal: number
          total: number
          tubes_per_box: number | null
          tubes_total: number | null
          updated_at: string
          wholesaler_id: string
        }
        Insert: {
          boxes?: number | null
          brand?: string | null
          commission_amount?: number
          commission_percentage?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          delivered_at?: string | null
          delivery_method?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          route_id?: string | null
          status?: string
          store_id: string
          subtotal?: number
          total?: number
          tubes_per_box?: number | null
          tubes_total?: number | null
          updated_at?: string
          wholesaler_id: string
        }
        Update: {
          boxes?: number | null
          brand?: string | null
          commission_amount?: number
          commission_percentage?: number
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_type?: string | null
          delivered_at?: string | null
          delivery_method?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          order_date?: string | null
          route_id?: string | null
          status?: string
          store_id?: string
          subtotal?: number
          total?: number
          tubes_per_box?: number | null
          tubes_total?: number | null
          updated_at?: string
          wholesaler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      wholesale_orders_platform: {
        Row: {
          buyer_company_id: string | null
          created_at: string | null
          id: string
          status: string | null
          total_amount: number | null
          wholesaler_id: string | null
        }
        Insert: {
          buyer_company_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          total_amount?: number | null
          wholesaler_id?: string | null
        }
        Update: {
          buyer_company_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          total_amount?: number | null
          wholesaler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesale_orders_platform_buyer_company_id_fkey"
            columns: ["buyer_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wholesale_orders_platform_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesalers"
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
      wholesaler_accounts: {
        Row: {
          commission_rate: number | null
          company_id: string | null
          contact_name: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          region: string | null
          updated_at: string | null
        }
        Insert: {
          commission_rate?: number | null
          company_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          region?: string | null
          updated_at?: string | null
        }
        Update: {
          commission_rate?: number | null
          company_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          region?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesaler_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      wholesaler_profiles: {
        Row: {
          company_name: string
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          shipping_preferences: Json | null
          status: string
          tax_id: string | null
          user_id: string
          website_url: string | null
          wholesaler_type: string | null
        }
        Insert: {
          company_name: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          shipping_preferences?: Json | null
          status?: string
          tax_id?: string | null
          user_id: string
          website_url?: string | null
          wholesaler_type?: string | null
        }
        Update: {
          company_name?: string
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          shipping_preferences?: Json | null
          status?: string
          tax_id?: string | null
          user_id?: string
          website_url?: string | null
          wholesaler_type?: string | null
        }
        Relationships: []
      }
      wholesalers: {
        Row: {
          company_id: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string | null
        }
        Insert: {
          company_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string | null
        }
        Update: {
          company_id?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesalers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
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
      can_access_brand: {
        Args: { _brand: string; _user_id: string }
        Returns: boolean
      }
      get_user_businesses: {
        Args: { user_id: string }
        Returns: {
          business_id: string
          business_name: string
          business_slug: string
          logo_url: string
          member_role: string
        }[]
      }
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
      process_automation_event: {
        Args: {
          p_brand?: string
          p_business_id?: string
          p_entity_id: string
          p_entity_type: string
          p_event_type: string
          p_metadata?: Json
        }
        Returns: undefined
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
        | "pod_worker"
        | "realestate_worker"
      brand_type: "GasMask" | "HotMama" | "GrabbaRUs" | "HotScalati"
      credit_terms_type: "COD" | "NET7" | "NET14" | "NET30"
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
      loyalty_level_type: "Bronze" | "Silver" | "Gold" | "VIP"
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
      template_category:
        | "reorder_reminder"
        | "thank_you"
        | "delivery_confirmation"
        | "upsell"
        | "late_payment"
        | "promotion"
        | "cold_outreach"
        | "wholesale_invitation"
        | "ambassador_recruitment"
        | "multi_brand_announcement"
        | "welcome_sequence"
        | "invoice"
        | "receipt"
        | "onboarding"
        | "follow_up"
        | "account_update"
        | "contract_renewal"
        | "abandoned_cart"
        | "grant_request"
        | "store_reorder_call"
        | "wholesale_warm_call"
        | "new_store_onboarding"
        | "collection_reminder"
        | "funding_intake"
        | "credit_repair_update"
        | "chauffeur_confirmation"
        | "model_verification"
      template_type: "sms" | "email" | "call_script" | "tone_pack"
      va_role:
        | "grabba_cluster_va"
        | "gasmask_va"
        | "hotmama_va"
        | "grabba_r_us_va"
        | "hot_scalati_va"
        | "toptier_va"
        | "unforgettable_va"
        | "iclean_va"
        | "playboxxx_va"
        | "funding_va"
        | "grants_va"
        | "credit_repair_va"
        | "special_needs_va"
        | "sports_betting_va"
        | "admin"
        | "owner"
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
        "pod_worker",
        "realestate_worker",
      ],
      brand_type: ["GasMask", "HotMama", "GrabbaRUs", "HotScalati"],
      credit_terms_type: ["COD", "NET7", "NET14", "NET30"],
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
      loyalty_level_type: ["Bronze", "Silver", "Gold", "VIP"],
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
      template_category: [
        "reorder_reminder",
        "thank_you",
        "delivery_confirmation",
        "upsell",
        "late_payment",
        "promotion",
        "cold_outreach",
        "wholesale_invitation",
        "ambassador_recruitment",
        "multi_brand_announcement",
        "welcome_sequence",
        "invoice",
        "receipt",
        "onboarding",
        "follow_up",
        "account_update",
        "contract_renewal",
        "abandoned_cart",
        "grant_request",
        "store_reorder_call",
        "wholesale_warm_call",
        "new_store_onboarding",
        "collection_reminder",
        "funding_intake",
        "credit_repair_update",
        "chauffeur_confirmation",
        "model_verification",
      ],
      template_type: ["sms", "email", "call_script", "tone_pack"],
      va_role: [
        "grabba_cluster_va",
        "gasmask_va",
        "hotmama_va",
        "grabba_r_us_va",
        "hot_scalati_va",
        "toptier_va",
        "unforgettable_va",
        "iclean_va",
        "playboxxx_va",
        "funding_va",
        "grants_va",
        "credit_repair_va",
        "special_needs_va",
        "sports_betting_va",
        "admin",
        "owner",
      ],
      visit_type: ["delivery", "inventoryCheck", "coldLead", "followUp"],
    },
  },
} as const
