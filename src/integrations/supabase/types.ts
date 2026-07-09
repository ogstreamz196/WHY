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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          created_at: string
          description: string
          emoji: string
          id: string
          name: string
          sort_order: number
          threshold: number | null
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          emoji: string
          id: string
          name: string
          sort_order?: number
          threshold?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          name?: string
          sort_order?: number
          threshold?: number | null
        }
        Relationships: []
      }
      app_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      boss_audit_log: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          emoji: string | null
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          emoji?: string | null
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          emoji?: string | null
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      category_interests: {
        Row: {
          category: string
          last_engaged_at: string
          user_id: string
          weight: number
        }
        Insert: {
          category: string
          last_engaged_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          category?: string
          last_engaged_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: []
      }
      chain_collection_items: {
        Row: {
          added_at: string
          chain_id: string
          collection_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          chain_id: string
          collection_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          chain_id?: string
          collection_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_collection_items_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "why_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "chain_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      chain_collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_missions: {
        Row: {
          bonus_awarded: boolean
          category_done: boolean
          category_key: string | null
          chain_done: boolean
          completed_at: string | null
          created_at: string
          id: string
          mission_date: string
          mystery_done: boolean
          surprise_done: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_awarded?: boolean
          category_done?: boolean
          category_key?: string | null
          chain_done?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_date: string
          mystery_done?: boolean
          surprise_done?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_awarded?: boolean
          category_done?: boolean
          category_key?: string | null
          chain_done?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          mission_date?: string
          mystery_done?: boolean
          surprise_done?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discoveries: {
        Row: {
          fact_id: string
          id: string
          seen_at: string
          user_id: string
        }
        Insert: {
          fact_id: string
          id?: string
          seen_at?: string
          user_id: string
        }
        Update: {
          fact_id?: string
          id?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discoveries_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
        ]
      }
      facts: {
        Row: {
          answer: string
          category: string | null
          code: string
          code_seq: number
          created_at: string
          fun_fact: string | null
          id: string
          is_adult: boolean
          question: string
          sheet_id: string | null
          source: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string | null
          code: string
          code_seq: number
          created_at?: string
          fun_fact?: string | null
          id?: string
          is_adult?: boolean
          question: string
          sheet_id?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string | null
          code?: string
          code_seq?: number
          created_at?: string
          fun_fact?: string | null
          id?: string
          is_adult?: boolean
          question?: string
          sheet_id?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          fact_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fact_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fact_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_questions: {
        Row: {
          answer: string | null
          category: string | null
          created_at: string
          fact_id: string | null
          fun_fact: string | null
          id: string
          question: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          category?: string | null
          created_at?: string
          fact_id?: string | null
          fun_fact?: string | null
          id?: string
          question: string
          user_id: string
        }
        Update: {
          answer?: string | null
          category?: string | null
          created_at?: string
          fact_id?: string | null
          fun_fact?: string | null
          id?: string
          question?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generated_questions_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          adult_provider: string | null
          adult_verified_at: string | null
          age_band: string | null
          avatar_id: string
          bio: string | null
          created_at: string
          display_name: string | null
          favorite_category: string | null
          hide_from_public: boolean
          id: string
          leaderboard_opt_out: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          adult_provider?: string | null
          adult_verified_at?: string | null
          age_band?: string | null
          avatar_id?: string
          bio?: string | null
          created_at?: string
          display_name?: string | null
          favorite_category?: string | null
          hide_from_public?: boolean
          id: string
          leaderboard_opt_out?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          adult_provider?: string | null
          adult_verified_at?: string | null
          age_band?: string | null
          avatar_id?: string
          bio?: string | null
          created_at?: string
          display_name?: string | null
          favorite_category?: string | null
          hide_from_public?: boolean
          id?: string
          leaderboard_opt_out?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          correct: boolean
          created_at: string
          fact_id: string
          id: string
          ms_taken: number
          picked_index: number
          points_awarded: number
          session_id: string
          user_id: string
        }
        Insert: {
          correct: boolean
          created_at?: string
          fact_id: string
          id?: string
          ms_taken?: number
          picked_index: number
          points_awarded?: number
          session_id: string
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          fact_id?: string
          id?: string
          ms_taken?: number
          picked_index?: number
          points_awarded?: number
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          category: string | null
          correct_answer: string
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          distractors: string[]
          explanation: string | null
          fact_id: string
          generated_at: string
          id: string
        }
        Insert: {
          category?: string | null
          correct_answer: string
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          distractors: string[]
          explanation?: string | null
          fact_id: string
          generated_at?: string
          id?: string
        }
        Update: {
          category?: string | null
          correct_answer?: string
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          distractors?: string[]
          explanation?: string | null
          fact_id?: string
          generated_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: true
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          accuracy: number
          answer_order: number[]
          category: string | null
          correct_count: number
          created_at: string
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          fact_ids: string[]
          finished_at: string | null
          id: string
          question_count: number
          score: number
          started_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number
          answer_order?: number[]
          category?: string | null
          correct_count?: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          fact_ids?: string[]
          finished_at?: string | null
          id?: string
          question_count?: number
          score?: number
          started_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number
          answer_order?: number[]
          category?: string | null
          correct_count?: number
          created_at?: string
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          fact_ids?: string[]
          finished_at?: string | null
          id?: string
          question_count?: number
          score?: number
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_stats: {
        Row: {
          best_score: number
          best_streak: number
          categories_answered: string[]
          correct_answered: number
          current_streak: number
          fast_correct: number
          favorite_category: string | null
          questions_answered: number
          total_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_score?: number
          best_streak?: number
          categories_answered?: string[]
          correct_answered?: number
          current_streak?: number
          fast_correct?: number
          favorite_category?: string | null
          questions_answered?: number
          total_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_score?: number
          best_streak?: number
          categories_answered?: string[]
          correct_answered?: number
          current_streak?: number
          fast_correct?: number
          favorite_category?: string | null
          questions_answered?: number
          total_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          signup_bonus_awarded: boolean
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id: string
          paddle_subscription_id: string
          price_id: string
          product_id: string
          signup_bonus_awarded?: boolean
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string
          paddle_subscription_id?: string
          price_id?: string
          product_id?: string
          signup_bonus_awarded?: boolean
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          adult_mode_enabled: boolean
          avatar_id: string
          child_mode: boolean
          dark_mode: boolean
          reading_level: string
          sound: boolean
          theme_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adult_mode_enabled?: boolean
          avatar_id?: string
          child_mode?: boolean
          dark_mode?: boolean
          reading_level?: string
          sound?: boolean
          theme_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adult_mode_enabled?: boolean
          avatar_id?: string
          child_mode?: boolean
          dark_mode?: boolean
          reading_level?: string
          sound?: boolean
          theme_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          current_streak: number
          facts_seen: number
          last_active_day: string | null
          last_daily_challenge_day: string | null
          last_login_bonus_day: string | null
          longest_streak: number
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          facts_seen?: number
          last_active_day?: string | null
          last_daily_challenge_day?: string | null
          last_login_bonus_day?: string | null
          longest_streak?: number
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          facts_seen?: number
          last_active_day?: string | null
          last_daily_challenge_day?: string | null
          last_login_bonus_day?: string | null
          longest_streak?: number
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      why_chain_steps: {
        Row: {
          answer: string | null
          chain_id: string
          created_at: string
          fact_id: string | null
          id: string
          position: number
          question: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          chain_id: string
          created_at?: string
          fact_id?: string | null
          id?: string
          position: number
          question: string
          user_id: string
        }
        Update: {
          answer?: string | null
          chain_id?: string
          created_at?: string
          fact_id?: string | null
          id?: string
          position?: number
          question?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "why_chain_steps_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "why_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "why_chain_steps_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
        ]
      }
      why_chains: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          pinned: boolean
          root_fact_id: string | null
          share_slug: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          pinned?: boolean
          root_fact_id?: string | null
          share_slug?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          pinned?: boolean
          root_fact_id?: string | null
          share_slug?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "why_chains_root_fact_id_fkey"
            columns: ["root_fact_id"]
            isOneToOne: false
            referencedRelation: "facts"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          category: string | null
          created_at: string
          id: string
          points: number
          source: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          points: number
          source: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          points?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      leaderboard_category: {
        Row: {
          age_band: string | null
          avatar_id: string | null
          category: string | null
          display_name: string | null
          score: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      leaderboard_global: {
        Row: {
          age_band: string | null
          avatar_id: string | null
          current_streak: number | null
          display_name: string | null
          facts_seen: number | null
          favorite_category: string | null
          longest_streak: number | null
          score: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      leaderboard_new: {
        Row: {
          age_band: string | null
          avatar_id: string | null
          display_name: string | null
          favorite_category: string | null
          joined_at: string | null
          score: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      leaderboard_rising: {
        Row: {
          age_band: string | null
          avatar_id: string | null
          display_name: string | null
          favorite_category: string | null
          score: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      leaderboard_streaks: {
        Row: {
          age_band: string | null
          avatar_id: string | null
          display_name: string | null
          favorite_category: string | null
          longest_streak: number | null
          score: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      leaderboard_weekend: {
        Row: {
          age_band: string | null
          avatar_id: string | null
          display_name: string | null
          favorite_category: string | null
          score: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
      leaderboard_weekly: {
        Row: {
          avatar_id: string | null
          best_this_week: number | null
          display_name: string | null
          quizzes_played: number | null
          user_id: string | null
          username: string | null
          week_score: number | null
        }
        Relationships: []
      }
      leaderboard_windowed: {
        Row: {
          age_band: string | null
          avatar_id: string | null
          created_at: string | null
          display_name: string | null
          favorite_category: string | null
          score: number | null
          user_id: string | null
          username: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      boss_decode_fact_code: {
        Args: { _code: string }
        Returns: {
          answer: string
          category: string
          code: string
          code_seq: number
          created_at: string
          fun_fact: string
          id: string
          question: string
          source: string
        }[]
      }
      count_unseen_facts: {
        Args: { _category?: string; _user: string }
        Returns: number
      }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
      is_adult_verified: { Args: { _uid: string }; Returns: boolean }
      is_boss: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      quiz_difficulty: "easy" | "medium" | "hard" | "expert"
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
      quiz_difficulty: ["easy", "medium", "hard", "expert"],
    },
  },
} as const
