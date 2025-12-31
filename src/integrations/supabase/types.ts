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
      accounting_ledger: {
        Row: {
          amount: number
          brand: string | null
          category: string | null
          created_at: string | null
          direction: string
          id: string
          notes: string | null
          recorded_by: string | null
          source_id: string | null
          source_type: string
        }
        Insert: {
          amount: number
          brand?: string | null
          category?: string | null
          created_at?: string | null
          direction: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          source_id?: string | null
          source_type: string
        }
        Update: {
          amount?: number
          brand?: string | null
          category?: string | null
          created_at?: string | null
          direction?: string
          id?: string
          notes?: string | null
          recorded_by?: string | null
          source_id?: string | null
          source_type?: string
        }
        Relationships: []
      }
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
      active_speaker_log: {
        Row: {
          agent_id: string | null
          ended_at: string | null
          id: string
          participant_id: string | null
          participant_type: string
          session_id: string
          started_at: string
        }
        Insert: {
          agent_id?: string | null
          ended_at?: string | null
          id?: string
          participant_id?: string | null
          participant_type: string
          session_id: string
          started_at?: string
        }
        Update: {
          agent_id?: string | null
          ended_at?: string | null
          id?: string
          participant_id?: string | null
          participant_type?: string
          session_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_speaker_log_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_speaker_log_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "call_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_speaker_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_user_id: string
          after: Json | null
          before: Json | null
          created_at: string
          id: string
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_user_id: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
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
      affiliate_clicks: {
        Row: {
          ambassador_id: string | null
          converted: boolean | null
          created_at: string | null
          id: string
          ip_address: string | null
          landing_page: string | null
          referral_code: string | null
          user_agent: string | null
        }
        Insert: {
          ambassador_id?: string | null
          converted?: boolean | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          referral_code?: string | null
          user_agent?: string | null
        }
        Update: {
          ambassador_id?: string | null
          converted?: boolean | null
          created_at?: string | null
          id?: string
          ip_address?: string | null
          landing_page?: string | null
          referral_code?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_conversions: {
        Row: {
          ambassador_id: string | null
          click_id: string | null
          commission_amount: number | null
          commission_rate: number | null
          created_at: string | null
          id: string
          order_id: string | null
          paid_at: string | null
          status: string | null
        }
        Insert: {
          ambassador_id?: string | null
          click_id?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          status?: string | null
        }
        Update: {
          ambassador_id?: string | null
          click_id?: string | null
          commission_amount?: number | null
          commission_rate?: number | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          paid_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_conversions_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_click_id_fkey"
            columns: ["click_id"]
            isOneToOne: false
            referencedRelation: "affiliate_clicks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_conversions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_assignments: {
        Row: {
          agent_id: string
          ai_notes: string | null
          business_id: string | null
          completed_at: string | null
          contact_id: string | null
          created_at: string
          id: string
          message_id: string | null
          priority: string | null
          result: Json | null
          started_at: string | null
          status: string
          store_id: string | null
          task_type: string
        }
        Insert: {
          agent_id: string
          ai_notes?: string | null
          business_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          priority?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          store_id?: string | null
          task_type: string
        }
        Update: {
          agent_id?: string
          ai_notes?: string | null
          business_id?: string | null
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          priority?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          store_id?: string | null
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_assignments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_assignments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_handoff_logs: {
        Row: {
          accepted: boolean | null
          assignment_id: string | null
          context: Json | null
          created_at: string
          from_agent_id: string
          id: string
          reason: string
          to_agent_id: string
        }
        Insert: {
          accepted?: boolean | null
          assignment_id?: string | null
          context?: Json | null
          created_at?: string
          from_agent_id: string
          id?: string
          reason: string
          to_agent_id: string
        }
        Update: {
          accepted?: boolean | null
          assignment_id?: string | null
          context?: Json | null
          created_at?: string
          from_agent_id?: string
          id?: string
          reason?: string
          to_agent_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_handoff_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "agent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_handoff_logs_from_agent_id_fkey"
            columns: ["from_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_handoff_logs_to_agent_id_fkey"
            columns: ["to_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_store_memory: {
        Row: {
          agent_id: string
          confidence: number | null
          created_at: string
          id: string
          memory_type: string
          memory_value: Json
          store_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          confidence?: number | null
          created_at?: string
          id?: string
          memory_type: string
          memory_value?: Json
          store_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          confidence?: number | null
          created_at?: string
          id?: string
          memory_type?: string
          memory_value?: Json
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_store_memory_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_store_memory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_supervision_logs: {
        Row: {
          agent_id: string
          assignment_id: string | null
          corrected_action: Json | null
          created_at: string
          decision: string
          id: string
          notes: string | null
          original_action: Json | null
          supervisor_id: string
        }
        Insert: {
          agent_id: string
          assignment_id?: string | null
          corrected_action?: Json | null
          created_at?: string
          decision: string
          id?: string
          notes?: string | null
          original_action?: Json | null
          supervisor_id: string
        }
        Update: {
          agent_id?: string
          assignment_id?: string | null
          corrected_action?: Json | null
          created_at?: string
          decision?: string
          id?: string
          notes?: string | null
          original_action?: Json | null
          supervisor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_supervision_logs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_supervision_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "agent_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_supervision_logs_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tone_corrections: {
        Row: {
          agent_id: string | null
          corrected_tone: string | null
          created_at: string
          id: string
          message_id: string | null
          previous_tone: string | null
          reason: string | null
        }
        Insert: {
          agent_id?: string | null
          corrected_tone?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          previous_tone?: string | null
          reason?: string | null
        }
        Update: {
          agent_id?: string | null
          corrected_tone?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          previous_tone?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_tone_corrections_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          active: boolean | null
          business_id: string | null
          capabilities: Json | null
          created_at: string
          default_language_profile_id: string | null
          default_personality_profile_id: string | null
          description: string | null
          id: string
          name: string
          persona_id: string | null
          role: string
          success_rate: number | null
          tasks_completed: number | null
        }
        Insert: {
          active?: boolean | null
          business_id?: string | null
          capabilities?: Json | null
          created_at?: string
          default_language_profile_id?: string | null
          default_personality_profile_id?: string | null
          description?: string | null
          id?: string
          name: string
          persona_id?: string | null
          role: string
          success_rate?: number | null
          tasks_completed?: number | null
        }
        Update: {
          active?: boolean | null
          business_id?: string | null
          capabilities?: Json | null
          created_at?: string
          default_language_profile_id?: string | null
          default_personality_profile_id?: string | null
          description?: string | null
          id?: string
          name?: string
          persona_id?: string | null
          role?: string
          success_rate?: number | null
          tasks_completed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_default_language_profile_id_fkey"
            columns: ["default_language_profile_id"]
            isOneToOne: false
            referencedRelation: "language_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_default_personality_profile_id_fkey"
            columns: ["default_personality_profile_id"]
            isOneToOne: false
            referencedRelation: "personality_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "voice_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_approval_queue: {
        Row: {
          action_description: string
          ai_worker_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          payload: Json | null
          request_type: string
          requested_by: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string | null
          status: string | null
        }
        Insert: {
          action_description: string
          ai_worker_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payload?: Json | null
          request_type: string
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string | null
        }
        Update: {
          action_description?: string
          ai_worker_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          payload?: Json | null
          request_type?: string
          requested_by?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_approval_queue_ai_worker_id_fkey"
            columns: ["ai_worker_id"]
            isOneToOne: false
            referencedRelation: "ai_workers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_campaigns: {
        Row: {
          answered_calls: number | null
          auto_followup_text: boolean | null
          business_id: string | null
          call_number_id: string | null
          completed_at: string | null
          completed_calls: number | null
          control_flow_id: string | null
          conversion_count: number | null
          created_at: string
          description: string | null
          dynamic_persona_switching: boolean | null
          experiment_mode: boolean | null
          experiment_split: Json | null
          failed_calls: number | null
          flow_id: string | null
          followup_template: string | null
          id: string
          max_calls_per_minute: number | null
          max_concurrent_calls: number | null
          max_texts_per_minute: number | null
          name: string
          persona_id: string | null
          prediction_snapshot: Json | null
          predictive_goal: string | null
          priority_mode: string | null
          retry_window_hours: number | null
          run_parallel: boolean | null
          scheduled_at: string | null
          sentiment_adaptation: boolean | null
          sequence_steps: Json | null
          sms_number_id: string | null
          started_at: string | null
          status: string | null
          target_segment: string | null
          total_targets: number | null
          updated_at: string
          variant_a_flow_id: string | null
          variant_b_flow_id: string | null
          vertical_id: string | null
          voicemail_count: number | null
        }
        Insert: {
          answered_calls?: number | null
          auto_followup_text?: boolean | null
          business_id?: string | null
          call_number_id?: string | null
          completed_at?: string | null
          completed_calls?: number | null
          control_flow_id?: string | null
          conversion_count?: number | null
          created_at?: string
          description?: string | null
          dynamic_persona_switching?: boolean | null
          experiment_mode?: boolean | null
          experiment_split?: Json | null
          failed_calls?: number | null
          flow_id?: string | null
          followup_template?: string | null
          id?: string
          max_calls_per_minute?: number | null
          max_concurrent_calls?: number | null
          max_texts_per_minute?: number | null
          name: string
          persona_id?: string | null
          prediction_snapshot?: Json | null
          predictive_goal?: string | null
          priority_mode?: string | null
          retry_window_hours?: number | null
          run_parallel?: boolean | null
          scheduled_at?: string | null
          sentiment_adaptation?: boolean | null
          sequence_steps?: Json | null
          sms_number_id?: string | null
          started_at?: string | null
          status?: string | null
          target_segment?: string | null
          total_targets?: number | null
          updated_at?: string
          variant_a_flow_id?: string | null
          variant_b_flow_id?: string | null
          vertical_id?: string | null
          voicemail_count?: number | null
        }
        Update: {
          answered_calls?: number | null
          auto_followup_text?: boolean | null
          business_id?: string | null
          call_number_id?: string | null
          completed_at?: string | null
          completed_calls?: number | null
          control_flow_id?: string | null
          conversion_count?: number | null
          created_at?: string
          description?: string | null
          dynamic_persona_switching?: boolean | null
          experiment_mode?: boolean | null
          experiment_split?: Json | null
          failed_calls?: number | null
          flow_id?: string | null
          followup_template?: string | null
          id?: string
          max_calls_per_minute?: number | null
          max_concurrent_calls?: number | null
          max_texts_per_minute?: number | null
          name?: string
          persona_id?: string | null
          prediction_snapshot?: Json | null
          predictive_goal?: string | null
          priority_mode?: string | null
          retry_window_hours?: number | null
          run_parallel?: boolean | null
          scheduled_at?: string | null
          sentiment_adaptation?: boolean | null
          sequence_steps?: Json | null
          sms_number_id?: string | null
          started_at?: string | null
          status?: string | null
          target_segment?: string | null
          total_targets?: number | null
          updated_at?: string
          variant_a_flow_id?: string | null
          variant_b_flow_id?: string | null
          vertical_id?: string | null
          voicemail_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_campaigns_call_number_id_fkey"
            columns: ["call_number_id"]
            isOneToOne: false
            referencedRelation: "business_phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_campaigns_sms_number_id_fkey"
            columns: ["sms_number_id"]
            isOneToOne: false
            referencedRelation: "business_phone_numbers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_campaigns_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_logs: {
        Row: {
          ai_summary: string | null
          business_id: string | null
          contact_id: string | null
          created_at: string | null
          duration_seconds: number | null
          flow_id: string | null
          flow_path: Json | null
          follow_up_created: boolean | null
          id: string
          language: string | null
          outcome: string | null
          persona_id: string | null
          phone_number: string | null
          script_id: string | null
          store_id: string | null
          tone_used: string | null
          transcription: string | null
          voice_id: string | null
          voice_profile_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          business_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          flow_id?: string | null
          flow_path?: Json | null
          follow_up_created?: boolean | null
          id?: string
          language?: string | null
          outcome?: string | null
          persona_id?: string | null
          phone_number?: string | null
          script_id?: string | null
          store_id?: string | null
          tone_used?: string | null
          transcription?: string | null
          voice_id?: string | null
          voice_profile_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          business_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          flow_id?: string | null
          flow_path?: Json | null
          follow_up_created?: boolean | null
          id?: string
          language?: string | null
          outcome?: string | null
          persona_id?: string | null
          phone_number?: string | null
          script_id?: string | null
          store_id?: string | null
          tone_used?: string | null
          transcription?: string | null
          voice_id?: string | null
          voice_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_logs_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "call_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_logs_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "voice_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_logs_voice_profile_id_fkey"
            columns: ["voice_profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_sessions: {
        Row: {
          ai_notes: string | null
          assigned_agent_id: string | null
          business_id: string | null
          call_id: string | null
          call_summary: string | null
          contact_id: string | null
          created_at: string
          current_node_id: string | null
          flow_id: string | null
          handoff_state: string
          id: string
          is_multi_party: boolean | null
          persona_id: string | null
          primary_agent_id: string | null
          sentiment_trend: string | null
          status: string
          store_id: string | null
          switchboard_agent_id: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          ai_notes?: string | null
          assigned_agent_id?: string | null
          business_id?: string | null
          call_id?: string | null
          call_summary?: string | null
          contact_id?: string | null
          created_at?: string
          current_node_id?: string | null
          flow_id?: string | null
          handoff_state?: string
          id?: string
          is_multi_party?: boolean | null
          persona_id?: string | null
          primary_agent_id?: string | null
          sentiment_trend?: string | null
          status?: string
          store_id?: string | null
          switchboard_agent_id?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          ai_notes?: string | null
          assigned_agent_id?: string | null
          business_id?: string | null
          call_id?: string | null
          call_summary?: string | null
          contact_id?: string | null
          created_at?: string
          current_node_id?: string | null
          flow_id?: string | null
          handoff_state?: string
          id?: string
          is_multi_party?: boolean | null
          persona_id?: string | null
          primary_agent_id?: string | null
          sentiment_trend?: string | null
          status?: string
          store_id?: string | null
          switchboard_agent_id?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_sessions_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "ai_call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_sessions_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "call_flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_sessions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "call_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_sessions_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "voice_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_sessions_primary_agent_id_fkey"
            columns: ["primary_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_call_sessions_switchboard_agent_id_fkey"
            columns: ["switchboard_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_call_tone_events: {
        Row: {
          created_at: string
          id: string
          new_tone: string
          old_tone: string | null
          reason: string | null
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          new_tone: string
          old_tone?: string | null
          reason?: string | null
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          new_tone?: string
          old_tone?: string | null
          reason?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_call_tone_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_call_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      ai_director_reports: {
        Row: {
          actual_revenue: number | null
          business_id: string | null
          campaigns_created: number | null
          campaigns_optimized: number | null
          campaigns_paused: number | null
          created_at: string
          id: string
          predicted_revenue: number | null
          recommendations: Json | null
          report_date: string
          scripts_updated: number | null
          stores_shifted: number | null
          summary: string | null
          voices_assigned: number | null
        }
        Insert: {
          actual_revenue?: number | null
          business_id?: string | null
          campaigns_created?: number | null
          campaigns_optimized?: number | null
          campaigns_paused?: number | null
          created_at?: string
          id?: string
          predicted_revenue?: number | null
          recommendations?: Json | null
          report_date?: string
          scripts_updated?: number | null
          stores_shifted?: number | null
          summary?: string | null
          voices_assigned?: number | null
        }
        Update: {
          actual_revenue?: number | null
          business_id?: string | null
          campaigns_created?: number | null
          campaigns_optimized?: number | null
          campaigns_paused?: number | null
          created_at?: string
          id?: string
          predicted_revenue?: number | null
          recommendations?: Json | null
          report_date?: string
          scripts_updated?: number | null
          stores_shifted?: number | null
          summary?: string | null
          voices_assigned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_director_reports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
      ai_game_predictions: {
        Row: {
          ai_confidence_score: number | null
          ai_predicted_probability: number | null
          ai_predicted_winner: string
          away_team: string
          created_at: string
          game_date: string
          game_id: string
          home_team: string
          id: string
          locked_at: string | null
          model_version: string | null
          prediction_source: string | null
          sport: string
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_predicted_probability?: number | null
          ai_predicted_winner: string
          away_team: string
          created_at?: string
          game_date: string
          game_id: string
          home_team: string
          id?: string
          locked_at?: string | null
          model_version?: string | null
          prediction_source?: string | null
          sport?: string
        }
        Update: {
          ai_confidence_score?: number | null
          ai_predicted_probability?: number | null
          ai_predicted_winner?: string
          away_team?: string
          created_at?: string
          game_date?: string
          game_id?: string
          home_team?: string
          id?: string
          locked_at?: string | null
          model_version?: string | null
          prediction_source?: string | null
          sport?: string
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
      ai_outbound_director_tasks: {
        Row: {
          business_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          payload: Json | null
          priority: string | null
          result: Json | null
          started_at: string | null
          status: string
          task_type: string
        }
        Insert: {
          business_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          priority?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          task_type: string
        }
        Update: {
          business_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          payload?: Json | null
          priority?: string | null
          result?: Json | null
          started_at?: string | null
          status?: string
          task_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_outbound_director_tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
      ai_text_sequences: {
        Row: {
          business_id: string | null
          created_at: string | null
          created_by: string | null
          goal: string | null
          id: string
          is_active: boolean | null
          steps: Json | null
          target_filter: Json | null
          title: string
          updated_at: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          created_by?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean | null
          steps?: Json | null
          target_filter?: Json | null
          title: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          created_by?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean | null
          steps?: Json | null
          target_filter?: Json | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_text_sequences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      audit_log: {
        Row: {
          acted_at: string | null
          acted_by: string | null
          action: string
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
        }
        Insert: {
          acted_at?: string | null
          acted_by?: string | null
          action: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
        }
        Update: {
          acted_at?: string | null
          acted_by?: string | null
          action?: string
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
        }
        Relationships: []
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
      audit_trail: {
        Row: {
          after: Json | null
          before: Json | null
          created_at: string | null
          event: string | null
          id: string
          module: string | null
          user_id: string | null
        }
        Insert: {
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          event?: string | null
          id?: string
          module?: string | null
          user_id?: string | null
        }
        Update: {
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          event?: string | null
          id?: string
          module?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      automated_notifications: {
        Row: {
          created_at: string
          generated_by: string
          id: string
          message_text: string
          related_entity_id: string | null
          related_entity_type: string | null
          status: string | null
          target_role: string | null
          target_user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          generated_by?: string
          id?: string
          message_text: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string | null
          target_role?: string | null
          target_user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          generated_by?: string
          id?: string
          message_text?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          status?: string | null
          target_role?: string | null
          target_user_id?: string | null
          viewed_at?: string | null
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
      bankrolls: {
        Row: {
          created_at: string
          global_bankroll: number
          id: string
          max_pct_per_entry: number
          max_pct_per_state_per_day: number
          state_bankrolls: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          global_bankroll?: number
          id?: string
          max_pct_per_entry?: number
          max_pct_per_state_per_day?: number
          state_bankrolls?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          global_bankroll?: number
          id?: string
          max_pct_per_entry?: number
          max_pct_per_state_per_day?: number
          state_bankrolls?: Json
          updated_at?: string
          user_id?: string
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
      bets_executed: {
        Row: {
          created_at: string | null
          execution_time: string | null
          id: string
          notes: string | null
          odds_received: number | null
          platform: string
          profit_units: number | null
          result: Database["public"]["Enums"]["bet_result"] | null
          simulated_bet_id: string | null
          stake_units: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          execution_time?: string | null
          id?: string
          notes?: string | null
          odds_received?: number | null
          platform: string
          profit_units?: number | null
          result?: Database["public"]["Enums"]["bet_result"] | null
          simulated_bet_id?: string | null
          stake_units: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          execution_time?: string | null
          id?: string
          notes?: string | null
          odds_received?: number | null
          platform?: string
          profit_units?: number | null
          result?: Database["public"]["Enums"]["bet_result"] | null
          simulated_bet_id?: string | null
          stake_units?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bets_executed_simulated_bet_id_fkey"
            columns: ["simulated_bet_id"]
            isOneToOne: false
            referencedRelation: "bets_simulated"
            referencedColumns: ["id"]
          },
        ]
      }
      bets_simulated: {
        Row: {
          ai_probability: number | null
          ai_projection: number | null
          bet_type: string
          calibration_factors: Json | null
          confidence_score: number | null
          created_at: string | null
          data_completeness: number | null
          description: string | null
          edge: number | null
          estimated_probability: number | null
          id: string
          implied_probability: number | null
          market_line_id: string | null
          platform: string
          recommendation: string | null
          simulated_roi: number | null
          source: string
          sportsbook_line_id: string | null
          status: Database["public"]["Enums"]["bet_status"] | null
          updated_at: string | null
          volatility_score: number | null
        }
        Insert: {
          ai_probability?: number | null
          ai_projection?: number | null
          bet_type: string
          calibration_factors?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          data_completeness?: number | null
          description?: string | null
          edge?: number | null
          estimated_probability?: number | null
          id?: string
          implied_probability?: number | null
          market_line_id?: string | null
          platform: string
          recommendation?: string | null
          simulated_roi?: number | null
          source?: string
          sportsbook_line_id?: string | null
          status?: Database["public"]["Enums"]["bet_status"] | null
          updated_at?: string | null
          volatility_score?: number | null
        }
        Update: {
          ai_probability?: number | null
          ai_projection?: number | null
          bet_type?: string
          calibration_factors?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          data_completeness?: number | null
          description?: string | null
          edge?: number | null
          estimated_probability?: number | null
          id?: string
          implied_probability?: number | null
          market_line_id?: string | null
          platform?: string
          recommendation?: string | null
          simulated_roi?: number | null
          source?: string
          sportsbook_line_id?: string | null
          status?: Database["public"]["Enums"]["bet_status"] | null
          updated_at?: string | null
          volatility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bets_simulated_market_line_id_fkey"
            columns: ["market_line_id"]
            isOneToOne: false
            referencedRelation: "market_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_simulated_sportsbook_line_id_fkey"
            columns: ["sportsbook_line_id"]
            isOneToOne: false
            referencedRelation: "sportsbook_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      biker_issues: {
        Row: {
          assigned_biker_id: string | null
          business_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          escalated: boolean | null
          escalates_at: string | null
          id: string
          issue_type: string
          location_id: string | null
          photos: string[] | null
          reported_by_biker_id: string | null
          severity: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_biker_id?: string | null
          business_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          escalated?: boolean | null
          escalates_at?: string | null
          id?: string
          issue_type: string
          location_id?: string | null
          photos?: string[] | null
          reported_by_biker_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_biker_id?: string | null
          business_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          escalated?: boolean | null
          escalates_at?: string | null
          id?: string
          issue_type?: string
          location_id?: string | null
          photos?: string[] | null
          reported_by_biker_id?: string | null
          severity?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biker_issues_assigned_biker_id_fkey"
            columns: ["assigned_biker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biker_issues_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biker_issues_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biker_issues_reported_by_biker_id_fkey"
            columns: ["reported_by_biker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      biker_locations: {
        Row: {
          accuracy_meters: number | null
          biker_id: string
          business_id: string | null
          created_at: string
          id: string
          lat: number
          lng: number
          recorded_at: string
        }
        Insert: {
          accuracy_meters?: number | null
          biker_id: string
          business_id?: string | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          recorded_at?: string
        }
        Update: {
          accuracy_meters?: number | null
          biker_id?: string
          business_id?: string | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "biker_locations_biker_id_fkey"
            columns: ["biker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biker_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      biker_performance_daily: {
        Row: {
          avg_time_to_submit_minutes: number | null
          biker_id: string
          business_id: string | null
          coaching_notes: string | null
          created_at: string
          date: string
          id: string
          issues_overdue: number | null
          issues_reported: number | null
          score: number | null
          tasks_approved: number | null
          tasks_assigned: number | null
          tasks_late: number | null
          tasks_rejected: number | null
          tasks_submitted: number | null
        }
        Insert: {
          avg_time_to_submit_minutes?: number | null
          biker_id: string
          business_id?: string | null
          coaching_notes?: string | null
          created_at?: string
          date: string
          id?: string
          issues_overdue?: number | null
          issues_reported?: number | null
          score?: number | null
          tasks_approved?: number | null
          tasks_assigned?: number | null
          tasks_late?: number | null
          tasks_rejected?: number | null
          tasks_submitted?: number | null
        }
        Update: {
          avg_time_to_submit_minutes?: number | null
          biker_id?: string
          business_id?: string | null
          coaching_notes?: string | null
          created_at?: string
          date?: string
          id?: string
          issues_overdue?: number | null
          issues_reported?: number | null
          score?: number | null
          tasks_approved?: number | null
          tasks_assigned?: number | null
          tasks_late?: number | null
          tasks_rejected?: number | null
          tasks_submitted?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "biker_performance_daily_biker_id_fkey"
            columns: ["biker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biker_performance_daily_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
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
      bikers: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          payout_handle: string | null
          payout_method: string | null
          phone: string | null
          status: string
          territory: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          payout_handle?: string | null
          payout_method?: string | null
          phone?: string | null
          status?: string
          territory?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          payout_handle?: string | null
          payout_method?: string | null
          phone?: string | null
          status?: string
          territory?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bikers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bikers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boroughs: {
        Row: {
          business_id: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "boroughs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_contact_store_links: {
        Row: {
          brand: string
          contact_id: string
          created_at: string | null
          id: string
          store_master_id: string
        }
        Insert: {
          brand: string
          contact_id: string
          created_at?: string | null
          id?: string
          store_master_id: string
        }
        Update: {
          brand?: string
          contact_id?: string
          created_at?: string | null
          id?: string
          store_master_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_contact_store_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "brand_crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_contact_store_links_store_master_id_fkey"
            columns: ["store_master_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_crm_contacts: {
        Row: {
          additional_roles: string[] | null
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          borough_id: string | null
          brand: Database["public"]["Enums"]["brand_type"]
          contact_email: string | null
          contact_name: string
          contact_phone: string | null
          created_at: string | null
          id: string
          is_primary_contact: boolean | null
          last_contacted: string | null
          neighborhood_id: string | null
          notes: string | null
          primary_role: string | null
          store_brand_account_id: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          additional_roles?: string[] | null
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          borough_id?: string | null
          brand: Database["public"]["Enums"]["brand_type"]
          contact_email?: string | null
          contact_name: string
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          is_primary_contact?: boolean | null
          last_contacted?: string | null
          neighborhood_id?: string | null
          notes?: string | null
          primary_role?: string | null
          store_brand_account_id: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          additional_roles?: string[] | null
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          borough_id?: string | null
          brand?: Database["public"]["Enums"]["brand_type"]
          contact_email?: string | null
          contact_name?: string
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          is_primary_contact?: boolean | null
          last_contacted?: string | null
          neighborhood_id?: string | null
          notes?: string | null
          primary_role?: string | null
          store_brand_account_id?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_crm_contacts_borough_id_fkey"
            columns: ["borough_id"]
            isOneToOne: false
            referencedRelation: "boroughs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_crm_contacts_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_crm_contacts_store_brand_account_id_fkey"
            columns: ["store_brand_account_id"]
            isOneToOne: false
            referencedRelation: "store_brand_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_insights_cache: {
        Row: {
          ai_summary: string | null
          ai_top_actions: string | null
          business_id: string
          calculated_at: string
          id: string
        }
        Insert: {
          ai_summary?: string | null
          ai_top_actions?: string | null
          business_id: string
          calculated_at?: string
          id?: string
        }
        Update: {
          ai_summary?: string | null
          ai_top_actions?: string | null
          business_id?: string
          calculated_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_insights_cache_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
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
      brand_tasks: {
        Row: {
          business_id: string
          completed_at: string | null
          contact_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          status: string
          store_id: string | null
          title: string
        }
        Insert: {
          business_id: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          store_id?: string | null
          title: string
        }
        Update: {
          business_id?: string
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          status?: string
          store_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_tasks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_verticals: {
        Row: {
          allow_cross_vertical: boolean | null
          created_at: string | null
          description: string | null
          id: string
          industry: string
          name: string
          slug: string
        }
        Insert: {
          allow_cross_vertical?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry: string
          name: string
          slug: string
        }
        Update: {
          allow_cross_vertical?: boolean | null
          created_at?: string | null
          description?: string | null
          id?: string
          industry?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          active?: boolean | null
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
      business_phone_numbers: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          label: string | null
          max_calls_per_minute: number | null
          max_sms_per_minute: number | null
          phone_number: string
          provider: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label?: string | null
          max_calls_per_minute?: number | null
          max_sms_per_minute?: number | null
          phone_number: string
          provider?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          label?: string | null
          max_calls_per_minute?: number | null
          max_sms_per_minute?: number | null
          phone_number?: string
          provider?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_phone_numbers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
          accent_color: string | null
          address: string | null
          address_line2: string | null
          billing_email: string | null
          borough_id: string | null
          brand_banner_url: string | null
          brand_type: string | null
          business_model: string | null
          business_type: string | null
          category: string | null
          channels_enabled: string[] | null
          city: string | null
          communication_enabled: boolean | null
          compliance_profile: string | null
          created_at: string | null
          default_dialect: string | null
          default_language: string | null
          default_personality: string | null
          email: string | null
          id: string
          industry: string | null
          internal_notes: string | null
          is_active: boolean | null
          logo_url: string | null
          long_description: string | null
          name: string
          neighborhood_id: string | null
          opening_date: string | null
          operating_region: string | null
          phone: string | null
          primary_color: string | null
          require_brand_stores: boolean | null
          secondary_color: string | null
          secondary_phone: string | null
          settings: Json | null
          short_description: string | null
          slug: string
          social_facebook: string | null
          social_instagram: string | null
          social_tiktok: string | null
          social_twitter: string | null
          social_youtube: string | null
          state: string | null
          subscription_status: string | null
          subscription_tier: string | null
          tagline: string | null
          theme_config: Json | null
          trial_ends_at: string | null
          updated_at: string | null
          use_affiliates: boolean | null
          use_ai_companion: boolean | null
          use_crm: boolean | null
          use_inventory: boolean | null
          use_route_planner: boolean | null
          use_store_master: boolean | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          address_line2?: string | null
          billing_email?: string | null
          borough_id?: string | null
          brand_banner_url?: string | null
          brand_type?: string | null
          business_model?: string | null
          business_type?: string | null
          category?: string | null
          channels_enabled?: string[] | null
          city?: string | null
          communication_enabled?: boolean | null
          compliance_profile?: string | null
          created_at?: string | null
          default_dialect?: string | null
          default_language?: string | null
          default_personality?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          internal_notes?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          long_description?: string | null
          name: string
          neighborhood_id?: string | null
          opening_date?: string | null
          operating_region?: string | null
          phone?: string | null
          primary_color?: string | null
          require_brand_stores?: boolean | null
          secondary_color?: string | null
          secondary_phone?: string | null
          settings?: Json | null
          short_description?: string | null
          slug: string
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_youtube?: string | null
          state?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          tagline?: string | null
          theme_config?: Json | null
          trial_ends_at?: string | null
          updated_at?: string | null
          use_affiliates?: boolean | null
          use_ai_companion?: boolean | null
          use_crm?: boolean | null
          use_inventory?: boolean | null
          use_route_planner?: boolean | null
          use_store_master?: boolean | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          address_line2?: string | null
          billing_email?: string | null
          borough_id?: string | null
          brand_banner_url?: string | null
          brand_type?: string | null
          business_model?: string | null
          business_type?: string | null
          category?: string | null
          channels_enabled?: string[] | null
          city?: string | null
          communication_enabled?: boolean | null
          compliance_profile?: string | null
          created_at?: string | null
          default_dialect?: string | null
          default_language?: string | null
          default_personality?: string | null
          email?: string | null
          id?: string
          industry?: string | null
          internal_notes?: string | null
          is_active?: boolean | null
          logo_url?: string | null
          long_description?: string | null
          name?: string
          neighborhood_id?: string | null
          opening_date?: string | null
          operating_region?: string | null
          phone?: string | null
          primary_color?: string | null
          require_brand_stores?: boolean | null
          secondary_color?: string | null
          secondary_phone?: string | null
          settings?: Json | null
          short_description?: string | null
          slug?: string
          social_facebook?: string | null
          social_instagram?: string | null
          social_tiktok?: string | null
          social_twitter?: string | null
          social_youtube?: string | null
          state?: string | null
          subscription_status?: string | null
          subscription_tier?: string | null
          tagline?: string | null
          theme_config?: Json | null
          trial_ends_at?: string | null
          updated_at?: string | null
          use_affiliates?: boolean | null
          use_ai_companion?: boolean | null
          use_crm?: boolean | null
          use_inventory?: boolean | null
          use_route_planner?: boolean | null
          use_store_master?: boolean | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_borough_id_fkey"
            columns: ["borough_id"]
            isOneToOne: false
            referencedRelation: "boroughs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
        ]
      }
      call_analytics: {
        Row: {
          ai_metadata: Json | null
          business_id: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          key_moments: Json | null
          manual_call_id: string | null
          next_steps: string[] | null
          objections: string[] | null
          promises: string[] | null
          recording_id: string | null
          sentiment: string | null
          sentiment_score: number | null
          session_id: string | null
          store_id: string | null
          summary: string | null
          tags: string[] | null
          transcript: string | null
          vertical_id: string | null
        }
        Insert: {
          ai_metadata?: Json | null
          business_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          key_moments?: Json | null
          manual_call_id?: string | null
          next_steps?: string[] | null
          objections?: string[] | null
          promises?: string[] | null
          recording_id?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          session_id?: string | null
          store_id?: string | null
          summary?: string | null
          tags?: string[] | null
          transcript?: string | null
          vertical_id?: string | null
        }
        Update: {
          ai_metadata?: Json | null
          business_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          key_moments?: Json | null
          manual_call_id?: string | null
          next_steps?: string[] | null
          objections?: string[] | null
          promises?: string[] | null
          recording_id?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          session_id?: string | null
          store_id?: string | null
          summary?: string | null
          tags?: string[] | null
          transcript?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_analytics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analytics_manual_call_id_fkey"
            columns: ["manual_call_id"]
            isOneToOne: false
            referencedRelation: "manual_call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analytics_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "call_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analytics_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analytics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_analytics_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
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
      call_dispositions: {
        Row: {
          business_name: string | null
          call_log_id: string
          created_at: string
          created_by: string | null
          disposition_code: string
          follow_up_required: boolean
          follow_up_scheduled_at: string | null
          follow_up_type: string | null
          id: string
          notes: string | null
          reason_category: string | null
          recording_consent_given: boolean | null
        }
        Insert: {
          business_name?: string | null
          call_log_id: string
          created_at?: string
          created_by?: string | null
          disposition_code: string
          follow_up_required?: boolean
          follow_up_scheduled_at?: string | null
          follow_up_type?: string | null
          id?: string
          notes?: string | null
          reason_category?: string | null
          recording_consent_given?: boolean | null
        }
        Update: {
          business_name?: string | null
          call_log_id?: string
          created_at?: string
          created_by?: string | null
          disposition_code?: string
          follow_up_required?: boolean
          follow_up_scheduled_at?: string | null
          follow_up_type?: string | null
          id?: string
          notes?: string | null
          reason_category?: string | null
          recording_consent_given?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "call_dispositions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      call_experiment_results: {
        Row: {
          answered: number | null
          avg_sentiment: number | null
          calls: number | null
          campaign_id: string | null
          churn_signals: number | null
          complaints: number | null
          created_at: string
          flow_variant: string
          id: string
          orders: number | null
          persona_id: string | null
        }
        Insert: {
          answered?: number | null
          avg_sentiment?: number | null
          calls?: number | null
          campaign_id?: string | null
          churn_signals?: number | null
          complaints?: number | null
          created_at?: string
          flow_variant: string
          id?: string
          orders?: number | null
          persona_id?: string | null
        }
        Update: {
          answered?: number | null
          avg_sentiment?: number | null
          calls?: number | null
          campaign_id?: string | null
          churn_signals?: number | null
          complaints?: number | null
          created_at?: string
          flow_variant?: string
          id?: string
          orders?: number | null
          persona_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_experiment_results_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_call_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      call_flow_edges: {
        Row: {
          condition_label: string | null
          condition_type: string | null
          created_at: string
          flow_id: string
          from_node_id: string
          id: string
          to_node_id: string
        }
        Insert: {
          condition_label?: string | null
          condition_type?: string | null
          created_at?: string
          flow_id: string
          from_node_id: string
          id?: string
          to_node_id: string
        }
        Update: {
          condition_label?: string | null
          condition_type?: string | null
          created_at?: string
          flow_id?: string
          from_node_id?: string
          id?: string
          to_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "call_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_flow_edges_from_node_id_fkey"
            columns: ["from_node_id"]
            isOneToOne: false
            referencedRelation: "call_flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_flow_edges_to_node_id_fkey"
            columns: ["to_node_id"]
            isOneToOne: false
            referencedRelation: "call_flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      call_flow_nodes: {
        Row: {
          content: string | null
          created_at: string
          expected_input: string | null
          flow_id: string
          id: string
          metadata: Json | null
          node_type: string
          order_index: number | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          expected_input?: string | null
          flow_id: string
          id?: string
          metadata?: Json | null
          node_type: string
          order_index?: number | null
        }
        Update: {
          content?: string | null
          created_at?: string
          expected_input?: string | null
          flow_id?: string
          id?: string
          metadata?: Json | null
          node_type?: string
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "call_flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "call_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      call_flows: {
        Row: {
          business_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          persona_id: string | null
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          persona_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          persona_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_flows_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_flows_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "voice_personas"
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
      call_optimization_stats: {
        Row: {
          answer_rate: number | null
          average_call_duration: number | null
          best_persona: string | null
          best_script: string | null
          best_time_to_call: string | null
          campaign_id: string | null
          churn_prevention_score: number | null
          conversion_rate: number | null
          created_at: string
          id: string
          updated_at: string
          voicemail_rate: number | null
        }
        Insert: {
          answer_rate?: number | null
          average_call_duration?: number | null
          best_persona?: string | null
          best_script?: string | null
          best_time_to_call?: string | null
          campaign_id?: string | null
          churn_prevention_score?: number | null
          conversion_rate?: number | null
          created_at?: string
          id?: string
          updated_at?: string
          voicemail_rate?: number | null
        }
        Update: {
          answer_rate?: number | null
          average_call_duration?: number | null
          best_persona?: string | null
          best_script?: string | null
          best_time_to_call?: string | null
          campaign_id?: string | null
          churn_prevention_score?: number | null
          conversion_rate?: number | null
          created_at?: string
          id?: string
          updated_at?: string
          voicemail_rate?: number | null
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          agent_id: string | null
          contact_id: string | null
          id: string
          joined_at: string
          left_at: string | null
          participant_type: string
          role: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          contact_id?: string | null
          id?: string
          joined_at?: string
          left_at?: string | null
          participant_type: string
          role?: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          contact_id?: string | null
          id?: string
          joined_at?: string
          left_at?: string | null
          participant_type?: string
          role?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_prediction_snapshots: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          snapshot: Json
          store_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          snapshot?: Json
          store_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          snapshot?: Json
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_prediction_snapshots_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_call_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_prediction_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      call_priority_queue: {
        Row: {
          ai_prediction: Json | null
          campaign_id: string | null
          created_at: string
          experiment_group: string | null
          id: string
          last_order_date: string | null
          opportunity_score: number | null
          persona_variant: string | null
          predicted_answer_prob: number | null
          predicted_churn_risk: number | null
          predicted_complaint_risk: number | null
          predicted_order_prob: number | null
          priority_score: number | null
          reason: string | null
          risk_score: number | null
          script_variant: string | null
          status: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          ai_prediction?: Json | null
          campaign_id?: string | null
          created_at?: string
          experiment_group?: string | null
          id?: string
          last_order_date?: string | null
          opportunity_score?: number | null
          persona_variant?: string | null
          predicted_answer_prob?: number | null
          predicted_churn_risk?: number | null
          predicted_complaint_risk?: number | null
          predicted_order_prob?: number | null
          priority_score?: number | null
          reason?: string | null
          risk_score?: number | null
          script_variant?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          ai_prediction?: Json | null
          campaign_id?: string | null
          created_at?: string
          experiment_group?: string | null
          id?: string
          last_order_date?: string | null
          opportunity_score?: number | null
          persona_variant?: string | null
          predicted_answer_prob?: number | null
          predicted_churn_risk?: number | null
          predicted_complaint_risk?: number | null
          predicted_order_prob?: number | null
          priority_score?: number | null
          reason?: string | null
          risk_score?: number | null
          script_variant?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_priority_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      call_quality_scores: {
        Row: {
          analytics_id: string | null
          business_id: string | null
          clarity_score: number | null
          closing_score: number | null
          coaching_tips: string[] | null
          compliance_score: number | null
          created_at: string | null
          empathy_score: number | null
          greeting_score: number | null
          id: string
          is_ai: boolean | null
          issues: string[] | null
          manual_call_id: string | null
          offer_delivery_score: number | null
          overall_score: number | null
          recording_id: string | null
          session_id: string | null
          store_id: string | null
          strengths: string[] | null
          vertical_id: string | null
        }
        Insert: {
          analytics_id?: string | null
          business_id?: string | null
          clarity_score?: number | null
          closing_score?: number | null
          coaching_tips?: string[] | null
          compliance_score?: number | null
          created_at?: string | null
          empathy_score?: number | null
          greeting_score?: number | null
          id?: string
          is_ai?: boolean | null
          issues?: string[] | null
          manual_call_id?: string | null
          offer_delivery_score?: number | null
          overall_score?: number | null
          recording_id?: string | null
          session_id?: string | null
          store_id?: string | null
          strengths?: string[] | null
          vertical_id?: string | null
        }
        Update: {
          analytics_id?: string | null
          business_id?: string | null
          clarity_score?: number | null
          closing_score?: number | null
          coaching_tips?: string[] | null
          compliance_score?: number | null
          created_at?: string | null
          empathy_score?: number | null
          greeting_score?: number | null
          id?: string
          is_ai?: boolean | null
          issues?: string[] | null
          manual_call_id?: string | null
          offer_delivery_score?: number | null
          overall_score?: number | null
          recording_id?: string | null
          session_id?: string | null
          store_id?: string | null
          strengths?: string[] | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_quality_scores_analytics_id_fkey"
            columns: ["analytics_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_quality_scores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_quality_scores_manual_call_id_fkey"
            columns: ["manual_call_id"]
            isOneToOne: false
            referencedRelation: "manual_call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_quality_scores_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "call_recordings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_quality_scores_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_quality_scores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_quality_scores_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      call_reasons: {
        Row: {
          business_id: string | null
          call_id: string | null
          confidence: number | null
          contact_id: string | null
          created_at: string
          id: string
          reason: string
          secondary_reasons: string[] | null
          session_id: string | null
          store_id: string | null
        }
        Insert: {
          business_id?: string | null
          call_id?: string | null
          confidence?: number | null
          contact_id?: string | null
          created_at?: string
          id?: string
          reason: string
          secondary_reasons?: string[] | null
          session_id?: string | null
          store_id?: string | null
        }
        Update: {
          business_id?: string | null
          call_id?: string | null
          confidence?: number | null
          contact_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          secondary_reasons?: string[] | null
          session_id?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_reasons_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_reasons_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "ai_call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_reasons_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_reasons_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      call_recordings: {
        Row: {
          business_id: string | null
          channels: string | null
          completed_at: string | null
          created_at: string | null
          has_transcript: boolean | null
          id: string
          language: string | null
          manual_call_id: string | null
          provider: string | null
          provider_call_sid: string | null
          recording_duration: number | null
          recording_url: string | null
          session_id: string | null
          started_at: string | null
          store_id: string | null
          transcript_path: string | null
          vertical_id: string | null
        }
        Insert: {
          business_id?: string | null
          channels?: string | null
          completed_at?: string | null
          created_at?: string | null
          has_transcript?: boolean | null
          id?: string
          language?: string | null
          manual_call_id?: string | null
          provider?: string | null
          provider_call_sid?: string | null
          recording_duration?: number | null
          recording_url?: string | null
          session_id?: string | null
          started_at?: string | null
          store_id?: string | null
          transcript_path?: string | null
          vertical_id?: string | null
        }
        Update: {
          business_id?: string | null
          channels?: string | null
          completed_at?: string | null
          created_at?: string | null
          has_transcript?: boolean | null
          id?: string
          language?: string | null
          manual_call_id?: string | null
          provider?: string | null
          provider_call_sid?: string | null
          recording_duration?: number | null
          recording_url?: string | null
          session_id?: string | null
          started_at?: string | null
          store_id?: string | null
          transcript_path?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_recordings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_manual_call_id_fkey"
            columns: ["manual_call_id"]
            isOneToOne: false
            referencedRelation: "manual_call_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_call_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_recordings_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      call_routing_rules: {
        Row: {
          action: Json
          business_id: string | null
          condition: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          updated_at: string
        }
        Insert: {
          action?: Json
          business_id?: string | null
          condition?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          updated_at?: string
        }
        Update: {
          action?: Json
          business_id?: string | null
          condition?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_routing_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      call_scripts: {
        Row: {
          branching_logic: Json | null
          business_id: string | null
          closing: string | null
          created_at: string | null
          greeting: string | null
          id: string
          is_active: boolean | null
          language: string | null
          purpose: string | null
          questions: Json | null
          title: string
          updated_at: string | null
          voice_type: string | null
        }
        Insert: {
          branching_logic?: Json | null
          business_id?: string | null
          closing?: string | null
          created_at?: string | null
          greeting?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          purpose?: string | null
          questions?: Json | null
          title: string
          updated_at?: string | null
          voice_type?: string | null
        }
        Update: {
          branching_logic?: Json | null
          business_id?: string | null
          closing?: string | null
          created_at?: string | null
          greeting?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          purpose?: string | null
          questions?: Json | null
          title?: string
          updated_at?: string | null
          voice_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_scripts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      cart_items: {
        Row: {
          cart_id: string | null
          created_at: string | null
          id: string
          price_locked: number | null
          product_id: string | null
          qty: number | null
        }
        Insert: {
          cart_id?: string | null
          created_at?: string | null
          id?: string
          price_locked?: number | null
          product_id?: string | null
          qty?: number | null
        }
        Update: {
          cart_id?: string | null
          created_at?: string | null
          id?: string
          price_locked?: number | null
          product_id?: string | null
          qty?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_all"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string | null
          id: string
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      cloud_checkpoints: {
        Row: {
          checkpoint_type: string
          created_at: string
          id: string
          label: string | null
          notes: string | null
          owner_id: string
          snapshot_data: Json
        }
        Insert: {
          checkpoint_type?: string
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          owner_id: string
          snapshot_data?: Json
        }
        Update: {
          checkpoint_type?: string
          created_at?: string
          id?: string
          label?: string | null
          notes?: string | null
          owner_id?: string
          snapshot_data?: Json
        }
        Relationships: []
      }
      communication_alerts: {
        Row: {
          alert_type: string
          business_id: string | null
          contact_id: string | null
          created_at: string | null
          id: string
          is_resolved: boolean | null
          message: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          store_id: string | null
        }
        Insert: {
          alert_type: string
          business_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          message: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          store_id?: string | null
        }
        Update: {
          alert_type?: string
          business_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          id?: string
          is_resolved?: boolean | null
          message?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_alerts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_alerts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_compliance_logs: {
        Row: {
          action: string
          business_name: string | null
          channel_type: string
          compliance_type: string
          contact_id: string | null
          evidence: string | null
          id: string
          logged_at: string
          logged_by: string | null
          source: string | null
        }
        Insert: {
          action: string
          business_name?: string | null
          channel_type: string
          compliance_type: string
          contact_id?: string | null
          evidence?: string | null
          id?: string
          logged_at?: string
          logged_by?: string | null
          source?: string | null
        }
        Update: {
          action?: string
          business_name?: string | null
          channel_type?: string
          compliance_type?: string
          contact_id?: string | null
          evidence?: string | null
          id?: string
          logged_at?: string
          logged_by?: string | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_compliance_logs_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_delivery_status: {
        Row: {
          business_name: string | null
          channel_type: string
          created_at: string
          delivered_at: string | null
          failure_code: string | null
          failure_reason: string | null
          id: string
          last_retry_at: string | null
          retry_count: number
          source_id: string
          source_table: string
          status: string
        }
        Insert: {
          business_name?: string | null
          channel_type: string
          created_at?: string
          delivered_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          last_retry_at?: string | null
          retry_count?: number
          source_id: string
          source_table: string
          status: string
        }
        Update: {
          business_name?: string | null
          channel_type?: string
          created_at?: string
          delivered_at?: string | null
          failure_code?: string | null
          failure_reason?: string | null
          id?: string
          last_retry_at?: string | null
          retry_count?: number
          source_id?: string
          source_table?: string
          status?: string
        }
        Relationships: []
      }
      communication_escalations: {
        Row: {
          ai_notes: string | null
          assigned_department: string | null
          assigned_to: string | null
          business_id: string | null
          contact_id: string | null
          created_at: string
          escalation_type: string
          id: string
          message_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          store_id: string | null
        }
        Insert: {
          ai_notes?: string | null
          assigned_department?: string | null
          assigned_to?: string | null
          business_id?: string | null
          contact_id?: string | null
          created_at?: string
          escalation_type: string
          id?: string
          message_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          store_id?: string | null
        }
        Update: {
          ai_notes?: string | null
          assigned_department?: string | null
          assigned_to?: string | null
          business_id?: string | null
          contact_id?: string | null
          created_at?: string
          escalation_type?: string
          id?: string
          message_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_escalations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_escalations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_escalations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
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
      communication_messages: {
        Row: {
          actor_type: string | null
          ai_generated: boolean | null
          assigned_at: string | null
          assigned_by: string | null
          business_id: string | null
          channel: string
          contact_id: string | null
          content: string | null
          created_at: string | null
          direction: string
          due_at: string | null
          escalated_to: string | null
          escalation_level: number | null
          escalation_reason: string | null
          first_response_at: string | null
          id: string
          metadata: Json | null
          owner_user_id: string | null
          phone_number: string | null
          priority: string | null
          resolved_at: string | null
          sentiment: string | null
          sla_deadline: string | null
          snooze_reason: string | null
          snoozed_until: string | null
          status: string | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          actor_type?: string | null
          ai_generated?: boolean | null
          assigned_at?: string | null
          assigned_by?: string | null
          business_id?: string | null
          channel: string
          contact_id?: string | null
          content?: string | null
          created_at?: string | null
          direction: string
          due_at?: string | null
          escalated_to?: string | null
          escalation_level?: number | null
          escalation_reason?: string | null
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          owner_user_id?: string | null
          phone_number?: string | null
          priority?: string | null
          resolved_at?: string | null
          sentiment?: string | null
          sla_deadline?: string | null
          snooze_reason?: string | null
          snoozed_until?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          actor_type?: string | null
          ai_generated?: boolean | null
          assigned_at?: string | null
          assigned_by?: string | null
          business_id?: string | null
          channel?: string
          contact_id?: string | null
          content?: string | null
          created_at?: string | null
          direction?: string
          due_at?: string | null
          escalated_to?: string | null
          escalation_level?: number | null
          escalation_reason?: string | null
          first_response_at?: string | null
          id?: string
          metadata?: Json | null
          owner_user_id?: string | null
          phone_number?: string | null
          priority?: string | null
          resolved_at?: string | null
          sentiment?: string | null
          sla_deadline?: string | null
          snooze_reason?: string | null
          snoozed_until?: string | null
          status?: string | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_messages_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_escalated_to_fkey"
            columns: ["escalated_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_messages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_sequences: {
        Row: {
          business_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          ends_at: string | null
          goal: string | null
          id: string
          is_active: boolean | null
          starts_at: string | null
          steps: Json | null
          target_stores: string[] | null
          title: string
          tone: string | null
          updated_at: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean | null
          starts_at?: string | null
          steps?: Json | null
          target_stores?: string[] | null
          title: string
          tone?: string | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          goal?: string | null
          id?: string
          is_active?: boolean | null
          starts_at?: string | null
          steps?: Json | null
          target_stores?: string[] | null
          title?: string
          tone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_sequences_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      communication_trend_snapshots: {
        Row: {
          business_id: string | null
          created_at: string
          data: Json | null
          forecast_period: string | null
          id: string
          trend_summary: string | null
          trend_type: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          data?: Json | null
          forecast_period?: string | null
          id?: string
          trend_summary?: string | null
          trend_type: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          data?: Json | null
          forecast_period?: string | null
          id?: string
          trend_summary?: string | null
          trend_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_trend_snapshots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      confirmation_audit_log: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string | null
          game_id: string
          id: string
          new_winner: string | null
          previous_winner: string | null
          reason: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string | null
          game_id: string
          id?: string
          new_winner?: string | null
          previous_winner?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string | null
          game_id?: string
          id?: string
          new_winner?: string | null
          previous_winner?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      confirmed_game_winners: {
        Row: {
          away_score: number | null
          away_team: string
          confirmation_revoked: boolean | null
          confirmation_source: string
          confirmed_at: string
          confirmed_by: string | null
          confirmed_winner: string
          created_at: string
          game_date: string
          game_id: string
          home_score: number | null
          home_team: string
          id: string
          notes: string | null
          override_count: number
          previous_winner: string | null
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          sport: string
          updated_at: string
        }
        Insert: {
          away_score?: number | null
          away_team: string
          confirmation_revoked?: boolean | null
          confirmation_source?: string
          confirmed_at?: string
          confirmed_by?: string | null
          confirmed_winner: string
          created_at?: string
          game_date: string
          game_id: string
          home_score?: number | null
          home_team: string
          id?: string
          notes?: string | null
          override_count?: number
          previous_winner?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          sport?: string
          updated_at?: string
        }
        Update: {
          away_score?: number | null
          away_team?: string
          confirmation_revoked?: boolean | null
          confirmation_source?: string
          confirmed_at?: string
          confirmed_by?: string | null
          confirmed_winner?: string
          created_at?: string
          game_date?: string
          game_id?: string
          home_score?: number | null
          home_team?: string
          id?: string
          notes?: string | null
          override_count?: number
          previous_winner?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          sport?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_interactions: {
        Row: {
          channel: string
          contact_id: string
          created_at: string | null
          created_by_user_id: string | null
          direction: string
          follow_up_at: string | null
          id: string
          next_action: string | null
          outcome: string | null
          sentiment: string | null
          store_id: string | null
          subject: string
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          contact_id: string
          created_at?: string | null
          created_by_user_id?: string | null
          direction: string
          follow_up_at?: string | null
          id?: string
          next_action?: string | null
          outcome?: string | null
          sentiment?: string | null
          store_id?: string | null
          subject: string
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          contact_id?: string
          created_at?: string | null
          created_by_user_id?: string | null
          direction?: string
          follow_up_at?: string | null
          id?: string
          next_action?: string | null
          outcome?: string | null
          sentiment?: string | null
          store_id?: string | null
          subject?: string
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "store_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_interactions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_memories: {
        Row: {
          ai_confidence_score: number | null
          associated_businesses: string[] | null
          contact_id: string
          created_at: string
          first_interaction_at: string | null
          id: string
          is_frozen: boolean | null
          last_interaction_at: string | null
          memory_summary_current: string | null
          memory_summary_versions: Json | null
          preferences: Json | null
          risk_flags: string[] | null
          sentiment_trend: string | null
          status: string
          unresolved_items: Json | null
          updated_at: string
        }
        Insert: {
          ai_confidence_score?: number | null
          associated_businesses?: string[] | null
          contact_id: string
          created_at?: string
          first_interaction_at?: string | null
          id?: string
          is_frozen?: boolean | null
          last_interaction_at?: string | null
          memory_summary_current?: string | null
          memory_summary_versions?: Json | null
          preferences?: Json | null
          risk_flags?: string[] | null
          sentiment_trend?: string | null
          status?: string
          unresolved_items?: Json | null
          updated_at?: string
        }
        Update: {
          ai_confidence_score?: number | null
          associated_businesses?: string[] | null
          contact_id?: string
          created_at?: string
          first_interaction_at?: string | null
          id?: string
          is_frozen?: boolean | null
          last_interaction_at?: string | null
          memory_summary_current?: string | null
          memory_summary_versions?: Json | null
          preferences?: Json | null
          risk_flags?: string[] | null
          sentiment_trend?: string | null
          status?: string
          unresolved_items?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      conversation_routing: {
        Row: {
          assigned_to: string | null
          business_id: string | null
          contact_id: string | null
          created_at: string
          department: string
          id: string
          is_active: boolean | null
          reason: string | null
          store_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          business_id?: string | null
          contact_id?: string | null
          created_at?: string
          department: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          store_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          business_id?: string | null
          contact_id?: string | null
          created_at?: string
          department?: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_routing_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_routing_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
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
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          ai_keywords: string[] | null
          ai_last_summary: string | null
          ai_next_action: string | null
          ai_priority: number | null
          ai_sentiment: string | null
          borough_id: string | null
          business_id: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          email: string | null
          id: string
          last_contact_date: string | null
          name: string
          neighborhood_id: string | null
          notes: string | null
          organization: string | null
          owner_id: string | null
          phone: string | null
          relationship_score: number | null
          relationship_status: string
          role_id: string | null
          tags: string[] | null
          type: string
          updated_at: string
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          ai_keywords?: string[] | null
          ai_last_summary?: string | null
          ai_next_action?: string | null
          ai_priority?: number | null
          ai_sentiment?: string | null
          borough_id?: string | null
          business_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_contact_date?: string | null
          name: string
          neighborhood_id?: string | null
          notes?: string | null
          organization?: string | null
          owner_id?: string | null
          phone?: string | null
          relationship_score?: number | null
          relationship_status?: string
          role_id?: string | null
          tags?: string[] | null
          type: string
          updated_at?: string
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          ai_keywords?: string[] | null
          ai_last_summary?: string | null
          ai_next_action?: string | null
          ai_priority?: number | null
          ai_sentiment?: string | null
          borough_id?: string | null
          business_id?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          last_contact_date?: string | null
          name?: string
          neighborhood_id?: string | null
          notes?: string | null
          organization?: string | null
          owner_id?: string | null
          phone?: string | null
          relationship_score?: number | null
          relationship_status?: string
          role_id?: string | null
          tags?: string[] | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_borough_id_fkey"
            columns: ["borough_id"]
            isOneToOne: false
            referencedRelation: "boroughs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_neighborhood_id_fkey"
            columns: ["neighborhood_id"]
            isOneToOne: false
            referencedRelation: "neighborhoods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_contacts_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "customer_roles"
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
          created_by: string | null
          dialect_preference: string | null
          email: string | null
          formality_level: string | null
          id: string
          language_preference: string | null
          last_order_date: string | null
          name: string
          notes: string | null
          personality_profile_id: string | null
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
          created_by?: string | null
          dialect_preference?: string | null
          email?: string | null
          formality_level?: string | null
          id?: string
          language_preference?: string | null
          last_order_date?: string | null
          name: string
          notes?: string | null
          personality_profile_id?: string | null
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
          created_by?: string | null
          dialect_preference?: string | null
          email?: string | null
          formality_level?: string | null
          id?: string
          language_preference?: string | null
          last_order_date?: string | null
          name?: string
          notes?: string | null
          personality_profile_id?: string | null
          phone?: string | null
          relationship_status?: string | null
          state?: string | null
          total_lifetime_value?: number | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_customers_personality_profile_id_fkey"
            columns: ["personality_profile_id"]
            isOneToOne: false
            referencedRelation: "personality_profiles"
            referencedColumns: ["id"]
          },
        ]
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
      crm_personal_notes: {
        Row: {
          content: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_type: string
          id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_personal_notes_history: {
        Row: {
          content: string | null
          edited_at: string
          edited_by: string | null
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          content?: string | null
          edited_at?: string
          edited_by?: string | null
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          content?: string | null
          edited_at?: string
          edited_by?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: []
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
      custom_contact_roles: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string | null
          created_by: string | null
          id: string
          role_name: string
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          role_name: string
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          role_name?: string
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
      customer_profiles: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          full_name: string | null
          id: string
          marketing_opt_in: boolean | null
          phone: string | null
          preferred_language: string | null
          state: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          marketing_opt_in?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          marketing_opt_in?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          state?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
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
      customer_roles: {
        Row: {
          created_at: string
          id: string
          role_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          role_name: string
        }
        Update: {
          created_at?: string
          id?: string
          role_name?: string
        }
        Relationships: []
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
      daily_prediction_snapshots: {
        Row: {
          actual_winner: string | null
          away_score: number | null
          away_team: string
          confidence_score: number | null
          created_at: string
          game_id: string
          game_status: string | null
          home_score: number | null
          home_team: string
          id: string
          is_backfilled: boolean | null
          model_version: string | null
          predicted_win_probability: number | null
          predicted_winner: string
          result_linked_at: string | null
          snapshot_date: string
          sport: string
          success: boolean | null
          updated_at: string
        }
        Insert: {
          actual_winner?: string | null
          away_score?: number | null
          away_team: string
          confidence_score?: number | null
          created_at?: string
          game_id: string
          game_status?: string | null
          home_score?: number | null
          home_team: string
          id?: string
          is_backfilled?: boolean | null
          model_version?: string | null
          predicted_win_probability?: number | null
          predicted_winner: string
          result_linked_at?: string | null
          snapshot_date: string
          sport?: string
          success?: boolean | null
          updated_at?: string
        }
        Update: {
          actual_winner?: string | null
          away_score?: number | null
          away_team?: string
          confidence_score?: number | null
          created_at?: string
          game_id?: string
          game_status?: string | null
          home_score?: number | null
          home_team?: string
          id?: string
          is_backfilled?: boolean | null
          model_version?: string | null
          predicted_win_probability?: number | null
          predicted_winner?: string
          result_linked_at?: string | null
          snapshot_date?: string
          sport?: string
          success?: boolean | null
          updated_at?: string
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
      deals: {
        Row: {
          business_id: string
          campaign_id: string | null
          channel: string
          closed_at: string | null
          created_at: string | null
          currency: string | null
          delivery_date: string | null
          delivery_window: string | null
          discount_amount: number | null
          discount_percent: number | null
          expected_value: number | null
          final_value: number | null
          id: string
          intent_type: string
          items: Json | null
          notes: string | null
          probability: number | null
          risk_level: string | null
          sentiment: number | null
          stage: string
          status: string
          store_id: string
          updated_at: string | null
          vertical_id: string | null
        }
        Insert: {
          business_id: string
          campaign_id?: string | null
          channel?: string
          closed_at?: string | null
          created_at?: string | null
          currency?: string | null
          delivery_date?: string | null
          delivery_window?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          expected_value?: number | null
          final_value?: number | null
          id?: string
          intent_type?: string
          items?: Json | null
          notes?: string | null
          probability?: number | null
          risk_level?: string | null
          sentiment?: number | null
          stage?: string
          status?: string
          store_id: string
          updated_at?: string | null
          vertical_id?: string | null
        }
        Update: {
          business_id?: string
          campaign_id?: string | null
          channel?: string
          closed_at?: string | null
          created_at?: string | null
          currency?: string | null
          delivery_date?: string | null
          delivery_window?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          expected_value?: number | null
          final_value?: number | null
          id?: string
          intent_type?: string
          items?: Json | null
          notes?: string | null
          probability?: number | null
          risk_level?: string | null
          sentiment?: number | null
          stage?: string
          status?: string
          store_id?: string
          updated_at?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "ai_call_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
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
      deliveries: {
        Row: {
          assigned_driver_id: string | null
          business_id: string
          created_at: string
          created_by_user_id: string | null
          delivery_type: string
          dispatcher_notes: string | null
          id: string
          internal_notes: string | null
          priority: string
          scheduled_date: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_driver_id?: string | null
          business_id: string
          created_at?: string
          created_by_user_id?: string | null
          delivery_type?: string
          dispatcher_notes?: string | null
          id?: string
          internal_notes?: string | null
          priority?: string
          scheduled_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_driver_id?: string | null
          business_id?: string
          created_at?: string
          created_by_user_id?: string | null
          delivery_type?: string
          dispatcher_notes?: string | null
          id?: string
          internal_notes?: string | null
          priority?: string
          scheduled_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_activity_log: {
        Row: {
          action: string
          actor_user_id: string | null
          business_id: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata_json: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          business_id: string
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          metadata_json?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          business_id?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_activity_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_activity_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      delivery_rates: {
        Row: {
          base_rate: number
          bonus_rules_json: Json | null
          business_id: string
          created_at: string
          id: string
          task_type: string
          updated_at: string
          worker_type: string
        }
        Insert: {
          base_rate?: number
          bonus_rules_json?: Json | null
          business_id: string
          created_at?: string
          id?: string
          task_type: string
          updated_at?: string
          worker_type: string
        }
        Update: {
          base_rate?: number
          bonus_rules_json?: Json | null
          business_id?: string
          created_at?: string
          id?: string
          task_type?: string
          updated_at?: string
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_rates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_stops: {
        Row: {
          amount_due: number | null
          completion_time: string | null
          created_at: string
          delivery_id: string
          driver_notes: string | null
          id: string
          items_summary: string | null
          location_id: string | null
          status: string
          stop_order: number
          stop_type: string
          updated_at: string
          window_end: string | null
          window_start: string | null
        }
        Insert: {
          amount_due?: number | null
          completion_time?: string | null
          created_at?: string
          delivery_id: string
          driver_notes?: string | null
          id?: string
          items_summary?: string | null
          location_id?: string | null
          status?: string
          stop_order?: number
          stop_type?: string
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Update: {
          amount_due?: number | null
          completion_time?: string | null
          created_at?: string
          delivery_id?: string
          driver_notes?: string | null
          id?: string
          items_summary?: string | null
          location_id?: string | null
          status?: string
          stop_order?: number
          stop_type?: string
          updated_at?: string
          window_end?: string | null
          window_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_stops_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_stops_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
      dispatch_triggers: {
        Row: {
          assigned_driver_id: string | null
          business_id: string
          created_at: string | null
          deal_id: string | null
          id: string
          last_updated: string | null
          payload: Json | null
          status: string
          store_id: string
          type: string
        }
        Insert: {
          assigned_driver_id?: string | null
          business_id: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          last_updated?: string | null
          payload?: Json | null
          status?: string
          store_id: string
          type?: string
        }
        Update: {
          assigned_driver_id?: string | null
          business_id?: string
          created_at?: string | null
          deal_id?: string | null
          id?: string
          last_updated?: string | null
          payload?: Json | null
          status?: string
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_triggers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_triggers_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_triggers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_debt_payments: {
        Row: {
          amount: number
          created_at: string
          debt_id: string
          id: string
          method: string
          payment_date: string
          recorded_by_user_id: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          debt_id: string
          id?: string
          method: string
          payment_date?: string
          recorded_by_user_id?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          debt_id?: string
          id?: string
          method?: string
          payment_date?: string
          recorded_by_user_id?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "driver_debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_debt_payments_recorded_by_user_id_fkey"
            columns: ["recorded_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_debts: {
        Row: {
          business_id: string
          created_at: string
          created_by_user_id: string | null
          debt_type: string
          driver_id: string
          id: string
          notes: string | null
          original_amount: number
          remaining_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by_user_id?: string | null
          debt_type: string
          driver_id: string
          id?: string
          notes?: string | null
          original_amount: number
          remaining_amount: number
          status?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by_user_id?: string | null
          debt_type?: string
          driver_id?: string
          id?: string
          notes?: string | null
          original_amount?: number
          remaining_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_debts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_debts_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_debts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      drivers: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          full_name: string
          home_base: string | null
          id: string
          license_number: string | null
          payout_handle: string | null
          payout_method: string | null
          phone: string | null
          status: string
          updated_at: string
          user_id: string | null
          vehicle_type: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          full_name: string
          home_base?: string | null
          id?: string
          license_number?: string | null
          payout_handle?: string | null
          payout_method?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vehicle_type?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          home_base?: string | null
          id?: string
          license_number?: string | null
          payout_handle?: string | null
          payout_method?: string | null
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drivers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_user_id_fkey"
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
      dynasty_checkpoints: {
        Row: {
          created_at: string
          id: string
          label: string
          notes: string | null
          owner_id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          owner_id: string
          payload: Json
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          owner_id?: string
          payload?: Json
        }
        Relationships: []
      }
      engagement_scores: {
        Row: {
          ai_notes: string | null
          avg_response_time_hours: number | null
          business_id: string | null
          id: string
          last_contact: string | null
          last_inbound: string | null
          last_outbound: string | null
          response_rate: number | null
          score: number
          sentiment_trend: string | null
          store_id: string | null
          total_messages: number | null
          updated_at: string
        }
        Insert: {
          ai_notes?: string | null
          avg_response_time_hours?: number | null
          business_id?: string | null
          id?: string
          last_contact?: string | null
          last_inbound?: string | null
          last_outbound?: string | null
          response_rate?: number | null
          score?: number
          sentiment_trend?: string | null
          store_id?: string | null
          total_messages?: number | null
          updated_at?: string
        }
        Update: {
          ai_notes?: string | null
          avg_response_time_hours?: number | null
          business_id?: string | null
          id?: string
          last_contact?: string | null
          last_inbound?: string | null
          last_outbound?: string | null
          response_rate?: number | null
          score?: number
          sentiment_trend?: string | null
          store_id?: string | null
          total_messages?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engagement_scores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engagement_scores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      escalation_rules: {
        Row: {
          business_name: string | null
          channel_type: string | null
          created_at: string
          description: string | null
          escalate_to_role: string | null
          escalate_to_user_id: string | null
          id: string
          is_active: boolean
          name: string
          notification_method: string
          priority: number
          trigger_config: Json
          trigger_type: string
        }
        Insert: {
          business_name?: string | null
          channel_type?: string | null
          created_at?: string
          description?: string | null
          escalate_to_role?: string | null
          escalate_to_user_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          notification_method?: string
          priority?: number
          trigger_config?: Json
          trigger_type: string
        }
        Update: {
          business_name?: string | null
          channel_type?: string | null
          created_at?: string
          description?: string | null
          escalate_to_role?: string | null
          escalate_to_user_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notification_method?: string
          priority?: number
          trigger_config?: Json
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalation_rules_escalate_to_user_id_fkey"
            columns: ["escalate_to_user_id"]
            isOneToOne: false
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
      final_results: {
        Row: {
          actual_winner: string
          ai_confidence_score: number | null
          ai_predicted_winner: string | null
          ai_probability: number | null
          away_score: number | null
          away_team: string
          confirmation_id: string | null
          created_at: string
          dnp: boolean | null
          final_stat_value: number | null
          game_date: string
          game_id: string
          home_score: number | null
          home_team: string
          id: string
          invalid_reason: string | null
          invalidated_at: string | null
          is_correct: boolean | null
          is_valid: boolean | null
          line_value: number | null
          locked_at: string | null
          market_type: string | null
          model_version: string | null
          opponent: string | null
          pick_entry_id: string | null
          player_id: string | null
          player_name: string | null
          prediction_id: string | null
          prediction_source: string | null
          settled_at: string
          settled_by: string | null
          settlement_source: string | null
          side: string | null
          sport: string
          stat_source: string | null
          stat_type: string | null
          team: string | null
        }
        Insert: {
          actual_winner: string
          ai_confidence_score?: number | null
          ai_predicted_winner?: string | null
          ai_probability?: number | null
          away_score?: number | null
          away_team: string
          confirmation_id?: string | null
          created_at?: string
          dnp?: boolean | null
          final_stat_value?: number | null
          game_date: string
          game_id: string
          home_score?: number | null
          home_team: string
          id?: string
          invalid_reason?: string | null
          invalidated_at?: string | null
          is_correct?: boolean | null
          is_valid?: boolean | null
          line_value?: number | null
          locked_at?: string | null
          market_type?: string | null
          model_version?: string | null
          opponent?: string | null
          pick_entry_id?: string | null
          player_id?: string | null
          player_name?: string | null
          prediction_id?: string | null
          prediction_source?: string | null
          settled_at?: string
          settled_by?: string | null
          settlement_source?: string | null
          side?: string | null
          sport?: string
          stat_source?: string | null
          stat_type?: string | null
          team?: string | null
        }
        Update: {
          actual_winner?: string
          ai_confidence_score?: number | null
          ai_predicted_winner?: string | null
          ai_probability?: number | null
          away_score?: number | null
          away_team?: string
          confirmation_id?: string | null
          created_at?: string
          dnp?: boolean | null
          final_stat_value?: number | null
          game_date?: string
          game_id?: string
          home_score?: number | null
          home_team?: string
          id?: string
          invalid_reason?: string | null
          invalidated_at?: string | null
          is_correct?: boolean | null
          is_valid?: boolean | null
          line_value?: number | null
          locked_at?: string | null
          market_type?: string | null
          model_version?: string | null
          opponent?: string | null
          pick_entry_id?: string | null
          player_id?: string | null
          player_name?: string | null
          prediction_id?: string | null
          prediction_source?: string | null
          settled_at?: string
          settled_by?: string | null
          settlement_source?: string | null
          side?: string | null
          sport?: string
          stat_source?: string | null
          stat_type?: string | null
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "final_results_confirmation_id_fkey"
            columns: ["confirmation_id"]
            isOneToOne: false
            referencedRelation: "confirmed_game_winners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "final_results_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "ai_game_predictions"
            referencedColumns: ["id"]
          },
        ]
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
      follow_up_queue: {
        Row: {
          brand: string | null
          business_id: string | null
          completed_at: string | null
          completed_by: string | null
          context: Json | null
          created_at: string | null
          due_at: string
          id: string
          priority: number | null
          reason: string
          recommended_action: string
          status: string | null
          store_id: string | null
          updated_at: string | null
          vertical_id: string | null
        }
        Insert: {
          brand?: string | null
          business_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          context?: Json | null
          created_at?: string | null
          due_at: string
          id?: string
          priority?: number | null
          reason: string
          recommended_action: string
          status?: string | null
          store_id?: string | null
          updated_at?: string | null
          vertical_id?: string | null
        }
        Update: {
          brand?: string | null
          business_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          context?: Json | null
          created_at?: string | null
          due_at?: string
          id?: string
          priority?: number | null
          reason?: string
          recommended_action?: string
          status?: string | null
          store_id?: string | null
          updated_at?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_queue_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_queue_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
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
      intent_graphs: {
        Row: {
          active_intents: string[] | null
          confidence_score: number | null
          conflicting_intents: string[] | null
          conversation_id: string
          created_at: string
          dormant_intents: string[] | null
          id: string
          intent_velocity_score: number | null
          last_analyzed_at: string | null
          opportunity_index: number | null
          predictions: Json | null
          resolved_intents: string[] | null
          risk_index: number | null
          suggestions: Json | null
          updated_at: string
        }
        Insert: {
          active_intents?: string[] | null
          confidence_score?: number | null
          conflicting_intents?: string[] | null
          conversation_id: string
          created_at?: string
          dormant_intents?: string[] | null
          id?: string
          intent_velocity_score?: number | null
          last_analyzed_at?: string | null
          opportunity_index?: number | null
          predictions?: Json | null
          resolved_intents?: string[] | null
          risk_index?: number | null
          suggestions?: Json | null
          updated_at?: string
        }
        Update: {
          active_intents?: string[] | null
          confidence_score?: number | null
          conflicting_intents?: string[] | null
          conversation_id?: string
          created_at?: string
          dormant_intents?: string[] | null
          id?: string
          intent_velocity_score?: number | null
          last_analyzed_at?: string | null
          opportunity_index?: number | null
          predictions?: Json | null
          resolved_intents?: string[] | null
          risk_index?: number | null
          suggestions?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intent_graphs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversation_memories"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_nodes: {
        Row: {
          ai_reasoning: string | null
          blockers: string[] | null
          created_at: string
          dependencies: string[] | null
          emotional_charge: string | null
          human_override_note: string | null
          id: string
          intent_direction: string
          intent_graph_id: string
          intent_strength: number
          intent_type: string
          is_locked: boolean | null
          likelihood_to_convert: number | null
          origin_event_id: string | null
          status: string
          supporting_event_ids: string[] | null
          updated_at: string
          urgency_score: number | null
        }
        Insert: {
          ai_reasoning?: string | null
          blockers?: string[] | null
          created_at?: string
          dependencies?: string[] | null
          emotional_charge?: string | null
          human_override_note?: string | null
          id?: string
          intent_direction?: string
          intent_graph_id: string
          intent_strength?: number
          intent_type: string
          is_locked?: boolean | null
          likelihood_to_convert?: number | null
          origin_event_id?: string | null
          status?: string
          supporting_event_ids?: string[] | null
          updated_at?: string
          urgency_score?: number | null
        }
        Update: {
          ai_reasoning?: string | null
          blockers?: string[] | null
          created_at?: string
          dependencies?: string[] | null
          emotional_charge?: string | null
          human_override_note?: string | null
          id?: string
          intent_direction?: string
          intent_graph_id?: string
          intent_strength?: number
          intent_type?: string
          is_locked?: boolean | null
          likelihood_to_convert?: number | null
          origin_event_id?: string | null
          status?: string
          supporting_event_ids?: string[] | null
          updated_at?: string
          urgency_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "intent_nodes_intent_graph_id_fkey"
            columns: ["intent_graph_id"]
            isOneToOne: false
            referencedRelation: "intent_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intent_nodes_origin_event_id_fkey"
            columns: ["origin_event_id"]
            isOneToOne: false
            referencedRelation: "memory_events"
            referencedColumns: ["id"]
          },
        ]
      }
      intent_training_feedback: {
        Row: {
          corrected_value: Json | null
          created_at: string
          feedback_type: string
          id: string
          intent_node_id: string
          notes: string | null
          original_value: Json | null
          user_id: string | null
        }
        Insert: {
          corrected_value?: Json | null
          created_at?: string
          feedback_type: string
          id?: string
          intent_node_id: string
          notes?: string | null
          original_value?: Json | null
          user_id?: string | null
        }
        Update: {
          corrected_value?: Json | null
          created_at?: string
          feedback_type?: string
          id?: string
          intent_node_id?: string
          notes?: string | null
          original_value?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intent_training_feedback_intent_node_id_fkey"
            columns: ["intent_node_id"]
            isOneToOne: false
            referencedRelation: "intent_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_notifications: {
        Row: {
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean | null
          message: string | null
          target_role: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          target_role?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean | null
          message?: string | null
          target_role?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
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
      inventory_audit_log: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          changed_by_system: boolean | null
          created_at: string | null
          field_changed: string
          id: string
          new_value: string | null
          old_value: string | null
          product_id: string | null
          quantity_delta: number | null
          reference_id: string | null
          reference_type: string | null
          stock_id: string | null
          store_id: string | null
          store_inventory_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          changed_by_system?: boolean | null
          created_at?: string | null
          field_changed: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          product_id?: string | null
          quantity_delta?: number | null
          reference_id?: string | null
          reference_type?: string | null
          stock_id?: string | null
          store_id?: string | null
          store_inventory_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          changed_by_system?: boolean | null
          created_at?: string | null
          field_changed?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          product_id?: string | null
          quantity_delta?: number | null
          reference_id?: string | null
          reference_type?: string | null
          stock_id?: string | null
          store_id?: string | null
          store_inventory_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_audit_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_log_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "inventory_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_log_store_inventory_id_fkey"
            columns: ["store_inventory_id"]
            isOneToOne: false
            referencedRelation: "store_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_audit_log_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      inventory_forecasts: {
        Row: {
          avg_daily_usage: number | null
          business_id: string | null
          calculated_at: string | null
          days_until_runout: number | null
          forecast_demand: number | null
          horizon_days: number
          id: string
          metadata: Json | null
          product_id: string | null
          projected_runout_date: string | null
          risk_level: string | null
          risk_reason: string | null
          suggestion: string | null
          warehouse_id: string | null
        }
        Insert: {
          avg_daily_usage?: number | null
          business_id?: string | null
          calculated_at?: string | null
          days_until_runout?: number | null
          forecast_demand?: number | null
          horizon_days?: number
          id?: string
          metadata?: Json | null
          product_id?: string | null
          projected_runout_date?: string | null
          risk_level?: string | null
          risk_reason?: string | null
          suggestion?: string | null
          warehouse_id?: string | null
        }
        Update: {
          avg_daily_usage?: number | null
          business_id?: string | null
          calculated_at?: string | null
          days_until_runout?: number | null
          forecast_demand?: number | null
          horizon_days?: number
          id?: string
          metadata?: Json | null
          product_id?: string | null
          projected_runout_date?: string | null
          risk_level?: string | null
          risk_reason?: string | null
          suggestion?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_forecasts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_forecasts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_forecasts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          created_by: string | null
          from_bin_id: string | null
          from_id: string | null
          from_type: string | null
          from_warehouse_id: string | null
          id: string
          movement_type: string
          notes: string | null
          order_id: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          to_bin_id: string | null
          to_id: string | null
          to_type: string | null
          to_warehouse_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_bin_id?: string | null
          from_id?: string | null
          from_type?: string | null
          from_warehouse_id?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          order_id?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          to_bin_id?: string | null
          to_id?: string | null
          to_type?: string | null
          to_warehouse_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_bin_id?: string | null
          from_id?: string | null
          from_type?: string | null
          from_warehouse_id?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          to_bin_id?: string | null
          to_id?: string | null
          to_type?: string | null
          to_warehouse_id?: string | null
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
      inventory_risk_flags: {
        Row: {
          business_id: string | null
          created_at: string | null
          days_without_movement: number | null
          flag_type: string
          id: string
          last_movement_at: string | null
          message: string
          product_id: string | null
          severity: string
          warehouse_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          days_without_movement?: number | null
          flag_type: string
          id?: string
          last_movement_at?: string | null
          message: string
          product_id?: string | null
          severity?: string
          warehouse_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          days_without_movement?: number | null
          flag_type?: string
          id?: string
          last_movement_at?: string | null
          message?: string
          product_id?: string | null
          severity?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_risk_flags_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_risk_flags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_risk_flags_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_snapshots: {
        Row: {
          business_id: string | null
          created_at: string | null
          id: string
          low_stock_count: number | null
          out_of_stock_count: number | null
          snapshot_date: string
          snapshot_warehouse_id: string | null
          total_products: number | null
          total_units: number | null
          total_value: number | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          id?: string
          low_stock_count?: number | null
          out_of_stock_count?: number | null
          snapshot_date: string
          snapshot_warehouse_id?: string | null
          total_products?: number | null
          total_units?: number | null
          total_value?: number | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          id?: string
          low_stock_count?: number | null
          out_of_stock_count?: number | null
          snapshot_date?: string
          snapshot_warehouse_id?: string | null
          total_products?: number | null
          total_units?: number | null
          total_value?: number | null
        }
        Relationships: []
      }
      inventory_stock: {
        Row: {
          bin_id: string | null
          business_id: string | null
          created_at: string | null
          id: string
          owner_id: string | null
          owner_type: string | null
          product_id: string | null
          quantity_in_transit: number | null
          quantity_on_hand: number | null
          quantity_reserved: number | null
          reorder_point: number | null
          reorder_target: number | null
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          bin_id?: string | null
          business_id?: string | null
          created_at?: string | null
          id?: string
          owner_id?: string | null
          owner_type?: string | null
          product_id?: string | null
          quantity_in_transit?: number | null
          quantity_on_hand?: number | null
          quantity_reserved?: number | null
          reorder_point?: number | null
          reorder_target?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          bin_id?: string | null
          business_id?: string | null
          created_at?: string | null
          id?: string
          owner_id?: string | null
          owner_type?: string | null
          product_id?: string | null
          quantity_in_transit?: number | null
          quantity_on_hand?: number | null
          quantity_reserved?: number | null
          reorder_point?: number | null
          reorder_target?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_stock_bin_id_fkey"
            columns: ["bin_id"]
            isOneToOne: false
            referencedRelation: "warehouse_bins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_stock_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      invoice_line_items: {
        Row: {
          brand_id: string | null
          brand_name: string | null
          created_at: string
          id: string
          invoice_id: string
          product_id: string | null
          product_name: string | null
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          brand_id?: string | null
          brand_name?: string | null
          created_at?: string
          id?: string
          invoice_id: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          total: number
          unit_price: number
        }
        Update: {
          brand_id?: string | null
          brand_name?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      issue_events: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          issue_id: string
          new_value: string | null
          notes: string | null
          old_value: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          issue_id: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          issue_id?: string
          new_value?: string | null
          notes?: string | null
          old_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issue_events_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issue_events_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "biker_issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issue_sla_rules: {
        Row: {
          business_id: string | null
          created_at: string
          escalation_minutes: number
          escalation_target_role: string | null
          id: string
          issue_type: string
          severity: string
          sla_minutes: number
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          escalation_minutes?: number
          escalation_target_role?: string | null
          id?: string
          issue_type: string
          severity: string
          sla_minutes?: number
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          escalation_minutes?: number
          escalation_target_role?: string | null
          id?: string
          issue_type?: string
          severity?: string
          sla_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_sla_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      language_profiles: {
        Row: {
          code: string
          created_at: string
          description: string | null
          dialect_code: string
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          dialect_code: string
          id?: string
          is_default?: boolean | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          dialect_code?: string
          id?: string
          is_default?: boolean | null
          name?: string
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
      locations: {
        Row: {
          address_line1: string | null
          business_id: string
          city: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          location_type: string
          name: string
          notes: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          business_id: string
          city?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_type?: string
          name: string
          notes?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          business_id?: string
          city?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          location_type?: string
          name?: string
          notes?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      manual_backfill_entries: {
        Row: {
          actual_stat_value: number | null
          actual_winner: string | null
          away_score: number | null
          away_team: string | null
          confidence: number | null
          created_at: string
          created_by: string | null
          date: string
          home_score: number | null
          home_team: string | null
          id: string
          locked: boolean
          market: string
          notes: string | null
          player_name: string | null
          predicted_direction: string | null
          predicted_side: string | null
          prop_line: number | null
          result: string
          source: string
          sport: string
          stat_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actual_stat_value?: number | null
          actual_winner?: string | null
          away_score?: number | null
          away_team?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          date: string
          home_score?: number | null
          home_team?: string | null
          id?: string
          locked?: boolean
          market: string
          notes?: string | null
          player_name?: string | null
          predicted_direction?: string | null
          predicted_side?: string | null
          prop_line?: number | null
          result: string
          source?: string
          sport?: string
          stat_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actual_stat_value?: number | null
          actual_winner?: string | null
          away_score?: number | null
          away_team?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          home_score?: number | null
          home_team?: string | null
          id?: string
          locked?: boolean
          market?: string
          notes?: string | null
          player_name?: string | null
          predicted_direction?: string | null
          predicted_side?: string | null
          prop_line?: number | null
          result?: string
          source?: string
          sport?: string
          stat_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      manual_call_logs: {
        Row: {
          business_id: string | null
          caller_id: string | null
          contact_id: string | null
          created_at: string | null
          direction: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          notes: string | null
          outcome: string | null
          phone_number: string | null
          started_at: string | null
          status: string | null
          store_id: string | null
          vertical_id: string | null
        }
        Insert: {
          business_id?: string | null
          caller_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          direction?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          phone_number?: string | null
          started_at?: string | null
          status?: string | null
          store_id?: string | null
          vertical_id?: string | null
        }
        Update: {
          business_id?: string | null
          caller_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          direction?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          outcome?: string | null
          phone_number?: string | null
          started_at?: string | null
          status?: string | null
          store_id?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_call_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_call_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_call_logs_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      market_lines: {
        Row: {
          created_at: string | null
          event: string
          event_time: string | null
          home_game: boolean | null
          id: string
          league: string | null
          line_value: number | null
          market_type: Database["public"]["Enums"]["market_type"]
          minutes_trend: string | null
          odds_or_payout: number | null
          opponent_def_tier: string | null
          over_under: string | null
          pace_tier: string | null
          platform: string
          player_name: string | null
          player_recent_avg: number | null
          player_recent_std: number | null
          player_season_avg: number | null
          sport: string
          stat_type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event: string
          event_time?: string | null
          home_game?: boolean | null
          id?: string
          league?: string | null
          line_value?: number | null
          market_type: Database["public"]["Enums"]["market_type"]
          minutes_trend?: string | null
          odds_or_payout?: number | null
          opponent_def_tier?: string | null
          over_under?: string | null
          pace_tier?: string | null
          platform: string
          player_name?: string | null
          player_recent_avg?: number | null
          player_recent_std?: number | null
          player_season_avg?: number | null
          sport: string
          stat_type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event?: string
          event_time?: string | null
          home_game?: boolean | null
          id?: string
          league?: string | null
          line_value?: number | null
          market_type?: Database["public"]["Enums"]["market_type"]
          minutes_trend?: string | null
          odds_or_payout?: number | null
          opponent_def_tier?: string | null
          over_under?: string | null
          pace_tier?: string | null
          platform?: string
          player_name?: string | null
          player_recent_avg?: number | null
          player_recent_std?: number | null
          player_season_avg?: number | null
          sport?: string
          stat_type?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      marketplace_order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          price_each: number
          product_id: string | null
          qty: number | null
          wholesaler_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          price_each: number
          product_id?: string | null
          qty?: number | null
          wholesaler_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          price_each?: number
          product_id?: string | null
          qty?: number | null
          wholesaler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_all"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_order_items_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesaler_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_orders: {
        Row: {
          billing_address: Json | null
          created_at: string | null
          fulfillment_status: string | null
          id: string
          notes: string | null
          order_type: string | null
          payment_status: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          shipping_funded_by_customer: boolean | null
          stripe_payment_intent_id: string | null
          subtotal: number | null
          tax_amount: number | null
          total: number | null
          updated_at: string | null
          user_id: string
          wholesaler_id: string | null
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string | null
          fulfillment_status?: string | null
          id?: string
          notes?: string | null
          order_type?: string | null
          payment_status?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_funded_by_customer?: boolean | null
          stripe_payment_intent_id?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total?: number | null
          updated_at?: string | null
          user_id: string
          wholesaler_id?: string | null
        }
        Update: {
          billing_address?: Json | null
          created_at?: string | null
          fulfillment_status?: string | null
          id?: string
          notes?: string | null
          order_type?: string | null
          payment_status?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          shipping_funded_by_customer?: boolean | null
          stripe_payment_intent_id?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total?: number | null
          updated_at?: string | null
          user_id?: string
          wholesaler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_orders_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesaler_profiles"
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
      memory_events: {
        Row: {
          actor: string
          actor_name: string | null
          ai_extracted_summary: string | null
          business_id: string | null
          channel: string
          conversation_id: string
          created_at: string
          direction: string | null
          escalation_flag: boolean | null
          id: string
          linked_tasks: string[] | null
          metadata: Json | null
          raw_content: string | null
          sentiment_score: number | null
          tags: string[] | null
        }
        Insert: {
          actor: string
          actor_name?: string | null
          ai_extracted_summary?: string | null
          business_id?: string | null
          channel: string
          conversation_id: string
          created_at?: string
          direction?: string | null
          escalation_flag?: boolean | null
          id?: string
          linked_tasks?: string[] | null
          metadata?: Json | null
          raw_content?: string | null
          sentiment_score?: number | null
          tags?: string[] | null
        }
        Update: {
          actor?: string
          actor_name?: string | null
          ai_extracted_summary?: string | null
          business_id?: string | null
          channel?: string
          conversation_id?: string
          created_at?: string
          direction?: string | null
          escalation_flag?: boolean | null
          id?: string
          linked_tasks?: string[] | null
          metadata?: Json | null
          raw_content?: string | null
          sentiment_score?: number | null
          tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "memory_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_memories"
            referencedColumns: ["id"]
          },
        ]
      }
      message_language_detection: {
        Row: {
          confidence: number | null
          created_at: string
          detected_dialect: string | null
          detected_formality: string | null
          detected_language: string | null
          id: string
          message_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          detected_dialect?: string | null
          detected_formality?: string | null
          detected_language?: string | null
          id?: string
          message_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          detected_dialect?: string | null
          detected_formality?: string | null
          detected_language?: string | null
          id?: string
          message_id?: string | null
        }
        Relationships: []
      }
      message_threads: {
        Row: {
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          order_id: string | null
          participants: Json
          status: string | null
          subject: string | null
          thread_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          order_id?: string | null
          participants?: Json
          status?: string | null
          subject?: string | null
          thread_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          order_id?: string | null
          participants?: Json
          status?: string | null
          subject?: string | null
          thread_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          attachments: Json | null
          created_at: string
          id: string
          is_system_message: boolean | null
          is_whisper: boolean | null
          message_text: string
          read_by: string[] | null
          receiver_id: string | null
          receiver_role: string | null
          sender_id: string
          sender_role: string
          starred_by: string[] | null
          thread_id: string
          translated_text: Json | null
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_system_message?: boolean | null
          is_whisper?: boolean | null
          message_text: string
          read_by?: string[] | null
          receiver_id?: string | null
          receiver_role?: string | null
          sender_id: string
          sender_role: string
          starred_by?: string[] | null
          thread_id: string
          translated_text?: Json | null
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          id?: string
          is_system_message?: boolean | null
          is_whisper?: boolean | null
          message_text?: string
          read_by?: string[] | null
          receiver_id?: string | null
          receiver_role?: string | null
          sender_id?: string
          sender_role?: string
          starred_by?: string[] | null
          thread_id?: string
          translated_text?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "message_threads"
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
      moneyline_results: {
        Row: {
          actual_winner: string
          ai_predicted_winner: string | null
          ai_probability: number | null
          away_score: number | null
          away_team: string
          confidence_score: number | null
          created_at: string
          game_date: string
          game_id: string
          home_score: number | null
          home_team: string
          id: string
          locked_at: string | null
          model_version: string | null
          prediction_id: string | null
          result: string | null
          settled_at: string
          sport: string
        }
        Insert: {
          actual_winner: string
          ai_predicted_winner?: string | null
          ai_probability?: number | null
          away_score?: number | null
          away_team: string
          confidence_score?: number | null
          created_at?: string
          game_date: string
          game_id: string
          home_score?: number | null
          home_team: string
          id?: string
          locked_at?: string | null
          model_version?: string | null
          prediction_id?: string | null
          result?: string | null
          settled_at?: string
          sport?: string
        }
        Update: {
          actual_winner?: string
          ai_predicted_winner?: string | null
          ai_probability?: number | null
          away_score?: number | null
          away_team?: string
          confidence_score?: number | null
          created_at?: string
          game_date?: string
          game_id?: string
          home_score?: number | null
          home_team?: string
          id?: string
          locked_at?: string | null
          model_version?: string | null
          prediction_id?: string | null
          result?: string | null
          settled_at?: string
          sport?: string
        }
        Relationships: []
      }
      multi_language_content: {
        Row: {
          content_ar: string | null
          content_en: string | null
          content_es: string | null
          content_fr: string | null
          created_at: string | null
          id: string
          key: string
          module: string
          updated_at: string | null
        }
        Insert: {
          content_ar?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          created_at?: string | null
          id?: string
          key: string
          module: string
          updated_at?: string | null
        }
        Update: {
          content_ar?: string | null
          content_en?: string | null
          content_es?: string | null
          content_fr?: string | null
          created_at?: string | null
          id?: string
          key?: string
          module?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      nba_games_today: {
        Row: {
          away_score: number | null
          away_team: string
          away_team_back_to_back: boolean | null
          created_at: string
          game_date: string
          game_id: string
          game_time: string | null
          home_score: number | null
          home_team: string
          home_team_back_to_back: boolean | null
          id: string
          status: string | null
          winner: string | null
        }
        Insert: {
          away_score?: number | null
          away_team: string
          away_team_back_to_back?: boolean | null
          created_at?: string
          game_date?: string
          game_id: string
          game_time?: string | null
          home_score?: number | null
          home_team: string
          home_team_back_to_back?: boolean | null
          id?: string
          status?: string | null
          winner?: string | null
        }
        Update: {
          away_score?: number | null
          away_team?: string
          away_team_back_to_back?: boolean | null
          created_at?: string
          game_date?: string
          game_id?: string
          game_time?: string | null
          home_score?: number | null
          home_team?: string
          home_team_back_to_back?: boolean | null
          id?: string
          status?: string | null
          winner?: string | null
        }
        Relationships: []
      }
      nba_moneyline_predictions: {
        Row: {
          away_back_to_back: boolean | null
          away_def_rating: number | null
          away_implied_odds: number | null
          away_injury_impact: number | null
          away_net_rating: number | null
          away_off_rating: number | null
          away_pace: number | null
          away_rest_days: number | null
          away_team: string
          away_win_probability: number | null
          calibration_factors: Json | null
          confidence_score: number | null
          created_at: string | null
          edge_vs_market: number | null
          game_date: string
          game_id: string
          game_time: string | null
          generated_at: string | null
          home_back_to_back: boolean | null
          home_def_rating: number | null
          home_implied_odds: number | null
          home_injury_impact: number | null
          home_net_rating: number | null
          home_off_rating: number | null
          home_pace: number | null
          home_rest_days: number | null
          home_team: string
          home_win_probability: number | null
          id: string
          predicted_winner: string | null
          reasoning: string | null
          recommendation: string | null
        }
        Insert: {
          away_back_to_back?: boolean | null
          away_def_rating?: number | null
          away_implied_odds?: number | null
          away_injury_impact?: number | null
          away_net_rating?: number | null
          away_off_rating?: number | null
          away_pace?: number | null
          away_rest_days?: number | null
          away_team: string
          away_win_probability?: number | null
          calibration_factors?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          edge_vs_market?: number | null
          game_date?: string
          game_id: string
          game_time?: string | null
          generated_at?: string | null
          home_back_to_back?: boolean | null
          home_def_rating?: number | null
          home_implied_odds?: number | null
          home_injury_impact?: number | null
          home_net_rating?: number | null
          home_off_rating?: number | null
          home_pace?: number | null
          home_rest_days?: number | null
          home_team: string
          home_win_probability?: number | null
          id?: string
          predicted_winner?: string | null
          reasoning?: string | null
          recommendation?: string | null
        }
        Update: {
          away_back_to_back?: boolean | null
          away_def_rating?: number | null
          away_implied_odds?: number | null
          away_injury_impact?: number | null
          away_net_rating?: number | null
          away_off_rating?: number | null
          away_pace?: number | null
          away_rest_days?: number | null
          away_team?: string
          away_win_probability?: number | null
          calibration_factors?: Json | null
          confidence_score?: number | null
          created_at?: string | null
          edge_vs_market?: number | null
          game_date?: string
          game_id?: string
          game_time?: string | null
          generated_at?: string | null
          home_back_to_back?: boolean | null
          home_def_rating?: number | null
          home_implied_odds?: number | null
          home_injury_impact?: number | null
          home_net_rating?: number | null
          home_off_rating?: number | null
          home_pace?: number | null
          home_rest_days?: number | null
          home_team?: string
          home_win_probability?: number | null
          id?: string
          predicted_winner?: string | null
          reasoning?: string | null
          recommendation?: string | null
        }
        Relationships: []
      }
      nba_player_box_scores: {
        Row: {
          assists: number
          blocks: number
          created_at: string
          dnp: boolean
          game_date: string
          game_id: string
          id: string
          minutes: number
          opponent: string
          player_id: string
          player_name: string
          points: number
          pra: number | null
          rebounds: number
          steals: number
          team: string
          three_pointers_made: number
          turnovers: number
          updated_at: string
        }
        Insert: {
          assists?: number
          blocks?: number
          created_at?: string
          dnp?: boolean
          game_date: string
          game_id: string
          id?: string
          minutes?: number
          opponent: string
          player_id: string
          player_name: string
          points?: number
          pra?: number | null
          rebounds?: number
          steals?: number
          team: string
          three_pointers_made?: number
          turnovers?: number
          updated_at?: string
        }
        Update: {
          assists?: number
          blocks?: number
          created_at?: string
          dnp?: boolean
          game_date?: string
          game_id?: string
          id?: string
          minutes?: number
          opponent?: string
          player_id?: string
          player_name?: string
          points?: number
          pra?: number | null
          rebounds?: number
          steals?: number
          team?: string
          three_pointers_made?: number
          turnovers?: number
          updated_at?: string
        }
        Relationships: []
      }
      nba_player_stats: {
        Row: {
          created_at: string
          id: string
          injury_status: string | null
          last_10_games_avg_3pm: number | null
          last_10_games_avg_ast: number | null
          last_10_games_avg_pra: number | null
          last_10_games_avg_pts: number | null
          last_10_games_avg_reb: number | null
          last_5_games_avg_3pm: number | null
          last_5_games_avg_ast: number | null
          last_5_games_avg_pra: number | null
          last_5_games_avg_pts: number | null
          last_5_games_avg_reb: number | null
          last_updated: string
          minutes_last_5_avg: number | null
          player_id: string
          player_name: string
          position: string | null
          season_avg_3pm: number | null
          season_avg_ast: number | null
          season_avg_min: number | null
          season_avg_pra: number | null
          season_avg_pts: number | null
          season_avg_reb: number | null
          std_3pm: number | null
          std_ast: number | null
          std_pra: number | null
          std_pts: number | null
          std_reb: number | null
          team: string
          usage_rate: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          injury_status?: string | null
          last_10_games_avg_3pm?: number | null
          last_10_games_avg_ast?: number | null
          last_10_games_avg_pra?: number | null
          last_10_games_avg_pts?: number | null
          last_10_games_avg_reb?: number | null
          last_5_games_avg_3pm?: number | null
          last_5_games_avg_ast?: number | null
          last_5_games_avg_pra?: number | null
          last_5_games_avg_pts?: number | null
          last_5_games_avg_reb?: number | null
          last_updated?: string
          minutes_last_5_avg?: number | null
          player_id: string
          player_name: string
          position?: string | null
          season_avg_3pm?: number | null
          season_avg_ast?: number | null
          season_avg_min?: number | null
          season_avg_pra?: number | null
          season_avg_pts?: number | null
          season_avg_reb?: number | null
          std_3pm?: number | null
          std_ast?: number | null
          std_pra?: number | null
          std_pts?: number | null
          std_reb?: number | null
          team: string
          usage_rate?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          injury_status?: string | null
          last_10_games_avg_3pm?: number | null
          last_10_games_avg_ast?: number | null
          last_10_games_avg_pra?: number | null
          last_10_games_avg_pts?: number | null
          last_10_games_avg_reb?: number | null
          last_5_games_avg_3pm?: number | null
          last_5_games_avg_ast?: number | null
          last_5_games_avg_pra?: number | null
          last_5_games_avg_pts?: number | null
          last_5_games_avg_reb?: number | null
          last_updated?: string
          minutes_last_5_avg?: number | null
          player_id?: string
          player_name?: string
          position?: string | null
          season_avg_3pm?: number | null
          season_avg_ast?: number | null
          season_avg_min?: number | null
          season_avg_pra?: number | null
          season_avg_pts?: number | null
          season_avg_reb?: number | null
          std_3pm?: number | null
          std_ast?: number | null
          std_pra?: number | null
          std_pts?: number | null
          std_reb?: number | null
          team?: string
          usage_rate?: number | null
        }
        Relationships: []
      }
      nba_props_generated: {
        Row: {
          back_to_back: boolean | null
          break_even_probability: number | null
          calibration_factors: Json | null
          confidence_score: number | null
          created_at: string
          data_completeness: number | null
          edge: number | null
          estimated_probability: number | null
          game_date: string
          game_id: string
          home_game: boolean | null
          id: string
          line_value: number
          minutes_trend: string | null
          opponent: string
          opponent_def_tier: string | null
          over_under: string
          pace_tier: string | null
          player_id: string
          player_name: string
          projected_value: number | null
          reasoning: string[] | null
          recommendation: string | null
          simulated_roi: number | null
          source: string | null
          stat_type: string
          team: string
          volatility_score: string | null
        }
        Insert: {
          back_to_back?: boolean | null
          break_even_probability?: number | null
          calibration_factors?: Json | null
          confidence_score?: number | null
          created_at?: string
          data_completeness?: number | null
          edge?: number | null
          estimated_probability?: number | null
          game_date?: string
          game_id: string
          home_game?: boolean | null
          id?: string
          line_value: number
          minutes_trend?: string | null
          opponent: string
          opponent_def_tier?: string | null
          over_under?: string
          pace_tier?: string | null
          player_id: string
          player_name: string
          projected_value?: number | null
          reasoning?: string[] | null
          recommendation?: string | null
          simulated_roi?: number | null
          source?: string | null
          stat_type: string
          team: string
          volatility_score?: string | null
        }
        Update: {
          back_to_back?: boolean | null
          break_even_probability?: number | null
          calibration_factors?: Json | null
          confidence_score?: number | null
          created_at?: string
          data_completeness?: number | null
          edge?: number | null
          estimated_probability?: number | null
          game_date?: string
          game_id?: string
          home_game?: boolean | null
          id?: string
          line_value?: number
          minutes_trend?: string | null
          opponent?: string
          opponent_def_tier?: string | null
          over_under?: string
          pace_tier?: string | null
          player_id?: string
          player_name?: string
          projected_value?: number | null
          reasoning?: string[] | null
          recommendation?: string | null
          simulated_roi?: number | null
          source?: string | null
          stat_type?: string
          team?: string
          volatility_score?: string | null
        }
        Relationships: []
      }
      nba_stats_refresh_log: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          games_fetched: number | null
          id: string
          players_updated: number | null
          props_generated: number | null
          refresh_date: string
          started_at: string | null
          status: string | null
          teams_updated: number | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          games_fetched?: number | null
          id?: string
          players_updated?: number | null
          props_generated?: number | null
          refresh_date?: string
          started_at?: string | null
          status?: string | null
          teams_updated?: number | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          games_fetched?: number | null
          id?: string
          players_updated?: number | null
          props_generated?: number | null
          refresh_date?: string
          started_at?: string | null
          status?: string | null
          teams_updated?: number | null
        }
        Relationships: []
      }
      nba_team_stats: {
        Row: {
          created_at: string
          def_rank_overall: number | null
          def_rank_vs_c: number | null
          def_rank_vs_pf: number | null
          def_rank_vs_pg: number | null
          def_rank_vs_sf: number | null
          def_rank_vs_sg: number | null
          id: string
          last_updated: string
          pace_rating: number | null
          pace_tier: string | null
          pts_allowed_avg: number | null
          team_abbr: string
          team_name: string
        }
        Insert: {
          created_at?: string
          def_rank_overall?: number | null
          def_rank_vs_c?: number | null
          def_rank_vs_pf?: number | null
          def_rank_vs_pg?: number | null
          def_rank_vs_sf?: number | null
          def_rank_vs_sg?: number | null
          id?: string
          last_updated?: string
          pace_rating?: number | null
          pace_tier?: string | null
          pts_allowed_avg?: number | null
          team_abbr: string
          team_name: string
        }
        Update: {
          created_at?: string
          def_rank_overall?: number | null
          def_rank_vs_c?: number | null
          def_rank_vs_pf?: number | null
          def_rank_vs_pg?: number | null
          def_rank_vs_sf?: number | null
          def_rank_vs_sg?: number | null
          id?: string
          last_updated?: string
          pace_rating?: number | null
          pace_tier?: string | null
          pts_allowed_avg?: number | null
          team_abbr?: string
          team_name?: string
        }
        Relationships: []
      }
      negotiation_sessions: {
        Row: {
          ai_agent_id: string | null
          channel: string
          deal_id: string
          ended_at: string | null
          human_agent_id: string | null
          id: string
          result: string | null
          session_type: string
          started_at: string | null
          summary: Json | null
          transcript_path: string | null
        }
        Insert: {
          ai_agent_id?: string | null
          channel: string
          deal_id: string
          ended_at?: string | null
          human_agent_id?: string | null
          id?: string
          result?: string | null
          session_type: string
          started_at?: string | null
          summary?: Json | null
          transcript_path?: string | null
        }
        Update: {
          ai_agent_id?: string | null
          channel?: string
          deal_id?: string
          ended_at?: string | null
          human_agent_id?: string | null
          id?: string
          result?: string | null
          session_type?: string
          started_at?: string | null
          summary?: Json | null
          transcript_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_sessions_ai_agent_id_fkey"
            columns: ["ai_agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_sessions_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiation_sessions_human_agent_id_fkey"
            columns: ["human_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          borough_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          borough_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          borough_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "neighborhoods_borough_id_fkey"
            columns: ["borough_id"]
            isOneToOne: false
            referencedRelation: "boroughs"
            referencedColumns: ["id"]
          },
        ]
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
      order_routing: {
        Row: {
          assigned_at: string | null
          assigned_biker_id: string | null
          assigned_driver_id: string | null
          assigned_wholesaler_id: string | null
          cash_amount: number | null
          cash_collection: boolean | null
          completed_at: string | null
          created_at: string | null
          delivery_date: string | null
          delivery_type: string | null
          fulfillment_type: string | null
          id: string
          order_id: string | null
          pickup_required: boolean | null
          status: string | null
          warehouse_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_biker_id?: string | null
          assigned_driver_id?: string | null
          assigned_wholesaler_id?: string | null
          cash_amount?: number | null
          cash_collection?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          delivery_date?: string | null
          delivery_type?: string | null
          fulfillment_type?: string | null
          id?: string
          order_id?: string | null
          pickup_required?: boolean | null
          status?: string | null
          warehouse_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_biker_id?: string | null
          assigned_driver_id?: string | null
          assigned_wholesaler_id?: string | null
          cash_amount?: number | null
          cash_collection?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          delivery_date?: string | null
          delivery_type?: string | null
          fulfillment_type?: string | null
          id?: string
          order_id?: string | null
          pickup_required?: boolean | null
          status?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_routing_assigned_biker_id_fkey"
            columns: ["assigned_biker_id"]
            isOneToOne: false
            referencedRelation: "biker_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_routing_assigned_driver_id_fkey"
            columns: ["assigned_driver_id"]
            isOneToOne: false
            referencedRelation: "driver_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_routing_assigned_wholesaler_id_fkey"
            columns: ["assigned_wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesaler_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_routing_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_snapshot: Json | null
          affiliate_id: string | null
          ambassador_id: string | null
          amount_paid: number
          assigned_to: string | null
          balance_due: number
          biker_id: string | null
          brand_key: string
          business_id: string | null
          cancel_reason: string | null
          canceled_at: string | null
          channel: Database["public"]["Enums"]["order_channel"]
          completed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_company: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_notes: string | null
          customer_phone: string | null
          customer_type: string | null
          deleted_at: string | null
          detail_ref: Json | null
          discount_amount: number
          driver_id: string | null
          due_at: string | null
          external_ref: string | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          internal_notes: string | null
          order_status: Database["public"]["Enums"]["order_status"]
          order_type: Database["public"]["Enums"]["order_type"]
          payment_status: Database["public"]["Enums"]["payment_status"]
          placed_at: string
          scheduled_at: string | null
          service_fee_amount: number
          shipping_amount: number
          short_code: string | null
          source_campaign: string | null
          source_note: string | null
          store_id: string | null
          subtotal_amount: number
          tags: string[] | null
          tax_amount: number
          total_amount: number
          updated_at: string
          updated_by: string | null
          wholesaler_id: string | null
        }
        Insert: {
          address_snapshot?: Json | null
          affiliate_id?: string | null
          ambassador_id?: string | null
          amount_paid?: number
          assigned_to?: string | null
          balance_due?: number
          biker_id?: string | null
          brand_key: string
          business_id?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          channel?: Database["public"]["Enums"]["order_channel"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_type?: string | null
          deleted_at?: string | null
          detail_ref?: Json | null
          discount_amount?: number
          driver_id?: string | null
          due_at?: string | null
          external_ref?: string | null
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          internal_notes?: string | null
          order_status?: Database["public"]["Enums"]["order_status"]
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
          scheduled_at?: string | null
          service_fee_amount?: number
          shipping_amount?: number
          short_code?: string | null
          source_campaign?: string | null
          source_note?: string | null
          store_id?: string | null
          subtotal_amount?: number
          tags?: string[] | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          wholesaler_id?: string | null
        }
        Update: {
          address_snapshot?: Json | null
          affiliate_id?: string | null
          ambassador_id?: string | null
          amount_paid?: number
          assigned_to?: string | null
          balance_due?: number
          biker_id?: string | null
          brand_key?: string
          business_id?: string | null
          cancel_reason?: string | null
          canceled_at?: string | null
          channel?: Database["public"]["Enums"]["order_channel"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_company?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          customer_notes?: string | null
          customer_phone?: string | null
          customer_type?: string | null
          deleted_at?: string | null
          detail_ref?: Json | null
          discount_amount?: number
          driver_id?: string | null
          due_at?: string | null
          external_ref?: string | null
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          internal_notes?: string | null
          order_status?: Database["public"]["Enums"]["order_status"]
          order_type?: Database["public"]["Enums"]["order_type"]
          payment_status?: Database["public"]["Enums"]["payment_status"]
          placed_at?: string
          scheduled_at?: string | null
          service_fee_amount?: number
          shipping_amount?: number
          short_code?: string | null
          source_campaign?: string | null
          source_note?: string | null
          store_id?: string | null
          subtotal_amount?: number
          tags?: string[] | null
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
          wholesaler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_activity_logs: {
        Row: {
          activity_type: string
          created_at: string | null
          description: string | null
          id: string
          ip_address: string | null
          metadata: Json | null
          org_id: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          org_id: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          description?: string | null
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          org_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_activity_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          accepted: boolean | null
          accepted_at: string | null
          created_at: string | null
          expires_at: string
          id: string
          invite_code: string
          invited_by: string | null
          invited_email: string
          invited_role: Database["public"]["Enums"]["org_role"]
          org_id: string
        }
        Insert: {
          accepted?: boolean | null
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          invite_code: string
          invited_by?: string | null
          invited_email: string
          invited_role: Database["public"]["Enums"]["org_role"]
          org_id: string
        }
        Update: {
          accepted?: boolean | null
          accepted_at?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          invite_code?: string
          invited_by?: string | null
          invited_email?: string
          invited_role?: Database["public"]["Enums"]["org_role"]
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_users: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          joined_at: string | null
          org_id: string
          permissions: Json | null
          role: Database["public"]["Enums"]["org_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          org_id: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          org_id?: string
          permissions?: Json | null
          role?: Database["public"]["Enums"]["org_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          org_type: string
          owner_user_id: string | null
          settings: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          billing_email?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          org_type: string
          owner_user_id?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_email?: string | null
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          org_type?: string
          owner_user_id?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      outbound_experiments: {
        Row: {
          answered: number | null
          avg_sentiment: number | null
          calls: number | null
          campaign_id: string | null
          channel: string | null
          complaints: number | null
          created_at: string
          id: string
          orders: number | null
          replies: number | null
          sms: number | null
          variant_name: string
        }
        Insert: {
          answered?: number | null
          avg_sentiment?: number | null
          calls?: number | null
          campaign_id?: string | null
          channel?: string | null
          complaints?: number | null
          created_at?: string
          id?: string
          orders?: number | null
          replies?: number | null
          sms?: number | null
          variant_name: string
        }
        Update: {
          answered?: number | null
          avg_sentiment?: number | null
          calls?: number | null
          campaign_id?: string | null
          channel?: string | null
          complaints?: number | null
          created_at?: string
          id?: string
          orders?: number | null
          replies?: number | null
          sms?: number | null
          variant_name?: string
        }
        Relationships: []
      }
      outbound_personalized_scripts: {
        Row: {
          campaign_id: string | null
          channel: string | null
          created_at: string
          id: string
          persona: string | null
          script: Json | null
          store_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          channel?: string | null
          created_at?: string
          id?: string
          persona?: string | null
          script?: Json | null
          store_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          channel?: string | null
          created_at?: string
          id?: string
          persona?: string | null
          script?: Json | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_personalized_scripts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_predictions: {
        Row: {
          answer_prob: number | null
          best_time_window: string | null
          business_id: string | null
          campaign_id: string | null
          churn_risk: number | null
          complaint_risk: number | null
          created_at: string
          id: string
          order_prob: number | null
          recommended_channel: string | null
          recommended_persona: string | null
          recommended_script_variant: string | null
          snapshot: Json | null
          store_id: string | null
          text_reply_prob: number | null
        }
        Insert: {
          answer_prob?: number | null
          best_time_window?: string | null
          business_id?: string | null
          campaign_id?: string | null
          churn_risk?: number | null
          complaint_risk?: number | null
          created_at?: string
          id?: string
          order_prob?: number | null
          recommended_channel?: string | null
          recommended_persona?: string | null
          recommended_script_variant?: string | null
          snapshot?: Json | null
          store_id?: string | null
          text_reply_prob?: number | null
        }
        Update: {
          answer_prob?: number | null
          best_time_window?: string | null
          business_id?: string | null
          campaign_id?: string | null
          churn_risk?: number | null
          complaint_risk?: number | null
          created_at?: string
          id?: string
          order_prob?: number | null
          recommended_channel?: string | null
          recommended_persona?: string | null
          recommended_script_variant?: string | null
          snapshot?: Json | null
          store_id?: string | null
          text_reply_prob?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_predictions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_predictions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_queue: {
        Row: {
          business_id: string | null
          campaign_id: string | null
          channel: string | null
          created_at: string
          experiment_group: string | null
          id: string
          phone_number: string | null
          predicted_outcome: Json | null
          priority_score: number | null
          status: string | null
          store_id: string | null
        }
        Insert: {
          business_id?: string | null
          campaign_id?: string | null
          channel?: string | null
          created_at?: string
          experiment_group?: string | null
          id?: string
          phone_number?: string | null
          predicted_outcome?: Json | null
          priority_score?: number | null
          status?: string | null
          store_id?: string | null
        }
        Update: {
          business_id?: string | null
          campaign_id?: string | null
          channel?: string | null
          created_at?: string
          experiment_group?: string | null
          id?: string
          phone_number?: string | null
          predicted_outcome?: Json | null
          priority_score?: number | null
          status?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_queue_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_queue_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      outbound_revenue_forecasts: {
        Row: {
          business_id: string | null
          confidence_score: number | null
          created_at: string
          factors: Json | null
          forecast_date: string
          id: string
          period: string
          predicted_orders: number | null
          predicted_revenue: number | null
        }
        Insert: {
          business_id?: string | null
          confidence_score?: number | null
          created_at?: string
          factors?: Json | null
          forecast_date: string
          id?: string
          period: string
          predicted_orders?: number | null
          predicted_revenue?: number | null
        }
        Update: {
          business_id?: string | null
          confidence_score?: number | null
          created_at?: string
          factors?: Json | null
          forecast_date?: string
          id?: string
          period?: string
          predicted_orders?: number | null
          predicted_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "outbound_revenue_forecasts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      outcome_simulations: {
        Row: {
          confidence_index: number | null
          conversation_id: string
          created_at: string
          expiry_timestamp: string | null
          generated_at: string
          human_override_notes: string | null
          id: string
          recommended_scenario_id: string | null
          status: string | null
          triggering_context: Json | null
          triggering_type: string | null
          updated_at: string
        }
        Insert: {
          confidence_index?: number | null
          conversation_id: string
          created_at?: string
          expiry_timestamp?: string | null
          generated_at?: string
          human_override_notes?: string | null
          id?: string
          recommended_scenario_id?: string | null
          status?: string | null
          triggering_context?: Json | null
          triggering_type?: string | null
          updated_at?: string
        }
        Update: {
          confidence_index?: number | null
          conversation_id?: string
          created_at?: string
          expiry_timestamp?: string | null
          generated_at?: string
          human_override_notes?: string | null
          id?: string
          recommended_scenario_id?: string | null
          status?: string | null
          triggering_context?: Json | null
          triggering_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcome_simulations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversation_memories"
            referencedColumns: ["id"]
          },
        ]
      }
      parlays: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          estimated_probability: number | null
          id: string
          legs: string[]
          parlay_type: Database["public"]["Enums"]["parlay_type"]
          payout_structure: Json | null
          platform: string
          simulated_roi: number | null
          status: Database["public"]["Enums"]["bet_status"] | null
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          estimated_probability?: number | null
          id?: string
          legs: string[]
          parlay_type: Database["public"]["Enums"]["parlay_type"]
          payout_structure?: Json | null
          platform: string
          simulated_roi?: number | null
          status?: Database["public"]["Enums"]["bet_status"] | null
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          estimated_probability?: number | null
          id?: string
          legs?: string[]
          parlay_type?: Database["public"]["Enums"]["parlay_type"]
          payout_structure?: Json | null
          platform?: string
          simulated_roi?: number | null
          status?: Database["public"]["Enums"]["bet_status"] | null
          updated_at?: string | null
        }
        Relationships: []
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
      pending_orders: {
        Row: {
          business_id: string
          created_at: string | null
          deal_id: string
          id: string
          items: Json
          status: string
          store_id: string
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string | null
          deal_id: string
          id?: string
          items?: Json
          status?: string
          store_id: string
          total?: number
        }
        Update: {
          business_id?: string
          created_at?: string | null
          deal_id?: string
          id?: string
          items?: Json
          status?: string
          store_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pending_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_orders_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions_matrix: {
        Row: {
          category: string | null
          description: string | null
          id: string
          org_types: string[] | null
          permission_key: string
          permission_name: string
        }
        Insert: {
          category?: string | null
          description?: string | null
          id?: string
          org_types?: string[] | null
          permission_key: string
          permission_name: string
        }
        Update: {
          category?: string | null
          description?: string | null
          id?: string
          org_types?: string[] | null
          permission_key?: string
          permission_name?: string
        }
        Relationships: []
      }
      personal_finance: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          id: string
          notes: string | null
          subcategory: string | null
          transaction_date: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          subcategory?: string | null
          transaction_date?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          subcategory?: string | null
          transaction_date?: string | null
          type?: string
          user_id?: string
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
      personality_profiles: {
        Row: {
          base_tone: string
          business_id: string | null
          created_at: string
          description: string | null
          emoji_style: string | null
          formality: string
          id: string
          language_profile_id: string | null
          name: string
          slang_level: string | null
        }
        Insert: {
          base_tone?: string
          business_id?: string | null
          created_at?: string
          description?: string | null
          emoji_style?: string | null
          formality?: string
          id?: string
          language_profile_id?: string | null
          name: string
          slang_level?: string | null
        }
        Update: {
          base_tone?: string
          business_id?: string | null
          created_at?: string
          description?: string | null
          emoji_style?: string | null
          formality?: string
          id?: string
          language_profile_id?: string | null
          name?: string
          slang_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personality_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personality_profiles_language_profile_id_fkey"
            columns: ["language_profile_id"]
            isOneToOne: false
            referencedRelation: "language_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pick_entries: {
        Row: {
          actual_result_value: number | null
          created_at: string
          date: string
          decision_source: string | null
          format_tag: string
          id: string
          line_value: number | null
          locked_at: string | null
          market: string
          multiplier: number | null
          notes: string | null
          odds: number | null
          opponent: string | null
          platform: string
          player: string | null
          profit_loss: number
          result: string | null
          settled_at: string | null
          side: string | null
          sport: string
          stake: number
          state: string
          status: string
          team: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_result_value?: number | null
          created_at?: string
          date: string
          decision_source?: string | null
          format_tag: string
          id?: string
          line_value?: number | null
          locked_at?: string | null
          market: string
          multiplier?: number | null
          notes?: string | null
          odds?: number | null
          opponent?: string | null
          platform: string
          player?: string | null
          profit_loss?: number
          result?: string | null
          settled_at?: string | null
          side?: string | null
          sport: string
          stake: number
          state: string
          status?: string
          team?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_result_value?: number | null
          created_at?: string
          date?: string
          decision_source?: string | null
          format_tag?: string
          id?: string
          line_value?: number | null
          locked_at?: string | null
          market?: string
          multiplier?: number | null
          notes?: string | null
          odds?: number | null
          opponent?: string | null
          platform?: string
          player?: string | null
          profit_loss?: number
          result?: string | null
          settled_at?: string | null
          side?: string | null
          sport?: string
          stake?: number
          state?: string
          status?: string
          team?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pick_entries_platform_fkey"
            columns: ["platform"]
            isOneToOne: false
            referencedRelation: "platforms"
            referencedColumns: ["platform_key"]
          },
        ]
      }
      platforms: {
        Row: {
          is_active: boolean
          platform_key: string
          platform_name: string
          platform_type: string
        }
        Insert: {
          is_active?: boolean
          platform_key: string
          platform_name: string
          platform_type: string
        }
        Update: {
          is_active?: boolean
          platform_key?: string
          platform_name?: string
          platform_type?: string
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
      prediction_evaluations: {
        Row: {
          ai_predicted_winner: string
          ai_result: string
          confirmation_id: string | null
          confirmed_winner: string
          evaluated_at: string
          evaluated_by: string | null
          game_date: string
          game_id: string
          id: string
          invalidated_at: string | null
          invalidation_reason: string | null
          is_valid: boolean | null
          notes: string | null
          prediction_id: string | null
          sport: string
        }
        Insert: {
          ai_predicted_winner: string
          ai_result: string
          confirmation_id?: string | null
          confirmed_winner: string
          evaluated_at?: string
          evaluated_by?: string | null
          game_date: string
          game_id: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          is_valid?: boolean | null
          notes?: string | null
          prediction_id?: string | null
          sport?: string
        }
        Update: {
          ai_predicted_winner?: string
          ai_result?: string
          confirmation_id?: string | null
          confirmed_winner?: string
          evaluated_at?: string
          evaluated_by?: string | null
          game_date?: string
          game_id?: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          is_valid?: boolean | null
          notes?: string | null
          prediction_id?: string | null
          sport?: string
        }
        Relationships: [
          {
            foreignKeyName: "prediction_evaluations_confirmation_id_fkey"
            columns: ["confirmation_id"]
            isOneToOne: false
            referencedRelation: "confirmed_game_winners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prediction_evaluations_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "ai_game_predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictive_actions: {
        Row: {
          action_type: string
          ai_reason: string | null
          business_id: string | null
          created_at: string
          executed: boolean
          executed_at: string | null
          id: string
          predicted_intent: string | null
          priority: string
          recommended_content: string | null
          store_id: string | null
        }
        Insert: {
          action_type: string
          ai_reason?: string | null
          business_id?: string | null
          created_at?: string
          executed?: boolean
          executed_at?: string | null
          id?: string
          predicted_intent?: string | null
          priority?: string
          recommended_content?: string | null
          store_id?: string | null
        }
        Update: {
          action_type?: string
          ai_reason?: string | null
          business_id?: string | null
          created_at?: string
          executed?: boolean
          executed_at?: string | null
          id?: string
          predicted_intent?: string | null
          priority?: string
          recommended_content?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictive_actions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictive_actions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      predictive_autopilot_log: {
        Row: {
          action_id: string | null
          action_taken: string
          ai_reasoning: string | null
          business_id: string | null
          created_at: string
          id: string
          result: string | null
          store_id: string | null
        }
        Insert: {
          action_id?: string | null
          action_taken: string
          ai_reasoning?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          result?: string | null
          store_id?: string | null
        }
        Update: {
          action_id?: string | null
          action_taken?: string
          ai_reasoning?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          result?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictive_autopilot_log_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "predictive_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictive_autopilot_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictive_autopilot_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      predictive_autopilot_settings: {
        Row: {
          auto_recovery_enabled: boolean
          auto_upsell_enabled: boolean
          business_id: string | null
          churn_threshold: number
          created_at: string
          enabled: boolean
          id: string
          opportunity_threshold: number
          updated_at: string
        }
        Insert: {
          auto_recovery_enabled?: boolean
          auto_upsell_enabled?: boolean
          business_id?: string | null
          churn_threshold?: number
          created_at?: string
          enabled?: boolean
          id?: string
          opportunity_threshold?: number
          updated_at?: string
        }
        Update: {
          auto_recovery_enabled?: boolean
          auto_upsell_enabled?: boolean
          business_id?: string | null
          churn_threshold?: number
          created_at?: string
          enabled?: boolean
          id?: string
          opportunity_threshold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictive_autopilot_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      predictive_opportunity_scores: {
        Row: {
          ai_summary: string | null
          business_id: string | null
          created_at: string
          id: string
          opportunity_factors: Json | null
          opportunity_score: number
          predicted_product_interest: string | null
          store_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          opportunity_factors?: Json | null
          opportunity_score?: number
          predicted_product_interest?: string | null
          store_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          opportunity_factors?: Json | null
          opportunity_score?: number
          predicted_product_interest?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictive_opportunity_scores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictive_opportunity_scores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      predictive_risk_scores: {
        Row: {
          ai_summary: string | null
          business_id: string | null
          churn_risk: number
          created_at: string
          id: string
          predicted_timeframe: string | null
          risk_factors: Json | null
          store_id: string | null
        }
        Insert: {
          ai_summary?: string | null
          business_id?: string | null
          churn_risk?: number
          created_at?: string
          id?: string
          predicted_timeframe?: string | null
          risk_factors?: Json | null
          store_id?: string | null
        }
        Update: {
          ai_summary?: string | null
          business_id?: string | null
          churn_risk?: number
          created_at?: string
          id?: string
          predicted_timeframe?: string | null
          risk_factors?: Json | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictive_risk_scores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictive_risk_scores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_tiers: {
        Row: {
          created_at: string | null
          id: string
          min_qty: number | null
          price_per_unit: number
          product_id: string | null
          tier: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          min_qty?: number | null
          price_per_unit: number
          product_id?: string | null
          tier: string
        }
        Update: {
          created_at?: string | null
          id?: string
          min_qty?: number | null
          price_per_unit?: number
          product_id?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_all"
            referencedColumns: ["id"]
          },
        ]
      }
      proactive_outreach_log: {
        Row: {
          business_id: string | null
          channel: string | null
          created_at: string
          id: string
          message_sent: string | null
          persona_id: string | null
          sent_at: string | null
          status: string | null
          store_id: string | null
          trigger_reason: string
        }
        Insert: {
          business_id?: string | null
          channel?: string | null
          created_at?: string
          id?: string
          message_sent?: string | null
          persona_id?: string | null
          sent_at?: string | null
          status?: string | null
          store_id?: string | null
          trigger_reason: string
        }
        Update: {
          business_id?: string | null
          channel?: string | null
          created_at?: string
          id?: string
          message_sent?: string | null
          persona_id?: string | null
          sent_at?: string | null
          status?: string | null
          store_id?: string | null
          trigger_reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "proactive_outreach_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_outreach_log_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "voice_personas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proactive_outreach_log_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      product_deal_recommendations: {
        Row: {
          business_id: string | null
          campaign_id: string | null
          created_at: string | null
          created_by_engine: string | null
          deal_type: string | null
          expires_at: string | null
          id: string
          notes: string | null
          product_id: string | null
          related_product_ids: string[] | null
          suggested_bundle_price: number | null
          suggested_discount_pct: number | null
          suggested_min_qty: number | null
          synced_to_campaign: boolean | null
          target_segment: string | null
          vertical_id: string | null
        }
        Insert: {
          business_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_by_engine?: string | null
          deal_type?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          related_product_ids?: string[] | null
          suggested_bundle_price?: number | null
          suggested_discount_pct?: number | null
          suggested_min_qty?: number | null
          synced_to_campaign?: boolean | null
          target_segment?: string | null
          vertical_id?: string | null
        }
        Update: {
          business_id?: string | null
          campaign_id?: string | null
          created_at?: string | null
          created_by_engine?: string | null
          deal_type?: string | null
          expires_at?: string | null
          id?: string
          notes?: string | null
          product_id?: string | null
          related_product_ids?: string[] | null
          suggested_bundle_price?: number | null
          suggested_discount_pct?: number | null
          suggested_min_qty?: number | null
          synced_to_campaign?: boolean | null
          target_segment?: string | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_deal_recommendations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_deal_recommendations_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      product_revenue_metrics: {
        Row: {
          avg_order_quantity: number | null
          business_id: string | null
          created_at: string | null
          ghost_score: number | null
          hero_score: number | null
          id: string
          product_id: string
          snapshot_date: string
          tags: string[] | null
          total_revenue_30d: number | null
          total_revenue_90d: number | null
          trend_30d: number | null
          trend_90d: number | null
          unique_stores_30d: number | null
          unique_stores_90d: number | null
          units_sold_30d: number | null
          units_sold_90d: number | null
          vertical_id: string | null
        }
        Insert: {
          avg_order_quantity?: number | null
          business_id?: string | null
          created_at?: string | null
          ghost_score?: number | null
          hero_score?: number | null
          id?: string
          product_id: string
          snapshot_date: string
          tags?: string[] | null
          total_revenue_30d?: number | null
          total_revenue_90d?: number | null
          trend_30d?: number | null
          trend_90d?: number | null
          unique_stores_30d?: number | null
          unique_stores_90d?: number | null
          units_sold_30d?: number | null
          units_sold_90d?: number | null
          vertical_id?: string | null
        }
        Update: {
          avg_order_quantity?: number | null
          business_id?: string | null
          created_at?: string | null
          ghost_score?: number | null
          hero_score?: number | null
          id?: string
          product_id?: string
          snapshot_date?: string
          tags?: string[] | null
          total_revenue_30d?: number | null
          total_revenue_90d?: number | null
          trend_30d?: number | null
          trend_90d?: number | null
          unique_stores_30d?: number | null
          unique_stores_90d?: number | null
          units_sold_30d?: number | null
          units_sold_90d?: number | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_revenue_metrics_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_revenue_metrics_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
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
      production_logs: {
        Row: {
          boxes_packed: number | null
          brand_id: string | null
          created_at: string | null
          created_by: string | null
          defects_count: number | null
          id: string
          labor_hours: number | null
          materials_used: Json | null
          notes: string | null
          production_date: string | null
          tubes_produced: number | null
        }
        Insert: {
          boxes_packed?: number | null
          brand_id?: string | null
          created_at?: string | null
          created_by?: string | null
          defects_count?: number | null
          id?: string
          labor_hours?: number | null
          materials_used?: Json | null
          notes?: string | null
          production_date?: string | null
          tubes_produced?: number | null
        }
        Update: {
          boxes_packed?: number | null
          brand_id?: string | null
          created_at?: string | null
          created_by?: string | null
          defects_count?: number | null
          id?: string
          labor_hours?: number | null
          materials_used?: Json | null
          notes?: string | null
          production_date?: string | null
          tubes_produced?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_logs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
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
          age_restricted: boolean | null
          ai_notes: string | null
          available_direct: boolean | null
          available_for_promotions: boolean | null
          available_to_ambassadors: boolean | null
          available_to_stores: boolean | null
          available_to_wholesalers: boolean | null
          barcode: string | null
          brand_id: string | null
          bulk_discount_rules: Json | null
          business_id: string | null
          case_size: number | null
          category: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          documents: string[] | null
          flavor_notes: string | null
          ghost_score: number | null
          hero_score: number | null
          id: string
          image_url: string | null
          internal_notes: string | null
          is_active: boolean | null
          low_stock_threshold: number | null
          min_order_qty: number | null
          moq: number | null
          name: string
          reorder_point: number | null
          reorder_qty: number | null
          requires_license: boolean | null
          safety_stock: number | null
          short_description: string | null
          sku: string | null
          status: string | null
          store_price: number | null
          strength_level: string | null
          suggested_crosssell_product_id: string | null
          suggested_retail_price: number | null
          suggested_upsell_product_id: string | null
          target_store_type: string | null
          taxable: boolean | null
          track_inventory: boolean | null
          type: string
          unit_type: string
          units_per_box: number | null
          units_per_pack: number | null
          variant: string | null
          vertical_id: string | null
          weight_per_unit: number | null
          wholesale_price: number | null
        }
        Insert: {
          age_restricted?: boolean | null
          ai_notes?: string | null
          available_direct?: boolean | null
          available_for_promotions?: boolean | null
          available_to_ambassadors?: boolean | null
          available_to_stores?: boolean | null
          available_to_wholesalers?: boolean | null
          barcode?: string | null
          brand_id?: string | null
          bulk_discount_rules?: Json | null
          business_id?: string | null
          case_size?: number | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          documents?: string[] | null
          flavor_notes?: string | null
          ghost_score?: number | null
          hero_score?: number | null
          id?: string
          image_url?: string | null
          internal_notes?: string | null
          is_active?: boolean | null
          low_stock_threshold?: number | null
          min_order_qty?: number | null
          moq?: number | null
          name: string
          reorder_point?: number | null
          reorder_qty?: number | null
          requires_license?: boolean | null
          safety_stock?: number | null
          short_description?: string | null
          sku?: string | null
          status?: string | null
          store_price?: number | null
          strength_level?: string | null
          suggested_crosssell_product_id?: string | null
          suggested_retail_price?: number | null
          suggested_upsell_product_id?: string | null
          target_store_type?: string | null
          taxable?: boolean | null
          track_inventory?: boolean | null
          type: string
          unit_type: string
          units_per_box?: number | null
          units_per_pack?: number | null
          variant?: string | null
          vertical_id?: string | null
          weight_per_unit?: number | null
          wholesale_price?: number | null
        }
        Update: {
          age_restricted?: boolean | null
          ai_notes?: string | null
          available_direct?: boolean | null
          available_for_promotions?: boolean | null
          available_to_ambassadors?: boolean | null
          available_to_stores?: boolean | null
          available_to_wholesalers?: boolean | null
          barcode?: string | null
          brand_id?: string | null
          bulk_discount_rules?: Json | null
          business_id?: string | null
          case_size?: number | null
          category?: string | null
          cost?: number | null
          created_at?: string | null
          description?: string | null
          documents?: string[] | null
          flavor_notes?: string | null
          ghost_score?: number | null
          hero_score?: number | null
          id?: string
          image_url?: string | null
          internal_notes?: string | null
          is_active?: boolean | null
          low_stock_threshold?: number | null
          min_order_qty?: number | null
          moq?: number | null
          name?: string
          reorder_point?: number | null
          reorder_qty?: number | null
          requires_license?: boolean | null
          safety_stock?: number | null
          short_description?: string | null
          sku?: string | null
          status?: string | null
          store_price?: number | null
          strength_level?: string | null
          suggested_crosssell_product_id?: string | null
          suggested_retail_price?: number | null
          suggested_upsell_product_id?: string | null
          target_store_type?: string | null
          taxable?: boolean | null
          track_inventory?: boolean | null
          type?: string
          unit_type?: string
          units_per_box?: number | null
          units_per_pack?: number | null
          variant?: string | null
          vertical_id?: string | null
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
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_suggested_crosssell_product_id_fkey"
            columns: ["suggested_crosssell_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_suggested_upsell_product_id_fkey"
            columns: ["suggested_upsell_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      products_all: {
        Row: {
          brand_id: string | null
          created_at: string | null
          description: string | null
          dimensions: Json | null
          id: string
          images: Json | null
          inventory_qty: number | null
          processing_time: string | null
          product_name: string
          retail_price: number | null
          shipping_from_city: string | null
          shipping_from_state: string | null
          status: string | null
          store_price: number | null
          unit_type: string | null
          updated_at: string | null
          weight_oz: number | null
          wholesale_price: number | null
          wholesaler_id: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          description?: string | null
          dimensions?: Json | null
          id?: string
          images?: Json | null
          inventory_qty?: number | null
          processing_time?: string | null
          product_name: string
          retail_price?: number | null
          shipping_from_city?: string | null
          shipping_from_state?: string | null
          status?: string | null
          store_price?: number | null
          unit_type?: string | null
          updated_at?: string | null
          weight_oz?: number | null
          wholesale_price?: number | null
          wholesaler_id?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          description?: string | null
          dimensions?: Json | null
          id?: string
          images?: Json | null
          inventory_qty?: number | null
          processing_time?: string | null
          product_name?: string
          retail_price?: number | null
          shipping_from_city?: string | null
          shipping_from_state?: string | null
          status?: string | null
          store_price?: number | null
          unit_type?: string | null
          updated_at?: string | null
          weight_oz?: number | null
          wholesale_price?: number | null
          wholesaler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_all_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_all_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesaler_profiles"
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
      proofs: {
        Row: {
          business_id: string
          captured_at: string
          captured_by_user_id: string | null
          file_url: string | null
          id: string
          proof_type: string
          related_id: string
          related_type: string
          text_note: string | null
        }
        Insert: {
          business_id: string
          captured_at?: string
          captured_by_user_id?: string | null
          file_url?: string | null
          id?: string
          proof_type: string
          related_id: string
          related_type: string
          text_note?: string | null
        }
        Update: {
          business_id?: string
          captured_at?: string
          captured_by_user_id?: string | null
          file_url?: string | null
          id?: string
          proof_type?: string
          related_id?: string
          related_type?: string
          text_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proofs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proofs_captured_by_user_id_fkey"
            columns: ["captured_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prop_results: {
        Row: {
          ai_predicted_side: string | null
          confidence_score: number | null
          created_at: string
          dnp: boolean | null
          final_stat_value: number | null
          game_date: string
          game_id: string
          id: string
          line_value: number
          locked_at: string | null
          model_version: string | null
          opponent: string | null
          pick_entry_id: string | null
          player_id: string | null
          player_name: string
          result: string | null
          settled_at: string
          sport: string
          stat_source: string | null
          stat_type: string
          team: string | null
        }
        Insert: {
          ai_predicted_side?: string | null
          confidence_score?: number | null
          created_at?: string
          dnp?: boolean | null
          final_stat_value?: number | null
          game_date: string
          game_id: string
          id?: string
          line_value: number
          locked_at?: string | null
          model_version?: string | null
          opponent?: string | null
          pick_entry_id?: string | null
          player_id?: string | null
          player_name: string
          result?: string | null
          settled_at?: string
          sport?: string
          stat_source?: string | null
          stat_type: string
          team?: string | null
        }
        Update: {
          ai_predicted_side?: string | null
          confidence_score?: number | null
          created_at?: string
          dnp?: boolean | null
          final_stat_value?: number | null
          game_date?: string
          game_id?: string
          id?: string
          line_value?: number
          locked_at?: string | null
          model_version?: string | null
          opponent?: string | null
          pick_entry_id?: string | null
          player_id?: string | null
          player_name?: string
          result?: string | null
          settled_at?: string
          sport?: string
          stat_source?: string | null
          stat_type?: string
          team?: string | null
        }
        Relationships: []
      }
      prop_settlement_audit_log: {
        Row: {
          box_score_id: string | null
          comparison_result: string
          created_at: string
          dnp: boolean
          entry_id: string
          final_stat_value: number
          game_date: string | null
          game_id: string | null
          id: string
          line_value: number
          minutes_played: number | null
          notes: string | null
          player_name: string
          raw_box_score_data: Json | null
          result: string
          settled_at: string
          settled_by: string | null
          settlement_source: string | null
          side: string
          stat_type: string
          user_id: string | null
        }
        Insert: {
          box_score_id?: string | null
          comparison_result: string
          created_at?: string
          dnp?: boolean
          entry_id: string
          final_stat_value: number
          game_date?: string | null
          game_id?: string | null
          id?: string
          line_value: number
          minutes_played?: number | null
          notes?: string | null
          player_name: string
          raw_box_score_data?: Json | null
          result: string
          settled_at?: string
          settled_by?: string | null
          settlement_source?: string | null
          side: string
          stat_type: string
          user_id?: string | null
        }
        Update: {
          box_score_id?: string | null
          comparison_result?: string
          created_at?: string
          dnp?: boolean
          entry_id?: string
          final_stat_value?: number
          game_date?: string | null
          game_id?: string | null
          id?: string
          line_value?: number
          minutes_played?: number | null
          notes?: string | null
          player_name?: string
          raw_box_score_data?: Json | null
          result?: string
          settled_at?: string
          settled_by?: string | null
          settlement_source?: string | null
          side?: string
          stat_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prop_settlement_audit_log_box_score_id_fkey"
            columns: ["box_score_id"]
            isOneToOne: false
            referencedRelation: "nba_player_box_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          purchase_order_id: string | null
          quantity_ordered: number
          quantity_received: number | null
          unit_cost: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          purchase_order_id?: string | null
          quantity_ordered?: number
          quantity_received?: number | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          purchase_order_id?: string | null
          quantity_ordered?: number
          quantity_received?: number | null
          unit_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          business_id: string | null
          created_at: string
          created_by: string | null
          estimated_arrival: string | null
          id: string
          notes: string | null
          products: Json
          shipping_cost: number | null
          status: string | null
          supplier_id: string | null
          target_warehouse_id: string | null
          total_cost: number | null
          tracking_number: string | null
          updated_at: string
          warehouse_location: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_arrival?: string | null
          id?: string
          notes?: string | null
          products?: Json
          shipping_cost?: number | null
          status?: string | null
          supplier_id?: string | null
          target_warehouse_id?: string | null
          total_cost?: number | null
          tracking_number?: string | null
          updated_at?: string
          warehouse_location?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          estimated_arrival?: string | null
          id?: string
          notes?: string | null
          products?: Json
          shipping_cost?: number | null
          status?: string | null
          supplier_id?: string | null
          target_warehouse_id?: string | null
          total_cost?: number | null
          tracking_number?: string | null
          updated_at?: string
          warehouse_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_target_warehouse_id_fkey"
            columns: ["target_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
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
      refund_tickets: {
        Row: {
          ai_suggestion: string | null
          amount: number
          approver_id: string | null
          business_id: string
          created_at: string | null
          created_by: string
          deal_id: string | null
          id: string
          reason: string
          resolved_at: string | null
          status: string
          store_id: string
        }
        Insert: {
          ai_suggestion?: string | null
          amount?: number
          approver_id?: string | null
          business_id: string
          created_at?: string | null
          created_by?: string
          deal_id?: string | null
          id?: string
          reason: string
          resolved_at?: string | null
          status?: string
          store_id: string
        }
        Update: {
          ai_suggestion?: string | null
          amount?: number
          approver_id?: string | null
          business_id?: string
          created_at?: string | null
          created_by?: string
          deal_id?: string | null
          id?: string
          reason?: string
          resolved_at?: string | null
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_tickets_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_tickets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_tickets_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_tickets_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      region_communication_styles: {
        Row: {
          boro: string | null
          created_at: string
          default_formality: string | null
          id: string
          neighborhood: string | null
          notes: string | null
          recommended_personality_id: string | null
        }
        Insert: {
          boro?: string | null
          created_at?: string
          default_formality?: string | null
          id?: string
          neighborhood?: string | null
          notes?: string | null
          recommended_personality_id?: string | null
        }
        Update: {
          boro?: string | null
          created_at?: string
          default_formality?: string | null
          id?: string
          neighborhood?: string | null
          notes?: string | null
          recommended_personality_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "region_communication_styles_recommended_personality_id_fkey"
            columns: ["recommended_personality_id"]
            isOneToOne: false
            referencedRelation: "personality_profiles"
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
      reorder_policies: {
        Row: {
          business_id: string | null
          created_at: string | null
          days_of_cover: number | null
          id: string
          max_reorder_qty: number | null
          min_reorder_qty: number | null
          product_id: string | null
          reorder_multiple: number | null
          updated_at: string | null
          use_auto_calculation: boolean | null
          warehouse_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          days_of_cover?: number | null
          id?: string
          max_reorder_qty?: number | null
          min_reorder_qty?: number | null
          product_id?: string | null
          reorder_multiple?: number | null
          updated_at?: string | null
          use_auto_calculation?: boolean | null
          warehouse_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          days_of_cover?: number | null
          id?: string
          max_reorder_qty?: number | null
          min_reorder_qty?: number | null
          product_id?: string | null
          reorder_multiple?: number | null
          updated_at?: string | null
          use_auto_calculation?: boolean | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reorder_policies_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_policies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reorder_policies_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
      restock_forecast: {
        Row: {
          created_at: string
          current_units: number | null
          daily_sales_rate: number | null
          id: string
          priority: string | null
          product_id: string | null
          product_name: string
          projected_out_date: string | null
          recommended_reorder_units: number | null
        }
        Insert: {
          created_at?: string
          current_units?: number | null
          daily_sales_rate?: number | null
          id?: string
          priority?: string | null
          product_id?: string | null
          product_name: string
          projected_out_date?: string | null
          recommended_reorder_units?: number | null
        }
        Update: {
          created_at?: string
          current_units?: number | null
          daily_sales_rate?: number | null
          id?: string
          priority?: string | null
          product_id?: string | null
          product_name?: string
          projected_out_date?: string | null
          recommended_reorder_units?: number | null
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
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission: string
          role_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission: string
          role_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          permission?: string
          role_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_name_fkey"
            columns: ["role_name"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
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
      route_suggestion_stops: {
        Row: {
          created_at: string
          estimated_minutes: number | null
          id: string
          issue_id: string | null
          location_id: string | null
          notes: string | null
          priority: string | null
          reason: string | null
          route_suggestion_id: string
          stop_order: number
        }
        Insert: {
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          issue_id?: string | null
          location_id?: string | null
          notes?: string | null
          priority?: string | null
          reason?: string | null
          route_suggestion_id: string
          stop_order: number
        }
        Update: {
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          issue_id?: string | null
          location_id?: string | null
          notes?: string | null
          priority?: string | null
          reason?: string | null
          route_suggestion_id?: string
          stop_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "route_suggestion_stops_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "biker_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_suggestion_stops_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_suggestion_stops_route_suggestion_id_fkey"
            columns: ["route_suggestion_id"]
            isOneToOne: false
            referencedRelation: "route_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      route_suggestions: {
        Row: {
          algorithm_version: string | null
          boro_filter: string | null
          business_id: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          neighborhood_filter: string | null
          priority_focus: string | null
          status: string
          stops_count: number | null
          suggested_for_biker_id: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          algorithm_version?: string | null
          boro_filter?: string | null
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          neighborhood_filter?: string | null
          priority_focus?: string | null
          status?: string
          stops_count?: number | null
          suggested_for_biker_id?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          algorithm_version?: string | null
          boro_filter?: string | null
          business_id?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          neighborhood_filter?: string | null
          priority_focus?: string | null
          status?: string
          stops_count?: number | null
          suggested_for_biker_id?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_suggestions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_suggestions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_suggestions_suggested_for_biker_id_fkey"
            columns: ["suggested_for_biker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      sales_rules: {
        Row: {
          allow_ai_refunds: boolean | null
          allow_ai_refunds_up_to: number | null
          auto_dispatch_enabled: boolean | null
          business_id: string
          config: Json | null
          created_at: string | null
          escalate_high_risk_stores: boolean | null
          id: string
          max_discount_percent: number | null
          max_discount_without_approval: number | null
          max_order_value_without_approval: number | null
          updated_at: string | null
        }
        Insert: {
          allow_ai_refunds?: boolean | null
          allow_ai_refunds_up_to?: number | null
          auto_dispatch_enabled?: boolean | null
          business_id: string
          config?: Json | null
          created_at?: string | null
          escalate_high_risk_stores?: boolean | null
          id?: string
          max_discount_percent?: number | null
          max_discount_without_approval?: number | null
          max_order_value_without_approval?: number | null
          updated_at?: string | null
        }
        Update: {
          allow_ai_refunds?: boolean | null
          allow_ai_refunds_up_to?: number | null
          auto_dispatch_enabled?: boolean | null
          business_id?: string
          config?: Json | null
          created_at?: string | null
          escalate_high_risk_stores?: boolean | null
          id?: string
          max_discount_percent?: number | null
          max_discount_without_approval?: number | null
          max_order_value_without_approval?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
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
      schema_history: {
        Row: {
          change_description: string | null
          change_type: string
          executed_at: string | null
          executed_by: string | null
          id: string
          is_reversible: boolean | null
          rollback_sql: string | null
          sql_executed: string | null
          table_name: string
          version_number: number
        }
        Insert: {
          change_description?: string | null
          change_type: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          is_reversible?: boolean | null
          rollback_sql?: string | null
          sql_executed?: string | null
          table_name: string
          version_number?: number
        }
        Update: {
          change_description?: string | null
          change_type?: string
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          is_reversible?: boolean | null
          rollback_sql?: string | null
          sql_executed?: string | null
          table_name?: string
          version_number?: number
        }
        Relationships: []
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
      sentiment_analysis: {
        Row: {
          ai_summary: string | null
          business_id: string | null
          created_at: string
          id: string
          keywords: Json | null
          message_id: string | null
          score: number
          sentiment: string
        }
        Insert: {
          ai_summary?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          keywords?: Json | null
          message_id?: string | null
          score: number
          sentiment: string
        }
        Update: {
          ai_summary?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          keywords?: Json | null
          message_id?: string | null
          score?: number
          sentiment?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentiment_analysis_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sentiment_analysis_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_labels: {
        Row: {
          carrier: string | null
          created_at: string | null
          id: string
          label_cost: number | null
          label_url: string | null
          order_id: string | null
          service_type: string | null
          ship_from_id: string | null
          ship_from_type: string | null
          ship_to_address: string | null
          ship_to_city: string | null
          ship_to_country: string | null
          ship_to_name: string | null
          ship_to_state: string | null
          ship_to_zip: string | null
          status: string | null
          tracking_number: string | null
          tracking_url: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          id?: string
          label_cost?: number | null
          label_url?: string | null
          order_id?: string | null
          service_type?: string | null
          ship_from_id?: string | null
          ship_from_type?: string | null
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_country?: string | null
          ship_to_name?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          status?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          id?: string
          label_cost?: number | null
          label_url?: string | null
          order_id?: string | null
          service_type?: string | null
          ship_from_id?: string | null
          ship_from_type?: string | null
          ship_to_address?: string | null
          ship_to_city?: string | null
          ship_to_country?: string | null
          ship_to_name?: string | null
          ship_to_state?: string | null
          ship_to_zip?: string | null
          status?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_labels_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "marketplace_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_feedback: {
        Row: {
          actual_outcome: Json | null
          created_at: string
          created_by: string | null
          executed_scenario_id: string | null
          feedback_notes: string | null
          feedback_type: string | null
          human_intuition_note: string | null
          id: string
          predicted_vs_actual_accuracy: number | null
          scenario_id: string | null
          simulation_id: string
        }
        Insert: {
          actual_outcome?: Json | null
          created_at?: string
          created_by?: string | null
          executed_scenario_id?: string | null
          feedback_notes?: string | null
          feedback_type?: string | null
          human_intuition_note?: string | null
          id?: string
          predicted_vs_actual_accuracy?: number | null
          scenario_id?: string | null
          simulation_id: string
        }
        Update: {
          actual_outcome?: Json | null
          created_at?: string
          created_by?: string | null
          executed_scenario_id?: string | null
          feedback_notes?: string | null
          feedback_type?: string | null
          human_intuition_note?: string | null
          id?: string
          predicted_vs_actual_accuracy?: number | null
          scenario_id?: string | null
          simulation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "simulation_feedback_executed_scenario_id_fkey"
            columns: ["executed_scenario_id"]
            isOneToOne: false
            referencedRelation: "simulation_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_feedback_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "simulation_scenarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "simulation_feedback_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "outcome_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_runs: {
        Row: {
          created_at: string | null
          drawdown: number | null
          end_date: string | null
          id: string
          losses: number | null
          markets_included: string[] | null
          notes: string | null
          peak_profit: number | null
          platforms_included: string[] | null
          roi: number | null
          run_name: string | null
          start_date: string
          status: string | null
          total_bets: number | null
          updated_at: string | null
          wins: number | null
        }
        Insert: {
          created_at?: string | null
          drawdown?: number | null
          end_date?: string | null
          id?: string
          losses?: number | null
          markets_included?: string[] | null
          notes?: string | null
          peak_profit?: number | null
          platforms_included?: string[] | null
          roi?: number | null
          run_name?: string | null
          start_date: string
          status?: string | null
          total_bets?: number | null
          updated_at?: string | null
          wins?: number | null
        }
        Update: {
          created_at?: string | null
          drawdown?: number | null
          end_date?: string | null
          id?: string
          losses?: number | null
          markets_included?: string[] | null
          notes?: string | null
          peak_profit?: number | null
          platforms_included?: string[] | null
          roi?: number | null
          run_name?: string | null
          start_date?: string
          status?: string | null
          total_bets?: number | null
          updated_at?: string | null
          wins?: number | null
        }
        Relationships: []
      }
      simulation_scenarios: {
        Row: {
          confidence_level: number | null
          created_at: string
          id: string
          initiating_action_type: string
          is_dismissed: boolean | null
          is_pinned: boolean | null
          is_recommended: boolean | null
          opportunity_score: number | null
          predicted_contact_response: string | null
          predicted_intent_shift: Json | null
          predicted_outcomes: Json | null
          predicted_sentiment_shift: string | null
          recommendation_reasoning: string | null
          risk_score: number | null
          scenario_name: string
          scenario_rank: number | null
          signals_to_watch: string[] | null
          simulation_id: string
          supporting_evidence: Json | null
          time_to_resolution_estimate: string | null
          tone_profile: string | null
          trust_impact_score: number | null
          warnings: string[] | null
        }
        Insert: {
          confidence_level?: number | null
          created_at?: string
          id?: string
          initiating_action_type: string
          is_dismissed?: boolean | null
          is_pinned?: boolean | null
          is_recommended?: boolean | null
          opportunity_score?: number | null
          predicted_contact_response?: string | null
          predicted_intent_shift?: Json | null
          predicted_outcomes?: Json | null
          predicted_sentiment_shift?: string | null
          recommendation_reasoning?: string | null
          risk_score?: number | null
          scenario_name: string
          scenario_rank?: number | null
          signals_to_watch?: string[] | null
          simulation_id: string
          supporting_evidence?: Json | null
          time_to_resolution_estimate?: string | null
          tone_profile?: string | null
          trust_impact_score?: number | null
          warnings?: string[] | null
        }
        Update: {
          confidence_level?: number | null
          created_at?: string
          id?: string
          initiating_action_type?: string
          is_dismissed?: boolean | null
          is_pinned?: boolean | null
          is_recommended?: boolean | null
          opportunity_score?: number | null
          predicted_contact_response?: string | null
          predicted_intent_shift?: Json | null
          predicted_outcomes?: Json | null
          predicted_sentiment_shift?: string | null
          recommendation_reasoning?: string | null
          risk_score?: number | null
          scenario_name?: string
          scenario_rank?: number | null
          signals_to_watch?: string[] | null
          simulation_id?: string
          supporting_evidence?: Json | null
          time_to_resolution_estimate?: string | null
          tone_profile?: string | null
          trust_impact_score?: number | null
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "simulation_scenarios_simulation_id_fkey"
            columns: ["simulation_id"]
            isOneToOne: false
            referencedRelation: "outcome_simulations"
            referencedColumns: ["id"]
          },
        ]
      }
      sportsbook_lines: {
        Row: {
          game_date: string
          id: string
          is_valid: boolean | null
          line_value: number | null
          market_type: string
          matched_player_id: string | null
          matched_team_id: string | null
          opponent: string | null
          over_odds: number | null
          player_or_team: string
          sport: string
          sportsbook: string | null
          under_odds: number | null
          uploaded_at: string
          uploaded_by: string | null
          validation_notes: string | null
        }
        Insert: {
          game_date: string
          id?: string
          is_valid?: boolean | null
          line_value?: number | null
          market_type: string
          matched_player_id?: string | null
          matched_team_id?: string | null
          opponent?: string | null
          over_odds?: number | null
          player_or_team: string
          sport?: string
          sportsbook?: string | null
          under_odds?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
          validation_notes?: string | null
        }
        Update: {
          game_date?: string
          id?: string
          is_valid?: boolean | null
          line_value?: number | null
          market_type?: string
          matched_player_id?: string | null
          matched_team_id?: string | null
          opponent?: string | null
          over_odds?: number | null
          player_or_team?: string
          sport?: string
          sportsbook?: string | null
          under_odds?: number | null
          uploaded_at?: string
          uploaded_by?: string | null
          validation_notes?: string | null
        }
        Relationships: []
      }
      state_rules: {
        Row: {
          created_at: string
          disabled_formats: Json
          disabled_platforms: Json
          enabled_formats: Json
          enabled_platforms: Json
          id: string
          is_active: boolean
          state_code: string
          tooltip_text: string | null
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          disabled_formats?: Json
          disabled_platforms?: Json
          enabled_formats?: Json
          enabled_platforms?: Json
          id?: string
          is_active?: boolean
          state_code: string
          tooltip_text?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          disabled_formats?: Json
          disabled_platforms?: Json
          enabled_formats?: Json
          enabled_platforms?: Json
          id?: string
          is_active?: boolean
          state_code?: string
          tooltip_text?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: []
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
      store_check_fields: {
        Row: {
          business_id: string
          check_type: string
          created_at: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          options_json: Json | null
          required: boolean | null
          sort_order: number | null
        }
        Insert: {
          business_id: string
          check_type: string
          created_at?: string
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          options_json?: Json | null
          required?: boolean | null
          sort_order?: number | null
        }
        Update: {
          business_id?: string
          check_type?: string
          created_at?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          options_json?: Json | null
          required?: boolean | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_check_fields_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      store_check_responses: {
        Row: {
          created_at: string
          field_key: string
          id: string
          store_check_id: string
          value_bool: boolean | null
          value_json: Json | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          field_key: string
          id?: string
          store_check_id: string
          value_bool?: boolean | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          field_key?: string
          id?: string
          store_check_id?: string
          value_bool?: boolean | null
          value_json?: Json | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_check_responses_store_check_id_fkey"
            columns: ["store_check_id"]
            isOneToOne: false
            referencedRelation: "store_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      store_checks: {
        Row: {
          assigned_biker_id: string | null
          business_id: string
          check_type: string
          created_at: string
          created_by_user_id: string | null
          id: string
          location_id: string | null
          reviewed_at: string | null
          reviewed_by_user_id: string | null
          scheduled_date: string
          status: string
          summary_notes: string | null
          updated_at: string
        }
        Insert: {
          assigned_biker_id?: string | null
          business_id: string
          check_type?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          location_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          scheduled_date?: string
          status?: string
          summary_notes?: string | null
          updated_at?: string
        }
        Update: {
          assigned_biker_id?: string | null
          business_id?: string
          check_type?: string
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          location_id?: string | null
          reviewed_at?: string | null
          reviewed_by_user_id?: string | null
          scheduled_date?: string
          status?: string
          summary_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_checks_assigned_biker_id_fkey"
            columns: ["assigned_biker_id"]
            isOneToOne: false
            referencedRelation: "bikers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_checks_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_checks_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_checks_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_checks_reviewed_by_user_id_fkey"
            columns: ["reviewed_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_contacts: {
        Row: {
          can_receive_sms: boolean | null
          created_at: string | null
          email: string | null
          id: string
          influence_level: string | null
          is_primary: boolean | null
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          store_id: string
        }
        Insert: {
          can_receive_sms?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          influence_level?: string | null
          is_primary?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          store_id: string
        }
        Update: {
          can_receive_sms?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          influence_level?: string | null
          is_primary?: boolean | null
          name?: string
          notes?: string | null
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
      store_extracted_profiles: {
        Row: {
          created_at: string
          extraction_confidence: number | null
          id: string
          last_extracted_at: string | null
          operational_profile: Json | null
          opportunities: Json | null
          personal_profile: Json | null
          raw_snapshot_hash: string | null
          red_flags: Json | null
          source_notes_count: number | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          extraction_confidence?: number | null
          id?: string
          last_extracted_at?: string | null
          operational_profile?: Json | null
          opportunities?: Json | null
          personal_profile?: Json | null
          raw_snapshot_hash?: string | null
          red_flags?: Json | null
          source_notes_count?: number | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          extraction_confidence?: number | null
          id?: string
          last_extracted_at?: string | null
          operational_profile?: Json | null
          opportunities?: Json | null
          personal_profile?: Json | null
          raw_snapshot_hash?: string | null
          red_flags?: Json | null
          source_notes_count?: number | null
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_inventory: {
        Row: {
          created_at: string | null
          id: string
          last_restock_date: string | null
          last_sale_date: string | null
          notes: string | null
          product_id: string
          quantity_on_hand: number | null
          quantity_reserved: number | null
          reorder_point: number | null
          store_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_restock_date?: string | null
          last_sale_date?: string | null
          notes?: string | null
          product_id: string
          quantity_on_hand?: number | null
          quantity_reserved?: number | null
          reorder_point?: number | null
          store_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_restock_date?: string | null
          last_sale_date?: string | null
          notes?: string | null
          product_id?: string
          quantity_on_hand?: number | null
          quantity_reserved?: number | null
          reorder_point?: number | null
          store_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_inventory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      store_master: {
        Row: {
          address: string
          borough_id: string | null
          brand_id: string | null
          city: string
          communication_preference: string | null
          country_of_origin: string | null
          created_at: string | null
          dialect_preference: string | null
          email: string | null
          expansion_notes: string | null
          expected_open_dates: string[] | null
          formality_level: string | null
          frustration_triggers: string[] | null
          has_expansion: boolean | null
          id: string
          influence_level: string | null
          language_preference: string | null
          languages: string[] | null
          loyalty_triggers: string[] | null
          new_store_addresses: string[] | null
          nickname: string | null
          notes: string | null
          notes_for_tone: string | null
          owner_name: string | null
          personality_notes: string | null
          personality_profile_id: string | null
          phone: string | null
          preferred_channel: string | null
          risk_score: string | null
          state: string
          sticker_in_store: boolean | null
          sticker_notes: string | null
          sticker_on_door: boolean | null
          sticker_with_phone: boolean | null
          store_name: string
          store_type: string | null
          updated_at: string | null
          zip: string
        }
        Insert: {
          address: string
          borough_id?: string | null
          brand_id?: string | null
          city: string
          communication_preference?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          dialect_preference?: string | null
          email?: string | null
          expansion_notes?: string | null
          expected_open_dates?: string[] | null
          formality_level?: string | null
          frustration_triggers?: string[] | null
          has_expansion?: boolean | null
          id?: string
          influence_level?: string | null
          language_preference?: string | null
          languages?: string[] | null
          loyalty_triggers?: string[] | null
          new_store_addresses?: string[] | null
          nickname?: string | null
          notes?: string | null
          notes_for_tone?: string | null
          owner_name?: string | null
          personality_notes?: string | null
          personality_profile_id?: string | null
          phone?: string | null
          preferred_channel?: string | null
          risk_score?: string | null
          state: string
          sticker_in_store?: boolean | null
          sticker_notes?: string | null
          sticker_on_door?: boolean | null
          sticker_with_phone?: boolean | null
          store_name: string
          store_type?: string | null
          updated_at?: string | null
          zip: string
        }
        Update: {
          address?: string
          borough_id?: string | null
          brand_id?: string | null
          city?: string
          communication_preference?: string | null
          country_of_origin?: string | null
          created_at?: string | null
          dialect_preference?: string | null
          email?: string | null
          expansion_notes?: string | null
          expected_open_dates?: string[] | null
          formality_level?: string | null
          frustration_triggers?: string[] | null
          has_expansion?: boolean | null
          id?: string
          influence_level?: string | null
          language_preference?: string | null
          languages?: string[] | null
          loyalty_triggers?: string[] | null
          new_store_addresses?: string[] | null
          nickname?: string | null
          notes?: string | null
          notes_for_tone?: string | null
          owner_name?: string | null
          personality_notes?: string | null
          personality_profile_id?: string | null
          phone?: string | null
          preferred_channel?: string | null
          risk_score?: string | null
          state?: string
          sticker_in_store?: boolean | null
          sticker_notes?: string | null
          sticker_on_door?: boolean | null
          sticker_with_phone?: boolean | null
          store_name?: string
          store_type?: string | null
          updated_at?: string | null
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_master_borough_id_fkey"
            columns: ["borough_id"]
            isOneToOne: false
            referencedRelation: "boroughs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_master_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_master_personality_profile_id_fkey"
            columns: ["personality_profile_id"]
            isOneToOne: false
            referencedRelation: "personality_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_notes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note_text: string
          store_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note_text: string
          store_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note_text?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
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
      store_product_predictions: {
        Row: {
          business_id: string | null
          buy_prob_30d: number | null
          buy_prob_7d: number | null
          created_at: string | null
          expected_quantity: number | null
          id: string
          is_experiment_candidate: boolean | null
          is_primary_sku: boolean | null
          last_order_at: string | null
          product_id: string
          snapshot_date: string
          store_id: string | null
          tags: string[] | null
          vertical_id: string | null
        }
        Insert: {
          business_id?: string | null
          buy_prob_30d?: number | null
          buy_prob_7d?: number | null
          created_at?: string | null
          expected_quantity?: number | null
          id?: string
          is_experiment_candidate?: boolean | null
          is_primary_sku?: boolean | null
          last_order_at?: string | null
          product_id: string
          snapshot_date: string
          store_id?: string | null
          tags?: string[] | null
          vertical_id?: string | null
        }
        Update: {
          business_id?: string | null
          buy_prob_30d?: number | null
          buy_prob_7d?: number | null
          created_at?: string | null
          expected_quantity?: number | null
          id?: string
          is_experiment_candidate?: boolean | null
          is_primary_sku?: boolean | null
          last_order_at?: string | null
          product_id?: string
          snapshot_date?: string
          store_id?: string | null
          tags?: string[] | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_product_predictions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_predictions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_product_predictions_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
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
      store_revenue_recommendations: {
        Row: {
          business_id: string | null
          created_at: string | null
          created_from_engine: string | null
          expires_at: string | null
          followup_id: string | null
          id: string
          notes: string | null
          priority: number | null
          reason: string | null
          recommended_action: string | null
          recommended_brand: string | null
          recommended_offer: Json | null
          score_snapshot_id: string | null
          store_id: string | null
          synced_to_followup: boolean | null
          vertical_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          created_from_engine?: string | null
          expires_at?: string | null
          followup_id?: string | null
          id?: string
          notes?: string | null
          priority?: number | null
          reason?: string | null
          recommended_action?: string | null
          recommended_brand?: string | null
          recommended_offer?: Json | null
          score_snapshot_id?: string | null
          store_id?: string | null
          synced_to_followup?: boolean | null
          vertical_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          created_from_engine?: string | null
          expires_at?: string | null
          followup_id?: string | null
          id?: string
          notes?: string | null
          priority?: number | null
          reason?: string | null
          recommended_action?: string | null
          recommended_brand?: string | null
          recommended_offer?: Json | null
          score_snapshot_id?: string | null
          store_id?: string | null
          synced_to_followup?: boolean | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_revenue_recommendations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_revenue_recommendations_score_snapshot_id_fkey"
            columns: ["score_snapshot_id"]
            isOneToOne: false
            referencedRelation: "store_revenue_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_revenue_recommendations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_revenue_recommendations_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      store_revenue_scores: {
        Row: {
          avg_order_value: number | null
          business_id: string | null
          churn_risk: number | null
          communication_score: number | null
          created_at: string | null
          deal_activity_score: number | null
          follow_up_intensity: number | null
          heat_score: number | null
          id: string
          last_order_at: string | null
          order_count_30d: number | null
          order_count_90d: number | null
          order_prob_7d: number | null
          predicted_next_order_at: string | null
          restock_window_end: string | null
          restock_window_start: string | null
          revenue_30d: number | null
          revenue_90d: number | null
          sentiment_score: number | null
          snapshot_date: string
          store_id: string | null
          tags: string[] | null
          vertical_id: string | null
        }
        Insert: {
          avg_order_value?: number | null
          business_id?: string | null
          churn_risk?: number | null
          communication_score?: number | null
          created_at?: string | null
          deal_activity_score?: number | null
          follow_up_intensity?: number | null
          heat_score?: number | null
          id?: string
          last_order_at?: string | null
          order_count_30d?: number | null
          order_count_90d?: number | null
          order_prob_7d?: number | null
          predicted_next_order_at?: string | null
          restock_window_end?: string | null
          restock_window_start?: string | null
          revenue_30d?: number | null
          revenue_90d?: number | null
          sentiment_score?: number | null
          snapshot_date: string
          store_id?: string | null
          tags?: string[] | null
          vertical_id?: string | null
        }
        Update: {
          avg_order_value?: number | null
          business_id?: string | null
          churn_risk?: number | null
          communication_score?: number | null
          created_at?: string | null
          deal_activity_score?: number | null
          follow_up_intensity?: number | null
          heat_score?: number | null
          id?: string
          last_order_at?: string | null
          order_count_30d?: number | null
          order_count_90d?: number | null
          order_prob_7d?: number | null
          predicted_next_order_at?: string | null
          restock_window_end?: string | null
          restock_window_start?: string | null
          revenue_30d?: number | null
          revenue_90d?: number | null
          sentiment_score?: number | null
          snapshot_date?: string
          store_id?: string | null
          tags?: string[] | null
          vertical_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_revenue_scores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_revenue_scores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_revenue_scores_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
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
      store_scores: {
        Row: {
          business_id: string
          created_at: string
          id: string
          last_calculated_at: string
          priority_label: string
          reason_summary: string | null
          score: number
          store_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          last_calculated_at?: string
          priority_label?: string
          reason_summary?: string | null
          score?: number
          store_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          last_calculated_at?: string
          priority_label?: string
          reason_summary?: string | null
          score?: number
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_scores_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      store_status_history: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          event_type: string
          id: string
          store_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type: string
          id?: string
          store_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_type?: string
          id?: string
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_status_history_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_status_history_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
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
      store_vertical_permissions: {
        Row: {
          allowed_brands: string[] | null
          can_receive_pitch: boolean | null
          created_at: string | null
          forbidden_brands: string[] | null
          id: string
          notes: string | null
          store_id: string
          updated_at: string | null
          vertical_id: string
        }
        Insert: {
          allowed_brands?: string[] | null
          can_receive_pitch?: boolean | null
          created_at?: string | null
          forbidden_brands?: string[] | null
          id?: string
          notes?: string | null
          store_id: string
          updated_at?: string | null
          vertical_id: string
        }
        Update: {
          allowed_brands?: string[] | null
          can_receive_pitch?: boolean | null
          created_at?: string | null
          forbidden_brands?: string[] | null
          id?: string
          notes?: string | null
          store_id?: string
          updated_at?: string | null
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_vertical_permissions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_vertical_permissions_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      store_voice_notes: {
        Row: {
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          file_url: string
          id: string
          sentiment: string | null
          status: string
          store_id: string
          summary: string | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          file_url: string
          id?: string
          sentiment?: string | null
          status?: string
          store_id: string
          summary?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          file_url?: string
          id?: string
          sentiment?: string | null
          status?: string
          store_id?: string
          summary?: string | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_voice_notes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
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
          deleted_at: string | null
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
          payment_type: Database["public"]["Enums"]["payment_type"] | null
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
          sticker_door: boolean | null
          sticker_door_last_seen_at: string | null
          sticker_door_note: string | null
          sticker_door_put_on_at: string | null
          sticker_door_taken_down_at: string | null
          sticker_instore: boolean | null
          sticker_instore_last_seen_at: string | null
          sticker_instore_note: string | null
          sticker_instore_put_on_at: string | null
          sticker_instore_taken_down_at: string | null
          sticker_last_seen_at: string | null
          sticker_phone: boolean | null
          sticker_phone_last_seen_at: string | null
          sticker_phone_note: string | null
          sticker_phone_put_on_at: string | null
          sticker_phone_taken_down_at: string | null
          sticker_status: Database["public"]["Enums"]["sticker_status"] | null
          sticker_taken_down: boolean | null
          sticker_taken_down_at: string | null
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
          deleted_at?: string | null
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
          payment_type?: Database["public"]["Enums"]["payment_type"] | null
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
          sticker_door?: boolean | null
          sticker_door_last_seen_at?: string | null
          sticker_door_note?: string | null
          sticker_door_put_on_at?: string | null
          sticker_door_taken_down_at?: string | null
          sticker_instore?: boolean | null
          sticker_instore_last_seen_at?: string | null
          sticker_instore_note?: string | null
          sticker_instore_put_on_at?: string | null
          sticker_instore_taken_down_at?: string | null
          sticker_last_seen_at?: string | null
          sticker_phone?: boolean | null
          sticker_phone_last_seen_at?: string | null
          sticker_phone_note?: string | null
          sticker_phone_put_on_at?: string | null
          sticker_phone_taken_down_at?: string | null
          sticker_status?: Database["public"]["Enums"]["sticker_status"] | null
          sticker_taken_down?: boolean | null
          sticker_taken_down_at?: string | null
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
          deleted_at?: string | null
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
          payment_type?: Database["public"]["Enums"]["payment_type"] | null
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
          sticker_door?: boolean | null
          sticker_door_last_seen_at?: string | null
          sticker_door_note?: string | null
          sticker_door_put_on_at?: string | null
          sticker_door_taken_down_at?: string | null
          sticker_instore?: boolean | null
          sticker_instore_last_seen_at?: string | null
          sticker_instore_note?: string | null
          sticker_instore_put_on_at?: string | null
          sticker_instore_taken_down_at?: string | null
          sticker_last_seen_at?: string | null
          sticker_phone?: boolean | null
          sticker_phone_last_seen_at?: string | null
          sticker_phone_note?: string | null
          sticker_phone_put_on_at?: string | null
          sticker_phone_taken_down_at?: string | null
          sticker_status?: Database["public"]["Enums"]["sticker_status"] | null
          sticker_taken_down?: boolean | null
          sticker_taken_down_at?: string | null
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
      supplier_products: {
        Row: {
          bulk_cost: number | null
          category: string | null
          created_at: string
          id: string
          moq: number | null
          name: string
          processing_time_days: number | null
          product_photos: string[] | null
          shipping_dimensions: Json | null
          shipping_weight: number | null
          sku: string | null
          supplier_id: string | null
          unit_cost: number | null
        }
        Insert: {
          bulk_cost?: number | null
          category?: string | null
          created_at?: string
          id?: string
          moq?: number | null
          name: string
          processing_time_days?: number | null
          product_photos?: string[] | null
          shipping_dimensions?: Json | null
          shipping_weight?: number | null
          sku?: string | null
          supplier_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          bulk_cost?: number | null
          category?: string | null
          created_at?: string
          id?: string
          moq?: number | null
          name?: string
          processing_time_days?: number | null
          product_photos?: string[] | null
          shipping_dimensions?: Json | null
          shipping_weight?: number | null
          sku?: string | null
          supplier_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          lead_time_days: number | null
          name: string
          notes: string | null
          payment_terms: string | null
          reliability_score: number | null
          shipping_methods: Json | null
          status: string | null
          total_spend: number | null
          wechat: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          lead_time_days?: number | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          reliability_score?: number | null
          shipping_methods?: Json | null
          status?: string | null
          total_spend?: number | null
          wechat?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          lead_time_days?: number | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          reliability_score?: number | null
          shipping_methods?: Json | null
          status?: string | null
          total_spend?: number | null
          wechat?: string | null
        }
        Relationships: []
      }
      supply_chain_inflow: {
        Row: {
          cost_per_unit: number | null
          id: string
          po_id: string | null
          product_name: string
          received_at: string
          receiving_notes: string | null
          units_in: number | null
        }
        Insert: {
          cost_per_unit?: number | null
          id?: string
          po_id?: string | null
          product_name: string
          received_at?: string
          receiving_notes?: string | null
          units_in?: number | null
        }
        Update: {
          cost_per_unit?: number | null
          id?: string
          po_id?: string | null
          product_name?: string
          received_at?: string
          receiving_notes?: string | null
          units_in?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_chain_inflow_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      system_checkpoints: {
        Row: {
          created_at: string | null
          created_by: string | null
          diagnostics: Json | null
          id: string
          label: string
          notes: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          diagnostics?: Json | null
          id?: string
          label: string
          notes?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          diagnostics?: Json | null
          id?: string
          label?: string
          notes?: string | null
          version?: string | null
        }
        Relationships: []
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
      territory_stats_daily: {
        Row: {
          boro: string
          business_id: string | null
          created_at: string
          date: string
          heat_score: number | null
          id: string
          issues_critical: number | null
          issues_open: number | null
          neighborhood: string | null
          revenue_impact_estimate: number | null
          tasks_completed: number | null
        }
        Insert: {
          boro: string
          business_id?: string | null
          created_at?: string
          date: string
          heat_score?: number | null
          id?: string
          issues_critical?: number | null
          issues_open?: number | null
          neighborhood?: string | null
          revenue_impact_estimate?: number | null
          tasks_completed?: number | null
        }
        Update: {
          boro?: string
          business_id?: string | null
          created_at?: string
          date?: string
          heat_score?: number | null
          id?: string
          issues_critical?: number | null
          issues_open?: number | null
          neighborhood?: string | null
          revenue_impact_estimate?: number | null
          tasks_completed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "territory_stats_daily_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      universal_activity: {
        Row: {
          action: string
          business_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          business_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          business_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      universal_ledger: {
        Row: {
          amount: number | null
          business_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          order_id: string | null
          type: string
        }
        Insert: {
          amount?: number | null
          business_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          type: string
        }
        Update: {
          amount?: number | null
          business_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          order_id?: string | null
          type?: string
        }
        Relationships: []
      }
      universal_messages: {
        Row: {
          business_id: string | null
          content: string | null
          created_at: string | null
          id: string
          message_type: string | null
          metadata: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          business_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          business_id?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          message_type?: string | null
          metadata?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      universal_orders: {
        Row: {
          amount: number
          business_id: string
          channel: string
          created_at: string | null
          customer_id: string | null
          deleted_at: string | null
          id: string
          metadata: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          business_id: string
          channel: string
          created_at?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          channel?: string
          created_at?: string | null
          customer_id?: string | null
          deleted_at?: string | null
          id?: string
          metadata?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
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
      user_brand_map: {
        Row: {
          brand_id: string
          created_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_brand_map_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
          role_name: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          role_name?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_name?: string | null
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
          {
            foreignKeyName: "user_roles_role_name_fkey"
            columns: ["role_name"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["name"]
          },
        ]
      }
      user_state_profile: {
        Row: {
          created_at: string
          last_state_update: string
          state_source: string
          updated_at: string
          user_id: string
          user_state: string
        }
        Insert: {
          created_at?: string
          last_state_update?: string
          state_source?: string
          updated_at?: string
          user_id: string
          user_state: string
        }
        Update: {
          created_at?: string
          last_state_update?: string
          state_source?: string
          updated_at?: string
          user_id?: string
          user_state?: string
        }
        Relationships: []
      }
      user_store_map: {
        Row: {
          created_at: string | null
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_store_map_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_master"
            referencedColumns: ["id"]
          },
        ]
      }
      ut_staff: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          availability: Json | null
          availability_notes: string | null
          business_id: string | null
          business_slug: string | null
          category: Database["public"]["Enums"]["ut_staff_category"]
          category_id: string | null
          certifications: string[] | null
          city: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          department: string | null
          dob: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employment_type: Database["public"]["Enums"]["ut_employment_type"]
          event_rate: number | null
          events_completed: number | null
          first_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          last_name: string
          notes: string | null
          pay_rate: number | null
          pay_type: string | null
          payment_details: Json | null
          payment_method: string | null
          phone: string | null
          preferred_contact_method: string | null
          preferred_hours: Json | null
          rating: number | null
          role: Database["public"]["Enums"]["ut_staff_role"]
          specialties: string[] | null
          state: string | null
          status: Database["public"]["Enums"]["ut_staff_status"]
          total_earnings: number | null
          updated_at: string
          user_id: string | null
          zip: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          availability?: Json | null
          availability_notes?: string | null
          business_id?: string | null
          business_slug?: string | null
          category?: Database["public"]["Enums"]["ut_staff_category"]
          category_id?: string | null
          certifications?: string[] | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: Database["public"]["Enums"]["ut_employment_type"]
          event_rate?: number | null
          events_completed?: number | null
          first_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name: string
          notes?: string | null
          pay_rate?: number | null
          pay_type?: string | null
          payment_details?: Json | null
          payment_method?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_hours?: Json | null
          rating?: number | null
          role: Database["public"]["Enums"]["ut_staff_role"]
          specialties?: string[] | null
          state?: string | null
          status?: Database["public"]["Enums"]["ut_staff_status"]
          total_earnings?: number | null
          updated_at?: string
          user_id?: string | null
          zip?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          availability?: Json | null
          availability_notes?: string | null
          business_id?: string | null
          business_slug?: string | null
          category?: Database["public"]["Enums"]["ut_staff_category"]
          category_id?: string | null
          certifications?: string[] | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          department?: string | null
          dob?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: Database["public"]["Enums"]["ut_employment_type"]
          event_rate?: number | null
          events_completed?: number | null
          first_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          last_name?: string
          notes?: string | null
          pay_rate?: number | null
          pay_type?: string | null
          payment_details?: Json | null
          payment_method?: string | null
          phone?: string | null
          preferred_contact_method?: string | null
          preferred_hours?: Json | null
          rating?: number | null
          role?: Database["public"]["Enums"]["ut_staff_role"]
          specialties?: string[] | null
          state?: string | null
          status?: Database["public"]["Enums"]["ut_staff_status"]
          total_earnings?: number | null
          updated_at?: string
          user_id?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ut_staff_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ut_staff_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ut_staff_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      ut_staff_assignments: {
        Row: {
          amount_due: number | null
          assignment_date: string
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          end_time: string | null
          event_id: string | null
          hours_worked: number | null
          id: string
          notes: string | null
          payment_status: string | null
          rate_applied: number | null
          role_for_event: Database["public"]["Enums"]["ut_staff_role"] | null
          staff_id: string
          start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_due?: number | null
          assignment_date: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          end_time?: string | null
          event_id?: string | null
          hours_worked?: number | null
          id?: string
          notes?: string | null
          payment_status?: string | null
          rate_applied?: number | null
          role_for_event?: Database["public"]["Enums"]["ut_staff_role"] | null
          staff_id: string
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_due?: number | null
          assignment_date?: string
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          end_time?: string | null
          event_id?: string | null
          hours_worked?: number | null
          id?: string
          notes?: string | null
          payment_status?: string | null
          rate_applied?: number | null
          role_for_event?: Database["public"]["Enums"]["ut_staff_role"] | null
          staff_id?: string
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ut_staff_assignments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "ut_staff"
            referencedColumns: ["id"]
          },
        ]
      }
      ut_staff_categories: {
        Row: {
          business_slug: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          business_slug?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          business_slug?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
      vertical_brands: {
        Row: {
          brand_id: string
          brand_name: string
          can_cross_promote: boolean | null
          created_at: string | null
          id: string
          pitch_priority: number | null
          vertical_id: string
        }
        Insert: {
          brand_id: string
          brand_name: string
          can_cross_promote?: boolean | null
          created_at?: string | null
          id?: string
          pitch_priority?: number | null
          vertical_id: string
        }
        Update: {
          brand_id?: string
          brand_name?: string
          can_cross_promote?: boolean | null
          created_at?: string | null
          id?: string
          pitch_priority?: number | null
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vertical_brands_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      vertical_pitch_rules: {
        Row: {
          created_at: string | null
          id: string
          rule_type: string
          rule_value: string
          severity: string | null
          vertical_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          rule_type: string
          rule_value: string
          severity?: string | null
          vertical_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          rule_type?: string
          rule_value?: string
          severity?: string | null
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vertical_pitch_rules_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
            referencedColumns: ["id"]
          },
        ]
      }
      vertical_script_guardrails: {
        Row: {
          created_at: string | null
          guardrail_type: string
          guardrail_value: string
          id: string
          is_active: boolean | null
          priority: number | null
          vertical_id: string
        }
        Insert: {
          created_at?: string | null
          guardrail_type: string
          guardrail_value: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          vertical_id: string
        }
        Update: {
          created_at?: string | null
          guardrail_type?: string
          guardrail_value?: string
          id?: string
          is_active?: boolean | null
          priority?: number | null
          vertical_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vertical_script_guardrails_vertical_id_fkey"
            columns: ["vertical_id"]
            isOneToOne: false
            referencedRelation: "brand_verticals"
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
      visit_products: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          store_id: string
          unit_type: string
          visit_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity?: number
          store_id: string
          unit_type?: string
          visit_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          store_id?: string
          unit_type?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_products_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visit_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_personas: {
        Row: {
          business_id: string | null
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          language: string | null
          language_profile_id: string | null
          name: string
          tone: string | null
          updated_at: string
          use_for_ai_calls: boolean | null
          use_for_ai_texts: boolean | null
          voice_profile_id: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          language?: string | null
          language_profile_id?: string | null
          name: string
          tone?: string | null
          updated_at?: string
          use_for_ai_calls?: boolean | null
          use_for_ai_texts?: boolean | null
          voice_profile_id?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          language?: string | null
          language_profile_id?: string | null
          name?: string
          tone?: string | null
          updated_at?: string
          use_for_ai_calls?: boolean | null
          use_for_ai_texts?: boolean | null
          voice_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_personas_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_personas_language_profile_id_fkey"
            columns: ["language_profile_id"]
            isOneToOne: false
            referencedRelation: "language_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_personas_voice_profile_id_fkey"
            columns: ["voice_profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_profiles: {
        Row: {
          business_id: string | null
          created_at: string
          description: string | null
          id: string
          is_founder_voice: boolean | null
          language: string | null
          name: string
          provider: string
          tone_presets: Json | null
          updated_at: string
          voice_model_id: string | null
          voice_type: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_founder_voice?: boolean | null
          language?: string | null
          name: string
          provider?: string
          tone_presets?: Json | null
          updated_at?: string
          voice_model_id?: string | null
          voice_type: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_founder_voice?: boolean | null
          language?: string | null
          name?: string
          provider?: string
          tone_presets?: Json | null
          updated_at?: string
          voice_model_id?: string | null
          voice_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_recordings: {
        Row: {
          created_at: string
          duration: number | null
          file_path: string
          id: string
          processed: boolean | null
          processing_status: string | null
          voice_profile_id: string
        }
        Insert: {
          created_at?: string
          duration?: number | null
          file_path: string
          id?: string
          processed?: boolean | null
          processing_status?: string | null
          voice_profile_id: string
        }
        Update: {
          created_at?: string
          duration?: number | null
          file_path?: string
          id?: string
          processed?: boolean | null
          processing_status?: string | null
          voice_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_recordings_voice_profile_id_fkey"
            columns: ["voice_profile_id"]
            isOneToOne: false
            referencedRelation: "voice_profiles"
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
      warehouse_bins: {
        Row: {
          aisle: string | null
          bin_code: string
          created_at: string | null
          description: string | null
          id: string
          max_weight: number | null
          shelf: string | null
          updated_at: string | null
          warehouse_id: string | null
          zone_id: string | null
        }
        Insert: {
          aisle?: string | null
          bin_code: string
          created_at?: string | null
          description?: string | null
          id?: string
          max_weight?: number | null
          shelf?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
          zone_id?: string | null
        }
        Update: {
          aisle?: string | null
          bin_code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          max_weight?: number | null
          shelf?: string | null
          updated_at?: string | null
          warehouse_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_bins_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_bins_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "warehouse_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_zones: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_zones_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_id: string | null
          capacity: number | null
          city: string | null
          code: string
          contact_phone: string | null
          country: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          state: string | null
          timezone: string | null
          type: string | null
          updated_at: string | null
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_id?: string | null
          capacity?: number | null
          city?: string | null
          code: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          state?: string | null
          timezone?: string | null
          type?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_id?: string | null
          capacity?: number | null
          city?: string | null
          code?: string
          contact_phone?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          state?: string | null
          timezone?: string | null
          type?: string | null
          updated_at?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      whisper_coaching_events: {
        Row: {
          agent_id: string
          created_at: string
          human_participant_id: string
          id: string
          session_id: string
          suggestion: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          human_participant_id: string
          id?: string
          session_id: string
          suggestion: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          human_participant_id?: string
          id?: string
          session_id?: string
          suggestion?: string
        }
        Relationships: [
          {
            foreignKeyName: "whisper_coaching_events_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whisper_coaching_events_human_participant_id_fkey"
            columns: ["human_participant_id"]
            isOneToOne: false
            referencedRelation: "call_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whisper_coaching_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_call_sessions"
            referencedColumns: ["id"]
          },
        ]
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
      wholesaler_payouts: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          net_amount: number
          paid_at: string | null
          payout_method: string | null
          payout_reference: string | null
          period_end: string | null
          period_start: string | null
          platform_fee: number | null
          status: string | null
          wholesaler_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          net_amount: number
          paid_at?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          platform_fee?: number | null
          status?: string | null
          wholesaler_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          net_amount?: number
          paid_at?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          platform_fee?: number | null
          status?: string | null
          wholesaler_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wholesaler_payouts_wholesaler_id_fkey"
            columns: ["wholesaler_id"]
            isOneToOne: false
            referencedRelation: "wholesaler_profiles"
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      worker_payout_lines: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          line_type: string
          payout_id: string
          ref_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description: string
          id?: string
          line_type: string
          payout_id: string
          ref_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          line_type?: string
          payout_id?: string
          ref_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_payout_lines_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "worker_payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_payouts: {
        Row: {
          adjustments: number | null
          approved_by_user_id: string | null
          business_id: string
          created_at: string
          debt_withheld: number | null
          id: string
          paid_at: string | null
          payout_method: string | null
          payout_reference: string | null
          period_end: string
          period_start: string
          status: string
          total_earned: number
          total_to_pay: number
          updated_at: string
          worker_id: string
          worker_type: string
        }
        Insert: {
          adjustments?: number | null
          approved_by_user_id?: string | null
          business_id: string
          created_at?: string
          debt_withheld?: number | null
          id?: string
          paid_at?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          period_end: string
          period_start: string
          status?: string
          total_earned?: number
          total_to_pay?: number
          updated_at?: string
          worker_id: string
          worker_type: string
        }
        Update: {
          adjustments?: number | null
          approved_by_user_id?: string | null
          business_id?: string
          created_at?: string
          debt_withheld?: number | null
          id?: string
          paid_at?: string | null
          payout_method?: string | null
          payout_reference?: string | null
          period_end?: string
          period_start?: string
          status?: string
          total_earned?: number
          total_to_pay?: number
          updated_at?: string
          worker_id?: string
          worker_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "worker_payouts_approved_by_user_id_fkey"
            columns: ["approved_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worker_payouts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
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
      backfill_final_results: { Args: never; Returns: number }
      can_access_brand: {
        Args: { _brand: string; _user_id: string }
        Returns: boolean
      }
      can_access_brand_by_user: {
        Args: { _brand_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_own_or_admin: {
        Args: { _owner_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_store: {
        Args: { _store_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_pitch_brand_to_store: {
        Args: { p_brand_id: string; p_store_id: string }
        Returns: boolean
      }
      expire_old_simulations: { Args: never; Returns: undefined }
      get_allowed_brands_for_store: {
        Args: { p_store_id: string }
        Returns: {
          brand_id: string
          brand_name: string
          vertical_name: string
        }[]
      }
      get_audit_summary: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
          role_type: Database["public"]["Enums"]["app_role"]
          user_email: string
          user_name: string
        }[]
      }
      get_store_full_address: { Args: { p_store_id: string }; Returns: string }
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
      get_vertical_guardrails: {
        Args: { p_vertical_slug: string }
        Returns: {
          guardrail_type: string
          guardrail_value: string
          priority: number
        }[]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_business_admin: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_business_member: {
        Args: { _business_id: string; _user_id: string }
        Returns: boolean
      }
      is_developer: { Args: { _user_id: string }; Returns: boolean }
      is_elevated_user: { Args: { _user_id: string }; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      log_audit_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type?: string
          p_metadata?: Json
        }
        Returns: string
      }
      log_security_event: {
        Args: { p_action: string; p_details?: Json }
        Returns: string
      }
      mark_overdue_followups: { Args: never; Returns: undefined }
      not_developer: { Args: { _user_id: string }; Returns: boolean }
      process_ai_approval: {
        Args: { p_approved: boolean; p_notes?: string; p_request_id: string }
        Returns: boolean
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
      request_ai_approval: {
        Args: {
          p_action_description: string
          p_ai_worker_id?: string
          p_payload?: Json
          p_request_type: string
          p_severity?: string
        }
        Returns: string
      }
      restore_deleted: {
        Args: { _record_id: string; _table_name: string }
        Returns: undefined
      }
      restore_soft_deleted: {
        Args: { p_id: string; p_table: string }
        Returns: undefined
      }
      soft_delete: {
        Args: { _record_id: string; _table_name: string }
        Returns: undefined
      }
      soft_delete_contact: { Args: { contact_id: string }; Returns: undefined }
      soft_delete_record: {
        Args: { p_id: string; p_table: string }
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
        | "owner"
        | "developer"
        | "staff"
        | "creator"
        | "va"
      bet_result: "pending" | "win" | "loss" | "push" | "void"
      bet_status: "simulated" | "approved" | "rejected" | "executed"
      brand_contact_role:
        | "owner"
        | "manager"
        | "buyer"
        | "assistant"
        | "accounting"
        | "marketing"
        | "decision_maker"
        | "other"
      brand_type: "GasMask" | "HotMama" | "GrabbaRUs" | "HotScalati"
      credit_terms_type: "COD" | "NET7" | "NET14" | "NET30"
      fulfillment_type:
        | "delivery"
        | "pickup"
        | "shipping"
        | "on_site_service"
        | "virtual"
        | "digital"
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
      market_type:
        | "spread"
        | "total"
        | "moneyline"
        | "player_prop"
        | "fantasy_prop"
      order_channel:
        | "web"
        | "mobile"
        | "admin"
        | "call_center"
        | "text"
        | "api"
        | "affiliate"
        | "store_portal"
        | "wholesaler_portal"
        | "other"
      order_status:
        | "draft"
        | "pending"
        | "confirmed"
        | "in_progress"
        | "completed"
        | "canceled"
        | "refunded"
      order_type:
        | "product"
        | "service"
        | "booking"
        | "subscription"
        | "application"
        | "other"
      org_role:
        | "owner"
        | "manager"
        | "inventory_staff"
        | "cashier"
        | "shipping_staff"
        | "support_staff"
        | "back_office"
      parlay_type: "sportsbook" | "pickem"
      payment_method: "cash" | "zelle" | "cashapp" | "venmo" | "other"
      payment_status: "unpaid" | "partial" | "paid" | "refunded" | "chargeback"
      payment_type: "pays_upfront" | "bill_to_bill"
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
      ut_employment_type:
        | "full_time"
        | "part_time"
        | "contractor"
        | "1099_hourly"
        | "per_event"
      ut_staff_category: "internal_staff" | "event_staff" | "vendor" | "partner"
      ut_staff_role:
        | "owner_managing_director"
        | "operations_director"
        | "event_production_manager"
        | "event_coordinator_lead"
        | "event_coordinator_assistant"
        | "client_success_manager"
        | "venue_relations_manager"
        | "vendor_relations_manager"
        | "partner_onboarding_specialist"
        | "rental_operations_manager"
        | "inventory_coordinator"
        | "setup_crew_lead"
        | "setup_crew_member"
        | "dj_coordinator"
        | "dj"
        | "mc_host"
        | "live_performer"
        | "catering_coordinator"
        | "bartending_manager"
        | "bartender"
        | "server"
        | "security_coordinator"
        | "security_guard"
        | "event_safety_supervisor"
        | "logistics_manager"
        | "driver"
        | "loader_runner"
        | "photography_coordinator"
        | "photographer"
        | "videographer"
        | "content_editor"
        | "finance_manager"
        | "accounts_payable_receivable"
        | "contracts_compliance_admin"
        | "crm_data_manager"
        | "marketing_manager"
        | "social_media_manager"
        | "influencer_ambassador_coordinator"
        | "virtual_assistant"
        | "customer_support_rep"
      ut_staff_status:
        | "active"
        | "inactive"
        | "pending"
        | "on_leave"
        | "terminated"
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
      visit_type:
        | "delivery"
        | "inventoryCheck"
        | "coldLead"
        | "followUp"
        | "order"
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
        "owner",
        "developer",
        "staff",
        "creator",
        "va",
      ],
      bet_result: ["pending", "win", "loss", "push", "void"],
      bet_status: ["simulated", "approved", "rejected", "executed"],
      brand_contact_role: [
        "owner",
        "manager",
        "buyer",
        "assistant",
        "accounting",
        "marketing",
        "decision_maker",
        "other",
      ],
      brand_type: ["GasMask", "HotMama", "GrabbaRUs", "HotScalati"],
      credit_terms_type: ["COD", "NET7", "NET14", "NET30"],
      fulfillment_type: [
        "delivery",
        "pickup",
        "shipping",
        "on_site_service",
        "virtual",
        "digital",
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
      loyalty_level_type: ["Bronze", "Silver", "Gold", "VIP"],
      market_type: [
        "spread",
        "total",
        "moneyline",
        "player_prop",
        "fantasy_prop",
      ],
      order_channel: [
        "web",
        "mobile",
        "admin",
        "call_center",
        "text",
        "api",
        "affiliate",
        "store_portal",
        "wholesaler_portal",
        "other",
      ],
      order_status: [
        "draft",
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "canceled",
        "refunded",
      ],
      order_type: [
        "product",
        "service",
        "booking",
        "subscription",
        "application",
        "other",
      ],
      org_role: [
        "owner",
        "manager",
        "inventory_staff",
        "cashier",
        "shipping_staff",
        "support_staff",
        "back_office",
      ],
      parlay_type: ["sportsbook", "pickem"],
      payment_method: ["cash", "zelle", "cashapp", "venmo", "other"],
      payment_status: ["unpaid", "partial", "paid", "refunded", "chargeback"],
      payment_type: ["pays_upfront", "bill_to_bill"],
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
      ut_employment_type: [
        "full_time",
        "part_time",
        "contractor",
        "1099_hourly",
        "per_event",
      ],
      ut_staff_category: ["internal_staff", "event_staff", "vendor", "partner"],
      ut_staff_role: [
        "owner_managing_director",
        "operations_director",
        "event_production_manager",
        "event_coordinator_lead",
        "event_coordinator_assistant",
        "client_success_manager",
        "venue_relations_manager",
        "vendor_relations_manager",
        "partner_onboarding_specialist",
        "rental_operations_manager",
        "inventory_coordinator",
        "setup_crew_lead",
        "setup_crew_member",
        "dj_coordinator",
        "dj",
        "mc_host",
        "live_performer",
        "catering_coordinator",
        "bartending_manager",
        "bartender",
        "server",
        "security_coordinator",
        "security_guard",
        "event_safety_supervisor",
        "logistics_manager",
        "driver",
        "loader_runner",
        "photography_coordinator",
        "photographer",
        "videographer",
        "content_editor",
        "finance_manager",
        "accounts_payable_receivable",
        "contracts_compliance_admin",
        "crm_data_manager",
        "marketing_manager",
        "social_media_manager",
        "influencer_ambassador_coordinator",
        "virtual_assistant",
        "customer_support_rep",
      ],
      ut_staff_status: [
        "active",
        "inactive",
        "pending",
        "on_leave",
        "terminated",
      ],
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
      visit_type: [
        "delivery",
        "inventoryCheck",
        "coldLead",
        "followUp",
        "order",
      ],
    },
  },
} as const
